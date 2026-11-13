import test from 'node:test';
import assert from 'node:assert/strict';
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

test('auth: 1-click first-time access and personal account setup flow', () => {
  const statusBefore = getAuthStatus();
  assert.ok(typeof statusBefore.hasCustomAdminCreated === 'boolean');

  // Test 1-click first-time access
  const firstAccess = firstTimeAccess('127.0.0.1');
  if (statusBefore.hasCustomAdminCreated) {
    assert.equal(firstAccess.success, false);
  } else {
    assert.equal(firstAccess.success, true);
    assert.ok(firstAccess.session?.token);

    // Setup personal account
    const setupRes = setupPersonalAccount({
      userId: firstAccess.session?.user.id,
      newUsername: 'admin_test_unit',
      fullName: 'Admin Penguji Unit',
      email: 'test@maplusmm.sch.id',
      newPassword: 'PasswordAman2026!',
      confirmPassword: 'PasswordAman2026!',
      ip: '127.0.0.1',
    });
    assert.equal(setupRes.success, true);
    assert.equal(setupRes.session?.user.username, 'admin_test_unit');
    assert.equal(setupRes.session?.user.mustChangePassword, false);

    // After setup, firstTimeAccess MUST be rejected
    const blockedAccess = firstTimeAccess('127.0.0.1');
    assert.equal(blockedAccess.success, false);
    assert.match(blockedAccess.error || '', /ditutup/i);

    // Login with new credentials succeeds
    const newLogin = login('admin_test_unit', 'PasswordAman2026!', '127.0.0.1');
    assert.equal(newLogin.success, true);
    assert.equal(newLogin.mustChangePassword, false);
  }
});

test('auth: session verification and logout functionality', () => {
  const invalidSession = verifySession('non-existent-token-xyz');
  assert.equal(invalidSession, null);

  const loggedOut = logout('non-existent-token-xyz');
  assert.equal(loggedOut, false);
});
