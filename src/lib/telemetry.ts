import type { AuthSession, PortalEventType } from '../types';
import {
  isCloudAdminReady,
  recordPortalEventInFirestore,
  recordPortalVisitInFirestore,
  upsertPortalSessionInFirestore,
} from './firestorePortal';

const VISITOR_STORAGE_KEY = 'PORTAL_VISITOR_UUID';
const SESSION_STORAGE_ID_KEY = 'PORTAL_SESSION_UUID';
const SESSION_FIRST_SEEN_KEY = 'PORTAL_SESSION_FIRST_SEEN_V1';
const SESSION_PAGEVIEWS_KEY = 'PORTAL_SESSION_PAGEVIEWS_V1';
const SESSION_ACTIONS_KEY = 'PORTAL_SESSION_ACTIONS_V1';
const VISIT_RECORDED_KEY_PREFIX = 'PORTAL_API_VISIT_SENT_';

function cleanId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return cleanId(`${prefix}_${crypto.randomUUID()}`);
  }
  return cleanId(`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
}

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,128}$/.test(existing)) {
      return existing;
    }
    const created = createId('vis');
    localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return createId('vis');
  }
}

export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,128}$/.test(existing)) {
      return existing;
    }
    const created = createId('ses');
    sessionStorage.setItem(SESSION_STORAGE_ID_KEY, created);
    return created;
  } catch {
    return createId('ses');
  }
}

export function getSessionFirstSeenAt(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_FIRST_SEEN_KEY);
    if (existing) return existing;
    const now = new Date().toISOString();
    sessionStorage.setItem(SESSION_FIRST_SEEN_KEY, now);
    return now;
  } catch {
    return new Date().toISOString();
  }
}

function bumpCounter(key: string, delta: number): number {
  try {
    const current = Number(sessionStorage.getItem(key) || '0') || 0;
    const next = Math.max(0, current + delta);
    sessionStorage.setItem(key, String(next));
    return next;
  } catch {
    return Math.max(0, delta);
  }
}

function readCounter(key: string): number {
  try {
    return Math.max(0, Number(sessionStorage.getItem(key) || '0') || 0);
  } catch {
    return 0;
  }
}

export function buildVisitId(sessionId: string, path: string, dayKey: string): string {
  const pathSlug = (path || '/').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'root';
  return cleanId(`v_${dayKey}_${sessionId}_${pathSlug}`);
}

export function getSessionDurationSeconds(): number {
  const startMs = new Date(getSessionFirstSeenAt()).getTime();
  if (!Number.isFinite(startMs)) return 0;
  return Math.max(0, Math.round((Date.now() - startMs) / 1000));
}

export function getSafeHref(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return trimmed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function trackPortalVisit(params: {
  path?: string;
  session?: AuthSession | null;
}): Promise<void> {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const firstSeenAt = getSessionFirstSeenAt();
  const path = (params.path || (typeof window !== 'undefined' ? window.location.pathname : '/')).slice(0, 200);
  const dayKey = new Date().toISOString().split('T')[0];
  const visitId = buildVisitId(sessionId, path, dayKey);
  const sentKey = `${VISIT_RECORDED_KEY_PREFIX}${visitId}`;

  let alreadySent = false;
  try {
    alreadySent = sessionStorage.getItem(sentKey) === '1';
  } catch {}

  const pageViews = alreadySent ? readCounter(SESSION_PAGEVIEWS_KEY) : bumpCounter(SESSION_PAGEVIEWS_KEY, 1);
  const actionsCount = readCounter(SESSION_ACTIONS_KEY);
  const hasAuth = Boolean(params.session?.token && !params.session.user.mustChangePassword);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hasAuth && params.session?.token) {
    headers.Authorization = `Bearer ${params.session.token}`;
  }

  const referrer = typeof document !== 'undefined' ? document.referrer : '';

  await Promise.allSettled([
    alreadySent
      ? Promise.resolve()
      : fetch('/api/public/visit', {
          method: 'POST',
          headers,
          body: JSON.stringify({ visitorId, sessionId, visitId, path, referrer }),
        })
          .then((res) => {
            if (res.ok) {
              try {
                sessionStorage.setItem(sentKey, '1');
              } catch {}
            }
          })
          .catch(() => {}),
    recordPortalVisitInFirestore({
      visitId,
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      path,
      referrer,
      dayKey,
    }),
    alreadySent
      ? Promise.resolve()
      : recordPortalEventInFirestore({
          id: cleanId(`evt_${visitId}`),
          sessionId,
          visitorId,
          actorType: hasAuth ? 'authenticated' : 'anonymous',
          username: params.session?.user?.username,
          role: params.session?.user?.role,
          eventType: 'PORTAL_VISIT',
          path,
          details: `Kunjungan portal pada ${path}`,
        }),
    upsertPortalSessionInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      userId: params.session?.user?.id,
      username: params.session?.user?.username || 'Pengunjung Publik',
      role: params.session?.user?.role || 'visitor',
      status: 'online',
      firstSeenAt,
      durationSeconds: getSessionDurationSeconds(),
      currentPath: path,
      currentMenu: hasAuth ? 'Dashboard Administrator' : 'Portal Publik',
      pageViews,
      actionsCount,
    }),
  ]);
}

export async function sendHeartbeat(params: {
  currentPath?: string;
  currentMenu: string;
  session?: AuthSession | null;
  incrementPageViews?: number;
  incrementActions?: number;
}): Promise<void> {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const firstSeenAt = getSessionFirstSeenAt();
  const currentPath = (
    params.currentPath || (typeof window !== 'undefined' ? window.location.pathname : '/')
  ).slice(0, 200);
  const pageViews = params.incrementPageViews
    ? bumpCounter(SESSION_PAGEVIEWS_KEY, params.incrementPageViews)
    : readCounter(SESSION_PAGEVIEWS_KEY);
  const actionsCount = params.incrementActions
    ? bumpCounter(SESSION_ACTIONS_KEY, params.incrementActions)
    : readCounter(SESSION_ACTIONS_KEY);

  const hasAuth = Boolean(params.session?.token && !params.session.user.mustChangePassword);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hasAuth && params.session?.token) {
    headers.Authorization = `Bearer ${params.session.token}`;
  }

  await Promise.allSettled([
    fetch('/api/public/session/heartbeat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        visitorId,
        currentPath,
        currentMenu: params.currentMenu,
        incrementPageViews: params.incrementPageViews || 0,
        incrementActions: params.incrementActions || 0,
      }),
    }).catch(() => {}),
    upsertPortalSessionInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      userId: params.session?.user?.id,
      username: params.session?.user?.username || 'Pengunjung Publik',
      role: params.session?.user?.role || 'visitor',
      status: 'online',
      firstSeenAt,
      durationSeconds: getSessionDurationSeconds(),
      currentPath,
      currentMenu: params.currentMenu,
      pageViews,
      actionsCount,
    }),
  ]);
}

export function sendOfflineBeacon(params: {
  currentPath?: string;
  currentMenu: string;
  session?: AuthSession | null;
}): void {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const firstSeenAt = getSessionFirstSeenAt();
  const currentPath = (
    params.currentPath || (typeof window !== 'undefined' ? window.location.pathname : '/')
  ).slice(0, 200);
  const pageViews = readCounter(SESSION_PAGEVIEWS_KEY);
  const actionsCount = readCounter(SESSION_ACTIONS_KEY);
  const endedAt = new Date().toISOString();
  const payload = JSON.stringify({
    sessionId,
    visitorId,
    currentPath,
    currentMenu: params.currentMenu,
  });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'text/plain' });
      navigator.sendBeacon('/api/public/session/offline', blob);
    } catch {
      // Fallback below
    }
  } else if (typeof fetch === 'function') {
    fetch('/api/public/session/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }

  const hasAuth = Boolean(params.session?.token && !params.session.user.mustChangePassword);
  void upsertPortalSessionInFirestore({
    sessionId,
    visitorId,
    actorType: hasAuth ? 'authenticated' : 'anonymous',
    userId: params.session?.user?.id,
    username: params.session?.user?.username || 'Pengunjung Publik',
    role: params.session?.user?.role || 'visitor',
    status: 'offline',
    firstSeenAt,
    endedAt,
    durationSeconds: getSessionDurationSeconds(),
    currentPath,
    currentMenu: params.currentMenu,
    pageViews,
    actionsCount,
  });
}

export async function trackPortalEvent(params: {
  eventType: 'MENU_NAVIGATE' | 'SERVICE_CLICK' | 'DOCUMENT_DOWNLOAD' | 'ACHIEVEMENT_SUBMIT';
  targetId?: string;
  targetName?: string;
  categoryId?: string;
  path?: string;
  details: string;
  session?: AuthSession | null;
}): Promise<void> {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const firstSeenAt = getSessionFirstSeenAt();
  const path = (params.path || (typeof window !== 'undefined' ? window.location.pathname : '/')).slice(0, 200);
  const actionsCount = bumpCounter(SESSION_ACTIONS_KEY, 1);
  const pageViews = readCounter(SESSION_PAGEVIEWS_KEY);

  const hasAuth = Boolean(params.session?.token && !params.session.user.mustChangePassword);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hasAuth && params.session?.token) {
    headers.Authorization = `Bearer ${params.session.token}`;
  }

  await Promise.allSettled([
    fetch('/api/public/event', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        visitorId,
        eventType: params.eventType,
        targetId: params.targetId,
        targetName: params.targetName,
        categoryId: params.categoryId,
        path,
        details: params.details,
      }),
    }).catch(() => {}),
    recordPortalEventInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      username: params.session?.user?.username,
      role: params.session?.user?.role,
      eventType: params.eventType,
      targetId: params.targetId,
      targetName: params.targetName,
      categoryId: params.categoryId,
      path,
      details: params.details,
    }),
    upsertPortalSessionInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      userId: params.session?.user?.id,
      username: params.session?.user?.username || 'Pengunjung Publik',
      role: params.session?.user?.role || 'visitor',
      status: 'online',
      firstSeenAt,
      durationSeconds: getSessionDurationSeconds(),
      currentPath: path,
      currentMenu: params.targetName || 'Portal Publik',
      pageViews,
      actionsCount,
    }),
  ]);
}

export async function trackServiceClick(params: {
  linkId: string;
  linkName: string;
  categoryId?: string;
  session?: AuthSession | null;
}): Promise<void> {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const firstSeenAt = getSessionFirstSeenAt();
  const actionsCount = bumpCounter(SESSION_ACTIONS_KEY, 1);
  const pageViews = readCounter(SESSION_PAGEVIEWS_KEY);
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const hasAuth = Boolean(params.session?.token && !params.session.user.mustChangePassword);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hasAuth && params.session?.token) {
    headers.Authorization = `Bearer ${params.session.token}`;
  }

  await Promise.allSettled([
    fetch(`/api/public/click/${encodeURIComponent(params.linkId)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ visitorId, sessionId }),
    }).catch(() => {}),
    recordPortalEventInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      username: params.session?.user?.username,
      role: params.session?.user?.role,
      eventType: 'SERVICE_CLICK',
      targetId: params.linkId,
      targetName: params.linkName,
      categoryId: params.categoryId,
      path,
      details: `Mengklik layanan ${params.linkName}`,
    }),
    upsertPortalSessionInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      userId: params.session?.user?.id,
      username: params.session?.user?.username || 'Pengunjung Publik',
      role: params.session?.user?.role || 'visitor',
      status: 'online',
      firstSeenAt,
      durationSeconds: getSessionDurationSeconds(),
      currentPath: path,
      currentMenu: params.linkName,
      pageViews,
      actionsCount,
    }),
  ]);
}

export async function trackDocumentDownload(params: {
  docId: string;
  docTitle: string;
  session?: AuthSession | null;
}): Promise<void> {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const firstSeenAt = getSessionFirstSeenAt();
  const actionsCount = bumpCounter(SESSION_ACTIONS_KEY, 1);
  const pageViews = readCounter(SESSION_PAGEVIEWS_KEY);
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const hasAuth = Boolean(params.session?.token && !params.session.user.mustChangePassword);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hasAuth && params.session?.token) {
    headers.Authorization = `Bearer ${params.session.token}`;
  }

  await Promise.allSettled([
    fetch(`/api/public/download/${encodeURIComponent(params.docId)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ visitorId, sessionId }),
    }).catch(() => {}),
    recordPortalEventInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      username: params.session?.user?.username,
      role: params.session?.user?.role,
      eventType: 'DOCUMENT_DOWNLOAD',
      targetId: params.docId,
      targetName: params.docTitle,
      path,
      details: `Mengunduh dokumen ${params.docTitle}`,
    }),
    upsertPortalSessionInFirestore({
      sessionId,
      visitorId,
      actorType: hasAuth ? 'authenticated' : 'anonymous',
      userId: params.session?.user?.id,
      username: params.session?.user?.username || 'Pengunjung Publik',
      role: params.session?.user?.role || 'visitor',
      status: 'online',
      firstSeenAt,
      durationSeconds: getSessionDurationSeconds(),
      currentPath: path,
      currentMenu: params.docTitle,
      pageViews,
      actionsCount,
    }),
  ]);
}

export async function recordAdminCloudAction(params: {
  session?: AuthSession | null;
  targetId?: string;
  targetName?: string;
  details: string;
}): Promise<void> {
  if (!isCloudAdminReady()) return;
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  await recordPortalEventInFirestore({
    sessionId,
    visitorId,
    actorType: 'authenticated',
    username: params.session?.user?.username || 'admin',
    role: params.session?.user?.role || 'admin',
    eventType: 'ADMIN_ACTION',
    targetId: params.targetId,
    targetName: params.targetName,
    path: '/admin',
    details: params.details,
  });
}
