import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import http from 'node:http';
import express from 'express';

const tmpMonitorDbFile = path.join(os.tmpdir(), `test_portal_monitoring_${Date.now()}.json`);
process.env.PORTAL_DB_FILE = tmpMonitorDbFile;

import {
  initializeDatabase,
  loadDatabase,
  saveDatabase,
  pruneAndUpdateSessionStatuses,
  ONLINE_WINDOW_MS,
} from './db.js';
import { login, changeInitialPassword } from './auth.js';
import { apiRouter } from './routes.js';

let server: http.Server;
let baseUrl = '';

test.before(async () => {
  initializeDatabase();
  const app = express();
  app.use('/api', apiRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to bind test HTTP server');
  }
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  try {
    if (fs.existsSync(tmpMonitorDbFile)) fs.unlinkSync(tmpMonitorDbFile);
  } catch {
    // ignore cleanup errors
  }
});

test('monitoring: anonymous heartbeat, offline text/plain beacon, and 60s stale window', async () => {
  const sessionId = 'ses_test_anon_1';
  const visitorId = 'vis_test_anon_1';

  const hbRes = await fetch(`${baseUrl}/api/public/session/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      visitorId,
      currentPath: '/',
      currentMenu: 'Portal Publik',
      incrementPageViews: 1,
    }),
  });
  assert.equal(hbRes.status, 200);
  const hbJson = (await hbRes.json()) as any;
  assert.equal(hbJson.success, true);
  assert.equal(hbJson.session.actorType, 'anonymous');
  assert.equal(hbJson.session.username, 'Pengunjung Publik');
  assert.equal(hbJson.session.status, 'online');

  // Offline beacon via text/plain (simulating navigator.sendBeacon)
  const offRes = await fetch(`${baseUrl}/api/public/session/offline`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      sessionId,
      visitorId,
      currentPath: '/',
      currentMenu: 'Keluar Halaman',
    }),
  });
  assert.equal(offRes.status, 200);
  const offJson = (await offRes.json()) as any;
  assert.equal(offJson.success, true);
  assert.equal(offJson.session.status, 'offline');
  assert.ok(offJson.session.endedAt);

  // Stale session transition beyond ONLINE_WINDOW_MS (60s)
  const staleSessionId = 'ses_test_stale_2';
  await fetch(`${baseUrl}/api/public/session/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: staleSessionId,
      visitorId: 'vis_test_stale_2',
      currentPath: '/',
      currentMenu: 'Portal Publik',
    }),
  });

  const db = loadDatabase();
  const stale = db.USER_SESSIONS?.find((s) => s.sessionId === staleSessionId);
  assert.ok(stale);
  const pastIso = new Date(Date.now() - ONLINE_WINDOW_MS - 15000).toISOString();
  stale.firstSeenAt = new Date(Date.now() - 120000).toISOString();
  stale.lastActiveAt = pastIso;
  saveDatabase(db);

  const dbCheck = loadDatabase();
  const changed = pruneAndUpdateSessionStatuses(dbCheck);
  assert.equal(changed, true);
  const pruned = dbCheck.USER_SESSIONS?.find((s) => s.sessionId === staleSessionId);
  assert.equal(pruned?.status, 'offline');
  assert.ok((pruned?.durationSeconds || 0) >= 40);
});

test('monitoring: visit deduplication prevents duplicate inflation within 30m window', async () => {
  const visitPayload = {
    visitorId: 'vis_dedup_1',
    sessionId: 'ses_dedup_1',
    visitId: 'v_2026_11_13_ses_dedup_1_root',
    path: '/',
  };

  const first = await fetch(`${baseUrl}/api/public/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visitPayload),
  });
  assert.equal(first.status, 200);
  const firstJson = (await first.json()) as any;
  assert.equal(firstJson.deduplicated, false);

  // Second hit with same visitor & path
  const second = await fetch(`${baseUrl}/api/public/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visitPayload),
  });
  assert.equal(second.status, 200);
  const secondJson = (await second.json()) as any;
  assert.equal(secondJson.deduplicated, true);

  // Distinct visitor increments
  const distinct = await fetch(`${baseUrl}/api/public/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: 'vis_dedup_2',
      sessionId: 'ses_dedup_2',
      visitId: 'v_2026_11_13_ses_dedup_2_root',
      path: '/',
    }),
  });
  assert.equal(distinct.status, 200);
  const distinctJson = (await distinct.json()) as any;
  assert.equal(distinctJson.deduplicated, false);
});

test('monitoring & security: event allowlist, login/logout telemetry, RBAC, and unsafe URL rejection', async () => {
  // Reject disallowed eventType on public endpoint
  const badEvtRes = await fetch(`${baseUrl}/api/public/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'ses_evt_1',
      visitorId: 'vis_evt_1',
      eventType: 'ADMIN_ACTION',
      details: 'Attempt spoof',
    }),
  });
  assert.equal(badEvtRes.status, 400);

  // Failed login logs AUTH_LOGIN_FAILED
  const failedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: '131235210019',
      password: 'WrongPassword!123',
      sessionId: 'ses_bad_login',
      visitorId: 'vis_bad_login',
    }),
  });
  assert.equal(failedLogin.status, 401);

  // Fixed admin login succeeds
  const adminSessionId = 'ses_admin_live_1';
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: '131235210019',
      password: 'Bismillah3x',
      sessionId: adminSessionId,
      visitorId: 'vis_admin_1',
      path: '/admin',
    }),
  });
  assert.equal(adminLoginRes.status, 200);
  const adminLoginJson = (await adminLoginRes.json()) as any;
  const adminToken = adminLoginJson.session?.token;
  assert.ok(adminToken);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // Reject unsafe javascript: URL
  const unsafeLinkRes = await fetch(`${baseUrl}/api/admin/links`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Bad Link',
      targetUrl: 'javascript:alert(1)',
    }),
  });
  assert.equal(unsafeLinkRes.status, 400);

  // Create valid link
  const goodLinkRes = await fetch(`${baseUrl}/api/admin/links`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Portal Akademik',
      targetUrl: 'https://madrasah.example.id',
      clicksCount: 9999, // must be ignored (mass assignment protection)
    }),
  });
  assert.equal(goodLinkRes.status, 200);
  const goodLinkJson = (await goodLinkRes.json()) as any;
  assert.equal(goodLinkJson.link.clicksCount, 0);

  // Public click tracks click & event
  const clickRes = await fetch(`${baseUrl}/api/public/click/${goodLinkJson.link.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: 'vis_click_1', sessionId: 'ses_click_1' }),
  });
  assert.equal(clickRes.status, 200);

  // Create operator account to verify RBAC
  const createOpRes = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      username: 'operator_test',
      fullName: 'Operator Uji',
      password: 'Operator#Password2026',
      role: 'operator',
    }),
  });
  assert.equal(createOpRes.status, 200);

  // Operator logs in and completes mandatory initial password setup
  const dbBeforeOp = loadDatabase();
  const opUser = dbBeforeOp.USERS.find((u) => u.username === 'operator_test');
  assert.ok(opUser);
  const opLogin = login('operator_test', 'Operator#Password2026', '127.0.0.1', {
    sessionId: 'ses_op_1',
    visitorId: 'vis_op_1',
  });
  assert.equal(opLogin.success, true);
  const opSetup = changeInitialPassword(
    opUser.id,
    'Operator#Password2026',
    'Operator#Strong2026',
    'Operator#Strong2026',
    '127.0.0.1'
  );
  assert.equal(opSetup.success, true);
  const opToken = opSetup.session!.token;

  // Operator CAN access monitoring & announcements, CANNOT access users/backups/links mutations
  const opMonRes = await fetch(`${baseUrl}/api/admin/monitoring?period=today`, {
    headers: { Authorization: `Bearer ${opToken}` },
  });
  assert.equal(opMonRes.status, 200);

  const opUsersRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${opToken}` },
  });
  assert.equal(opUsersRes.status, 403);

  const opCreateLinkRes = await fetch(`${baseUrl}/api/admin/links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opToken}`,
    },
    body: JSON.stringify({ name: 'Unauthorized', targetUrl: 'https://example.com' }),
  });
  assert.equal(opCreateLinkRes.status, 403);

  // Verify monitoring summary reflects clicks, visits, and login history
  const monRes = await fetch(`${baseUrl}/api/admin/monitoring?period=today`, {
    headers: authHeaders,
  });
  assert.equal(monRes.status, 200);
  const mon = (await monRes.json()) as any;
  assert.ok(mon.totalVisits >= 2);
  assert.ok(mon.uniqueVisitors >= 2);
  assert.equal(mon.totalClicks, 1);
  assert.ok(mon.loginHistory.some((e: any) => e.eventType === 'AUTH_LOGIN'));
  assert.ok(mon.loginHistory.some((e: any) => e.eventType === 'AUTH_LOGIN_FAILED'));

  // Concurrent multi-user visits & heartbeats do not drop records
  await Promise.all(
    Array.from({ length: 6 }, (_, idx) =>
      fetch(`${baseUrl}/api/public/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: `vis_conc_${idx}`,
          sessionId: `ses_conc_${idx}`,
          visitId: `v_conc_${idx}`,
          path: '/',
        }),
      })
    )
  );
  const monAfterConc = (await (
    await fetch(`${baseUrl}/api/admin/monitoring?period=today`, { headers: authHeaders })
  ).json()) as any;
  assert.ok(monAfterConc.uniqueVisitors >= 8);

  // Admin logout updates session offline and logs AUTH_LOGOUT
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ sessionId: adminSessionId, visitorId: 'vis_admin_1' }),
  });
  assert.equal(logoutRes.status, 200);
  const dbAfterLogout = loadDatabase();
  const adminSessRecord = dbAfterLogout.USER_SESSIONS?.find((s) => s.sessionId === adminSessionId);
  assert.equal(adminSessRecord?.status, 'offline');
  assert.ok(dbAfterLogout.PORTAL_EVENTS?.some((e) => e.eventType === 'AUTH_LOGOUT'));
});
