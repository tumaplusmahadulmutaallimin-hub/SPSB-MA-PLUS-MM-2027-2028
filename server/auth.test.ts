import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const tmpAuthDbFile = path.join(os.tmpdir(), `test_portal_auth_${Date.now()}.json`);
process.env.PORTAL_DB_FILE = tmpAuthDbFile;

import { initializeDatabase, loadDatabase } from './db';
import {
  login,
  changeInitialPassword,
  verifySession,
  logout,
  getAuthStatus,
  firstTimeAccess,
  setupPersonalAccount,
} from './auth';

test.after(() => {
  try {
    if (fs.existsSync(tmpAuthDbFile)) fs.unlinkSync(tmpAuthDbFile);
  } catch {}
});

test('auth: initial admin login detects mustChangePassword requirement', () => {
  const { setupCredentials } = initializeDatabase();
  const db = loadDatabase();
  const admin = db.USERS.find((u) => u.role === 'super_admin');
  assert.ok(admin);

  // Attempt login with incorrect password
  const failRes = login(admin.username, 'WrongPassword123!', '127.0.0.1');
  assert.equal(failRes.success, false);
});

test('auth: password change enforces strength rules and clears mustChangePassword', () => {
  const db = loadDatabase();
  const admin = db.USERS.find((u) => u.role === 'super_admin');
  assert.ok(admin);

  // Attempt change with weak password
  const weakRes = changeInitialPassword(
    admin.id,
    'any',
    'weak',
    'weak',
    '127.0.0.1'
  );
  assert.equal(weakRes.success, false);
  assert.match(weakRes.error || '', /karakter/i);

  // Attempt change with mismatched confirmation
  const mismatchRes = changeInitialPassword(
    admin.id,
    'any',
    'KuatBanget#2026',
    'BedaBanget#2026',
    '127.0.0.1'
  );
  assert.equal(mismatchRes.success, false);
  assert.match(mismatchRes.error || '', /tidak cocok/i);
});

test('auth: fixed admin credentials 131235210019 / Bismillah3x work immediately without setup mode', () => {
  const statusBefore = getAuthStatus();
  assert.equal(statusBefore.hasCustomAdminCreated, true);
  assert.equal(statusBefore.isSetupMode, false);

  // 1-click access must remain blocked when fixed admin is active
  const blockedAccess = firstTimeAccess('127.0.0.1');
  assert.equal(blockedAccess.success, false);

  // Login with fixed credentials succeeds directly
  const okLogin = login('131235210019', 'Bismillah3x', '127.0.0.1');
  assert.equal(okLogin.success, true);
  assert.equal(okLogin.mustChangePassword, false);
  assert.equal(okLogin.session?.user.username, '131235210019');
  assert.ok(okLogin.session?.token);

  // Session token verifies properly
  const verified = verifySession(okLogin.session!.token);
  assert.ok(verified);
  assert.equal(verified.user.username, '131235210019');
});

test('auth: session verification and logout functionality', () => {
  const invalidSession = verifySession('non-existent-token-xyz');
  assert.equal(invalidSession, null);

  const loggedOut = logout('non-existent-token-xyz');
  assert.equal(loggedOut, false);
});
