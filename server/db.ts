import fs from 'node:fs';
import path from 'node:path';
import type {
  DatabaseSchema,
  User,
  Role,
  Category,
  ServiceLink,
  Registration,
  Announcement,
  DocumentItem,
  SiteSettings,
  QrSettings,
  VisitorRecord,
  LinkClickRecord,
  ActivityLog,
  SystemConfig,
  BackupLog,
  SetupCredentials,
  MadrasahAchievement,
} from '../src/types/index.js';
import {
  generateSalt,
  hashPasswordSync,
  generateTemporaryPassword,
  generateUUID,
} from '../src/lib/crypto.js';

const BUNDLED_DATA_DIR = path.resolve(process.cwd(), 'data');
const BUNDLED_DB_FILE = path.join(BUNDLED_DATA_DIR, 'db_portal_digital.json');

function isServerlessReadOnly(): boolean {
  if (process.env.PORTAL_DB_FILE) return false;
  if (process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return true;
  }
  try {
    if (!fs.existsSync(BUNDLED_DATA_DIR)) {
      fs.mkdirSync(BUNDLED_DATA_DIR, { recursive: true });
    }
    fs.accessSync(BUNDLED_DATA_DIR, fs.constants.W_OK);
    return false;
  } catch {
    return true;
  }
}

function getRuntimeDataDir(): string {
  return isServerlessReadOnly() ? '/tmp/portal_digital_data' : BUNDLED_DATA_DIR;
}

export function getDbFile(): string {
  if (process.env.PORTAL_DB_FILE) return process.env.PORTAL_DB_FILE;
  return path.join(getRuntimeDataDir(), 'db_portal_digital.json');
}

function getBackupsDir(): string {
  return path.join(getRuntimeDataDir(), 'backups');
}

// Memory lock for atomic operations (similar to Apps Script LockService)
let lockAcquired = false;
async function acquireLock(timeoutMs = 5000): Promise<() => void> {
  const start = Date.now();
  while (lockAcquired) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Database LockService timeout: could not acquire lock');
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  lockAcquired = true;
  return () => {
    lockAcquired = false;
  };
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  portalName: 'Portal Digital Terpadu',
  institutionName: "MA PLUS MA'HADUL MUTA'ALLIMIN",
  tagline: 'One QR Code – One Portal – All Digital Services',
  description: 'Pusat akses resmi seluruh layanan, pendaftaran PPDB, daftarkan prestasi santri, dokumen, dan saluran informasi resmi MA Plus MM.',
  logoUrl: '',
  faviconUrl: '',
  bannerUrl: '',
  primaryColor: '#065f46',
  accentColor: '#d97706',
  whatsappNumber: '',
  email: 'tumaplusmahadulmutaallimin@gmail.com',
  address: '',
  instagramUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  tiktokUrl: '',
  websiteUrl: '',
  copyrightText: '© ' + new Date().getFullYear() + " MA Plus Ma'hadul Muta'allimin. Seluruh Hak Cipta Dilindungi.",
  heroEnabled: true,
  announcementsEnabled: true,
  registrationsEnabled: true,
  documentsEnabled: true,
  searchEnabled: true,
  categoriesEnabled: true,
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_COMMITTEE_CONTACTS: any[] = [];

export const DEFAULT_MADRASAH_ACHIEVEMENTS: MadrasahAchievement[] = [];

const DEFAULT_QR_SETTINGS: QrSettings = {
  portalUrl: process.env.APP_URL || '',
  size: 320,
  foregroundColor: '#065f46',
  backgroundColor: '#ffffff',
  includeLogo: true,
  logoUrl: '',
  errorCorrectionLevel: 'H',
  posterTitle: 'PORTAL DIGITAL TERPADU',
  posterSubtitle: "Pusat Akses Layanan Resmi MA Plus Ma'hadul Muta'allimin",
  posterFooter: 'Buka kamera smartphone Anda dan arahkan ke kode QR di atas.',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-superadmin',
    name: 'Super Administrator',
    description: 'Akses penuh ke seluruh sistem, pengguna, pengaturan, dan database.',
    permissions: ['all'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-admin',
    name: 'Administrator',
    description: 'Mengelola konten portal, ikon layanan, kategori, pengumuman, dan dokumen.',
    permissions: ['manage_content', 'manage_links', 'manage_announcements', 'manage_documents', 'view_analytics'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-operator',
    name: 'Operator',
    description: 'Mengelola pengumuman dan melihat statistik.',
    permissions: ['manage_announcements', 'view_analytics'],
    createdAt: new Date().toISOString(),
  },
];

let inMemoryDb: DatabaseSchema | null = null;
let lastSetupCredentials: SetupCredentials | null = null;

function ensureDirectories(): void {
  const dbDir = path.dirname(getDbFile());
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
}

/**
 * Atomically save database to JSON file (with EROFS/serverless safety)
 */
export function saveDatabase(data: DatabaseSchema): void {
  inMemoryDb = data;
  try {
    ensureDirectories();
    const dbFile = getDbFile();
    const tempPath = `${dbFile}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, dbFile);
  } catch (err) {
    console.warn('Warning: could not persist database to disk, keeping in memory:', (err as Error)?.message);
  }
}

/**
 * Load database from disk (or bundled seed in serverless environments)
 */
export function loadDatabase(): DatabaseSchema {
  try {
    ensureDirectories();
  } catch {
    // Ignore if directory creation fails
  }
  const dbFile = getDbFile();
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf8');
      const parsed = JSON.parse(content) as DatabaseSchema;
      inMemoryDb = migrateDatabase(parsed);
      return inMemoryDb;
    } catch (err) {
      console.error('Error loading db file, attempting migration/recovery:', err);
    }
  }

  // On serverless (e.g. Vercel), copy bundled data/db_portal_digital.json into /tmp on first cold start
  if (!process.env.PORTAL_DB_FILE && dbFile !== BUNDLED_DB_FILE && fs.existsSync(BUNDLED_DB_FILE)) {
    try {
      const content = fs.readFileSync(BUNDLED_DB_FILE, 'utf8');
      const parsed = JSON.parse(content) as DatabaseSchema;
      const migrated = migrateDatabase(parsed);
      saveDatabase(migrated);
      return migrated;
    } catch (err) {
      console.error('Error seeding runtime db from bundled file:', err);
    }
  }

  if (inMemoryDb) {
    return inMemoryDb;
  }

  // In serverless read-only mode without bundled file, initialize clean without dummy data
  if (!process.env.PORTAL_DB_FILE && isServerlessReadOnly()) {
    const clean = buildCleanServerlessDatabase();
    saveDatabase(clean);
    return clean;
  }

  return initializeDatabase().db;
}

function buildCleanServerlessDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  const cleanDb: DatabaseSchema = {
    USERS: [],
    ROLES: DEFAULT_ROLES,
    CATEGORIES: [],
    LINKS: [],
    REGISTRATIONS: [],
    ANNOUNCEMENTS: [],
    DOCUMENTS: [],
    SITE_SETTINGS: { ...DEFAULT_SITE_SETTINGS },
    QR_SETTINGS: { ...DEFAULT_QR_SETTINGS },
    VISITORS: [],
    LINK_CLICKS: [],
    ACTIVITY_LOGS: [],
    SYSTEM_CONFIG: {
      version: '1.0.0',
      appName: 'Portal Digital Terpadu',
      databaseName: 'DB_PORTAL_DIGITAL',
      installationCompleted: true,
      installedAt: now,
      lastBackupAt: null,
      maxLoginAttempts: 5,
      sessionTimeoutHours: 8,
      hasCustomAdminCreated: true,
    },
    BACKUP_LOGS: [],
    STUDENT_ACHIEVEMENTS: [],
    COMMITTEE_CONTACTS: [],
    MADRASAH_ACHIEVEMENTS: [],
  };

  createInitialAdmin(cleanDb);
  return cleanDb;
}

/**
 * Idempotent database initialization function
 */
export function initializeDatabase(): { db: DatabaseSchema; setupCredentials: SetupCredentials | null } {
  try {
    ensureDirectories();
  } catch {
    // Ignore if directory creation fails
  }

  const dbFile = getDbFile();
  let existing: DatabaseSchema | null = null;
  if (fs.existsSync(dbFile)) {
    try {
      const raw = fs.readFileSync(dbFile, 'utf8');
      existing = JSON.parse(raw);
    } catch {
      existing = null;
    }
  } else if (!process.env.PORTAL_DB_FILE && dbFile !== BUNDLED_DB_FILE && fs.existsSync(BUNDLED_DB_FILE)) {
    try {
      const raw = fs.readFileSync(BUNDLED_DB_FILE, 'utf8');
      existing = JSON.parse(raw);
    } catch {
      existing = null;
    }
  }

  if (existing) {
    // Run schema migration safely without overwriting data
    const migrated = migrateDatabase(existing);
    saveDatabase(migrated);
    inMemoryDb = migrated;
    return { db: migrated, setupCredentials: null };
  }

  // Create clean initial structure WITHOUT ANY DUMMY DATA
  const initialDb: DatabaseSchema = {
    USERS: [],
    ROLES: DEFAULT_ROLES,
    CATEGORIES: [],
    LINKS: [],
    REGISTRATIONS: [],
    ANNOUNCEMENTS: [],
    DOCUMENTS: [],
    SITE_SETTINGS: { ...DEFAULT_SITE_SETTINGS },
    QR_SETTINGS: { ...DEFAULT_QR_SETTINGS },
    VISITORS: [],
    LINK_CLICKS: [],
    ACTIVITY_LOGS: [],
    SYSTEM_CONFIG: {
      version: '1.0.0',
      appName: 'Portal Digital Terpadu',
      databaseName: 'DB_PORTAL_DIGITAL',
      installationCompleted: true,
      installedAt: new Date().toISOString(),
      lastBackupAt: null,
      maxLoginAttempts: 5,
      sessionTimeoutHours: 8,
      hasCustomAdminCreated: true,
    },
    BACKUP_LOGS: [],
    STUDENT_ACHIEVEMENTS: [],
    COMMITTEE_CONTACTS: [],
    MADRASAH_ACHIEVEMENTS: [],
  };

  // Generate initial administrator account automatically
  const setupCreds = createInitialAdmin(initialDb);
  saveDatabase(initialDb);

  // Log system creation activity
  addActivityLog(initialDb, {
    userId: 'system',
    username: 'SYSTEM',
    action: 'INITIALIZE_DATABASE',
    details: 'Database DB_PORTAL_DIGITAL berhasil diinisialisasi secara otomatis tanpa data dummy.',
    ipAddress: '127.0.0.1',
  });
  saveDatabase(initialDb);

  lastSetupCredentials = setupCreds;
  return { db: initialDb, setupCredentials: setupCreds };
}

/**
 * Safe idempotent schema migration
 */
export function migrateDatabase(db: Partial<DatabaseSchema>): DatabaseSchema {
  const now = new Date().toISOString();
  const safeDb: DatabaseSchema = {
    USERS: Array.isArray(db.USERS) ? db.USERS : [],
    ROLES: Array.isArray(db.ROLES) && db.ROLES.length > 0 ? db.ROLES : DEFAULT_ROLES,
    CATEGORIES: Array.isArray(db.CATEGORIES) ? db.CATEGORIES : [],
    LINKS: Array.isArray(db.LINKS) ? db.LINKS : [],
    REGISTRATIONS: Array.isArray(db.REGISTRATIONS) ? db.REGISTRATIONS : [],
    ANNOUNCEMENTS: Array.isArray(db.ANNOUNCEMENTS) ? db.ANNOUNCEMENTS : [],
    DOCUMENTS: Array.isArray(db.DOCUMENTS) ? db.DOCUMENTS : [],
    SITE_SETTINGS: { ...DEFAULT_SITE_SETTINGS, ...(db.SITE_SETTINGS || {}) },
    QR_SETTINGS: { ...DEFAULT_QR_SETTINGS, ...(db.QR_SETTINGS || {}) },
    VISITORS: Array.isArray(db.VISITORS) ? db.VISITORS : [],
    LINK_CLICKS: Array.isArray(db.LINK_CLICKS) ? db.LINK_CLICKS : [],
    ACTIVITY_LOGS: Array.isArray(db.ACTIVITY_LOGS) ? db.ACTIVITY_LOGS : [],
    SYSTEM_CONFIG: {
      version: '1.0.0',
      appName: 'Portal Digital Terpadu',
      databaseName: 'DB_PORTAL_DIGITAL',
      installationCompleted: true,
      installedAt: db.SYSTEM_CONFIG?.installedAt || now,
      lastBackupAt: db.SYSTEM_CONFIG?.lastBackupAt || null,
      maxLoginAttempts: db.SYSTEM_CONFIG?.maxLoginAttempts || 5,
      sessionTimeoutHours: db.SYSTEM_CONFIG?.sessionTimeoutHours || 8,
      hasCustomAdminCreated: db.SYSTEM_CONFIG?.hasCustomAdminCreated ?? true,
    },
    BACKUP_LOGS: Array.isArray(db.BACKUP_LOGS) ? db.BACKUP_LOGS : [],
    STUDENT_ACHIEVEMENTS: Array.isArray(db.STUDENT_ACHIEVEMENTS) ? db.STUDENT_ACHIEVEMENTS : [],
    COMMITTEE_CONTACTS: Array.isArray(db.COMMITTEE_CONTACTS) ? db.COMMITTEE_CONTACTS : [],
    MADRASAH_ACHIEVEMENTS: Array.isArray(db.MADRASAH_ACHIEVEMENTS) ? db.MADRASAH_ACHIEVEMENTS : [],
  };

  // If no admin user exists, create the fixed admin account
  const existingAdmin = safeDb.USERS.find((u) => u.role === 'super_admin' && u.isActive);
  if (!existingAdmin) {
    createInitialAdmin(safeDb);
  } else if (existingAdmin.username === 'admin_portal' && existingAdmin.mustChangePassword) {
    // Upgrade legacy placeholder admin to fixed credentials
    const salt = generateSalt();
    existingAdmin.username = '131235210019';
    existingAdmin.fullName = 'Administrator MA Plus MM';
    existingAdmin.email = 'tumaplusmahadulmutaallimin@gmail.com';
    existingAdmin.salt = salt;
    existingAdmin.passwordHash = hashPasswordSync('Bismillah3x', salt);
    existingAdmin.mustChangePassword = false;
    existingAdmin.updatedAt = now;
    safeDb.SYSTEM_CONFIG.hasCustomAdminCreated = true;
  }

  return safeDb;
}

/**
 * Automatically creates the fixed administrator account (131235210019 / Bismillah3x)
 */
export function createInitialAdmin(db: DatabaseSchema): SetupCredentials {
  const existingAdmin = db.USERS.find((u) => u.role === 'super_admin' && u.isActive);
  if (existingAdmin) {
    return {
      username: existingAdmin.username,
      temporaryPassword: '*** (Akun administrator sudah aktif)',
      role: existingAdmin.role,
      note: 'Akun administrator telah aktif di sistem.',
    };
  }

  const username = '131235210019';
  const fixedPassword = 'Bismillah3x';
  const salt = generateSalt();
  const passwordHash = hashPasswordSync(fixedPassword, salt);
  const now = new Date().toISOString();

  const newAdmin: User = {
    id: generateUUID(),
    username,
    email: 'tumaplusmahadulmutaallimin@gmail.com',
    fullName: 'Administrator MA Plus MM',
    passwordHash,
    salt,
    role: 'super_admin',
    mustChangePassword: false,
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };

  db.USERS.push(newAdmin);
  if (db.SYSTEM_CONFIG) {
    db.SYSTEM_CONFIG.hasCustomAdminCreated = true;
  }

  return {
    username,
    temporaryPassword: '***',
    role: 'super_admin',
    note: 'Gunakan akun administrator tetap untuk masuk ke dashboard.',
  };
}

/**
 * Verify database health and integrity
 */
export function verifyDatabase(): { isValid: boolean; sheetsCount: number; tables: string[]; error?: string } {
  try {
    const db = loadDatabase();
    const tables = [
      'USERS',
      'ROLES',
      'CATEGORIES',
      'LINKS',
      'REGISTRATIONS',
      'ANNOUNCEMENTS',
      'DOCUMENTS',
      'SITE_SETTINGS',
      'QR_SETTINGS',
      'VISITORS',
      'LINK_CLICKS',
      'ACTIVITY_LOGS',
      'SYSTEM_CONFIG',
      'BACKUP_LOGS',
    ];

    for (const table of tables) {
      if (!(table in db)) {
        return { isValid: false, sheetsCount: Object.keys(db).length, tables, error: `Tabel ${table} tidak ditemukan.` };
      }
    }

    return { isValid: true, sheetsCount: tables.length, tables };
  } catch (err: any) {
    return { isValid: false, sheetsCount: 0, tables: [], error: err.message };
  }
}

/**
 * Backup database to disk
 */
export function backupDatabase(createdBy = 'system', notes = 'Automated backup'): BackupLog {
  const db = loadDatabase();
  const timestamp = new Date().toISOString();
  ensureDirectories();
  const fileName = `DB_PORTAL_DIGITAL_BACKUP_${Date.now()}.json`;
  const backupFilePath = path.join(getBackupsDir(), fileName);

  const snapshot = JSON.stringify(db, null, 2);
  fs.writeFileSync(backupFilePath, snapshot, 'utf8');

  const stats = fs.statSync(backupFilePath);
  const backupEntry: BackupLog = {
    id: generateUUID(),
    timestamp,
    fileName,
    sizeBytes: stats.size,
    status: 'success',
    createdBy,
    notes,
  };

  db.BACKUP_LOGS.unshift(backupEntry);
  db.SYSTEM_CONFIG.lastBackupAt = timestamp;
  addActivityLog(db, {
    userId: createdBy,
    username: createdBy,
    action: 'BACKUP_DATABASE',
    details: `Backup database dibuat: ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`,
    ipAddress: '127.0.0.1',
  });
  saveDatabase(db);

  return backupEntry;
}

/**
 * Restore database from snapshot
 */
export function restoreDatabase(jsonContent: string, restoredBy = 'admin'): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonContent);
    const migrated = migrateDatabase(parsed);
    saveDatabase(migrated);

    addActivityLog(migrated, {
      userId: restoredBy,
      username: restoredBy,
      action: 'RESTORE_DATABASE',
      details: `Database berhasil dipulihkan dari cadangan oleh ${restoredBy}`,
      ipAddress: '127.0.0.1',
    });
    saveDatabase(migrated);

    return { success: true, message: 'Database berhasil dipulihkan dengan sukses.' };
  } catch (err: any) {
    return { success: false, message: `Gagal memulihkan database: ${err.message}` };
  }
}

/**
 * Add audit log
 */
export function addActivityLog(
  db: DatabaseSchema,
  entry: Omit<ActivityLog, 'id' | 'timestamp'>
): void {
  const log: ActivityLog = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  db.ACTIVITY_LOGS.unshift(log);
  // Keep last 1000 logs
  if (db.ACTIVITY_LOGS.length > 1000) {
    db.ACTIVITY_LOGS = db.ACTIVITY_LOGS.slice(0, 1000);
  }
}

/**
 * Get setup credentials if newly created
 */
export function getLastSetupCredentials(): SetupCredentials | null {
  return lastSetupCredentials;
}

export function clearLastSetupCredentials(): void {
  lastSetupCredentials = null;
}
