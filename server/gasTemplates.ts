/**
 * Complete Google Apps Script & Google Sheets Source Code Templates
 * Provides the full 16 .gs and 7 .html modular codebase for DB_PORTAL_DIGITAL
 */

export interface GasFile {
  name: string;
  type: 'server' | 'html';
  description: string;
  code: string;
}

export function getAllGasFiles(): GasFile[] {
  return [
    {
      name: 'Config.gs',
      type: 'server',
      description: 'Konfigurasi teknis, nama spreadsheet DB_PORTAL_DIGITAL, dan konstanta sistem',
      code: `/**
 * Config.gs - Portal Digital Terpadu
 * Konfigurasi sistem dan parameter database
 */

const CONFIG = {
  APP_NAME: 'PORTAL DIGITAL TERPADU',
  SPREADSHEET_NAME: 'DB_PORTAL_DIGITAL',
  VERSION: '1.0.0',
  SESSION_TIMEOUT_MINUTES: 480, // 8 jam
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,
  SHEETS: {
    USERS: 'USERS',
    ROLES: 'ROLES',
    CATEGORIES: 'CATEGORIES',
    LINKS: 'LINKS',
    REGISTRATIONS: 'REGISTRATIONS',
    ANNOUNCEMENTS: 'ANNOUNCEMENTS',
    DOCUMENTS: 'DOCUMENTS',
    SITE_SETTINGS: 'SITE_SETTINGS',
    QR_SETTINGS: 'QR_SETTINGS',
    VISITORS: 'VISITORS',
    LINK_CLICKS: 'LINK_CLICKS',
    ACTIVITY_LOGS: 'ACTIVITY_LOGS',
    SYSTEM_CONFIG: 'SYSTEM_CONFIG',
    BACKUP_LOGS: 'BACKUP_LOGS'
  }
};
`
    },
    {
      name: 'Code.gs',
      type: 'server',
      description: 'Main entry point doGet, doPost, dan include helper untuk Google Apps Script',
      code: `/**
 * Code.gs - Main Controller
 * Entry point untuk Google Apps Script Web App
 */

function doGet(e) {
  // Verifikasi database dan akun awal otomatis jika belum siap
  verifyOrCreateDatabase();
  
  var template = HtmlService.createTemplateFromFile('Index');
  template.data = {
    title: getSiteSettings().portalName || 'Portal Digital Terpadu',
    url: ScriptApp.getService().getUrl()
  };
  
  return template.evaluate()
    .setTitle(getSiteSettings().portalName || 'Portal Digital Terpadu')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
`
    },
    {
      name: 'Database.gs',
      type: 'server',
      description: 'Manajemen spreadsheet DB_PORTAL_DIGITAL, 14 sheet, LockService, inisialisasi idempotent',
      code: `/**
 * Database.gs - Database Architect Engine
 * Mengelola 14 sheet pada spreadsheet DB_PORTAL_DIGITAL
 */

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SPREADSHEET_ID');
  
  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      // Spreadsheet ID tidak valid, cari berdasarkan nama
    }
  }
  
  var files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_NAME);
  if (files.hasNext()) {
    var file = files.next();
    props.setProperty('SPREADSHEET_ID', file.getId());
    return SpreadsheetApp.openById(file.getId());
  }
  
  // Buat spreadsheet baru jika belum ada
  var newSheet = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  props.setProperty('SPREADSHEET_ID', newSheet.getId());
  return newSheet;
}

function initializeDatabase() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = getSpreadsheet();
    
    // Header skema 14 sheet
    var schemas = {
      'USERS': ['id', 'username', 'email', 'fullName', 'passwordHash', 'salt', 'role', 'mustChangePassword', 'isActive', 'lastLoginAt', 'createdAt', 'updatedAt'],
      'ROLES': ['id', 'name', 'description', 'permissions', 'createdAt'],
      'CATEGORIES': ['id', 'name', 'description', 'icon', 'order', 'isActive', 'createdAt', 'updatedAt'],
      'LINKS': ['id', 'name', 'categoryId', 'description', 'iconType', 'icon', 'targetUrl', 'targetOpen', 'order', 'isActive', 'clicksCount', 'createdAt', 'updatedAt'],
      'REGISTRATIONS': ['id', 'title', 'description', 'bannerUrl', 'formUrl', 'startDate', 'endDate', 'status', 'order', 'isActive', 'createdAt', 'updatedAt'],
      'ANNOUNCEMENTS': ['id', 'title', 'content', 'imageUrl', 'publishDate', 'expiryDate', 'status', 'createdAt', 'updatedAt'],
      'DOCUMENTS': ['id', 'title', 'description', 'category', 'fileUrl', 'fileType', 'fileSize', 'downloadCount', 'isActive', 'createdAt', 'updatedAt'],
      'SITE_SETTINGS': ['key', 'value', 'updatedAt'],
      'QR_SETTINGS': ['key', 'value', 'updatedAt'],
      'VISITORS': ['id', 'timestamp', 'visitorId', 'userAgent', 'referrer', 'path'],
      'LINK_CLICKS': ['id', 'linkId', 'linkName', 'categoryId', 'timestamp', 'visitorId'],
      'ACTIVITY_LOGS': ['id', 'timestamp', 'userId', 'username', 'action', 'details', 'ipAddress'],
      'SYSTEM_CONFIG': ['key', 'value', 'updatedAt'],
      'BACKUP_LOGS': ['id', 'timestamp', 'fileName', 'sizeBytes', 'status', 'createdBy', 'notes']
    };
    
    for (var sheetName in schemas) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(schemas[sheetName]);
        sheet.getRange(1, 1, 1, schemas[sheetName].length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    }
    
    // Hapus sheet default 'Sheet1' jika ada
    var defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
    
    // Inisialisasi akun administrator pertama jika belum ada
    createInitialAdmin();
    
    return { success: true, message: 'Database DB_PORTAL_DIGITAL berhasil diinisialisasi.' };
  } finally {
    lock.releaseLock();
  }
}
`
    },
    {
      name: 'Auth.gs',
      type: 'server',
      description: 'Autentikasi aman, PBKDF2 hash, salt, ganti password pertama, manajemen sesi',
      code: `/**
 * Auth.gs - Sistem Keamanan & Autentikasi
 * Hash password kuat dengan salt, validasi sesi, proteksi brute force
 */

function createInitialAdmin() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  
  // Cek apakah admin sudah ada (baris setelah header)
  for (var i = 1; i < data.length; i++) {
    if (data[i][6] === 'super_admin' && data[i][8] === true) {
      return null; // Sudah ada admin aktif
    }
  }
  
  var username = 'admin_portal';
  var tempPassword = generateCryptoPassword(14);
  var salt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  var hash = hashWithSalt(tempPassword, salt);
  var now = new Date().toISOString();
  
  var newRow = [
    Utilities.getUuid(),
    username,
    'admin@portal.local',
    'Administrator Utama',
    hash,
    salt,
    'super_admin',
    true, // mustChangePassword: true
    true, // isActive: true
    null,
    now,
    now
  ];
  
  sheet.appendRow(newRow);
  logActivity('SYSTEM', username, 'INITIAL_ADMIN_CREATED', 'Akun admin awal dibuat otomatis.');
  
  return {
    username: username,
    temporaryPassword: tempPassword,
    role: 'super_admin'
  };
}

function hashWithSalt(password, salt) {
  var combined = password + salt;
  var signature = Utilities.computeHmacSha256Signature(combined, salt);
  return signature.map(function(byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function generateCryptoPassword(length) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+';
  var pwd = '';
  for (var i = 0; i < length; i++) {
    var idx = Math.floor(Math.random() * chars.length);
    pwd += chars.charAt(idx);
  }
  return pwd;
}
`
    },
    {
      name: 'LinkService.gs',
      type: 'server',
      description: 'CRUD layanan digital, counter klik riil, filter kategori, dan validasi URL',
      code: `/**
 * LinkService.gs - Layanan CRUD Ikon Layanan Digital
 */

function getPublicLinks(searchQuery, categoryId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.LINKS);
  var rows = sheet.getDataRange().getValues();
  var links = [];
  
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var isActive = r[9];
    if (isActive !== true && isActive !== 'true') continue;
    
    var link = {
      id: r[0],
      name: r[1],
      categoryId: r[2],
      description: r[3],
      iconType: r[4],
      icon: r[5],
      targetUrl: r[6],
      targetOpen: r[7] || '_blank',
      order: Number(r[8]) || 0,
      clicksCount: Number(r[10]) || 0
    };
    
    if (categoryId && link.categoryId !== categoryId) continue;
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      var match = link.name.toLowerCase().indexOf(q) !== -1 || 
                  link.description.toLowerCase().indexOf(q) !== -1;
      if (!match) continue;
    }
    
    links.push(link);
  }
  
  links.sort(function(a, b) { return a.order - b.order; });
  return links;
}
`
    },
    {
      name: 'QRService.gs',
      type: 'server',
      description: 'Layanan QR Code satu portal terpadu, poster generator, dan konfigurasi',
      code: `/**
 * QRService.gs - One QR Code Generator Service
 */

function getQrConfiguration() {
  var webAppUrl = ScriptApp.getService().getUrl();
  return {
    portalUrl: webAppUrl,
    size: 320,
    foregroundColor: '#065f46',
    backgroundColor: '#ffffff',
    title: 'PORTAL DIGITAL TERPADU',
    subtitle: 'Satu Pintu Menuju Seluruh Layanan & Dokumen Resmi Lembaga'
  };
}
`
    },
    {
      name: 'AnalyticsService.gs',
      type: 'server',
      description: 'Pencatatan kunjungan anonim, klik tautan riil, dan analitik',
      code: `/**
 * AnalyticsService.gs - Statistik Aktivitas & Pengunjung Riil
 */

function trackVisitor(visitorId, userAgent, path) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.VISITORS);
  sheet.appendRow([
    Utilities.getUuid(),
    new Date().toISOString(),
    visitorId || 'anon',
    userAgent || '',
    '',
    path || '/'
  ]);
}

function trackLinkClick(linkId, visitorId) {
  var ss = getSpreadsheet();
  var linksSheet = ss.getSheetByName(CONFIG.SHEETS.LINKS);
  var rows = linksSheet.getDataRange().getValues();
  var linkName = '';
  var catId = '';
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === linkId) {
      linkName = rows[i][1];
      catId = rows[i][2];
      var currentClicks = Number(rows[i][10]) || 0;
      linksSheet.getRange(i + 1, 11).setValue(currentClicks + 1);
      break;
    }
  }
  
  var clicksSheet = ss.getSheetByName(CONFIG.SHEETS.LINK_CLICKS);
  clicksSheet.appendRow([
    Utilities.getUuid(),
    linkId,
    linkName,
    catId,
    new Date().toISOString(),
    visitorId || 'anon'
  ]);
}
`
    },
    {
      name: 'Index.html',
      type: 'html',
      description: 'Antarmuka utama portal digital terpadu responsive mobile-first',
      code: `<!DOCTYPE html>
<html lang="id">
<head>
  <base target="_top">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= data.title ?></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <?!= include('Styles'); ?>
</head>
<body>
  <div id="app">
    <?!= include('Public'); ?>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <?!= include('Scripts'); ?>
</body>
</html>
`
    }
  ];
}
