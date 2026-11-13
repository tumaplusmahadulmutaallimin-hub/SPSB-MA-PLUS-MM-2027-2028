/**
 * Database Schema and Entity Types for Portal Digital Terpadu
 * Matches DB_PORTAL_DIGITAL 14 Sheets Specification
 */

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  passwordHash: string;
  salt: string;
  role: 'super_admin' | 'admin' | 'operator';
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceLink {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  iconType: 'lucide' | 'image' | 'upload';
  icon: string; // Lucide icon name or image data/url
  targetUrl: string;
  targetOpen: '_blank' | '_self';
  order: number;
  isActive: boolean;
  clicksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Registration {
  id: string;
  title: string;
  description: string;
  bannerUrl: string;
  formUrl: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  publishDate: string;
  expiryDate?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileType: string;
  fileSize: string;
  downloadCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  portalName: string;
  institutionName: string;
  tagline: string;
  description: string;
  logoUrl: string;
  faviconUrl: string;
  bannerUrl: string;
  primaryColor: string; // Forest Green default e.g. #065f46
  accentColor: string;  // Gold default e.g. #d97706
  whatsappNumber: string;
  email: string;
  address: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  websiteUrl: string;
  copyrightText: string;
  heroEnabled: boolean;
  announcementsEnabled: boolean;
  registrationsEnabled: boolean;
  documentsEnabled: boolean;
  searchEnabled: boolean;
  categoriesEnabled: boolean;
  updatedAt: string;
}

export interface QrSettings {
  portalUrl: string;
  size: number;
  foregroundColor: string;
  backgroundColor: string;
  includeLogo: boolean;
  logoUrl: string;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  posterTitle: string;
  posterSubtitle: string;
  posterFooter: string;
  updatedAt: string;
}

export interface VisitorRecord {
  id: string;
  timestamp: string;
  visitorId: string;
  userAgent: string;
  referrer: string;
  path: string;
}

export interface LinkClickRecord {
  id: string;
  linkId: string;
  linkName: string;
  categoryId: string;
  timestamp: string;
  visitorId: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface SystemConfig {
  version: string;
  appName: string;
  databaseName: string;
  installationCompleted: boolean;
  installedAt: string;
  lastBackupAt: string | null;
  maxLoginAttempts: number;
  sessionTimeoutHours: number;
  hasCustomAdminCreated?: boolean;
}

export interface BackupLog {
  id: string;
  timestamp: string;
  fileName: string;
  sizeBytes: number;
  status: 'success' | 'failed';
  createdBy: string;
  notes: string;
}

export interface StudentAchievement {
  id: string;
  registrationNumberOrNisn: string;
  studentName: string;
  achievementTitle: string;
  field: 'tahfidz' | 'akademik' | 'olahraga' | 'seni_budaya' | 'keagamaan' | 'lainnya';
  level: 'Kecamatan' | 'Kabupaten/Kota' | 'Provinsi' | 'Nasional' | 'Internasional';
  rank: 'Juara 1' | 'Juara 2' | 'Juara 3' | 'Harapan 1' | 'Harapan 2' | 'Finalis / Peserta';
  organizer: string;
  year: string;
  certificateUrl: string;
  certificateFileName?: string;
  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommitteeContact {
  id: string;
  name: string;
  role: string;
  whatsappNumber: string;
  notes?: string;
  isAvailable: boolean;
}

export interface MadrasahAchievement {
  id: string;
  title: string;
  category: string;
  level: string;
  recipient: string;
  year: string;
  photoUrl: string;
  shortDescription: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  USERS: User[];
  ROLES: Role[];
  CATEGORIES: Category[];
  LINKS: ServiceLink[];
  REGISTRATIONS: Registration[];
  ANNOUNCEMENTS: Announcement[];
  DOCUMENTS: DocumentItem[];
  SITE_SETTINGS: SiteSettings;
  QR_SETTINGS: QrSettings;
  VISITORS: VisitorRecord[];
  LINK_CLICKS: LinkClickRecord[];
  ACTIVITY_LOGS: ActivityLog[];
  SYSTEM_CONFIG: SystemConfig;
  BACKUP_LOGS: BackupLog[];
  STUDENT_ACHIEVEMENTS?: StudentAchievement[];
  COMMITTEE_CONTACTS?: CommitteeContact[];
  MADRASAH_ACHIEVEMENTS?: MadrasahAchievement[];
}

export interface AuthSession {
  token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    mustChangePassword: boolean;
    mustCreatePersonalAccount?: boolean;
  };
  expiresAt: number;
}

export interface SetupCredentials {
  username: string;
  temporaryPassword: string;
  role: string;
  note: string;
}

export interface AuthStatus {
  hasCustomAdminCreated: boolean;
  isSetupMode: boolean;
  currentAdminHint?: string;
}
