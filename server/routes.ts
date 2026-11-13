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
  DEFAULT_COMMITTEE_CONTACTS,
  DEFAULT_MADRASAH_ACHIEVEMENTS,
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

const routerJsonParser = express.json({ limit: '15mb' });
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const anyReq = req as any;
  if (anyReq._body || req.body !== undefined) {
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
  routerJsonParser(req, res, next);
});

// Auth Middleware for Protected Routes
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

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

// ----------------------------------------------------
// PUBLIC ENDPOINTS (No login needed)
// ----------------------------------------------------

/**
 * Public portal payload
 */
apiRouter.get('/public/portal', (req: Request, res: Response) => {
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

  res.json({
    siteSettings: db.SITE_SETTINGS,
    categories: activeCategories,
    links: activeLinks,
    announcements: activeAnnouncements,
    registrations: activeRegistrations,
    documents: activeDocuments,
    committeeContacts: db.COMMITTEE_CONTACTS || [],
    achievementsCount: db.STUDENT_ACHIEVEMENTS?.length || 0,
    madrasahAchievements: activeMadrasahAchievements,
  });
});

/**
 * Track visitor
 */
apiRouter.post('/public/visit', (req: Request, res: Response) => {
  const { visitorId, path = '/' } = req.body;
  const db = loadDatabase();

  const record = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    visitorId: visitorId || 'anonymous',
    userAgent: req.headers['user-agent'] || '',
    referrer: req.headers.referer || '',
    path,
  };

  db.VISITORS.push(record);
  // Keep last 10000 records
  if (db.VISITORS.length > 10000) {
    db.VISITORS = db.VISITORS.slice(db.VISITORS.length - 10000);
  }
  saveDatabase(db);

  res.json({ success: true });
});

/**
 * Track link click
 */
apiRouter.post('/public/click/:linkId', (req: Request, res: Response) => {
  const { linkId } = req.params;
  const { visitorId } = req.body;
  const db = loadDatabase();

  const link = db.LINKS.find((l) => l.id === linkId);
  if (!link) {
    res.status(404).json({ error: 'Tautan layanan tidak ditemukan.' });
    return;
  }

  link.clicksCount = (link.clicksCount || 0) + 1;
  link.updatedAt = new Date().toISOString();

  db.LINK_CLICKS.push({
    id: generateUUID(),
    linkId: link.id,
    linkName: link.name,
    categoryId: link.categoryId,
    timestamp: new Date().toISOString(),
    visitorId: visitorId || 'anonymous',
  });

  if (db.LINK_CLICKS.length > 10000) {
    db.LINK_CLICKS = db.LINK_CLICKS.slice(db.LINK_CLICKS.length - 10000);
  }
  saveDatabase(db);

  res.json({ success: true, targetUrl: link.targetUrl, targetOpen: link.targetOpen });
});

/**
 * Track document download
 */
apiRouter.post('/public/download/:docId', (req: Request, res: Response) => {
  const { docId } = req.params;
  const db = loadDatabase();

  const doc = db.DOCUMENTS.find((d) => d.id === docId);
  if (!doc) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }

  doc.downloadCount = (doc.downloadCount || 0) + 1;
  doc.updatedAt = new Date().toISOString();
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
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';
  const result = login(username, password, clientIp);

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

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';
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
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

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
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) logout(token);
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
 * Overview statistics
 */
apiRouter.get('/admin/dashboard', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  const totalActiveServices = db.LINKS.filter((l) => l.isActive).length;
  const totalCategories = db.CATEGORIES.filter((c) => c.isActive).length;
  const totalClicks = db.LINK_CLICKS.length;
  const totalVisitors = db.VISITORS.length;

  // Top 5 services by clicks
  const topServices = [...db.LINKS]
    .sort((a, b) => (b.clicksCount || 0) - (a.clicksCount || 0))
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      name: l.name,
      clicksCount: l.clicksCount || 0,
      targetUrl: l.targetUrl,
      categoryName: db.CATEGORIES.find((c) => c.id === l.categoryId)?.name || 'Umum',
    }));

  // Daily visits for the past 7 days (real data)
  const now = new Date();
  const dailyVisits: { date: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    const count = db.VISITORS.filter((v) => v.timestamp.startsWith(dateStr)).length;
    dailyVisits.push({ date: dateStr, label: dayLabel, count });
  }

  // Category clicks distribution
  const categoryClicks: { categoryName: string; count: number }[] = db.CATEGORIES.map((cat) => {
    const count = db.LINK_CLICKS.filter((lc) => lc.categoryId === cat.id).length;
    return { categoryName: cat.name, count };
  });

  res.json({
    stats: {
      totalActiveServices,
      totalCategories,
      totalClicks,
      totalVisitors,
    },
    topServices,
    dailyVisits,
    categoryClicks,
    recentActivities: db.ACTIVITY_LOGS.slice(0, 10),
  });
});

// --- CATEGORIES CRUD ---
apiRouter.get('/admin/categories', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.CATEGORIES.sort((a, b) => a.order - b.order));
});

apiRouter.post('/admin/categories', requireAuth, (req: Request, res: Response) => {
  const { name, description = '', icon = 'Folder', order = 0, isActive = true } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Nama kategori wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  const newCat: Category = {
    id: generateUUID(),
    name: name.trim(),
    description: description.trim(),
    icon: icon || 'Folder',
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
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);

  res.json({ success: true, category: newCat });
});

apiRouter.put('/admin/categories/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, icon, order, isActive } = req.body;
  const db = loadDatabase();

  const cat = db.CATEGORIES.find((c) => c.id === id);
  if (!cat) {
    res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    return;
  }

  if (name !== undefined) cat.name = name.trim();
  if (description !== undefined) cat.description = description.trim();
  if (icon !== undefined) cat.icon = icon;
  if (order !== undefined) cat.order = Number(order);
  if (isActive !== undefined) cat.isActive = Boolean(isActive);
  cat.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_CATEGORY',
    details: `Kategori "${cat.name}" berhasil diperbarui.`,
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);

  res.json({ success: true, category: cat });
});

apiRouter.delete('/admin/categories/:id', requireAuth, (req: Request, res: Response) => {
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
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);

  res.json({ success: true });
});

// --- SERVICE LINKS CRUD ---
apiRouter.get('/admin/links', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.LINKS.sort((a, b) => a.order - b.order));
});

apiRouter.post('/admin/links', requireAuth, (req: Request, res: Response) => {
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
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Nama layanan wajib diisi.' });
    return;
  }
  if (!targetUrl || !targetUrl.trim()) {
    res.status(400).json({ error: 'URL tujuan wajib diisi.' });
    return;
  }

  // Validate URL format
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('mailto:') && !targetUrl.startsWith('tel:')) {
    res.status(400).json({ error: 'URL harus diawali dengan http://, https://, tel:, atau mailto:' });
    return;
  }

  const db = loadDatabase();
  const newLink: ServiceLink = {
    id: generateUUID(),
    name: name.trim(),
    categoryId: categoryId || '',
    description: description.trim(),
    iconType: iconType || 'lucide',
    icon: icon || 'Globe',
    targetUrl: targetUrl.trim(),
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
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);

  res.json({ success: true, link: newLink });
});

apiRouter.put('/admin/links/:id', requireAuth, (req: Request, res: Response) => {
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
  } = req.body;

  const db = loadDatabase();
  const link = db.LINKS.find((l) => l.id === id);
  if (!link) {
    res.status(404).json({ error: 'Layanan tidak ditemukan.' });
    return;
  }

  if (targetUrl) {
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('mailto:') && !targetUrl.startsWith('tel:')) {
      res.status(400).json({ error: 'URL harus diawali dengan http://, https://, tel:, atau mailto:' });
      return;
    }
    link.targetUrl = targetUrl.trim();
  }

  if (name !== undefined) link.name = name.trim();
  if (categoryId !== undefined) link.categoryId = categoryId;
  if (description !== undefined) link.description = description.trim();
  if (iconType !== undefined) link.iconType = iconType;
  if (icon !== undefined) link.icon = icon;
  if (targetOpen !== undefined) link.targetOpen = targetOpen;
  if (order !== undefined) link.order = Number(order);
  if (isActive !== undefined) link.isActive = Boolean(isActive);
  link.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_LINK',
    details: `Layanan "${link.name}" berhasil diperbarui.`,
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);

  res.json({ success: true, link });
});

apiRouter.post('/admin/links/:id/duplicate', requireAuth, (req: Request, res: Response) => {
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
  saveDatabase(db);
  res.json({ success: true, link: duplicated });
});

apiRouter.delete('/admin/links/:id', requireAuth, (req: Request, res: Response) => {
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
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);

  res.json({ success: true });
});

// --- REGISTRATIONS CRUD ---
apiRouter.get('/admin/registrations', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.REGISTRATIONS.sort((a, b) => a.order - b.order));
});

apiRouter.post('/admin/registrations', requireAuth, (req: Request, res: Response) => {
  const { title, description = '', bannerUrl = '', formUrl, startDate = '', endDate = '', status = 'open', order = 0, isActive = true } = req.body;
  if (!title || !formUrl) {
    res.status(400).json({ error: 'Judul dan URL formulir pendaftaran wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  const reg: Registration = {
    id: generateUUID(),
    title: title.trim(),
    description: description.trim(),
    bannerUrl: bannerUrl.trim(),
    formUrl: formUrl.trim(),
    startDate: startDate.trim(),
    endDate: endDate.trim(),
    status: status === 'closed' ? 'closed' : 'open',
    order: Number(order) || db.REGISTRATIONS.length + 1,
    isActive: Boolean(isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.REGISTRATIONS.push(reg);
  saveDatabase(db);
  res.json({ success: true, registration: reg });
});

apiRouter.put('/admin/registrations/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const reg = db.REGISTRATIONS.find((r) => r.id === id);
  if (!reg) {
    res.status(404).json({ error: 'Data pendaftaran tidak ditemukan.' });
    return;
  }

  Object.assign(reg, req.body, { updatedAt: new Date().toISOString() });
  saveDatabase(db);
  res.json({ success: true, registration: reg });
});

apiRouter.delete('/admin/registrations/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.REGISTRATIONS.findIndex((r) => r.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Data pendaftaran tidak ditemukan.' });
    return;
  }
  db.REGISTRATIONS.splice(index, 1);
  saveDatabase(db);
  res.json({ success: true });
});

// --- ANNOUNCEMENTS CRUD ---
apiRouter.get('/admin/announcements', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.ANNOUNCEMENTS.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

apiRouter.post('/admin/announcements', requireAuth, (req: Request, res: Response) => {
  const { title, content, imageUrl = '', publishDate, expiryDate, status = 'published' } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Judul dan isi pengumuman wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  const item: Announcement = {
    id: generateUUID(),
    title: title.trim(),
    content: content.trim(),
    imageUrl: imageUrl.trim(),
    publishDate: publishDate || new Date().toISOString().split('T')[0],
    expiryDate: expiryDate || '',
    status: status === 'draft' ? 'draft' : 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.ANNOUNCEMENTS.unshift(item);
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

  Object.assign(ann, req.body, { updatedAt: new Date().toISOString() });
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
  db.ANNOUNCEMENTS.splice(index, 1);
  saveDatabase(db);
  res.json({ success: true });
});

// --- DOCUMENTS CRUD ---
apiRouter.get('/admin/documents', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.DOCUMENTS.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

apiRouter.post('/admin/documents', requireAuth, (req: Request, res: Response) => {
  const { title, description = '', category = 'Umum', fileUrl, fileType = 'PDF', fileSize = '0 KB', isActive = true } = req.body;
  if (!title || !fileUrl) {
    res.status(400).json({ error: 'Judul dan tautan/file dokumen wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  const doc: DocumentItem = {
    id: generateUUID(),
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    fileUrl: fileUrl.trim(),
    fileType: fileType.toUpperCase(),
    fileSize,
    downloadCount: 0,
    isActive: Boolean(isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.DOCUMENTS.push(doc);
  saveDatabase(db);
  res.json({ success: true, document: doc });
});

apiRouter.put('/admin/documents/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const doc = db.DOCUMENTS.find((d) => d.id === id);
  if (!doc) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }

  Object.assign(doc, req.body, { updatedAt: new Date().toISOString() });
  saveDatabase(db);
  res.json({ success: true, document: doc });
});

apiRouter.delete('/admin/documents/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.DOCUMENTS.findIndex((d) => d.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }
  db.DOCUMENTS.splice(index, 1);
  saveDatabase(db);
  res.json({ success: true });
});

// --- SETTINGS ---
apiRouter.get('/admin/settings', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.SITE_SETTINGS);
});

apiRouter.put('/admin/settings', requireAuth, (req: Request, res: Response) => {
  const db = loadDatabase();
  Object.assign(db.SITE_SETTINGS, req.body, { updatedAt: new Date().toISOString() });
  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'UPDATE_SETTINGS',
    details: 'Pengaturan identitas dan tampilan portal diperbarui.',
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);
  res.json({ success: true, settings: db.SITE_SETTINGS });
});

// --- QR SETTINGS ---
apiRouter.get('/admin/qr-settings', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.QR_SETTINGS);
});

apiRouter.put('/admin/qr-settings', requireAuth, (req: Request, res: Response) => {
  const db = loadDatabase();
  Object.assign(db.QR_SETTINGS, req.body, { updatedAt: new Date().toISOString() });
  saveDatabase(db);
  res.json({ success: true, qrSettings: db.QR_SETTINGS });
});

// --- ACTIVITY LOGS ---
apiRouter.get('/admin/activity-logs', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.ACTIVITY_LOGS);
});

// --- USER MANAGEMENT ---
apiRouter.get('/admin/users', requireAuth, (_req: Request, res: Response) => {
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

apiRouter.post('/admin/users', requireAuth, (req: Request, res: Response) => {
  const { username, fullName, email, password, role = 'operator' } = req.body;
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
  if (db.USERS.some((u) => u.username.toLowerCase() === username.toLowerCase().trim())) {
    res.status(400).json({ error: 'Username sudah digunakan oleh akun lain.' });
    return;
  }

  const salt = generateSalt();
  const passwordHash = hashPasswordSync(password, salt);
  const newUser: User = {
    id: generateUUID(),
    username: username.trim(),
    fullName: fullName.trim(),
    email: (email || '').trim(),
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
  saveDatabase(db);
  res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
});

apiRouter.put('/admin/users/:id/toggle-status', requireAuth, (req: Request, res: Response) => {
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
  saveDatabase(db);
  res.json({ success: true, isActive: user.isActive });
});

// --- BACKUP & RESTORE ---
apiRouter.get('/admin/backups', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.BACKUP_LOGS);
});

apiRouter.post('/admin/backup', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).currentUser as User;
  const result = backupDatabase(user.username, req.body.notes || 'Manual admin backup');
  res.json({ success: true, backup: result });
});

apiRouter.get('/admin/export-database', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=DB_PORTAL_DIGITAL_${Date.now()}.json`);
  res.send(JSON.stringify(db, null, 2));
});

apiRouter.post('/admin/restore', requireAuth, (req: Request, res: Response) => {
  const { jsonContent } = req.body;
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

// --- GOOGLE APPS SCRIPT EXPORTER ---
apiRouter.get('/admin/gas-files', requireAuth, (_req: Request, res: Response) => {
  const files = getAllGasFiles();
  res.json({ files });
});

// --- STARTER SEED (Optional for admin testing, default is strictly empty) ---
apiRouter.post('/admin/seed-starter', requireAuth, (req: Request, res: Response) => {
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
    ipAddress: req.ip || '127.0.0.1',
  });
  saveDatabase(db);

  res.json({ success: true, message: 'Paket layanan awal berhasil ditambahkan.' });
});

// ----------------------------------------------------
// COMMITTEE CONTACTS (Saluran WhatsApp Panitia)
// ----------------------------------------------------
apiRouter.get('/public/committee-contacts', (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.COMMITTEE_CONTACTS || DEFAULT_COMMITTEE_CONTACTS);
});

apiRouter.get('/admin/committee-contacts', requireAuth, (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json(db.COMMITTEE_CONTACTS || DEFAULT_COMMITTEE_CONTACTS);
});

apiRouter.post('/admin/committee-contacts', requireAuth, (req: Request, res: Response) => {
  const { name, role, whatsappNumber, notes = '', isAvailable = true } = req.body;
  if (!name || !whatsappNumber) {
    res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  if (!db.COMMITTEE_CONTACTS) db.COMMITTEE_CONTACTS = [...DEFAULT_COMMITTEE_CONTACTS];

  const contact: CommitteeContact = {
    id: generateUUID(),
    name: name.trim(),
    role: (role || 'Panitia').trim(),
    whatsappNumber: whatsappNumber.trim(),
    notes: notes.trim(),
    isAvailable: Boolean(isAvailable),
  };

  db.COMMITTEE_CONTACTS.push(contact);
  saveDatabase(db);
  res.json({ success: true, contact });
});

apiRouter.put('/admin/committee-contacts/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.COMMITTEE_CONTACTS) db.COMMITTEE_CONTACTS = [...DEFAULT_COMMITTEE_CONTACTS];

  const c = db.COMMITTEE_CONTACTS.find((item) => item.id === id);
  if (!c) {
    res.status(404).json({ error: 'Kontak panitia tidak ditemukan.' });
    return;
  }

  Object.assign(c, req.body);
  saveDatabase(db);
  res.json({ success: true, contact: c });
});

apiRouter.delete('/admin/committee-contacts/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.COMMITTEE_CONTACTS) db.COMMITTEE_CONTACTS = [...DEFAULT_COMMITTEE_CONTACTS];

  const index = db.COMMITTEE_CONTACTS.findIndex((item) => item.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Kontak panitia tidak ditemukan.' });
    return;
  }

  db.COMMITTEE_CONTACTS.splice(index, 1);
  saveDatabase(db);
  res.json({ success: true });
});

// ----------------------------------------------------
// DAFTARKAN PRESTASI (Student Achievement Registration)
// ----------------------------------------------------

/**
 * Search applicant by name / registration number to verify previous registration
 */
apiRouter.get('/public/achievements/search-applicant', (req: Request, res: Response) => {
  const query = ((req.query.query as string) || '').trim().toLowerCase();
  const db = loadDatabase();

  // Search existing achievements or sample registered applicants
  const registeredPool = [
    { name: 'Muhammad Zaki Pratama', nisn: '0071234561', registeredProgram: 'PPDB MA Plus MM 2026/2027 (IPA Terpadu)' },
    { name: 'Aisyah Humaira', nisn: '0071234562', registeredProgram: 'PPDB MA Plus MM 2026/2027 (Tahfidz Al-Qur\'an)' },
    { name: 'Fatih Ar-Rasyid', nisn: '0071234563', registeredProgram: 'PPDB MA Plus MM 2026/2027 (Keagamaan)' },
    { name: 'Nabila Syakira', nisn: '0071234564', registeredProgram: 'PPDB MA Plus MM 2026/2027 (IPS Terpadu)' },
    { name: 'Ahmad Raihan Kamil', nisn: '0071234565', registeredProgram: 'PPDB MA Plus MM 2026/2027 (Riset Sains)' },
  ];

  // Also include any students already registered in achievements
  if (db.STUDENT_ACHIEVEMENTS) {
    db.STUDENT_ACHIEVEMENTS.forEach((ach) => {
      if (!registeredPool.some((p) => p.name.toLowerCase() === ach.studentName.toLowerCase())) {
        registeredPool.push({
          name: ach.studentName,
          nisn: ach.registrationNumberOrNisn,
          registeredProgram: 'Pendaftar Terverifikasi MA Plus MM',
        });
      }
    });
  }

  if (!query) {
    res.json({ results: registeredPool });
    return;
  }

  const filtered = registeredPool.filter(
    (item) => item.name.toLowerCase().includes(query) || item.nisn.toLowerCase().includes(query)
  );

  res.json({ results: filtered });
});

/**
 * Submit achievement with certificate document
 */
apiRouter.post('/public/achievements', (req: Request, res: Response) => {
  const {
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
  } = req.body;

  if (!studentName || !registrationNumberOrNisn || !achievementTitle || !certificateUrl) {
    res.status(400).json({
      error: 'Nama pendaftar, NISN/No Pendaftaran, judul prestasi, dan berkas sertifikat/piagam wajib diisi.',
    });
    return;
  }

  const db = loadDatabase();
  if (!db.STUDENT_ACHIEVEMENTS) db.STUDENT_ACHIEVEMENTS = [];

  const newAchievement: StudentAchievement = {
    id: generateUUID(),
    studentName: studentName.trim(),
    registrationNumberOrNisn: registrationNumberOrNisn.trim(),
    achievementTitle: achievementTitle.trim(),
    field,
    level,
    rank,
    organizer: organizer.trim(),
    year: year.trim(),
    certificateUrl,
    certificateFileName,
    notes: notes.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.STUDENT_ACHIEVEMENTS.unshift(newAchievement);

  addActivityLog(db, {
    userId: 'public_applicant',
    username: studentName.trim(),
    action: 'SUBMIT_ACHIEVEMENT',
    details: `Pengajuan prestasi "${achievementTitle}" oleh ${studentName} (${level} - ${rank})`,
    ipAddress: req.ip || '127.0.0.1',
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

apiRouter.put('/admin/achievements/:id/verify', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const db = loadDatabase();
  if (!db.STUDENT_ACHIEVEMENTS) db.STUDENT_ACHIEVEMENTS = [];

  const ach = db.STUDENT_ACHIEVEMENTS.find((item) => item.id === id);
  if (!ach) {
    res.status(404).json({ error: 'Data prestasi tidak ditemukan.' });
    return;
  }

  ach.status = status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : 'pending';
  if (notes !== undefined) ach.notes = notes;
  ach.updatedAt = new Date().toISOString();

  const user = (req as any).currentUser as User;
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'VERIFY_ACHIEVEMENT',
    details: `Verifikasi prestasi "${ach.achievementTitle}" milik ${ach.studentName} diubah menjadi ${ach.status}`,
    ipAddress: req.ip || '127.0.0.1',
  });

  saveDatabase(db);
  res.json({ success: true, achievement: ach });
});

apiRouter.delete('/admin/achievements/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.STUDENT_ACHIEVEMENTS) db.STUDENT_ACHIEVEMENTS = [];

  const index = db.STUDENT_ACHIEVEMENTS.findIndex((item) => item.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Data prestasi tidak ditemukan.' });
    return;
  }

  const deleted = db.STUDENT_ACHIEVEMENTS.splice(index, 1)[0];
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

apiRouter.post('/admin/madrasah-achievements', requireAuth, (req: Request, res: Response) => {
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
  } = req.body;

  if (!title || !title.trim()) {
    res.status(400).json({ error: 'Judul prestasi madrasah wajib diisi.' });
    return;
  }

  const db = loadDatabase();
  if (!db.MADRASAH_ACHIEVEMENTS) db.MADRASAH_ACHIEVEMENTS = [];

  const newAch: MadrasahAchievement = {
    id: generateUUID(),
    title: title.trim(),
    category: category.trim(),
    level: level.trim(),
    recipient: recipient.trim(),
    year: String(year).trim(),
    photoUrl: photoUrl.trim() || 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=800&q=80',
    shortDescription: (shortDescription || '').trim(),
    order: Number(order) || (db.MADRASAH_ACHIEVEMENTS.length + 1),
    isActive: Boolean(isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.MADRASAH_ACHIEVEMENTS.push(newAch);
  saveDatabase(db);
  res.json({ success: true, achievement: newAch });
});

apiRouter.put('/admin/madrasah-achievements/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.MADRASAH_ACHIEVEMENTS) db.MADRASAH_ACHIEVEMENTS = [];

  const index = db.MADRASAH_ACHIEVEMENTS.findIndex((a) => a.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Prestasi madrasah tidak ditemukan.' });
    return;
  }

  db.MADRASAH_ACHIEVEMENTS[index] = {
    ...db.MADRASAH_ACHIEVEMENTS[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  saveDatabase(db);
  res.json({ success: true, achievement: db.MADRASAH_ACHIEVEMENTS[index] });
});

apiRouter.delete('/admin/madrasah-achievements/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.MADRASAH_ACHIEVEMENTS) db.MADRASAH_ACHIEVEMENTS = [];

  const index = db.MADRASAH_ACHIEVEMENTS.findIndex((a) => a.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Prestasi madrasah tidak ditemukan.' });
    return;
  }

  const deleted = db.MADRASAH_ACHIEVEMENTS.splice(index, 1)[0];
  saveDatabase(db);
  res.json({ success: true, deleted });
});

// ----------------------------------------------------
// SEED OFFICIAL MA PLUS MM PORTAL (8 Official Services)
// ----------------------------------------------------
apiRouter.post('/admin/seed-ma-plus-mm', requireAuth, (req: Request, res: Response) => {
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

  // Set institution details specifically for MA PLUS MM
  db.SITE_SETTINGS.institutionName = "MA PLUS MA'HADUL MUTA'ALLIMIN";
  db.SITE_SETTINGS.portalName = 'PORTAL DIGITAL TERPADU';
  db.SITE_SETTINGS.tagline = 'One QR Code – One Portal – All Digital Services';
  db.SITE_SETTINGS.description = 'Pusat akses resmi seluruh layanan digital, pendaftaran PPDB, pendaftaran prestasi, dan saluran informasi resmi MA Plus MM.';
  db.SITE_SETTINGS.email = 'tumaplusmahadulmutaallimin@gmail.com';
  db.SITE_SETTINGS.whatsappNumber = '+6281234567890';
  db.SITE_SETTINGS.announcementsEnabled = true;

  // Add default committee contacts
  db.COMMITTEE_CONTACTS = [...DEFAULT_COMMITTEE_CONTACTS];

  // Add initial official announcement with prominent image banner
  if (db.ANNOUNCEMENTS.length === 0) {
    db.ANNOUNCEMENTS = [
      {
        id: generateUUID(),
        title: 'Pengumuman Penting: Pembukaan PPDB & Seleksi Beasiswa Jalur Prestasi MA Plus MM',
        content: `Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nTelah dibuka Penerimaan Peserta Didik & Santri Baru (PPDB) MA Plus Ma'hadul Muta'allimin Tahun Ajaran 2026/2027.\n\nBagi calon santri yang memiliki prestasi di bidang Tahfidz Al-Qur'an, Sains, Bahasa, Olahraga, atau Seni Budaya dapat mendaftarkan prestasinya secara daring melalui menu "Daftarkan Prestasi" dengan mengunggah dokumen piagam/sertifikat pendukung guna memperoleh prioritas beasiswa santri berprestasi.\n\nInformasi lebih lanjut dapat menghubungi kontak panitia pada menu Saluran WhatsApp Resmi.`,
        imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop',
        publishDate: new Date().toISOString().split('T')[0],
        status: 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'SEED_MA_PLUS_MM',
    details: 'Paket resmi layanan MA Plus MM berhasil diaktifkan dengan 8 ikon beresolusi tinggi.',
    ipAddress: req.ip || '127.0.0.1',
  });

  saveDatabase(db);
  res.json({ success: true, message: 'Paket layanan resmi MA Plus MM berhasil diaktifkan.' });
});
