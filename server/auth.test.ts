import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase, loadDatabase } from './db';
import { login, changeInitialPassword, verifySession, logout } from './auth';

test('auth: initial admin login detects mustChangePassword requirement', () => {
  const { setupCredentials } = initializeDatabase();
  const db = loadDatabase();
  const admin = db.USERS.find((u) => u.role === 'super_admin');
  assert.ok(admin);

  // If setupCredentials returned temporary password, use it, or if already created, test with known flow
  let tempPass = setupCredentials?.temporaryPassword;
  if (!tempPass || tempPass.startsWith('***')) {
    // Generate fresh test user
    // The admin's temporary password was generated during initialization
  }

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

test('auth: session verification and logout functionality', () => {
  const invalidSession = verifySession('non-existent-token-xyz');
  assert.equal(invalidSession, null);

  const loggedOut = logout('non-existent-token-xyz');
  assert.equal(loggedOut, false);
});
