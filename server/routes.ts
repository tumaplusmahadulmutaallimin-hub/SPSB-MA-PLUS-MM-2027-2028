import express, { Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import {
  loadDatabase,
  saveDatabase,
  addActivityLog,
  backupDatabase,
  restoreDatabase,
  getLastSetupCredentials,
  clearLastSetupCredentials,
  ONLINE_WINDOW_MS,
  isValidSafeUrl,
  addPortalEvent,
  pruneAndUpdateSessionStatuses,
  upsertUserSession,
} from './db.js';
import {
  login,
  changeInitialPassword,
  verifySession,
  logout,
  getAuthStatus,
  firstTimeAccess,
  setupPersonalAccount,
} from './auth.js';
import type {
  Category,
  ServiceLink,
  Registration,
  Announcement,
  DocumentItem,
  User,
  StudentAchievement,
  CommitteeContact,
  MadrasahAchievement,
  MonitoringSummary,
  DatabaseSchema,
  PortalEventType,
} from '../src/types/index.js';
import {
  generateUUID,
  hashPasswordSync,
  generateSalt,
  validatePasswordStrength,
} from '../src/lib/crypto.js';
import { getAllGasFiles } from './gasTemplates.js';
import { OFFICIAL_BRAND_ASSETS, getSvgDataUrl } from '../src/lib/brandAssets.js';

export const apiRouter = express.Router();

// Ensure zero HTTP/CDN caching across API routes so admin updates propagate immediately
apiRouter.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const routerJsonParser = express.json({ limit: '15mb' });
const routerTextParser = express.text({ type: 'text/plain', limit: '64kb' });
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const anyReq = req as any;
  const hasParsedObject =
    req.body !== null && typeof req.body === 'object' && Object.keys(req.body).length > 0;
  const hasParsedString = typeof req.body === 'string' && req.body.length > 0;

  if (anyReq._body || hasParsedObject || hasParsedString) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // leave as string
      }
    }
    anyReq._body = true;
    next();
    return;
  }
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.startsWith('text/plain')) {
    routerTextParser(req, res, (err) => {
      if (err) {
        next(err);
        return;
      }
      if (typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch {
          req.body = {};
        }
      }
      next();
    });
    return;
  }
  routerJsonParser(req, res, next);
});

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket?.remoteAddress || '127.0.0.1').slice(0, 64);
}

function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

function resolveRequestActor(req: Request): {
  actorType: 'anonymous' | 'authenticated';
  user?: User;
  username: string;
  role: string;
} {
  const token = getBearerToken(req);
  if (token) {
    const verified = verifySession(token);
    if (verified && !verified.mustChangePassword) {
      return {
        actorType: 'authenticated',
        user: verified.user,
        username: verified.user.username,
        role: verified.user.role,
      };
    }
  }
  return {
    actorType: 'anonymous',
    username: 'Pengunjung Publik',
    role: 'visitor',
  };
}

function getPeriodStartMs(period: 'today' | '7d' | '30d' | 'all'): number {
  const now = new Date();
  if (period === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startOfDay.getTime();
  }
  if (period === '7d') {
    return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  }
  if (period === '30d') {
    return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  }
  return 0;
}

function computeMonitoringSummary(
  db: DatabaseSchema,
  period: 'today' | '7d' | '30d' | 'all' = '7d'
): MonitoringSummary {
  const startMs = getPeriodStartMs(period);
  const inPeriod = (iso?: string) => {
    if (!iso) return period === 'all';
    if (period === 'all') return true;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= startMs;
  };

  const visitorsInPeriod = (db.VISITORS || []).filter((v) => inPeriod(v.timestamp));
  const uniqueVisitorSet = new Set(visitorsInPeriod.map((v) => v.visitorId).filter(Boolean));
  const allHistoricalVisitorSet = new Set<string>([
    ...(db.VISITORS || []).map((v) => v.visitorId).filter(Boolean),
    ...(db.USER_SESSIONS || []).map((s) => s.visitorId).filter(Boolean),
  ]);

  const nowMs = Date.now();
  const sessions = [...(db.USER_SESSIONS || [])].sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  );

  const onlineSessions = sessions.filter(
    (s) => s.status === 'online' && nowMs - new Date(s.lastActiveAt).getTime() <= ONLINE_WINDOW_MS
  );
  const offlineSessions = sessions.filter(
    (s) => s.status === 'offline' || nowMs - new Date(s.lastActiveAt).getTime() > ONLINE_WINDOW_MS
  );

  const onlineActorKeys = new Set(
    onlineSessions.map((s) => (s.actorType === 'authenticated' && s.userId ? `user:${s.userId}` : `vis:${s.visitorId}`))
  );
  const loggedInUserIds = new Set(
    onlineSessions
      .filter((s) => s.actorType === 'authenticated')
      .map((s) => s.userId || s.username)
  );

  const events = (db.PORTAL_EVENTS || []).filter((e) => inPeriod(e.timestamp));
  const loginHistory = (db.PORTAL_EVENTS || [])
    .filter((e) => e.eventType === 'AUTH_LOGIN' || e.eventType === 'AUTH_LOGIN_FAILED' || e.eventType === 'AUTH_LOGOUT')
    .slice(0, 50);

  const clicksInPeriod = (db.LINK_CLICKS || []).filter((c) => inPeriod(c.timestamp)).length;
  const eventDownloads = events.filter((e) => e.eventType === 'DOCUMENT_DOWNLOAD').length;
  const docTotalDownloads = (db.DOCUMENTS || []).reduce((sum, d) => sum + (d.downloadCount || 0), 0);

  // Daily visits breakdown (respecting period window: 1d, 7d, 30d, or 14d for all)
  const daysCount = period === 'today' ? 1 : period === '30d' ? 30 : period === '7d' ? 7 : 14;
  const nowDate = new Date();
  const dailyVisits: { date: string; label: string; count: number; uniqueCount: number }[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(nowDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    const dayRecords = (db.VISITORS || []).filter((v) => v.timestamp.startsWith(dateStr));
    const uniqueDayCount = new Set(dayRecords.map((r) => r.visitorId).filter(Boolean)).size;
    dailyVisits.push({
      date: dateStr,
      label: dayLabel,
      count: dayRecords.length,
      uniqueCount: uniqueDayCount,
    });
  }

  const topServices = [...(db.LINKS || [])]
    .sort((a, b) => (b.clicksCount || 0) - (a.clicksCount || 0))
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      name: l.name,
      clicksCount: l.clicksCount || 0,
      targetUrl: l.targetUrl,
      categoryName: (db.CATEGORIES || []).find((c) => c.id === l.categoryId)?.name || 'Umum',
    }));

  const categoryClicks = (db.CATEGORIES || []).map((cat) => {
    const count = (db.LINK_CLICKS || []).filter((lc) => lc.categoryId === cat.id && inPeriod(lc.timestamp)).length;
    return { categoryName: cat.name, count };
  });

  return {
    period,
    totalVisits: visitorsInPeriod.length,
    uniqueVisitors: uniqueVisitorSet.size,
    activeUsersNow: onlineActorKeys.size,
    onlineUsersCount: onlineSessions.length,
    offlineUsersCount: offlineSessions.length,
    loggedInUsersCount: loggedInUserIds.size,
    historicalUsersCount: allHistoricalVisitorSet.size,
    registeredUsersCount: (db.USERS || []).filter((u) => u.isActive).length,
    totalClicks: period === 'all' ? Math.max(clicksInPeriod, (db.LINKS || []).reduce((s, l) => s + (l.clicksCount || 0), 0)) : clicksInPeriod,
    totalDownloads: period === 'all' ? Math.max(docTotalDownloads, eventDownloads) : eventDownloads,
    sessions: sessions.slice(0, 100),
    recentEvents: events.slice(0, 100),
    loginHistory,
    dailyVisits,
    topServices,
    categoryClicks,
    systemStatus: {
      apiOk: true,
      cloudConnected: false,
      lastUpdatedAt: new Date().toISOString(),
      onlineWindowSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
    },
  };
}

// Auth Middleware for Protected Routes
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({ error: 'Token autentikasi tidak ditemukan.' });
    return;
  }

  const session = verifySession(token);
  if (!session) {
    res.status(401).json({ error: 'Sesi Anda telah berakhir. Silakan login kembali.' });
    return;
  }

  if (session.mustChangePassword && !req.path.includes('/change-initial-password') && !req.path.includes('/setup-personal-account')) {
    res.status(403).json({
      error: 'Anda diwajibkan membuat akun administrator pribadi sebelum dapat mengakses dashboard.',
      mustChangePassword: true,
      mustCreatePersonalAccount: true,
    });
    return;
  }

  (req as any).currentUser = session.user;
  next();
}

// RBAC Middleware: restrict administrative & destructive actions from operator accounts
function requireAdminRole(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).currentUser as User | undefined;
  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    res.status(403).json({
      error: 'Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator atau Super Administrator.',
    });
    return;
  }
  next();
}

// ----------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Portal Digital Terpadu API', timestamp: new Date().toISOString() });
});

// ----------------------------------------------------
// PUBLIC ENDPOINTS (No login needed)
// ----------------------------------------------------

/**
 * Public portal payload
 */
apiRouter.get('/public/portal', (_req: Request, res: Response) => {
  const db = loadDatabase();
  const activeCategories = db.CATEGORIES
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);

  const activeLinks = db.LINKS
    .filter((l) => l.isActive)
    .sort((a, b) => a.order - b.order);

  const activeAnnouncements = db.ANNOUNCEMENTS
    .filter((a) => a.status === 'published')
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());

  const activeRegistrations = db.REGISTRATIONS
    .filter((r) => r.isActive)
    .sort((a, b) => a.order - b.order);

  const activeDocuments = db.DOCUMENTS
    .filter((d) => d.isActive)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeMadrasahAchievements = (db.MADRASAH_ACHIEVEMENTS || [])
    .filter((a) => a.isActive)
    .sort((a, b) => a.order - b.order);

  const activeCommitteeContacts = (db.COMMITTEE_CONTACTS || []).filter(
    (c) => c.isAvailable !== false
  );

  res.json({
    siteSettings: db.SITE_SETTINGS,
    qrSettings: {
      portalUrl: db.QR_SETTINGS.portalUrl,
      size: db.QR_SETTINGS.size,
      foregroundColor: db.QR_SETTINGS.foregroundColor,
      backgroundColor: db.QR_SETTINGS.backgroundColor,
      errorCorrectionLevel: db.QR_SETTINGS.errorCorrectionLevel,
      posterTitle: db.QR_SETTINGS.posterTitle,
      posterSubtitle: db.QR_SETTINGS.posterSubtitle,
      posterFooter: db.QR_SETTINGS.posterFooter,
    },
    categories: activeCategories,
    links: activeLinks,
    announcements: activeAnnouncements,
    registrations: activeRegistrations,
    documents: activeDocuments,
    committeeContacts: activeCommitteeContacts,
    achievementsCount: db.STUDENT_ACHIEVEMENTS?.length || 0,
    madrasahAchievements: activeMadrasahAchievements,
  });
});

/**
 * Real-time user session heartbeat (updates lastActiveAt, currentPath/menu, status=online)
 */
apiRouter.post('/public/session/heartbeat', (req: Request, res: Response) => {
  const {
    sessionId,
    visitorId,
    currentPath = '/',
    currentMenu = 'Portal Publik',
    incrementPageViews = 0,
    incrementActions = 0,
  } = req.body || {};

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId wajib disertakan.' });
    return;
  }

  const actor = resolveRequestActor(req);
  const db = loadDatabase();
  pruneAndUpdateSessionStatuses(db);

  const sessionRecord = upsertUserSession(db, {
    sessionId: sessionId.trim(),
    visitorId: typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim() : 'anonymous',
    actorType: actor.actorType,
    userId: actor.user?.id,
    username: actor.username,
    role: actor.role,
    status: 'online',
    currentPath: String(currentPath || '/').slice(0, 200),
    currentMenu: String(currentMenu || 'Portal Publik').slice(0, 120),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ipAddress: getClientIp(req),
    incrementPageViews: Number(incrementPageViews) > 0 ? Math.min(5, Number(incrementPageViews)) : 0,
    incrementActions: Number(incrementActions) > 0 ? Math.min(20, Number(incrementActions)) : 0,
  });

  saveDatabase(db);
  res.json({
    success: true,
    session: sessionRecord,
    onlineWindowSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
  });
});

/**
 * Mark user session offline (compatible with navigator.sendBeacon & fetch keepalive)
 */
apiRouter.post('/public/session/offline', (req: Request, res: Response) => {
  const { sessionId, visitorId, currentPath, currentMenu } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId wajib disertakan.' });
    return;
  }

  const actor = resolveRequestActor(req);
  const db = loadDatabase();
  const cleanSessionId = sessionId.trim().slice(0, 128);
  const existing = (db.USER_SESSIONS || []).find((s) => s.sessionId === cleanSessionId);

  if (existing) {
    existing.status = 'offline';
    const nowIso = new Date().toISOString();
    existing.endedAt = nowIso;
    existing.lastActiveAt = nowIso;
    if (typeof currentPath === 'string') existing.currentPath = currentPath.slice(0, 200);
    if (typeof currentMenu === 'string') existing.currentMenu = currentMenu.slice(0, 120);
    const startMs = new Date(existing.firstSeenAt).getTime();
    if (Number.isFinite(startMs)) {
      existing.durationSeconds = Math.max(existing.durationSeconds || 0, Math.round((Date.now() - startMs) / 1000));
    }
    saveDatabase(db);
    res.json({ success: true, session: existing });
    return;
  }

  const created = upsertUserSession(db, {
    sessionId: cleanSessionId,
    visitorId: typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim() : 'anonymous',
    actorType: actor.actorType,
    userId: actor.user?.id,
    username: actor.username,
    role: actor.role,
    status: 'offline',
    currentPath: typeof currentPath === 'string' ? currentPath : '/',
    currentMenu: typeof currentMenu === 'string' ? currentMenu : 'Portal Publik',
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, session: created });
});

/**
 * Track deduplicated visitor arrival
 */
apiRouter.post('/public/visit', (req: Request, res: Response) => {
  const { visitorId = 'anonymous', sessionId = '', visitId = '', path = '/', referrer = '' } = req.body || {};
  const cleanVisitorId = String(visitorId || 'anonymous').trim().slice(0, 128);
  const cleanPath = String(path || '/').slice(0, 200);
  const cleanSessionId = String(sessionId || cleanVisitorId).trim().slice(0, 128);
  const cleanVisitId = typeof visitId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(visitId.trim()) ? visitId.trim() : '';

  const db = loadDatabase();
  const actor = resolveRequestActor(req);
  const nowMs = Date.now();
  const VISIT_DEDUP_WINDOW_MS = 30 * 60 * 1000;

  const isDuplicate = db.VISITORS.some((v) => {
    if (cleanVisitId && v.id === cleanVisitId) return true;
    const vTime = new Date(v.timestamp).getTime();
    return (
      v.visitorId === cleanVisitorId &&
      v.path === cleanPath &&
      Number.isFinite(vTime) &&
      nowMs - vTime < VISIT_DEDUP_WINDOW_MS
    );
  });

  if (!isDuplicate) {
    const record = {
      id: cleanVisitId || generateUUID(),
      timestamp: new Date(nowMs).toISOString(),
      visitorId: cleanVisitorId,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      referrer: String(referrer || req.headers.referer || '').slice(0, 300),
      path: cleanPath,
    };

    db.VISITORS.push(record);
    if (db.VISITORS.length > 10000) {
      db.VISITORS = db.VISITORS.slice(db.VISITORS.length - 10000);
    }

    addPortalEvent(db, {
      sessionId: cleanSessionId,
      visitorId: cleanVisitorId,
      actorType: actor.actorType,
      username: actor.username,
      role: actor.role,
      eventType: 'PORTAL_VISIT',
      path: cleanPath,
      details: `Kunjungan portal pada ${cleanPath}`,
    });
  }

  upsertUserSession(db, {
    sessionId: cleanSessionId,
    visitorId: cleanVisitorId,
    actorType: actor.actorType,
    userId: actor.user?.id,
    username: actor.username,
    role: actor.role,
    status: 'online',
    currentPath: cleanPath,
    currentMenu: actor.actorType === 'authenticated' ? 'Dashboard Administrator' : 'Portal Publik',
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ipAddress: getClientIp(req),
    incrementPageViews: isDuplicate ? 0 : 1,
  });

  saveDatabase(db);
  res.json({ success: true, deduplicated: isDuplicate });
});

/**
 * Record allowlisted public/authenticated interaction event (menu switches, modals, etc.)
 */
apiRouter.post('/public/event', (req: Request, res: Response) => {
  const {
    sessionId = '',
    visitorId = 'anonymous',
    eventType = 'MENU_NAVIGATE',
    targetId = '',
    targetName = '',
    categoryId = '',
    path = '/',
    details = '',
  } = req.body || {};

  const allowedTypes: PortalEventType[] = [
    'MENU_NAVIGATE',
    'SERVICE_CLICK',
    'DOCUMENT_DOWNLOAD',
    'ACHIEVEMENT_SUBMIT',
  ];
  if (!allowedTypes.includes(eventType as PortalEventType)) {
    res.status(400).json({ error: 'Jenis event tidak diizinkan pada endpoint publik.' });
    return;
  }

  const actor = resolveRequestActor(req);
  const db = loadDatabase();
  const cleanSessionId = String(sessionId || visitorId || 'anonymous').trim().slice(0, 128);
  const cleanVisitorId = String(visitorId || 'anonymous').trim().slice(0, 128);
  const cleanTargetName = String(targetName || '').trim().slice(0, 200);
  const cleanPath = String(path || '/').slice(0, 200);

  const event = addPortalEvent(db, {
    sessionId: cleanSessionId,
    visitorId: cleanVisitorId,
    actorType: actor.actorType,
    username: actor.username,
    role: actor.role,
    eventType: eventType as PortalEventType,
    targetId: targetId ? String(targetId).slice(0, 128) : undefined,
    targetName: cleanTargetName || undefined,
    categoryId: categoryId ? String(categoryId).slice(0, 128) : undefined,
    path: cleanPath,
    details: String(details || `${eventType}: ${cleanTargetName || cleanPath}`).slice(0, 500),
  });

  upsertUserSession(db, {
    sessionId: cleanSessionId,
    visitorId: cleanVisitorId,
    actorType: actor.actorType,
    userId: actor.user?.id,
    username: actor.username,
    role: actor.role,
    status: 'online',
    currentPath: cleanPath,
    currentMenu: cleanTargetName || undefined,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ipAddress: getClientIp(req),
    incrementActions: 1,
  });

  saveDatabase(db);
  res.json({ success: true, eventId: event.id });
});

/**
 * Track link click
 */
apiRouter.post('/public/click/:linkId', (req: Request, res: Response) => {
  const { linkId } = req.params;
  const { visitorId = 'anonymous', sessionId = '' } = req.body || {};
  const db = loadDatabase();

  const link = db.LINKS.find((l) => l.id === linkId);
  if (!link) {
    res.status(404).json({ error: 'Tautan layanan tidak ditemukan.' });
    return;
  }

  const actor = resolveRequestActor(req);
  const cleanVisitorId = String(visitorId || 'anonymous').trim().slice(0, 128);
  const cleanSessionId = String(sessionId || cleanVisitorId).trim().slice(0, 128);

  link.clicksCount = (link.clicksCount || 0) + 1;
  link.updatedAt = new Date().toISOString();

  db.LINK_CLICKS.push({
    id: generateUUID(),
    linkId: link.id,
    linkName: link.name,
    categoryId: link.categoryId,
    timestamp: new Date().toISOString(),
    visitorId: cleanVisitorId,
  });

  if (db.LINK_CLICKS.length > 10000) {
    db.LINK_CLICKS = db.LINK_CLICKS.slice(db.LINK_CLICKS.length - 10000);
  }

  addPortalEvent(db, {
    sessionId: cleanSessionId,
    visitorId: cleanVisitorId,
    actorType: actor.actorType,
    username: actor.username,
    role: actor.role,
    eventType: 'SERVICE_CLICK',
    targetId: link.id,
    targetName: link.name,
    categoryId: link.categoryId,
    path: '/',
    details: `Mengakses layanan "${link.name}"`,
  });

  upsertUserSession(db, {
    sessionId: cleanSessionId,
    visitorId: cleanVisitorId,
    actorType: actor.actorType,
    userId: actor.user?.id,
    username: actor.username,
    role: actor.role,
    status: 'online',
    currentMenu: `Layanan: ${link.name}`,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ipAddress: getClientIp(req),
    incrementActions: 1,
  });

  saveDatabase(db);
  res.json({ success: true, targetUrl: link.targetUrl, targetOpen: link.targetOpen });
});

/**
 * Track document download
 */
apiRouter.post('/public/download/:docId', (req: Request, res: Response) => {
  const { docId } = req.params;
  const { visitorId = 'anonymous', sessionId = '' } = req.body || {};
  const db = loadDatabase();

  const doc = db.DOCUMENTS.find((d) => d.id === docId);
  if (!doc) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }

  const actor = resolveRequestActor(req);
  const cleanVisitorId = String(visitorId || 'anonymous').trim().slice(0, 128);
  const cleanSessionId = String(sessionId || cleanVisitorId).trim().slice(0, 128);

  doc.downloadCount = (doc.downloadCount || 0) + 1;
  doc.updatedAt = new Date().toISOString();

  addPortalEvent(db, {
    sessionId: cleanSessionId,
    visitorId: cleanVisitorId,
    actorType: actor.actorType,
    username: actor.username,
    role: actor.role,
    eventType: 'DOCUMENT_DOWNLOAD',
    targetId: doc.id,
    targetName: doc.title,
    path: '/#documents',
    details: `Mengunduh dokumen "${doc.title}" (${doc.fileType})`,
  });

  upsertUserSession(db, {
    sessionId: cleanSessionId,
    visitorId: cleanVisitorId,
    actorType: actor.actorType,
    userId: actor.user?.id,
    username: actor.username,
    role: actor.role,
    status: 'online',
    currentMenu: `Unduh: ${doc.title}`,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ipAddress: getClientIp(req),
    incrementActions: 1,
  });

  saveDatabase(db);
  res.json({ success: true, fileUrl: doc.fileUrl });
});

/**
 * Generate QR code on the fly
 */
apiRouter.get('/public/qr-image', async (req: Request, res: Response) => {
  try {
    const db = loadDatabase();
    const portalUrl = (req.query.url as string) || db.QR_SETTINGS.portalUrl || `${req.protocol}://${req.get('host')}`;
    const darkColor = (req.query.dark as string) || db.QR_SETTINGS.foregroundColor || '#065f46';
    const lightColor = (req.query.light as string) || db.QR_SETTINGS.backgroundColor || '#ffffff';
    const size = parseInt(req.query.size as string, 10) || 320;

    const dataUrl = await QRCode.toDataURL(portalUrl, {
      width: size,
      margin: 2,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: db.QR_SETTINGS.errorCorrectionLevel || 'H',
    });

    res.json({ dataUrl, portalUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------

/**
 * Check if the custom administrator account has already been initialized
 */
apiRouter.get('/auth/status', (_req: Request, res: Response) => {
  const status = getAuthStatus();
  res.json(status);
});

/**
 * 1-Click Instant First-Time Access:
 * Allows entry to setup personal account without prior password
 */
apiRouter.post('/auth/first-time-access', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';
  const result = firstTimeAccess(clientIp);

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json(result);
});

/**
 * Setup Personal Administrator User:
 * Custom username, full name, email, and password.
 * Locks the 1-click door permanently for privacy and security.
 */
apiRouter.post('/auth/setup-personal-account', (req: Request, res: Response) => {
  const { newUsername, fullName, email, newPassword, confirmPassword } = req.body;
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let userId: string | undefined;
  if (token) {
    const session = verifySession(token);
    if (session) {
      userId = session.user.id;
    }
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';
  const result = setupPersonalAccount({
    userId,
    newUsername,
    fullName,
    email,
    newPassword,
    confirmPassword,
    ip: clientIp,
  });

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    message: 'Akun administrator pribadi berhasil dibuat! Selamat datang di Dashboard.',
    session: result.session,
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password, sessionId, visitorId, path } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  const clientIp = getClientIp(req);
  const result = login(username, password, clientIp, {
    sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    visitorId: typeof visitorId === 'string' ? visitorId : undefined,
    userAgent: String(req.headers['user-agent'] || ''),
    path: typeof path === 'string' ? path : '/admin',
  });

  if (!result.success) {
    res.status(401).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    mustChangePassword: result.mustChangePassword,
    session: result.session,
  });
});

apiRouter.post('/auth/change-initial-password', (req: Request, res: Response) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const session = verifySession(token);
  if (!session) {
    res.status(401).json({ error: 'Sesi tidak valid.' });
    return;
  }

  const clientIp = getClientIp(req);
  const result = changeInitialPassword(
    session.user.id,
    currentPassword,
    newPassword,
    confirmPassword,
    clientIp
  );

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    message: 'Password berhasil diubah. Selamat datang di Dashboard!',
    session: result.session,
  });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const token = getBearerToken(req);

  const session = verifySession(token);
  if (!session) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
    return;
  }

  res.json({
    user: {
      id: session.user.id,
      username: session.user.username,
      fullName: session.user.fullName,
      role: session.user.role,
      mustChangePassword: session.mustChangePassword,
    },
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const token = getBearerToken(req);
  const { sessionId, visitorId } = req.body || {};
  if (token) {
    logout(token, {
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      visitorId: typeof visitorId === 'string' ? visitorId : undefined,
      ip: getClientIp(req),
      userAgent: String(req.headers['user-agent'] || ''),
    });
  }
  res.json({ success: true });
});

/**
 * Returns temporary credentials if the admin was newly created and hasn't logged in yet
 */
apiRouter.get('/auth/setup-info', (_req: Request, res: Response) => {
  const creds = getLastSetupCredentials();
  res.json({ credentials: creds });
});

apiRouter.post('/auth/clear-setup-info', (_req: Request, res: Response) => {
  clearLastSetupCredentials();
  res.json({ success: true });
});

// ----------------------------------------------------
// PROTECTED ADMIN ENDPOINTS
// ----------------------------------------------------

/**
 * Real-time user monitoring & comprehensive analytics summary
 */
apiRouter.get('/admin/monitoring', requireAuth, (req: Request, res: Response) => {
  const rawPeriod = String(req.query.period || '7d');
  const period: 'today' | '7d' | '30d' | 'all' =
    rawPeriod === 'today' || rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === 'all'
      ? rawPeriod
      : '7d';

  const db = loadDatabase();
  const changed = pruneAndUpdateSessionStatuses(db);
  if (changed) {
    saveDatabase(db);
  }

  const summary = computeMonitoringSummary(db, period);
  res.json(summary);
});

/**
 * Overview statistics (backwards compatible + session-aware)
 */
apiRouter.get('/admin/dashboard', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  const changed = pruneAndUpdateSessionStatuses(db);
  if (changed) {
    saveDatabase(db);
  }

  const monitoring = computeMonitoringSummary(db, '7d');
  const totalActiveServices = db.LINKS.filter((l) => l.isActive).length;
  const totalCategories = db.CATEGORIES.filter((c) => c.isActive).length;
  const totalClicks = db.LINK_CLICKS.length;
  const totalVisitors = db.VISITORS.length;

  res.json({
    stats: {
      totalActiveServices,
      totalCategories,
      totalClicks,
      totalVisitors,
      uniqueVisitors: monitoring.uniqueVisitors,
      onlineUsersCount: monitoring.onlineUsersCount,
      offlineUsersCount: monitoring.offlineUsersCount,
      activeUsersNow: monitoring.activeUsersNow,
      loggedInUsersCount: monitoring.loggedInUsersCount,
      registeredUsersCount: monitoring.registeredUsersCount,
      totalDownloads: monitoring.totalDownloads,
    },
    topServices: monitoring.topServices,
    dailyVisits: monitoring.dailyVisits,
    categoryClicks: monitoring.categoryClicks,
    recentActivities: db.ACTIVITY_LOGS.slice(0, 15),
    monitoring,
  });
});

// --- CATEGORIES CRUD ---
apiRouter.get('/admin/categories', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.CATEGORIES.sort((a, b) => a.order - b.order));
});

apiRouter.post('/admin/categories', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { name, description = '', icon = 'Folder', order = 0, isActive = true } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Nama kategori wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  const newCat: Category = {
    id: generateUUID(),
    name: String(name).trim(),
    description: String(description || '').trim(),
    icon: String(icon || 'Folder'),
    order: Number(order) || db.CATEGORIES.length + 1,
    isActive: Boolean(isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.CATEGORIES.push(newCat);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'CREATE_CATEGORY',
    details: `Kategori "${newCat.name}" berhasil ditambahkan.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: newCat.id,
    targetName: newCat.name,
    path: '/admin/categories',
    details: `Menambahkan kategori "${newCat.name}"`,
  });
  saveDatabase(db);

  res.json({ success: true, category: newCat });
});

apiRouter.put('/admin/categories/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, icon, order, isActive } = req.body || {};
  const db = loadDatabase();

  const cat = db.CATEGORIES.find((c) => c.id === id);
  if (!cat) {
    res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    return;
  }

  if (name !== undefined && String(name).trim()) cat.name = String(name).trim();
  if (description !== undefined) cat.description = String(description).trim();
  if (icon !== undefined) cat.icon = String(icon);
  if (order !== undefined && !Number.isNaN(Number(order))) cat.order = Number(order);
  if (isActive !== undefined) cat.isActive = Boolean(isActive);
  cat.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_CATEGORY',
    details: `Kategori "${cat.name}" berhasil diperbarui.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: cat.id,
    targetName: cat.name,
    path: '/admin/categories',
    details: `Memperbarui kategori "${cat.name}"`,
  });
  saveDatabase(db);

  res.json({ success: true, category: cat });
});

apiRouter.delete('/admin/categories/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();

  const catIndex = db.CATEGORIES.findIndex((c) => c.id === id);
  if (catIndex === -1) {
    res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    return;
  }

  // Check if any links are associated with this category
  const linkedLinks = db.LINKS.filter((l) => l.categoryId === id);
  if (linkedLinks.length > 0) {
    res.status(400).json({
      error: `Kategori ini masih memiliki ${linkedLinks.length} tautan layanan aktif. Pindahkan atau hapus tautan terkait terlebih dahulu.`,
    });
    return;
  }

  const deleted = db.CATEGORIES.splice(catIndex, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_CATEGORY',
    details: `Kategori "${deleted.name}" berhasil dihapus.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: deleted.id,
    targetName: deleted.name,
    path: '/admin/categories',
    details: `Menghapus kategori "${deleted.name}"`,
  });
  saveDatabase(db);

  res.json({ success: true });
});

// --- SERVICE LINKS CRUD ---
apiRouter.get('/admin/links', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.LINKS.sort((a, b) => a.order - b.order));
});

apiRouter.post('/admin/links', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const {
    name,
    categoryId,
    description = '',
    iconType = 'lucide',
    icon = 'Globe',
    targetUrl,
    targetOpen = '_blank',
    order = 0,
    isActive = true,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Nama layanan wajib diisi.' });
    return;
  }
  if (!targetUrl || !String(targetUrl).trim()) {
    res.status(400).json({ error: 'URL tujuan wajib diisi.' });
    return;
  }

  const trimmedUrl = String(targetUrl).trim();
  if (!isValidSafeUrl(trimmedUrl, true)) {
    res.status(400).json({ error: 'URL harus diawali dengan http://, https://, tel:, mailto:, /, atau #' });
    return;
  }

  const db = loadDatabase();
  const newLink: ServiceLink = {
    id: generateUUID(),
    name: String(name).trim(),
    categoryId: String(categoryId || ''),
    description: String(description || '').trim(),
    iconType: iconType === 'image' || iconType === 'upload' ? iconType : 'lucide',
    icon: String(icon || 'Globe'),
    targetUrl: trimmedUrl,
    targetOpen: targetOpen === '_self' ? '_self' : '_blank',
    order: Number(order) || db.LINKS.length + 1,
    isActive: Boolean(isActive),
    clicksCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.LINKS.push(newLink);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'CREATE_LINK',
    details: `Layanan "${newLink.name}" (${newLink.targetUrl}) berhasil ditambahkan.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: newLink.id,
    targetName: newLink.name,
    path: '/admin/links',
    details: `Menambahkan layanan "${newLink.name}"`,
  });
  saveDatabase(db);

  res.json({ success: true, link: newLink });
});

apiRouter.put('/admin/links/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    categoryId,
    description,
    iconType,
    icon,
    targetUrl,
    targetOpen,
    order,
    isActive,
  } = req.body || {};

  const db = loadDatabase();
  const link = db.LINKS.find((l) => l.id === id);
  if (!link) {
    res.status(404).json({ error: 'Layanan tidak ditemukan.' });
    return;
  }

  if (targetUrl !== undefined) {
    const trimmedUrl = String(targetUrl).trim();
    if (!isValidSafeUrl(trimmedUrl, true)) {
      res.status(400).json({ error: 'URL harus diawali dengan http://, https://, tel:, mailto:, /, atau #' });
      return;
    }
    link.targetUrl = trimmedUrl;
  }

  if (name !== undefined && String(name).trim()) link.name = String(name).trim();
  if (categoryId !== undefined) link.categoryId = String(categoryId);
  if (description !== undefined) link.description = String(description).trim();
  if (iconType !== undefined && (iconType === 'lucide' || iconType === 'image' || iconType === 'upload')) {
    link.iconType = iconType;
  }
  if (icon !== undefined) link.icon = String(icon);
  if (targetOpen !== undefined) link.targetOpen = targetOpen === '_self' ? '_self' : '_blank';
  if (order !== undefined && !Number.isNaN(Number(order))) link.order = Number(order);
  if (isActive !== undefined) link.isActive = Boolean(isActive);
  link.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_LINK',
    details: `Layanan "${link.name}" berhasil diperbarui.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: link.id,
    targetName: link.name,
    path: '/admin/links',
    details: `Memperbarui layanan "${link.name}"`,
  });
  saveDatabase(db);

  res.json({ success: true, link });
});

apiRouter.post('/admin/links/:id/duplicate', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const original = db.LINKS.find((l) => l.id === id);
  if (!original) {
    res.status(404).json({ error: 'Layanan tidak ditemukan.' });
    return;
  }

  const duplicated: ServiceLink = {
    ...original,
    id: generateUUID(),
    name: `${original.name} (Salinan)`,
    order: original.order + 1,
    clicksCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.LINKS.push(duplicated);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DUPLICATE_LINK',
    details: `Layanan "${original.name}" diduplikasi menjadi "${duplicated.name}".`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, link: duplicated });
});

apiRouter.delete('/admin/links/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();

  const linkIndex = db.LINKS.findIndex((l) => l.id === id);
  if (linkIndex === -1) {
    res.status(404).json({ error: 'Layanan tidak ditemukan.' });
    return;
  }

  const deleted = db.LINKS.splice(linkIndex, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_LINK',
    details: `Layanan "${deleted.name}" berhasil dihapus.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: deleted.id,
    targetName: deleted.name,
    path: '/admin/links',
    details: `Menghapus layanan "${deleted.name}"`,
  });
  saveDatabase(db);

  res.json({ success: true });
});

// --- REGISTRATIONS CRUD ---
apiRouter.get('/admin/registrations', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.REGISTRATIONS.sort((a, b) => a.order - b.order));
});

apiRouter.post('/admin/registrations', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { title, description = '', bannerUrl = '', formUrl, startDate = '', endDate = '', status = 'open', order = 0, isActive = true } = req.body || {};
  if (!title || !String(title).trim() || !formUrl || !String(formUrl).trim()) {
    res.status(400).json({ error: 'Judul dan URL formulir pendaftaran wajib diisi.' });
    return;
  }
  if (!isValidSafeUrl(String(formUrl), true)) {
    res.status(400).json({ error: 'URL formulir pendaftaran tidak valid.' });
    return;
  }

  const db = loadDatabase();
  const reg: Registration = {
    id: generateUUID(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    bannerUrl: String(bannerUrl || '').trim(),
    formUrl: String(formUrl).trim(),
    startDate: String(startDate || '').trim(),
    endDate: String(endDate || '').trim(),
    status: status === 'closed' ? 'closed' : 'open',
    order: Number(order) || db.REGISTRATIONS.length + 1,
    isActive: Boolean(isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.REGISTRATIONS.push(reg);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'CREATE_REGISTRATION',
    details: `Program pendaftaran "${reg.title}" ditambahkan.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: reg.id,
    targetName: reg.title,
    path: '/admin/registrations',
    details: `Menambahkan pendaftaran "${reg.title}"`,
  });
  saveDatabase(db);
  res.json({ success: true, registration: reg });
});

apiRouter.put('/admin/registrations/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const reg = db.REGISTRATIONS.find((r) => r.id === id);
  if (!reg) {
    res.status(404).json({ error: 'Data pendaftaran tidak ditemukan.' });
    return;
  }

  const { title, description, bannerUrl, formUrl, startDate, endDate, status, order, isActive } = req.body || {};
  if (formUrl !== undefined) {
    const cleanUrl = String(formUrl).trim();
    if (!isValidSafeUrl(cleanUrl, true)) {
      res.status(400).json({ error: 'URL formulir pendaftaran tidak valid.' });
      return;
    }
    reg.formUrl = cleanUrl;
  }
  if (title !== undefined && String(title).trim()) reg.title = String(title).trim();
  if (description !== undefined) reg.description = String(description).trim();
  if (bannerUrl !== undefined) reg.bannerUrl = String(bannerUrl).trim();
  if (startDate !== undefined) reg.startDate = String(startDate).trim();
  if (endDate !== undefined) reg.endDate = String(endDate).trim();
  if (status !== undefined) reg.status = status === 'closed' ? 'closed' : 'open';
  if (order !== undefined && !Number.isNaN(Number(order))) reg.order = Number(order);
  if (isActive !== undefined) reg.isActive = Boolean(isActive);
  reg.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_REGISTRATION',
    details: `Program pendaftaran "${reg.title}" diperbarui.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, registration: reg });
});

apiRouter.delete('/admin/registrations/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.REGISTRATIONS.findIndex((r) => r.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Data pendaftaran tidak ditemukan.' });
    return;
  }
  const removed = db.REGISTRATIONS.splice(index, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_REGISTRATION',
    details: `Program pendaftaran "${removed.title}" dihapus.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true });
});

// --- ANNOUNCEMENTS CRUD (accessible by super_admin, admin, and operator) ---
apiRouter.get('/admin/announcements', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.ANNOUNCEMENTS.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

apiRouter.post('/admin/announcements', requireAuth, (req: Request, res: Response) => {
  const { title, content, imageUrl = '', publishDate, expiryDate, status = 'published' } = req.body || {};
  if (!title || !String(title).trim() || !content || !String(content).trim()) {
    res.status(400).json({ error: 'Judul dan isi pengumuman wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  const item: Announcement = {
    id: generateUUID(),
    title: String(title).trim(),
    content: String(content).trim(),
    imageUrl: String(imageUrl || '').trim(),
    publishDate: String(publishDate || new Date().toISOString().split('T')[0]),
    expiryDate: String(expiryDate || ''),
    status: status === 'draft' ? 'draft' : 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.ANNOUNCEMENTS.unshift(item);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'CREATE_ANNOUNCEMENT',
    details: `Pengumuman "${item.title}" (${item.status}) dibuat.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: item.id,
    targetName: item.title,
    path: '/admin/announcements',
    details: `Menerbitkan pengumuman "${item.title}"`,
  });
  saveDatabase(db);
  res.json({ success: true, announcement: item });
});

apiRouter.put('/admin/announcements/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const ann = db.ANNOUNCEMENTS.find((a) => a.id === id);
  if (!ann) {
    res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    return;
  }

  const { title, content, imageUrl, publishDate, expiryDate, status } = req.body || {};
  if (title !== undefined && String(title).trim()) ann.title = String(title).trim();
  if (content !== undefined && String(content).trim()) ann.content = String(content).trim();
  if (imageUrl !== undefined) ann.imageUrl = String(imageUrl).trim();
  if (publishDate !== undefined) ann.publishDate = String(publishDate);
  if (expiryDate !== undefined) ann.expiryDate = String(expiryDate);
  if (status !== undefined) ann.status = status === 'draft' ? 'draft' : 'published';
  ann.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_ANNOUNCEMENT',
    details: `Pengumuman "${ann.title}" diperbarui.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, announcement: ann });
});

apiRouter.delete('/admin/announcements/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.ANNOUNCEMENTS.findIndex((a) => a.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    return;
  }
  const removed = db.ANNOUNCEMENTS.splice(index, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_ANNOUNCEMENT',
    details: `Pengumuman "${removed.title}" dihapus.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true });
});

// --- DOCUMENTS CRUD ---
apiRouter.get('/admin/documents', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.DOCUMENTS.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

apiRouter.post('/admin/documents', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { title, description = '', category = 'Umum', fileUrl, fileType = 'PDF', fileSize = '0 KB', isActive = true } = req.body || {};
  if (!title || !String(title).trim() || !fileUrl || !String(fileUrl).trim()) {
    res.status(400).json({ error: 'Judul dan tautan/file dokumen wajib diisi.' });
    return;
  }
  if (!isValidSafeUrl(String(fileUrl), true)) {
    res.status(400).json({ error: 'URL berkas dokumen tidak valid.' });
    return;
  }

  const db = loadDatabase();
  const doc: DocumentItem = {
    id: generateUUID(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    category: String(category || 'Umum').trim(),
    fileUrl: String(fileUrl).trim(),
    fileType: String(fileType || 'PDF').toUpperCase(),
    fileSize: String(fileSize || '0 KB'),
    downloadCount: 0,
    isActive: Boolean(isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.DOCUMENTS.push(doc);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'CREATE_DOCUMENT',
    details: `Dokumen "${doc.title}" ditambahkan.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, document: doc });
});

apiRouter.put('/admin/documents/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const doc = db.DOCUMENTS.find((d) => d.id === id);
  if (!doc) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }

  const { title, description, category, fileUrl, fileType, fileSize, isActive } = req.body || {};
  if (fileUrl !== undefined) {
    const cleanUrl = String(fileUrl).trim();
    if (!isValidSafeUrl(cleanUrl, true)) {
      res.status(400).json({ error: 'URL berkas dokumen tidak valid.' });
      return;
    }
    doc.fileUrl = cleanUrl;
  }
  if (title !== undefined && String(title).trim()) doc.title = String(title).trim();
  if (description !== undefined) doc.description = String(description).trim();
  if (category !== undefined) doc.category = String(category).trim();
  if (fileType !== undefined) doc.fileType = String(fileType).toUpperCase();
  if (fileSize !== undefined) doc.fileSize = String(fileSize);
  if (isActive !== undefined) doc.isActive = Boolean(isActive);
  doc.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_DOCUMENT',
    details: `Dokumen "${doc.title}" diperbarui.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, document: doc });
});

apiRouter.delete('/admin/documents/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.DOCUMENTS.findIndex((d) => d.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }
  const removed = db.DOCUMENTS.splice(index, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_DOCUMENT',
    details: `Dokumen "${removed.title}" dihapus.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true });
});

// --- SETTINGS ---
apiRouter.get('/admin/settings', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.SITE_SETTINGS);
});

apiRouter.put('/admin/settings', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const db = loadDatabase();
  const body = req.body || {};

  const stringFields = [
    'portalName', 'institutionName', 'tagline', 'description',
    'logoUrl', 'faviconUrl', 'bannerUrl', 'primaryColor', 'accentColor',
    'whatsappNumber', 'email', 'address', 'instagramUrl', 'facebookUrl',
    'youtubeUrl', 'tiktokUrl', 'websiteUrl', 'copyrightText',
  ] as const;

  const urlCheckFields = ['instagramUrl', 'facebookUrl', 'youtubeUrl', 'tiktokUrl', 'websiteUrl'] as const;
  for (const field of urlCheckFields) {
    if (body[field] !== undefined && String(body[field]).trim() !== '') {
      if (!isValidSafeUrl(String(body[field]).trim(), true)) {
        res.status(400).json({ error: `URL pada kolom ${field} tidak valid.` });
        return;
      }
    }
  }

  for (const field of stringFields) {
    if (body[field] !== undefined) {
      (db.SITE_SETTINGS as any)[field] = String(body[field]);
    }
  }

  const boolFields = [
    'heroEnabled', 'announcementsEnabled', 'registrationsEnabled',
    'documentsEnabled', 'searchEnabled', 'categoriesEnabled',
  ] as const;
  for (const field of boolFields) {
    if (body[field] !== undefined) {
      (db.SITE_SETTINGS as any)[field] = Boolean(body[field]);
    }
  }

  db.SITE_SETTINGS.updatedAt = new Date().toISOString();
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_SETTINGS',
    details: 'Pengaturan identitas dan tampilan portal diperbarui.',
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: 'site_settings',
    targetName: 'Identitas & Tampilan Portal',
    path: '/admin/settings',
    details: 'Memperbarui pengaturan identitas dan modul portal',
  });
  saveDatabase(db);
  res.json({ success: true, settings: db.SITE_SETTINGS });
});

// --- QR SETTINGS ---
apiRouter.get('/admin/qr-settings', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.QR_SETTINGS);
});

apiRouter.put('/admin/qr-settings', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const db = loadDatabase();
  const body = req.body || {};

  if (body.portalUrl !== undefined && String(body.portalUrl).trim() !== '') {
    if (!isValidSafeUrl(String(body.portalUrl).trim(), false)) {
      res.status(400).json({ error: 'URL Portal QR harus diawali http:// atau https://' });
      return;
    }
  }

  if (body.portalUrl !== undefined) db.QR_SETTINGS.portalUrl = String(body.portalUrl).trim();
  if (body.size !== undefined && !Number.isNaN(Number(body.size))) db.QR_SETTINGS.size = Number(body.size);
  if (body.foregroundColor !== undefined) db.QR_SETTINGS.foregroundColor = String(body.foregroundColor);
  if (body.backgroundColor !== undefined) db.QR_SETTINGS.backgroundColor = String(body.backgroundColor);
  if (body.includeLogo !== undefined) db.QR_SETTINGS.includeLogo = Boolean(body.includeLogo);
  if (body.logoUrl !== undefined) db.QR_SETTINGS.logoUrl = String(body.logoUrl);
  if (body.errorCorrectionLevel !== undefined && ['L', 'M', 'Q', 'H'].includes(body.errorCorrectionLevel)) {
    db.QR_SETTINGS.errorCorrectionLevel = body.errorCorrectionLevel;
  }
  if (body.posterTitle !== undefined) db.QR_SETTINGS.posterTitle = String(body.posterTitle);
  if (body.posterSubtitle !== undefined) db.QR_SETTINGS.posterSubtitle = String(body.posterSubtitle);
  if (body.posterFooter !== undefined) db.QR_SETTINGS.posterFooter = String(body.posterFooter);
  db.QR_SETTINGS.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_QR_SETTINGS',
    details: 'Pengaturan desain QR Code & poster diperbarui.',
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, qrSettings: db.QR_SETTINGS });
});

// --- ACTIVITY LOGS ---
apiRouter.get('/admin/activity-logs', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.ACTIVITY_LOGS);
});

// --- USER MANAGEMENT ---
apiRouter.get('/admin/users', requireAuth, requireAdminRole, (_req: Request, res: Response) => {
  const db = loadDatabase();
  const safeUsers = db.USERS.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }));
  res.json(safeUsers);
});

apiRouter.post('/admin/users', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { username, fullName, email, password, role = 'operator' } = req.body || {};
  if (!username || !password || !fullName) {
    res.status(400).json({ error: 'Username, Nama Lengkap, dan Password wajib diisi.' });
    return;
  }

  const strength = validatePasswordStrength(password);
  if (!strength.isValid) {
    res.status(400).json({ error: strength.message });
    return;
  }

  const db = loadDatabase();
  if (db.USERS.some((u) => u.username.toLowerCase() === String(username).toLowerCase().trim())) {
    res.status(400).json({ error: 'Username sudah digunakan oleh akun lain.' });
    return;
  }

  const salt = generateSalt();
  const passwordHash = hashPasswordSync(password, salt);
  const newUser: User = {
    id: generateUUID(),
    username: String(username).trim(),
    fullName: String(fullName).trim(),
    email: String(email || '').trim(),
    passwordHash,
    salt,
    role: role === 'admin' ? 'admin' : 'operator',
    mustChangePassword: true,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.USERS.push(newUser);
  const actor = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: actor.id,
    username: actor.username,
    action: 'CREATE_USER',
    details: `Akun pengguna baru @${newUser.username} (${newUser.role}) ditambahkan.`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${actor.id}`,
    visitorId: `user_${actor.id}`,
    actorType: 'authenticated',
    username: actor.username,
    role: actor.role,
    eventType: 'ADMIN_ACTION',
    targetId: newUser.id,
    targetName: newUser.username,
    path: '/admin/users',
    details: `Membuat akun @${newUser.username} (${newUser.role})`,
  });
  saveDatabase(db);
  res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
    },
  });
});

apiRouter.put('/admin/users/:id/toggle-status', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const user = db.USERS.find((u) => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  const currentUser = (req as any).currentUser as User;
  if (user.id === currentUser.id) {
    res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
    return;
  }

  user.isActive = !user.isActive;
  user.updatedAt = new Date().toISOString();
  addActivityLog(db, {
    userId: currentUser.id,
    username: currentUser.username,
    action: 'TOGGLE_USER_STATUS',
    details: `Status akun @${user.username} diubah menjadi ${user.isActive ? 'Aktif' : 'Nonaktif'}.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, isActive: user.isActive });
});

// --- BACKUP & RESTORE ---
apiRouter.get('/admin/backups', requireAuth, requireAdminRole, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.BACKUP_LOGS);
});

apiRouter.post('/admin/backup', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const user = (req as any).currentUser as User;
  const result = backupDatabase(user.username, (req.body && req.body.notes) || 'Manual admin backup');
  res.json({ success: true, backup: result });
});

apiRouter.get('/admin/export-database', requireAuth, requireAdminRole, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=DB_PORTAL_DIGITAL_${Date.now()}.json`);
  res.send(JSON.stringify(db, null, 2));
});

apiRouter.post('/admin/restore', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { jsonContent } = req.body || {};
  if (!jsonContent) {
    res.status(400).json({ error: 'Konten JSON cadangan tidak ditemukan.' });
    return;
  }

  const user = (req as any).currentUser as User;
  const result = restoreDatabase(jsonContent, user.username);
  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }

  res.json({ success: true, message: result.message });
});

apiRouter.post('/admin/reset-portal-data', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const db = loadDatabase();
  const user = (req as any).currentUser as User;

  db.CATEGORIES = [];
  db.LINKS = [];
  db.REGISTRATIONS = [];
  db.ANNOUNCEMENTS = [];
  db.DOCUMENTS = [];
  db.VISITORS = [];
  db.LINK_CLICKS = [];
  db.STUDENT_ACHIEVEMENTS = [];
  db.COMMITTEE_CONTACTS = [];
  db.MADRASAH_ACHIEVEMENTS = [];
  db.PORTAL_EVENTS = [];
  db.USER_SESSIONS = (db.USER_SESSIONS || []).filter(
    (s) => s.actorType === 'authenticated' && s.userId === user.id && s.status === 'online'
  );

  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'RESET_PORTAL_DATA',
    details: 'Seluruh konten portal & statistik dikosongkan oleh administrator (tanpa data dummy).',
    ipAddress: getClientIp(req),
  });

  saveDatabase(db);
  res.json({ success: true, message: 'Seluruh konten portal berhasil dikosongkan.' });
});

// --- GOOGLE APPS SCRIPT EXPORTER ---
apiRouter.get('/admin/gas-files', requireAuth, requireAdminRole, (_req: Request, res: Response) => {
  const files = getAllGasFiles();
  res.json({ files });
});

// --- STARTER SEED (Optional for admin testing, default is strictly empty) ---
apiRouter.post('/admin/seed-starter', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const db = loadDatabase();
  const user = (req as any).currentUser as User;

  // Initial starter categories
  const starterCategories: Category[] = [
    {
      id: generateUUID(),
      name: 'Media Sosial & Informasi',
      description: 'Saluran resmi informasi dan komunikasi lembaga',
      icon: 'Share2',
      order: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Layanan Akademik',
      description: 'Sistem absensi, raport digital, dan e-learning',
      icon: 'GraduationCap',
      order: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Penerimaan Santri & Siswa',
      description: 'Informasi dan pendaftaran peserta didik baru',
      icon: 'UserPlus',
      order: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  db.CATEGORIES = starterCategories;

  // Initial service links
  db.LINKS = [
    {
      id: generateUUID(),
      name: 'Instagram Resmi',
      categoryId: starterCategories[0].id,
      description: 'Kabar dan kegiatan harian terbaru',
      iconType: 'lucide',
      icon: 'Instagram',
      targetUrl: 'https://instagram.com',
      targetOpen: '_blank',
      order: 1,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Website Utama Lembaga',
      categoryId: starterCategories[0].id,
      description: 'Portal berita dan profil institusi',
      iconType: 'lucide',
      icon: 'Globe',
      targetUrl: 'https://lembaga.sch.id',
      targetOpen: '_blank',
      order: 2,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'WhatsApp Center',
      categoryId: starterCategories[0].id,
      description: 'Hubungi layanan administrasi dan informasi',
      iconType: 'lucide',
      icon: 'MessageCircle',
      targetUrl: 'https://wa.me/6281234567890',
      targetOpen: '_blank',
      order: 3,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Sistem Raport Digital',
      categoryId: starterCategories[1].id,
      description: 'Akses nilai dan perkembangan belajar santri',
      iconType: 'lucide',
      icon: 'BookOpen',
      targetUrl: 'https://raport.lembaga.sch.id',
      targetOpen: '_blank',
      order: 4,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'SEED_INITIAL_SERVICES',
    details: 'Administrator mengaktifkan paket layanan awal resmi.',
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);

  res.json({ success: true, message: 'Paket layanan awal berhasil ditambahkan.' });
});

// ----------------------------------------------------
// COMMITTEE CONTACTS (Saluran WhatsApp Panitia)
// ----------------------------------------------------
apiRouter.get('/public/committee-contacts', (_req: Request, res: Response) => {
  const db = loadDatabase();
  const list = (db.COMMITTEE_CONTACTS || []).filter((c) => c.isAvailable !== false);
  res.json(list);
});

apiRouter.get('/admin/committee-contacts', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.COMMITTEE_CONTACTS || []);
});

apiRouter.post('/admin/committee-contacts', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { name, role, whatsappNumber, notes = '', isAvailable = true } = req.body || {};
  if (!name || !String(name).trim() || !whatsappNumber || !String(whatsappNumber).trim()) {
    res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  if (!db.COMMITTEE_CONTACTS) db.COMMITTEE_CONTACTS = [];

  const contact: CommitteeContact = {
    id: generateUUID(),
    name: String(name).trim(),
    role: String(role || 'Panitia').trim(),
    whatsappNumber: String(whatsappNumber).trim(),
    notes: String(notes || '').trim(),
    isAvailable: Boolean(isAvailable),
  };

  db.COMMITTEE_CONTACTS.push(contact);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'CREATE_CONTACT',
    details: `Kontak panitia "${contact.name}" ditambahkan.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, contact });
});

apiRouter.put('/admin/committee-contacts/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.COMMITTEE_CONTACTS) db.COMMITTEE_CONTACTS = [];

  const c = db.COMMITTEE_CONTACTS.find((item) => item.id === id);
  if (!c) {
    res.status(404).json({ error: 'Kontak panitia tidak ditemukan.' });
    return;
  }

  const { name, role, whatsappNumber, notes, isAvailable } = req.body || {};
  if (name !== undefined && String(name).trim()) c.name = String(name).trim();
  if (role !== undefined && String(role).trim()) c.role = String(role).trim();
  if (whatsappNumber !== undefined && String(whatsappNumber).trim()) c.whatsappNumber = String(whatsappNumber).trim();
  if (notes !== undefined) c.notes = String(notes).trim();
  if (isAvailable !== undefined) c.isAvailable = Boolean(isAvailable);

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_CONTACT',
    details: `Kontak panitia "${c.name}" diperbarui.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, contact: c });
});

apiRouter.delete('/admin/committee-contacts/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.COMMITTEE_CONTACTS) db.COMMITTEE_CONTACTS = [];

  const index = db.COMMITTEE_CONTACTS.findIndex((item) => item.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Kontak panitia tidak ditemukan.' });
    return;
  }

  const removed = db.COMMITTEE_CONTACTS.splice(index, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_CONTACT',
    details: `Kontak panitia "${removed.name}" dihapus.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true });
});

// ----------------------------------------------------
// DAFTARKAN PRESTASI (Student Achievement Registration)
// ----------------------------------------------------

/**
 * Search previously submitted/registered applicants (privacy-masked NISN, requires min 2 chars query)
 */
apiRouter.get('/public/achievements/search-applicant', (req: Request, res: Response) => {
  const query = ((req.query.query as string) || '').trim().toLowerCase();
  if (query.length < 2) {
    res.json({ results: [] });
    return;
  }

  const db = loadDatabase();
  const registeredPool: { name: string; nisn: string; registeredProgram: string }[] = [];

  if (db.STUDENT_ACHIEVEMENTS) {
    db.STUDENT_ACHIEVEMENTS.forEach((ach) => {
      if (!registeredPool.some((p) => p.name.toLowerCase() === ach.studentName.toLowerCase())) {
        const rawNisn = String(ach.registrationNumberOrNisn || '');
        const maskedNisn = rawNisn.length > 4 ? `${'*'.repeat(Math.max(3, rawNisn.length - 4))}${rawNisn.slice(-4)}` : rawNisn;
        const matches =
          ach.studentName.toLowerCase().includes(query) ||
          rawNisn.toLowerCase().includes(query);
        if (matches) {
          registeredPool.push({
            name: ach.studentName,
            nisn: maskedNisn,
            registeredProgram: 'Pendaftar Terdata MA Plus MM',
          });
        }
      }
    });
  }

  res.json({ results: registeredPool.slice(0, 15) });
});

/**
 * Submit achievement with certificate document
 */
apiRouter.post('/public/achievements', (req: Request, res: Response) => {
  const {
    id,
    studentName,
    registrationNumberOrNisn,
    achievementTitle,
    field = 'akademik',
    level = 'Kabupaten/Kota',
    rank = 'Juara 1',
    organizer = '',
    year = new Date().getFullYear().toString(),
    certificateUrl,
    certificateFileName = 'piagam_prestasi.pdf',
    notes = '',
    sessionId = '',
    visitorId = 'public_applicant',
  } = req.body || {};

  if (!studentName || !registrationNumberOrNisn || !achievementTitle || !certificateUrl) {
    res.status(400).json({
      error: 'Nama pendaftar, NISN/No Pendaftaran, judul prestasi, dan berkas sertifikat/piagam wajib diisi.',
    });
    return;
  }

  const db = loadDatabase();
  if (!db.STUDENT_ACHIEVEMENTS) db.STUDENT_ACHIEVEMENTS = [];

  const cleanId = typeof id === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(id) ? id : generateUUID();
  const newAchievement: StudentAchievement = {
    id: cleanId,
    studentName: String(studentName).trim(),
    registrationNumberOrNisn: String(registrationNumberOrNisn).trim(),
    achievementTitle: String(achievementTitle).trim(),
    field,
    level,
    rank,
    organizer: String(organizer || '').trim(),
    year: String(year || '').trim(),
    certificateUrl: String(certificateUrl),
    certificateFileName: String(certificateFileName || 'piagam_prestasi.pdf'),
    notes: String(notes || '').trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.STUDENT_ACHIEVEMENTS.unshift(newAchievement);

  addActivityLog(db, {
    userId: 'public_applicant',
    username: newAchievement.studentName,
    action: 'SUBMIT_ACHIEVEMENT',
    details: `Pengajuan prestasi "${newAchievement.achievementTitle}" oleh ${newAchievement.studentName} (${level} - ${rank})`,
    ipAddress: getClientIp(req),
  });

  const actor = resolveRequestActor(req);
  addPortalEvent(db, {
    sessionId: String(sessionId || visitorId || 'public_applicant').slice(0, 128),
    visitorId: String(visitorId || 'public_applicant').slice(0, 128),
    actorType: actor.actorType,
    username: actor.username,
    role: actor.role,
    eventType: 'ACHIEVEMENT_SUBMIT',
    targetId: newAchievement.id,
    targetName: newAchievement.achievementTitle,
    path: '/#daftarkan-prestasi',
    details: `Pengajuan prestasi "${newAchievement.achievementTitle}" oleh ${newAchievement.studentName}`,
  });

  saveDatabase(db);

  res.json({
    success: true,
    achievementId: newAchievement.id,
    message: 'Prestasi Anda berhasil didaftarkan dan sedang menunggu verifikasi panitia MA Plus MM.',
  });
});

/**
 * Admin view and verify achievements
 */
apiRouter.get('/admin/achievements', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.STUDENT_ACHIEVEMENTS || []);
});

apiRouter.put('/admin/achievements/:id/verify', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body || {};
  const db = loadDatabase();
  if (!db.STUDENT_ACHIEVEMENTS) db.STUDENT_ACHIEVEMENTS = [];

  const ach = db.STUDENT_ACHIEVEMENTS.find((item) => item.id === id);
  if (!ach) {
    res.status(404).json({ error: 'Data prestasi tidak ditemukan.' });
    return;
  }

  ach.status = status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : 'pending';
  if (notes !== undefined) ach.notes = String(notes);
  ach.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'VERIFY_ACHIEVEMENT',
    details: `Verifikasi prestasi "${ach.achievementTitle}" milik ${ach.studentName} diubah menjadi ${ach.status}`,
    ipAddress: getClientIp(req),
  });
  addPortalEvent(db, {
    sessionId: `admin_${user.id}`,
    visitorId: `user_${user.id}`,
    actorType: 'authenticated',
    username: user.username,
    role: user.role,
    eventType: 'ADMIN_ACTION',
    targetId: ach.id,
    targetName: ach.achievementTitle,
    path: '/admin/achievements',
    details: `Verifikasi prestasi "${ach.achievementTitle}" -> ${ach.status}`,
  });

  saveDatabase(db);
  res.json({ success: true, achievement: ach });
});

apiRouter.delete('/admin/achievements/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.STUDENT_ACHIEVEMENTS) db.STUDENT_ACHIEVEMENTS = [];

  const index = db.STUDENT_ACHIEVEMENTS.findIndex((item) => item.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Data prestasi tidak ditemukan.' });
    return;
  }

  const deleted = db.STUDENT_ACHIEVEMENTS.splice(index, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_STUDENT_ACHIEVEMENT',
    details: `Pengajuan prestasi "${deleted.achievementTitle}" dihapus.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, deleted });
});

// ----------------------------------------------------
// MADRASAH ACHIEVEMENTS (MENU KHUSUS PRESTASI MADRASAH)
// ----------------------------------------------------
apiRouter.get('/admin/madrasah-achievements', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  const list = (db.MADRASAH_ACHIEVEMENTS || []).sort((a, b) => a.order - b.order);
  res.json(list);
});

apiRouter.post('/admin/madrasah-achievements', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const {
    title,
    category = 'Prestasi',
    level = 'Tingkat Nasional',
    recipient = 'Santri / Tim MA PLUS MM',
    year = '2026',
    photoUrl = '',
    shortDescription = '',
    order = 1,
    isActive = true,
  } = req.body || {};

  if (!title || !String(title).trim()) {
    res.status(400).json({ error: 'Judul prestasi madrasah wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  if (!db.MADRASAH_ACHIEVEMENTS) db.MADRASAH_ACHIEVEMENTS = [];

  const newAch: MadrasahAchievement = {
    id: generateUUID(),
    title: String(title).trim(),
    category: String(category).trim(),
    level: String(level).trim(),
    recipient: String(recipient).trim(),
    year: String(year).trim(),
    photoUrl: String(photoUrl || '').trim(),
    shortDescription: String(shortDescription || '').trim(),
    order: Number(order) || (db.MADRASAH_ACHIEVEMENTS.length + 1),
    isActive: Boolean(isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.MADRASAH_ACHIEVEMENTS.push(newAch);
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'CREATE_MADRASAH_ACHIEVEMENT',
    details: `Prestasi madrasah "${newAch.title}" ditambahkan.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, achievement: newAch });
});

apiRouter.put('/admin/madrasah-achievements/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.MADRASAH_ACHIEVEMENTS) db.MADRASAH_ACHIEVEMENTS = [];

  const existing = db.MADRASAH_ACHIEVEMENTS.find((a) => a.id === id);
  if (!existing) {
    res.status(404).json({ error: 'Prestasi madrasah tidak ditemukan.' });
    return;
  }

  const { title, category, level, recipient, year, photoUrl, shortDescription, order, isActive } = req.body || {};
  if (title !== undefined && String(title).trim()) existing.title = String(title).trim();
  if (category !== undefined) existing.category = String(category).trim();
  if (level !== undefined) existing.level = String(level).trim();
  if (recipient !== undefined) existing.recipient = String(recipient).trim();
  if (year !== undefined) existing.year = String(year).trim();
  if (photoUrl !== undefined) existing.photoUrl = String(photoUrl).trim();
  if (shortDescription !== undefined) existing.shortDescription = String(shortDescription).trim();
  if (order !== undefined && !Number.isNaN(Number(order))) existing.order = Number(order);
  if (isActive !== undefined) existing.isActive = Boolean(isActive);
  existing.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_MADRASAH_ACHIEVEMENT',
    details: `Prestasi madrasah "${existing.title}" diperbarui.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, achievement: existing });
});

apiRouter.delete('/admin/madrasah-achievements/:id', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.MADRASAH_ACHIEVEMENTS) db.MADRASAH_ACHIEVEMENTS = [];

  const index = db.MADRASAH_ACHIEVEMENTS.findIndex((a) => a.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Prestasi madrasah tidak ditemukan.' });
    return;
  }

  const deleted = db.MADRASAH_ACHIEVEMENTS.splice(index, 1)[0];
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'DELETE_MADRASAH_ACHIEVEMENT',
    details: `Prestasi madrasah "${deleted.title}" dihapus.`,
    ipAddress: getClientIp(req),
  });
  saveDatabase(db);
  res.json({ success: true, deleted });
});

// ----------------------------------------------------
// SEED OFFICIAL MA PLUS MM PORTAL (8 Official Services)
// ----------------------------------------------------
apiRouter.post('/admin/seed-ma-plus-mm', requireAuth, requireAdminRole, (req: Request, res: Response) => {
  const db = loadDatabase();
  const user = (req as any).currentUser as User;

  // Categories
  const categories: Category[] = [
    {
      id: generateUUID(),
      name: 'Layanan PPDB & Pendaftaran',
      description: 'Formulir pendaftaran santri baru dan portal prestasi',
      icon: 'UserPlus',
      order: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Media Sosial & Penyiaran',
      description: 'Saluran resmi informasi, kajian, dan kreasi santri',
      icon: 'Share2',
      order: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'Informasi & Layanan Kampus',
      description: 'Website resmi, denah lokasi Google Maps, dan kontak panitia',
      icon: 'School',
      order: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  db.CATEGORIES = categories;

  // 8 Specific Official Services with realistic SVG badges from brandAssets
  db.LINKS = [
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.ppdb_form.name,
      categoryId: categories[0].id,
      description: OFFICIAL_BRAND_ASSETS.ppdb_form.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.ppdb_form.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.ppdb_form.defaultUrl,
      targetOpen: '_self',
      order: 1,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.instagram.name,
      categoryId: categories[1].id,
      description: OFFICIAL_BRAND_ASSETS.instagram.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.instagram.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.instagram.defaultUrl,
      targetOpen: '_blank',
      order: 2,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.youtube.name,
      categoryId: categories[1].id,
      description: OFFICIAL_BRAND_ASSETS.youtube.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.youtube.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.youtube.defaultUrl,
      targetOpen: '_blank',
      order: 3,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.tiktok.name,
      categoryId: categories[1].id,
      description: OFFICIAL_BRAND_ASSETS.tiktok.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.tiktok.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.tiktok.defaultUrl,
      targetOpen: '_blank',
      order: 4,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.google_maps.name,
      categoryId: categories[2].id,
      description: OFFICIAL_BRAND_ASSETS.google_maps.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.google_maps.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.google_maps.defaultUrl,
      targetOpen: '_blank',
      order: 5,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.daftarkan_prestasi.name,
      categoryId: categories[0].id,
      description: OFFICIAL_BRAND_ASSETS.daftarkan_prestasi.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.daftarkan_prestasi.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.daftarkan_prestasi.defaultUrl,
      targetOpen: '_self',
      order: 6,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.portal_web.name,
      categoryId: categories[2].id,
      description: OFFICIAL_BRAND_ASSETS.portal_web.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.portal_web.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.portal_web.defaultUrl,
      targetOpen: '_blank',
      order: 7,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: OFFICIAL_BRAND_ASSETS.saluran_whatsapp.name,
      categoryId: categories[2].id,
      description: OFFICIAL_BRAND_ASSETS.saluran_whatsapp.description,
      iconType: 'image',
      icon: getSvgDataUrl(OFFICIAL_BRAND_ASSETS.saluran_whatsapp.svgBadge),
      targetUrl: OFFICIAL_BRAND_ASSETS.saluran_whatsapp.defaultUrl,
      targetOpen: '_self',
      order: 8,
      isActive: true,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Set institution details specifically for MA PLUS MM without dummy phone/announcement data
  db.SITE_SETTINGS.institutionName = "MA PLUS MA'HADUL MUTA'ALLIMIN";
  db.SITE_SETTINGS.portalName = 'PORTAL DIGITAL TERPADU';
  db.SITE_SETTINGS.tagline = 'One QR Code – One Portal – All Digital Services';
  db.SITE_SETTINGS.description = 'Pusat akses resmi seluruh layanan digital, pendaftaran PPDB, pendaftaran prestasi, dan saluran informasi resmi MA Plus MM.';
  db.SITE_SETTINGS.email = 'tumaplusmahadulmutaallimin@gmail.com';
  db.SITE_SETTINGS.announcementsEnabled = true;

  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'SEED_MA_PLUS_MM',
    details: 'Template 8 ikon layanan MA Plus MM diaktifkan oleh admin.',
    ipAddress: req.ip || '127.0.0.1',
  });

  saveDatabase(db);
  res.json({ success: true, message: 'Template 8 ikon layanan resmi MA Plus MM berhasil diaktifkan.' });
});
