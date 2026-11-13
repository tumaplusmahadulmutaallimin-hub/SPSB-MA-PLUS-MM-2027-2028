import fs from 'node:fs';
import path from 'node:path';
import {
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
} from '../src/types';
import {
  generateSalt,
  hashPasswordSync,
  generateTemporaryPassword,
  generateUUID,
} from '../src/lib/crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export function getDbFile(): string {
  return process.env.PORTAL_DB_FILE || path.join(DATA_DIR, 'db_portal_digital.json');
}
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

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
  primaryColor: '#065f46', // Emerald / Forest Green
  accentColor: '#d97706',  // Warm Gold
  whatsappNumber: '+6281234567890',
  email: 'tumaplusmahadulmutaallimin@gmail.com',
  address: 'Kompleks Pesantren Ma\'hadul Muta\'allimin, Jawa Timur',
  instagramUrl: 'https://instagram.com',
  facebookUrl: 'https://facebook.com',
  youtubeUrl: 'https://youtube.com',
  tiktokUrl: 'https://tiktok.com',
  websiteUrl: 'https://maplusmm.sch.id',
  copyrightText: '© ' + new Date().getFullYear() + ' MA Plus Ma\'hadul Muta\'allimin. Seluruh Hak Cipta Dilindungi.',
  heroEnabled: true,
  announcementsEnabled: true,
  registrationsEnabled: true,
  documentsEnabled: true,
  searchEnabled: true,
  categoriesEnabled: true,
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_COMMITTEE_CONTACTS = [
  {
    id: 'panitia-1',
    name: 'Ustadz Ahmad Fauzi, S.Pd.',
    role: 'Ketua Panitia PPDB 2026/2027',
    whatsappNumber: '+6281234567891',
    notes: 'Konsultasi syarat pendaftaran, alur tes, dan seleksi masuk',
    isAvailable: true,
  },
  {
    id: 'panitia-2',
    name: 'Ustadzah Nurul Hidayah, M.Pd.',
    role: 'Sekretariat & Pendaftaran Prestasi',
    whatsappNumber: '+6281234567892',
    notes: 'Verifikasi piagam penghargaan, beasiswa prestasi, dan tahfidz',
    isAvailable: true,
  },
  {
    id: 'panitia-3',
    name: 'Ustadz Muhammad Ilham, S.Kom.',
    role: 'Humas & Saluran Informasi Madrasah',
    whatsappNumber: '+6281234567893',
    notes: 'Informasi umum madrasah, kunjungan kampus, dan media sosial',
    isAvailable: true,
  },
  {
    id: 'panitia-4',
    name: 'Ustadz Hasan Basri, Lc.',
    role: 'Koordinator Kepondokan & Asrama Santri',
    whatsappNumber: '+6281234567894',
    notes: 'Informasi fasilitas asrama, tata tertib, dan program kepondokan',
    isAvailable: true,
  },
];

export const DEFAULT_MADRASAH_ACHIEVEMENTS: MadrasahAchievement[] = [
  {
    id: 'ach-madrasah-1',
    title: 'Juara 1 Nasional Madrasah Robotics Competition (MRC)',
    category: 'Robotik & Sains',
    level: 'Tingkat Nasional',
    recipient: 'Tim Robotik Santri MA Plus MM',
    year: '2026',
    photoUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Meraih Juara 1 Nasional kategori Mobile Robot & IoT Innovation mengalahkan ratusan madrasah se-Indonesia.',
    order: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ach-madrasah-2',
    title: 'Juara Umum Musabaqah Hifdzil Qur\'an (MHQ) 30 Juz & Tafsir',
    category: 'Tahfidz Al-Qur\'an',
    level: 'Tingkat Provinsi Jawa Timur',
    recipient: 'Kafilah Santri Tahfidz MA Plus MM',
    year: '2026',
    photoUrl: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Memperoleh predikat Juara Umum dengan tajwid mutqin, kefasihan makhraj, dan pemahaman tafsir Al-Qur\'an terbaik.',
    order: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ach-madrasah-3',
    title: 'Medali Emas KSM Bidang Matematika & Fisika Terintegrasi',
    category: 'Kompetisi Sains Madrasah',
    level: 'Tingkat Provinsi Jawa Timur',
    recipient: 'Santri Berprestasi MA Plus MM',
    year: '2025/2026',
    photoUrl: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Meraih medali emas pada integrasi sains modern dengan khazanah nilai-nilai dan dalil Al-Qur\'an.',
    order: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ach-madrasah-4',
    title: 'Juara 1 Pidato & Debat Bahasa Arab Pesantren Se-Indonesia',
    category: 'Bahasa & Literasi',
    level: 'Tingkat Nasional',
    recipient: 'Klub Bahasa Arab MA Plus MM',
    year: '2025',
    photoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Juara 1 dalam penguasaan tata bahasa fushah, retorika dakwah, dan argumentasi ilmiah antar madrasah plus.',
    order: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_QR_SETTINGS: QrSettings = {
  portalUrl: process.env.APP_URL || 'http://localhost:3000',
  size: 320,
  foregroundColor: '#065f46',
  backgroundColor: '#ffffff',
  includeLogo: true,
  logoUrl: '',
  errorCorrectionLevel: 'H',
  posterTitle: 'PORTAL DIGITAL TERPADU',
  posterSubtitle: 'Pusat Akses Layanan Resmi MA Plus Ma\'hadul Muta\'allimin',
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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Atomically save database to JSON file
 */
export function saveDatabase(data: DatabaseSchema): void {
  ensureDirectories();
  const dbFile = getDbFile();
  const tempPath = `${dbFile}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, dbFile);
  inMemoryDb = data;
}

/**
 * Load database from disk
 */
export function loadDatabase(): DatabaseSchema {
  ensureDirectories();
  const dbFile = getDbFile();
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf8');
      inMemoryDb = JSON.parse(content) as DatabaseSchema;
      return inMemoryDb;
    } catch (err) {
      console.error('Error loading db file, attempting migration/recovery:', err);
    }
  }
  return initializeDatabase().db;
}

/**
 * Idempotent database initialization function
 */
export function initializeDatabase(): { db: DatabaseSchema; setupCredentials: SetupCredentials | null } {
  ensureDirectories();

  const dbFile = getDbFile();
  let existing: DatabaseSchema | null = null;
  if (fs.existsSync(dbFile)) {
    try {
      const raw = fs.readFileSync(dbFile, 'utf8');
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
    CATEGORIES: [], // Absolute rule: No dummy data
    LINKS: [],      // Absolute rule: No dummy data
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
    },
    BACKUP_LOGS: [],
    STUDENT_ACHIEVEMENTS: [],
    COMMITTEE_CONTACTS: [...DEFAULT_COMMITTEE_CONTACTS],
    MADRASAH_ACHIEVEMENTS: [...DEFAULT_MADRASAH_ACHIEVEMENTS],
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
    },
    BACKUP_LOGS: Array.isArray(db.BACKUP_LOGS) ? db.BACKUP_LOGS : [],
    STUDENT_ACHIEVEMENTS: Array.isArray(db.STUDENT_ACHIEVEMENTS) ? db.STUDENT_ACHIEVEMENTS : [],
    COMMITTEE_CONTACTS: Array.isArray(db.COMMITTEE_CONTACTS) && db.COMMITTEE_CONTACTS.length > 0 ? db.COMMITTEE_CONTACTS : DEFAULT_COMMITTEE_CONTACTS,
    MADRASAH_ACHIEVEMENTS: Array.isArray(db.MADRASAH_ACHIEVEMENTS) && db.MADRASAH_ACHIEVEMENTS.length > 0 ? db.MADRASAH_ACHIEVEMENTS : DEFAULT_MADRASAH_ACHIEVEMENTS,
  };

  // If no admin user exists, create one
  const hasAdmin = safeDb.USERS.some((u) => u.role === 'super_admin' && u.isActive);
  if (!hasAdmin) {
    createInitialAdmin(safeDb);
  }

  return safeDb;
}

/**
 * Automatically creates the first initial administrator account
 */
export function createInitialAdmin(db: DatabaseSchema): SetupCredentials {
  const existingAdmin = db.USERS.find((u) => u.role === 'super_admin' && u.isActive);
  if (existingAdmin) {
    return {
      username: existingAdmin.username,
      temporaryPassword: '*** (Akun administrator sudah dibuat)',
      role: existingAdmin.role,
      note: 'Akun administrator telah aktif di sistem.',
    };
  }

  const username = 'admin_portal';
  const temporaryPassword = generateTemporaryPassword(14);
  const salt = generateSalt();
  const passwordHash = hashPasswordSync(temporaryPassword, salt);
  const now = new Date().toISOString();

  const newAdmin: User = {
    id: generateUUID(),
    username,
    email: 'admin@portal.local',
    fullName: 'Administrator Utama',
    passwordHash,
    salt,
    role: 'super_admin',
    mustChangePassword: true, // MANDATORY: Must change password on first login
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };

  db.USERS.push(newAdmin);

  return {
    username,
    temporaryPassword,
    role: 'super_admin',
    note: 'Simpan kredensial sementara ini. Anda diwajibkan mengubah password pada login pertama kali.',
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
  const fileName = `DB_PORTAL_DIGITAL_BACKUP_${Date.now()}.json`;
  const backupFilePath = path.join(BACKUPS_DIR, fileName);

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
