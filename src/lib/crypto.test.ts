import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSalt,
  hashPasswordSync,
  verifyPassword,
  generateTemporaryPassword,
  validatePasswordStrength,
  generateSessionToken,
  generateUUID,
} from './crypto';

test('crypto: generates unique salts', () => {
  const salt1 = generateSalt();
  const salt2 = generateSalt();
  assert.notEqual(salt1, salt2);
  assert.equal(salt1.length, 32); // 16 bytes = 32 hex chars
});

test('crypto: hashes and verifies password correctly', () => {
  const password = 'SuperSecretPassword123!';
  const salt = generateSalt();
  const hash = hashPasswordSync(password, salt);

  assert.ok(hash.length > 0);
  assert.equal(verifyPassword(password, hash, salt), true);
  assert.equal(verifyPassword('WrongPassword123!', hash, salt), false);
});

test('crypto: generates valid temporary password', () => {
  const tempPass = generateTemporaryPassword(14);
  assert.equal(tempPass.length, 14);
  const validation = validatePasswordStrength(tempPass);
  assert.equal(validation.isValid, true);
});

test('crypto: password strength validation enforces security rules', () => {
  // Too short
  assert.equal(validatePasswordStrength('Short1!').isValid, false);
  // Missing uppercase
  assert.equal(validatePasswordStrength('nouppercase123!').isValid, false);
  // Missing lowercase
  assert.equal(validatePasswordStrength('NOLOWERCASE123!').isValid, false);
  // Missing number
  assert.equal(validatePasswordStrength('NoNumbersHere!').isValid, false);
  // Missing symbol
  assert.equal(validatePasswordStrength('NoSymbols12345').isValid, false);
  // Strong password
  assert.equal(validatePasswordStrength('KuatBanget#2026').isValid, true);
});

test('crypto: generates unique session tokens and UUIDs', () => {
  const token = generateSessionToken();
  assert.equal(token.length, 64); // 32 bytes hex = 64 chars
  const uuid = generateUUID();
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});
