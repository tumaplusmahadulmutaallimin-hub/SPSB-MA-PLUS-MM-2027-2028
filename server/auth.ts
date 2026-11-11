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
  generateSessionToken,
  validatePasswordStrength,
} from '../src/lib/crypto';

// In-memory sessions table with TTL
const activeSessions = new Map<string, { user: User; expiresAt: number }>();

// Rate-limiting tracking: IP/Username -> { attempts: number, lockedUntil: number }
const loginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

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

  // Generate session token
  const token = generateSessionToken();
  const expiresAt = now + SESSION_TTL_MS;
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

  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
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

export function verifySession(token: string): { user: User; mustChangePassword: boolean } | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  // Ensure user still exists and is active in database
  const db = loadDatabase();
  const freshUser = db.USERS.find((u) => u.id === session.user.id && u.isActive);
  if (!freshUser) {
    activeSessions.delete(token);
    return null;
  }

  return {
    user: freshUser,
    mustChangePassword: freshUser.mustChangePassword,
  };
}

export function logout(token: string): boolean {
  return activeSessions.delete(token);
}
