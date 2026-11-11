import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha256';

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(length = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a password using PBKDF2-HMAC-SHA256
 */
export function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
}

/**
 * Synchronous hash password for quick testing or synchronous tasks
 */
export function hashPasswordSync(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
}

/**
 * Verify if candidate password matches stored hash with constant-time comparison
 */
export function verifyPassword(candidate: string, hash: string, salt: string): boolean {
  try {
    const candidateHash = hashPasswordSync(candidate, salt);
    const hashBuf = Buffer.from(hash, 'hex');
    const candBuf = Buffer.from(candidateHash, 'hex');
    if (hashBuf.length !== candBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, candBuf);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure temporary password
 * Contains uppercase, lowercase, numbers, and symbols
 */
export function generateTemporaryPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+~';
  const allChars = upper + lower + digits + symbols;

  // Guarantee at least one from each character set
  const guaranteed = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  const remainingLength = Math.max(0, length - guaranteed.length);
  const randomChars: string[] = [];

  for (let i = 0; i < remainingLength; i++) {
    const idx = crypto.randomInt(0, allChars.length);
    randomChars.push(allChars[idx]);
  }

  // Shuffle array using Fisher-Yates
  const combined = [...guaranteed, ...randomChars];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}

/**
 * Validate password strength
 * Rules: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password minimal terdiri dari 8 karakter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password harus mengandung minimal satu huruf besar (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password harus mengandung minimal satu huruf kecil (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password harus mengandung minimal satu angka (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(password)) {
    return { isValid: false, message: 'Password harus mengandung minimal satu karakter khusus/simbol.' };
  }
  return { isValid: true, message: 'Password memenuhi kriteria keamanan.' };
}

/**
 * Generate secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate unique UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
