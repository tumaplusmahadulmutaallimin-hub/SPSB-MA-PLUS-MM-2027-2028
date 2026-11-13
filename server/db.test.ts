import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

const tmpDbFile = path.join(os.tmpdir(), `test_portal_db_${Date.now()}.json`);
process.env.PORTAL_DB_FILE = tmpDbFile;

import {
  initializeDatabase,
  verifyDatabase,
  migrateDatabase,
  backupDatabase,
  restoreDatabase,
  loadDatabase,
} from './db';

test.after(() => {
  try {
    const fs = require('node:fs');
    if (fs.existsSync(tmpDbFile)) fs.unlinkSync(tmpDbFile);
  } catch {}
});

test('database: initializes 14 tables and adheres to no dummy data rule', () => {
  const { db } = initializeDatabase();
  assert.ok(db);

  // Check 14 tables
  assert.ok(Array.isArray(db.USERS));
  assert.ok(Array.isArray(db.ROLES));
  assert.ok(Array.isArray(db.CATEGORIES));
  assert.ok(Array.isArray(db.LINKS));
  assert.ok(Array.isArray(db.REGISTRATIONS));
  assert.ok(Array.isArray(db.ANNOUNCEMENTS));
  assert.ok(Array.isArray(db.DOCUMENTS));
  assert.ok(db.SITE_SETTINGS);
  assert.ok(db.QR_SETTINGS);
  assert.ok(Array.isArray(db.VISITORS));
  assert.ok(Array.isArray(db.LINK_CLICKS));
  assert.ok(Array.isArray(db.ACTIVITY_LOGS));
  assert.ok(db.SYSTEM_CONFIG);
  assert.ok(Array.isArray(db.BACKUP_LOGS));

  // ABSOLUTE RULE: Zero dummy data
  assert.equal(db.CATEGORIES.length, 0, 'Categories must start empty without dummy data');
  assert.equal(db.LINKS.length, 0, 'Links must start empty without dummy data');
  assert.equal(db.REGISTRATIONS.length, 0, 'Registrations must start empty');
  assert.equal(db.ANNOUNCEMENTS.length, 0, 'Announcements must start empty');
  assert.equal(db.DOCUMENTS.length, 0, 'Documents must start empty');
  assert.equal(db.VISITORS.length, 0, 'Visitors must start empty');
  assert.equal(db.LINK_CLICKS.length, 0, 'Link clicks must start empty');
  assert.equal(db.COMMITTEE_CONTACTS?.length, 0, 'Committee contacts must start empty');
  assert.equal(db.MADRASAH_ACHIEVEMENTS?.length, 0, 'Madrasah achievements must start empty');
  assert.equal(db.STUDENT_ACHIEVEMENTS?.length, 0, 'Student achievements must start empty');
  assert.equal(db.SITE_SETTINGS.whatsappNumber, '', 'WhatsApp number must not contain dummy data');
  assert.equal(db.SITE_SETTINGS.address, '', 'Address must not contain dummy data');
  assert.equal(db.SITE_SETTINGS.instagramUrl, '', 'Instagram URL must not contain dummy data');
  assert.equal(db.SITE_SETTINGS.youtubeUrl, '', 'YouTube URL must not contain dummy data');
  assert.equal(db.SITE_SETTINGS.tiktokUrl, '', 'TikTok URL must not contain dummy data');

  // Verify health check
  const health = verifyDatabase();
  assert.equal(health.isValid, true);
  assert.equal(health.sheetsCount, 14);
});

test('database: creates fixed initial admin and prevents duplicate super_admin accounts', () => {
  const db = loadDatabase();
  const admin = db.USERS.find((u) => u.role === 'super_admin');
  assert.ok(admin, 'Admin must exist');
  assert.equal(admin.username, '131235210019');
  assert.equal(admin.mustChangePassword, false, 'Fixed admin must be ready immediately without password change lock');
  assert.equal(admin.isActive, true);

  // Calling initializeDatabase again must NOT create duplicate admins
  const countBefore = db.USERS.length;
  initializeDatabase();
  const dbAfter = loadDatabase();
  assert.equal(dbAfter.USERS.length, countBefore, 'Admin account must not be duplicated');
});

test('database: backup and restore preserve structure and data', () => {
  const backup = backupDatabase('test_runner', 'Unit test backup');
  assert.ok(backup.id);
  assert.equal(backup.status, 'success');

  const currentDb = loadDatabase();
  const jsonStr = JSON.stringify(currentDb);
  const restoreRes = restoreDatabase(jsonStr, 'test_runner');
  assert.equal(restoreRes.success, true);
});
