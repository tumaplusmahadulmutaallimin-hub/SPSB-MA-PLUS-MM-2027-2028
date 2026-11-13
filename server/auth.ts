import crypto from 'node:crypto';
import { User, AuthSession } from '../src/types';
import {
  loadDatabase,
  saveDatabase,
  addActivityLog,
} from './db';
import {
  verifyPassword,
  hashPasswordSync,
  generateSalt,
  validatePasswordStrength,
} from '../src/lib/crypto';

// In-memory sessions cache & revoked token list
const activeSessions = new Map<string, { user: User; expiresAt: number }>();
const revokedTokens = new Set<string>();

// Rate-limiting tracking: IP/Username -> { attempts: number, lockedUntil: number }
const loginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || 'portal_digital_terpadu_ma_plus_mm_secret_key_2026';
}

interface SignedTokenPayload {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  mustChangePassword: boolean;
  expiresAt: number;
  nonce: string;
}

function createSignedSessionToken(user: User, expiresAt: number, forceMustChange?: boolean): string {
  const payload: SignedTokenPayload = {
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: forceMustChange !== undefined ? forceMustChange : Boolean(user.mustChangePassword),
    expiresAt,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySignedSessionToken(token: string): SignedTokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SignedTokenPayload;
    if (!payload.userId || !payload.expiresAt || Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function login(
  username: string,
  password: string,
  ip = '127.0.0.1'
): { success: boolean; session?: AuthSession; error?: string; mustChangePassword?: boolean } {
  const attemptKey = `${ip}_${username.toLowerCase()}`;
  const now = Date.now();
  const attemptRecord = loginAttempts.get(attemptKey);

  if (attemptRecord && attemptRecord.lockedUntil > now) {
    const minutesLeft = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
    return {
      success: false,
      error: `Terlalu banyak percobaan login gagal. Akun dikunci sementara selama ${minutesLeft} menit untuk keamanan.`,
    };
  }

  const db = loadDatabase();
  const user = db.USERS.find(
    (u) => u.username.toLowerCase() === username.toLowerCase().trim() && u.isActive
  );

  if (!user) {
    recordFailedAttempt(attemptKey);
    return { success: false, error: 'Username atau password tidak sesuai.' };
  }

  const isPasswordValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isPasswordValid) {
    recordFailedAttempt(attemptKey);
    addActivityLog(db, {
      userId: user.id,
      username: user.username,
      action: 'LOGIN_FAILED',
      details: `Percobaan login gagal dengan password salah dari IP ${ip}`,
      ipAddress: ip,
    });
    saveDatabase(db);
    return { success: false, error: 'Username atau password tidak sesuai.' };
  }

  // Login successful: reset failed attempts
  loginAttempts.delete(attemptKey);

  // Update last login
  user.lastLoginAt = new Date().toISOString();
  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'LOGIN_SUCCESS',
    details: `Login berhasil${user.mustChangePassword ? ' (Wajib ganti password pertama)' : ''}`,
    ipAddress: ip,
  });
  saveDatabase(db);

  // Generate stateless HMAC-signed session token
  const expiresAt = now + SESSION_TTL_MS;
  const token = createSignedSessionToken(user, expiresAt);
  activeSessions.set(token, { user, expiresAt });

  return {
    success: true,
    mustChangePassword: user.mustChangePassword,
    session: {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      expiresAt,
    },
  };
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const existing = loginAttempts.get(key) || { attempts: 0, lockedUntil: 0 };
  existing.attempts += 1;
  if (existing.attempts >= MAX_ATTEMPTS) {
    existing.lockedUntil = now + LOCKOUT_MS;
  }
  loginAttempts.set(key, existing);
}

export function changeInitialPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  ip = '127.0.0.1'
): { success: boolean; session?: AuthSession; error?: string } {
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Konfirmasi password baru tidak cocok.' };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.isValid) {
    return { success: false, error: strength.message };
  }

  const db = loadDatabase();
  const user = db.USERS.find((u) => u.id === userId && u.isActive);
  if (!user) {
    return { success: false, error: 'Pengguna tidak ditemukan atau tidak aktif.' };
  }

  const isCurrentValid = verifyPassword(currentPassword, user.passwordHash, user.salt);
  if (!isCurrentValid) {
    return { success: false, error: 'Password sementara saat ini tidak sesuai.' };
  }

  // Generate new salt and new hash
  const newSalt = generateSalt();
  const newHash = hashPasswordSync(newPassword, newSalt);

  user.salt = newSalt;
  user.passwordHash = newHash;
  user.mustChangePassword = false;
  user.updatedAt = new Date().toISOString();

  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'PASSWORD_CHANGED',
    details: 'Password akun administrator berhasil diganti permanen. Status mustChangePassword dinonaktifkan.',
    ipAddress: ip,
  });
  saveDatabase(db);

  // Invalidate old sessions for this user and create fresh session
  for (const [t, s] of activeSessions.entries()) {
    if (s.user.id === user.id) {
      activeSessions.delete(t);
    }
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = createSignedSessionToken(user, expiresAt, false);
  activeSessions.set(token, { user, expiresAt });

  return {
    success: true,
    session: {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: false,
      },
      expiresAt,
    },
  };
}

export function verifySession(token: string): { user: User; mustChangePassword: boolean; mustCreatePersonalAccount?: boolean } | null {
  if (!token || revokedTokens.has(token)) return null;

  let userId: string | null = null;
  let expiresAt = 0;

  const signedPayload = verifySignedSessionToken(token);
  if (signedPayload) {
    userId = signedPayload.userId;
    expiresAt = signedPayload.expiresAt;
  } else {
    const session = activeSessions.get(token);
    if (!session) return null;
    userId = session.user.id;
    expiresAt = session.expiresAt;
  }

  if (!userId || Date.now() > expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  // Ensure user still exists and is active in database
  const db = loadDatabase();
  const freshUser = db.USERS.find((u) => u.id === userId && u.isActive);
  if (!freshUser) {
    activeSessions.delete(token);
    return null;
  }

  const hasCustomAdminCreated = Boolean(db.SYSTEM_CONFIG?.hasCustomAdminCreated);
  const mustCreate = !hasCustomAdminCreated || Boolean(freshUser.mustChangePassword);

  return {
    user: freshUser,
    mustChangePassword: freshUser.mustChangePassword,
    mustCreatePersonalAccount: mustCreate,
  };
}

export function logout(token: string): boolean {
  if (!token) return false;
  const existed = activeSessions.delete(token);
  if (verifySignedSessionToken(token)) {
    revokedTokens.add(token);
    return true;
  }
  return existed;
}

/**
 * Returns whether a custom personal administrator account has been set up.
 */
export function getAuthStatus(): { hasCustomAdminCreated: boolean; isSetupMode: boolean; currentAdminHint?: string } {
  const db = loadDatabase();
  const superAdmin = db.USERS.find((u) => u.role === 'super_admin' && u.isActive);
  const hasCustom = Boolean(db.SYSTEM_CONFIG?.hasCustomAdminCreated) && Boolean(superAdmin && !superAdmin.mustChangePassword);

  return {
    hasCustomAdminCreated: hasCustom,
    isSetupMode: !hasCustom,
    currentAdminHint: superAdmin ? superAdmin.username : undefined,
  };
}

/**
 * First-Time Instant Access:
 * Allows a single 1-click entrance for initial setup BEFORE any personal user is created.
 * Once personal user is created, this function permanently rejects further calls with 403 error.
 */
export function firstTimeAccess(ip = '127.0.0.1'): {
  success: boolean;
  session?: AuthSession;
  error?: string;
} {
  const db = loadDatabase();
  const superAdmin = db.USERS.find((u) => u.role === 'super_admin' && u.isActive);

  if (!superAdmin) {
    return {
      success: false,
      error: 'Pengguna administrator sistem tidak ditemukan.',
    };
  }

  const hasCustom = Boolean(db.SYSTEM_CONFIG?.hasCustomAdminCreated) && !superAdmin.mustChangePassword;
  if (hasCustom) {
    return {
      success: false,
      error: 'Akses pertama kali telah ditutup secara permanen demi privasi & keamanan. Silakan login dengan Username dan Password pribadi Anda.',
    };
  }

  // Generate a setup session that forces the user to create personal account before reaching dashboard
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const token = createSignedSessionToken(superAdmin, expiresAt, true);

  activeSessions.set(token, { user: superAdmin, expiresAt });

  addActivityLog(db, {
    userId: superAdmin.id,
    username: superAdmin.username,
    action: 'FIRST_TIME_ACCESS_INITIATED',
    details: `Akses 1-klik pertama kali dibuka dari IP ${ip}. Administrator diarahkan ke pembuatan akun pribadi.`,
    ipAddress: ip,
  });
  saveDatabase(db);

  return {
    success: true,
    session: {
      token,
      user: {
        id: superAdmin.id,
        username: superAdmin.username,
        fullName: superAdmin.fullName,
        role: superAdmin.role,
        mustChangePassword: true,
        mustCreatePersonalAccount: true,
      },
      expiresAt,
    },
  };
}

/**
 * Setup Personal Administrator Account:
 * Sets the real personal username, full name, email, and password.
 * Marks mustChangePassword = false and hasCustomAdminCreated = true.
 * Permanently locks the 1-click door.
 */
export function setupPersonalAccount(params: {
  userId?: string;
  newUsername: string;
  fullName: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
  ip?: string;
}): { success: boolean; session?: AuthSession; error?: string } {
  const { userId, newUsername, fullName, email, newPassword, confirmPassword, ip = '127.0.0.1' } = params;

  const cleanUsername = (newUsername || '').trim();
  const cleanFullName = (fullName || '').trim();
  const cleanEmail = (email || '').trim();

  if (cleanUsername.length < 3) {
    return { success: false, error: 'Username minimal harus 3 karakter.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Konfirmasi password baru tidak cocok.' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'Password minimal harus 6 karakter demi keamanan.' };
  }

  const db = loadDatabase();
  let user: User | undefined;

  if (userId) {
    user = db.USERS.find((u) => u.id === userId && u.isActive);
  }
  if (!user) {
    // If setup mode, find the super_admin
    user = db.USERS.find((u) => u.role === 'super_admin' && u.isActive);
  }

  if (!user) {
    return { success: false, error: 'Pengguna administrator tidak ditemukan.' };
  }

  // Check if newUsername is already used by another active user
  const duplicate = db.USERS.find(
    (u) => u.id !== user!.id && u.username.toLowerCase() === cleanUsername.toLowerCase() && u.isActive
  );
  if (duplicate) {
    return { success: false, error: `Username "${cleanUsername}" sudah digunakan. Silakan pilih username lain.` };
  }

  // Hash new password
  const newSalt = generateSalt();
  const newHash = hashPasswordSync(newPassword, newSalt);

  user.username = cleanUsername;
  if (cleanFullName) user.fullName = cleanFullName;
  if (cleanEmail) user.email = cleanEmail;
  user.salt = newSalt;
  user.passwordHash = newHash;
  user.mustChangePassword = false;
  user.updatedAt = new Date().toISOString();

  // Mark system config as custom admin created
  db.SYSTEM_CONFIG.hasCustomAdminCreated = true;

  addActivityLog(db, {
    userId: user.id,
    username: user.username,
    action: 'ADMIN_ACCOUNT_SETUP_COMPLETED',
    details: `Akun administrator pribadi (${cleanUsername} - ${cleanFullName}) berhasil dibuat. Akses pertama kali 1-klik kini ditutup permanen.`,
    ipAddress: ip,
  });

  saveDatabase(db);

  // Invalidate old sessions and issue a fresh session
  for (const [t, s] of activeSessions.entries()) {
    if (s.user.id === user.id) {
      activeSessions.delete(t);
    }
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = createSignedSessionToken(user, expiresAt, false);
  activeSessions.set(token, { user, expiresAt });

  return {
    success: true,
    session: {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: false,
        mustCreatePersonalAccount: false,
      },
      expiresAt,
    },
  };
}
