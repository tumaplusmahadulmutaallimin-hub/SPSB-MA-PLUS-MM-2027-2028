import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building,
  Settings,
  Grid,
  FolderTree,
  Link as LinkIcon,
  UserPlus,
  Bell,
  FileText,
  QrCode,
  BarChart3,
  Users,
  Sliders,
  Database,
  History,
  Code2,
  LogOut,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  Printer,
  ChevronDown,
  Sparkles,
  Award,
  Phone,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Eye,
  Trophy,
  Menu,
  X,
  Cloud,
  CloudOff,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  ADMIN_AUTHORIZED_EMAIL,
  AISTUDIO_SHARED_APP_URL,
  FIREBASE_AUTHORIZED_DOMAINS_URL,
  isAuthorizedFirebaseAdmin,
  onFirebaseAuthChange,
  signInAdminWithGoogle,
  signOutFirebase,
} from '../../lib/firebase';
import {
  clearPortalCollectionsInFirestore,
  compressImageFileToDataUrl,
  deleteAnnouncementFromFirestore,
  deleteCategoryFromFirestore,
  deleteContactFromFirestore,
  deleteDocumentFromFirestore,
  deleteLinkFromFirestore,
  deleteMadrasahAchievementFromFirestore,
  deleteRegistrationFromFirestore,
  deleteStudentAchievementFromFirestore,
  isCloudAdminReady,
  loadAllAdminFromFirestore,
  saveAnnouncementToFirestore,
  saveCategoryToFirestore,
  saveContactToFirestore,
  saveDocumentToFirestore,
  saveLinkToFirestore,
  saveMadrasahAchievementToFirestore,
  saveQrSettingsToFirestore,
  saveRegistrationToFirestore,
  saveSiteSettingsToFirestore,
  syncAllLocalToFirestore,
  verifyStudentAchievementInFirestore,
} from '../../lib/firestorePortal';
import {
  AuthSession,
  Category,
  ServiceLink,
  Announcement,
  Registration,
  DocumentItem,
  SiteSettings,
  QrSettings,
  ActivityLog,
  BackupLog,
  StudentAchievement,
  CommitteeContact,
  MadrasahAchievement,
} from '../../types';
import { IconRenderer, AVAILABLE_LUCIDE_ICONS } from '../common/IconRenderer';
import { OFFICIAL_BRAND_ASSETS, getSvgDataUrl } from '../../lib/brandAssets';

const ADMIN_TAB_STORAGE_KEY = 'PORTAL_ADMIN_ACTIVE_TAB_V1';

interface AdminDashboardProps {
  session: AuthSession;
  onLogout: () => void;
  onViewPublicPortal: () => void;
  onDataUpdated?: () => void;
}

type TabType =
  | 'overview'
  | 'identity'
  | 'home_settings'
  | 'links'
  | 'categories'
  | 'achievements'
  | 'contacts'
  | 'registrations'
  | 'announcements'
  | 'documents'
  | 'qrcode'
  | 'analytics'
  | 'users'
  | 'system'
  | 'backup'
  | 'logs'
  | 'gas_export';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  onLogout,
  onViewPublicPortal,
  onDataUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY) as TabType | null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'overview';
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  // Data states
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<ServiceLink[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [qrSettings, setQrSettings] = useState<QrSettings | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [gasFiles, setGasFiles] = useState<any[]>([]);
  const [selectedGasFile, setSelectedGasFile] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [committeeContacts, setCommitteeContacts] = useState<CommitteeContact[]>([]);
  const [madrasahAchievements, setMadrasahAchievements] = useState<MadrasahAchievement[]>([]);
  const [achievementSubTab, setAchievementSubTab] = useState<'madrasah' | 'student'>('madrasah');

  // Modals & form editing states
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingLink, setEditingLink] = useState<Partial<ServiceLink> | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Partial<Announcement> | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<Partial<Registration> | null>(null);
  const [editingDocument, setEditingDocument] = useState<Partial<DocumentItem> | null>(null);
  const [editingContact, setEditingContact] = useState<Partial<CommitteeContact> | null>(null);
  const [editingMadrasahAchievement, setEditingMadrasahAchievement] = useState<Partial<MadrasahAchievement> | null>(null);
  const [selectedAchievementCert, setSelectedAchievementCert] = useState<StudentAchievement | null>(null);
  const [newUserForm, setNewUserForm] = useState({ username: '', fullName: '', email: '', password: '', role: 'operator' });
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [restoreJson, setRestoreJson] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Live QR state for QR tab
  const [adminQrDataUrl, setAdminQrDataUrl] = useState<string>('');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Initial & synced data loading (cache: no-store)
  const loadAllData = async () => {
    setLoading(true);
    try {
      const fetchOpts: RequestInit = { headers: authHeaders, cache: 'no-store' };
      const [
        dashRes,
        catRes,
        linkRes,
        annRes,
        regRes,
        docRes,
        settRes,
        qrRes,
        logsRes,
        usersRes,
        backupsRes,
        achRes,
        contactsRes,
        madrasahAchRes,
        cloudData,
      ] = await Promise.all([
        fetch('/api/admin/dashboard', fetchOpts),
        fetch('/api/admin/categories', fetchOpts),
        fetch('/api/admin/links', fetchOpts),
        fetch('/api/admin/announcements', fetchOpts),
        fetch('/api/admin/registrations', fetchOpts),
        fetch('/api/admin/documents', fetchOpts),
        fetch('/api/admin/settings', fetchOpts),
        fetch('/api/admin/qr-settings', fetchOpts),
        fetch('/api/admin/activity-logs', fetchOpts),
        fetch('/api/admin/users', fetchOpts),
        fetch('/api/admin/backups', fetchOpts),
        fetch('/api/admin/achievements', fetchOpts),
        fetch('/api/admin/committee-contacts', fetchOpts),
        fetch('/api/admin/madrasah-achievements', fetchOpts),
        loadAllAdminFromFirestore().catch(() => null),
      ]);

      if (dashRes.ok) setDashboardStats(await dashRes.json());
      if (logsRes.ok) setActivityLogs(await logsRes.json());
      if (usersRes.ok) setUsersList(await usersRes.json());
      if (backupsRes.ok) setBackupLogs(await backupsRes.json());

      if (cloudData && cloudData.initialized) {
        setSiteSettings(cloudData.siteSettings);
        if (cloudData.qrSettings) {
          setQrSettings(cloudData.qrSettings);
        } else if (qrRes.ok) {
          setQrSettings(await qrRes.json());
        }
        setCategories(cloudData.categories);
        setLinks(cloudData.links);
        setAnnouncements(cloudData.announcements);
        setRegistrations(cloudData.registrations);
        setDocuments(cloudData.documents);
        setCommitteeContacts(cloudData.committeeContacts);
        setMadrasahAchievements(cloudData.madrasahAchievements);
        if (isCloudAdminReady() || cloudData.studentAchievements.length > 0) {
          setAchievements(cloudData.studentAchievements);
        } else if (achRes.ok) {
          setAchievements(await achRes.json());
        }
      } else {
        if (catRes.ok) setCategories(await catRes.json());
        if (linkRes.ok) setLinks(await linkRes.json());
        if (annRes.ok) setAnnouncements(await annRes.json());
        if (regRes.ok) setRegistrations(await regRes.json());
        if (docRes.ok) setDocuments(await docRes.json());
        if (settRes.ok) setSiteSettings(await settRes.json());
        if (qrRes.ok) setQrSettings(await qrRes.json());
        if (achRes.ok) setAchievements(await achRes.json());
        if (contactsRes.ok) setCommitteeContacts(await contactsRes.json());
        if (madrasahAchRes.ok) setMadrasahAchievements(await madrasahAchRes.json());
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      showNotification('error', 'Gagal memuat sebagian data.');
    } finally {
      setLoading(false);
    }
  };

  // Refresh admin data AND immediately notify public portal / other open tabs
  const syncAfterChange = async () => {
    await loadAllData();
    onDataUpdated?.();
  };

  useEffect(() => {
    loadAllData();
    const unsubAuth = onFirebaseAuthChange((user) => {
      setFirebaseUser(user);
      if (isAuthorizedFirebaseAdmin(user)) {
        loadAllData();
      }
    });
    return () => unsubAuth();
  }, []);

  const handleConnectGoogleCloud = async () => {
    setIsCloudSyncing(true);
    setUnauthorizedDomain(null);
    try {
      const user = await signInAdminWithGoogle();
      if (!isAuthorizedFirebaseAdmin(user)) {
        showNotification(
          'error',
          `Akun ${user.email || 'ini'} belum terdaftar sebagai admin (${ADMIN_AUTHORIZED_EMAIL}).`
        );
        return;
      }

      const cloud = await loadAllAdminFromFirestore();
      if (!cloud.initialized) {
        await syncAllLocalToFirestore({
          siteSettings,
          qrSettings,
          categories,
          links,
          announcements,
          registrations,
          documents,
          committeeContacts,
          madrasahAchievements,
        });
      }
      showNotification('success', 'Cloud Firestore terhubung! Seluruh perubahan kini tersimpan permanen.');
      await syncAfterChange();
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || String(err?.message || '').includes('unauthorized-domain')) {
        setUnauthorizedDomain(err?.unauthorizedDomain || window.location.hostname);
      }
      showNotification('error', err?.message || 'Gagal menghubungkan Google Cloud Firestore.');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleForceSyncToCloud = async () => {
    if (!isCloudAdminReady()) {
      await handleConnectGoogleCloud();
      return;
    }
    setIsCloudSyncing(true);
    try {
      await syncAllLocalToFirestore({
        siteSettings,
        qrSettings,
        categories,
        links,
        announcements,
        registrations,
        documents,
        committeeContacts,
        madrasahAchievements,
      });
      showNotification('success', 'Seluruh data berhasil disinkronkan ke Cloud Firestore.');
      await syncAfterChange();
    } catch (err: any) {
      showNotification('error', err?.message || 'Gagal menyinkronkan ke Cloud Firestore.');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Fetch GAS files when tab is selected
  useEffect(() => {
    if (activeTab === 'gas_export') {
      fetch('/api/admin/gas-files', { headers: authHeaders, cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data.files) {
            setGasFiles(data.files);
            if (!selectedGasFile && data.files.length > 0) {
              setSelectedGasFile(data.files[0]);
            }
          }
        });
    }
  }, [activeTab]);

  // Generate QR for QR tab
  useEffect(() => {
    if (activeTab === 'qrcode' && qrSettings) {
      const url = qrSettings.portalUrl || window.location.origin;
      fetch(
        `/api/public/qr-image?url=${encodeURIComponent(url)}&dark=${encodeURIComponent(
          qrSettings.foregroundColor || '#065f46'
        )}&light=${encodeURIComponent(qrSettings.backgroundColor || '#ffffff')}&size=360`,
        { cache: 'no-store' }
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.dataUrl) setAdminQrDataUrl(data.dataUrl);
        });
    }
  }, [activeTab, qrSettings]);

  // --- CRUD ACTIONS ---

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name?.trim()) return;

    try {
      const isEdit = Boolean(editingCategory.id);
      const url = isEdit ? `/api/admin/categories/${editingCategory.id}` : '/api/admin/categories';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(editingCategory),
      });
      const data = await res.json().catch(() => ({}));
      const cloudReady = isCloudAdminReady();

      if (!res.ok && !cloudReady) {
        showNotification('error', data.error || 'Gagal menyimpan kategori.');
        return;
      }

      const savedCat: Category = data.category || {
        id: editingCategory.id || crypto.randomUUID(),
        name: editingCategory.name.trim(),
        description: (editingCategory.description || '').trim(),
        icon: editingCategory.icon || 'Folder',
        order: Number(editingCategory.order ?? categories.length + 1),
        isActive: editingCategory.isActive ?? true,
        createdAt: editingCategory.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (cloudReady) {
        await saveCategoryToFirestore(savedCat);
      }

      showNotification('success', `Kategori berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
      setEditingCategory(null);
      await syncAfterChange();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: Category) => {
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus kategori "${cat.name}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      const cloudReady = isCloudAdminReady();
      if (!res.ok && !cloudReady) {
        showNotification('error', data.error || 'Gagal menghapus kategori.');
        return;
      }
      if (cloudReady) {
        await deleteCategoryFromFirestore(cat.id);
      }
      showNotification('success', `Kategori "${cat.name}" berhasil dihapus.`);
      await syncAfterChange();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Save Service Link
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink?.name?.trim() || !editingLink?.targetUrl?.trim()) return;

    try {
      const isEdit = Boolean(editingLink.id);
      const url = isEdit ? `/api/admin/links/${editingLink.id}` : '/api/admin/links';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(editingLink),
      });
      const data = await res.json().catch(() => ({}));
      const cloudReady = isCloudAdminReady();

      if (!res.ok && !cloudReady) {
        showNotification('error', data.error || 'Gagal menyimpan layanan.');
        return;
      }

      const savedLink: ServiceLink = data.link || {
        id: editingLink.id || crypto.randomUUID(),
        name: editingLink.name.trim(),
        categoryId: editingLink.categoryId || '',
        description: (editingLink.description || '').trim(),
        iconType: editingLink.iconType || 'lucide',
        icon: editingLink.icon || 'Globe',
        targetUrl: editingLink.targetUrl.trim(),
        targetOpen: editingLink.targetOpen === '_self' ? '_self' : '_blank',
        order: Number(editingLink.order ?? links.length + 1),
        isActive: editingLink.isActive ?? true,
        clicksCount: Number(editingLink.clicksCount || 0),
        createdAt: editingLink.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (cloudReady) {
        await saveLinkToFirestore(savedLink);
      }

      showNotification('success', `Layanan berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
      setEditingLink(null);
      await syncAfterChange();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Duplicate Service Link
  const handleDuplicateLink = async (link: ServiceLink) => {
    try {
      const res = await fetch(`/api/admin/links/${link.id}/duplicate`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      const cloudReady = isCloudAdminReady();
      if (res.ok || cloudReady) {
        const dup: ServiceLink = data.link || {
          ...link,
          id: crypto.randomUUID(),
          name: `${link.name} (Salinan)`,
          order: link.order + 1,
          clicksCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (cloudReady) {
          await saveLinkToFirestore(dup);
        }
        showNotification('success', `Layanan "${link.name}" berhasil digandakan.`);
        await syncAfterChange();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Delete Service Link
  const handleDeleteLink = async (link: ServiceLink) => {
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus layanan "${link.name}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/links/${link.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const cloudReady = isCloudAdminReady();
      if (res.ok || cloudReady) {
        if (cloudReady) {
          await deleteLinkFromFirestore(link.id);
        }
        showNotification('success', `Layanan "${link.name}" berhasil dihapus.`);
        await syncAfterChange();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Save Settings
  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteSettings) return;

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(siteSettings),
      });
      const cloudReady = isCloudAdminReady();
      if (cloudReady) {
        await saveSiteSettingsToFirestore(siteSettings);
      }
      if (res.ok || cloudReady) {
        showNotification('success', 'Pengaturan identitas dan tampilan portal berhasil disimpan & disinkronkan.');
        await syncAfterChange();
      } else {
        const data = await res.json();
        showNotification('error', data.error || 'Gagal menyimpan pengaturan.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Save QR Settings
  const handleSaveQrSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrSettings) return;

    try {
      const res = await fetch('/api/admin/qr-settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(qrSettings),
      });
      const cloudReady = isCloudAdminReady();
      if (cloudReady) {
        await saveQrSettingsToFirestore(qrSettings);
      }
      if (res.ok || cloudReady) {
        showNotification('success', 'Pengaturan QR Code dan Poster berhasil diperbarui.');
        const url = qrSettings.portalUrl || window.location.origin;
        const qrRes = await fetch(
          `/api/public/qr-image?url=${encodeURIComponent(url)}&dark=${encodeURIComponent(
            qrSettings.foregroundColor || '#065f46'
          )}&light=${encodeURIComponent(qrSettings.backgroundColor || '#ffffff')}&size=360`,
          { cache: 'no-store' }
        );
        const qrData = await qrRes.json();
        if (qrData.dataUrl) setAdminQrDataUrl(qrData.dataUrl);
        await syncAfterChange();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Verify / Reject Achievement
  const handleVerifyAchievement = async (id: string, status: 'verified' | 'rejected', notes?: string) => {
    try {
      const res = await fetch(`/api/admin/achievements/${id}/verify`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status, notes: notes || '' }),
      });
      const cloudReady = isCloudAdminReady();
      if (cloudReady) {
        await verifyStudentAchievementInFirestore(id, status, notes || '');
      }
      if (res.ok || cloudReady) {
        showNotification(
          'success',
          `Status prestasi berhasil diubah menjadi: ${status === 'verified' ? 'Terverifikasi' : 'Ditolak'}`
        );
        await syncAfterChange();
      } else {
        const data = await res.json();
        showNotification('error', data.error || 'Gagal memperbarui status prestasi.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Delete Achievement
  const handleDeleteAchievement = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus arsip pengajuan prestasi ini?')) return;
    try {
      const res = await fetch(`/api/admin/achievements/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const cloudReady = isCloudAdminReady();
      if (cloudReady) {
        await deleteStudentAchievementFromFirestore(id);
      }
      if (res.ok || cloudReady) {
        showNotification('success', 'Data prestasi berhasil dihapus.');
        await syncAfterChange();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Save / Update Madrasah Achievement (Menu Khusus Beranda)
  const handleSaveMadrasahAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMadrasahAchievement?.title?.trim()) return;

    try {
      const isEdit = Boolean(editingMadrasahAchievement.id);
      const url = isEdit
        ? `/api/admin/madrasah-achievements/${editingMadrasahAchievement.id}`
        : '/api/admin/madrasah-achievements';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(editingMadrasahAchievement),
      });
      const data = await res.json().catch(() => ({}));
      const cloudReady = isCloudAdminReady();

      if (res.ok || cloudReady) {
        const savedItem: MadrasahAchievement = data.achievement || {
          id: editingMadrasahAchievement.id || crypto.randomUUID(),
          title: editingMadrasahAchievement.title.trim(),
          category: editingMadrasahAchievement.category || 'Prestasi',
          level: editingMadrasahAchievement.level || 'Tingkat Nasional',
          recipient: editingMadrasahAchievement.recipient || 'MA PLUS MM',
          year: editingMadrasahAchievement.year || String(new Date().getFullYear()),
          photoUrl: editingMadrasahAchievement.photoUrl || '',
          shortDescription: editingMadrasahAchievement.shortDescription || '',
          order: Number(editingMadrasahAchievement.order ?? madrasahAchievements.length + 1),
          isActive: editingMadrasahAchievement.isActive !== false,
          createdAt: editingMadrasahAchievement.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (cloudReady) {
          await saveMadrasahAchievementToFirestore(savedItem);
        }
        showNotification(
          'success',
          `Prestasi Madrasah berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`
        );
        setEditingMadrasahAchievement(null);
        await syncAfterChange();
      } else {
        showNotification('error', data.error || 'Gagal menyimpan prestasi madrasah.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Delete Madrasah Achievement
  const handleDeleteMadrasahAchievement = async (id: string) => {
    if (!window.confirm('Hapus prestasi madrasah ini dari halaman utama?')) return;
    try {
      const res = await fetch(`/api/admin/madrasah-achievements/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const cloudReady = isCloudAdminReady();
      if (cloudReady) {
        await deleteMadrasahAchievementFromFirestore(id);
      }
      if (res.ok || cloudReady) {
        showNotification('success', 'Prestasi madrasah berhasil dihapus.');
        await syncAfterChange();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Save / Update Committee Contact
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact?.role || !editingContact?.whatsappNumber) return;

    try {
      const isEdit = Boolean(editingContact.id);
      const url = isEdit ? `/api/admin/committee-contacts/${editingContact.id}` : '/api/admin/committee-contacts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(editingContact),
      });
      const data = await res.json().catch(() => ({}));
      const cloudReady = isCloudAdminReady();

      if (res.ok || cloudReady) {
        const savedContact: CommitteeContact = data.contact || {
          id: editingContact.id || crypto.randomUUID(),
          name: (editingContact.name || '').trim(),
          role: editingContact.role.trim(),
          whatsappNumber: editingContact.whatsappNumber.trim(),
          notes: editingContact.notes || '',
          isAvailable: editingContact.isAvailable !== false,
        };
        if (cloudReady) {
          await saveContactToFirestore(savedContact);
        }
        showNotification('success', `Kontak panitia berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
        setEditingContact(null);
        await syncAfterChange();
      } else {
        showNotification('error', data.error || 'Gagal menyimpan kontak panitia.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Delete Committee Contact
  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Hapus kontak panitia ini?')) return;
    try {
      const res = await fetch(`/api/admin/committee-contacts/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const cloudReady = isCloudAdminReady();
      if (cloudReady) {
        await deleteContactFromFirestore(id);
      }
      if (res.ok || cloudReady) {
        showNotification('success', 'Kontak panitia berhasil dihapus.');
        await syncAfterChange();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Manual Backup
  const handleTriggerBackup = async () => {
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ notes: 'Cadangan manual melalui dashboard admin' }),
      });
      if (res.ok) {
        showNotification('success', 'Cadangan database DB_PORTAL_DIGITAL berhasil dibuat.');
        await loadAllData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Authenticated JSON Database Export
  const handleExportDatabaseJson = async () => {
    try {
      const res = await fetch('/api/admin/export-database', { headers: authHeaders, cache: 'no-store' });
      if (!res.ok) {
        showNotification('error', 'Gagal mengekspor database JSON.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DB_PORTAL_DIGITAL_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification('success', 'File JSON database berhasil diunduh.');
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Reset all portal content & stats cleanly (zero dummy data)
  const handleResetPortalData = async () => {
    const confirmed = window.confirm(
      'PERINGATAN: Ini akan mengosongkan seluruh konten portal (layanan, kategori, pengumuman, pendaftaran, dokumen, prestasi, kontak panitia, dan statistik). Akun admin tetap aman. Lanjutkan?'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/reset-portal-data', {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      const cloudReady = isCloudAdminReady();
      if (!res.ok && !cloudReady) {
        showNotification('error', data.error || 'Gagal mengosongkan konten portal.');
        return;
      }
      if (cloudReady) {
        await clearPortalCollectionsInFirestore();
      }
      showNotification('success', 'Seluruh konten portal berhasil dikosongkan.');
      await syncAfterChange();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Restore Database
  const handleRestoreDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreJson.trim()) return;

    const confirmed = window.confirm(
      'PERINGATAN: Memulihkan database akan menggantikan data aktif saat ini dengan data cadangan. Lanjutkan?'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ jsonContent: restoreJson }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Gagal memulihkan database.');
        return;
      }

      showNotification('success', 'Database berhasil dipulihkan.');
      setShowRestoreModal(false);
      setRestoreJson('');
      await syncAfterChange();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Print Poster
  const handlePrintPoster = () => {
    window.print();
  };

  // Copy code helper
  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row text-slate-800 relative">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 lg:hidden no-print"
        />
      )}

      {/* ----------------- SIDEBAR NAVIGATION ----------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isSidebarOpen ? 'w-64' : 'w-64 lg:w-20'
        } shrink-0 bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 border-r border-slate-800 no-print`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            {(isSidebarOpen || mobileNavOpen) && (
              <span className="font-bold text-xs text-white uppercase tracking-wider truncate">
                Admin Portal
              </span>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:inline-flex p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            title="Ciutkan Sidebar"
          >
            <ChevronDown className={`w-4 h-4 transform ${isSidebarOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          {[
            { id: 'overview', label: '1. Dashboard Utama', icon: LayoutDashboard },
            { id: 'identity', label: '2. Identitas Portal', icon: Building },
            { id: 'home_settings', label: '3. Pengaturan Halaman', icon: Settings },
            { id: 'links', label: '4. Ikon Layanan Digital', icon: Grid },
            { id: 'categories', label: '5. Manajemen Kategori', icon: FolderTree },
            { id: 'achievements', label: '6. Prestasi Santri', icon: Award },
            { id: 'contacts', label: '7. Saluran & Panitia', icon: Phone },
            { id: 'registrations', label: '8. Pendaftaran & PPDB', icon: UserPlus },
            { id: 'announcements', label: '9. Pengumuman', icon: Bell },
            { id: 'documents', label: '10. Dokumen & Brosur', icon: FileText },
            { id: 'qrcode', label: '11. QR Code & Poster', icon: QrCode },
            { id: 'analytics', label: '12. Statistik Riil', icon: BarChart3 },
            { id: 'users', label: '13. Manajemen Pengguna', icon: Users },
            { id: 'system', label: '14. Pengaturan Sistem', icon: Sliders },
            { id: 'backup', label: '15. Backup & Restore', icon: Database },
            { id: 'logs', label: '16. Log Aktivitas', icon: History },
            { id: 'gas_export', label: '17. Ekspor Apps Script', icon: Code2 },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as TabType);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {(isSidebarOpen || mobileNavOpen) && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-slate-800 text-xs">
          {(isSidebarOpen || mobileNavOpen) && (
            <div className="mb-2 px-2">
              <p className="font-bold text-white truncate">{session.user.fullName}</p>
              <p className="text-[11px] text-emerald-400 capitalize truncate">@{session.user.username} ({session.user.role})</p>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {(isSidebarOpen || mobileNavOpen) && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* ----------------- MAIN CONTENT AREA ----------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-3 no-print sticky top-0 z-20">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              title="Buka Menu Admin"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm sm:text-lg font-bold text-slate-900 capitalize truncate">
              {activeTab === 'overview' && 'Ringkasan Dashboard'}
              {activeTab === 'identity' && 'Identitas & Tampilan Portal'}
              {activeTab === 'home_settings' && 'Pengaturan Bagian Halaman Utama'}
              {activeTab === 'links' && 'Manajemen Ikon Layanan Digital'}
              {activeTab === 'categories' && 'Manajemen Kategori Layanan'}
              {activeTab === 'achievements' && 'Akademik & Pengajuan Prestasi Santri'}
              {activeTab === 'contacts' && 'Saluran WhatsApp Resmi & Narahubung Panitia'}
              {activeTab === 'registrations' && 'Manajemen Pendaftaran & PPDB'}
              {activeTab === 'announcements' && 'Manajemen Pengumuman Resmi'}
              {activeTab === 'documents' && 'Manajemen Dokumen & Berkas'}
              {activeTab === 'qrcode' && 'Generator QR Code & Pembuat Poster'}
              {activeTab === 'analytics' && 'Statistik & Analisis Pengunjung Riil'}
              {activeTab === 'users' && 'Manajemen Pengguna & Operator'}
              {activeTab === 'system' && 'Konfigurasi Sistem'}
              {activeTab === 'backup' && 'Cadangan & Pemulihan Database'}
              {activeTab === 'logs' && 'Log Audit Aktivitas'}
              {activeTab === 'gas_export' && 'Ekspor Kode Google Apps Script (DB_PORTAL_DIGITAL)'}
            </h2>
            {loading && <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onViewPublicPortal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Lihat Halaman Publik</span>
              <span className="sm:hidden">Publik</span>
            </button>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between no-print ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            <span>{feedbackMessage.text}</span>
            <button onClick={() => setFeedbackMessage(null)} className="cursor-pointer">
              <Check className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {/* Cloud Firestore Sync Status Bar */}
          <div
            className={`mb-5 p-3.5 sm:p-4 rounded-2xl border text-xs no-print ${
              isAuthorizedFirebaseAdmin(firebaseUser)
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : unauthorizedDomain
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5">
                {isAuthorizedFirebaseAdmin(firebaseUser) ? (
                  <Cloud className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <CloudOff className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${unauthorizedDomain ? 'text-rose-600' : 'text-amber-700'}`} />
                )}
                <div>
                  {isAuthorizedFirebaseAdmin(firebaseUser) ? (
                    <>
                      <p className="font-bold text-emerald-900">
                        Cloud Firestore Aktif — Perubahan Tersimpan Permanen ({firebaseUser?.email})
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Setiap perubahan langsung tersimpan di cloud dan tidak hilang setelah refresh atau deploy ulang.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={`font-bold ${unauthorizedDomain ? 'text-rose-950' : 'text-amber-950'}`}>
                        Aktifkan Simpan Permanen Cloud Firestore (Agar Data Tidak Hilang Setelah Refresh)
                      </p>
                      <p className={`text-[11px] ${unauthorizedDomain ? 'text-rose-800' : 'text-amber-800'}`}>
                        Hubungkan akun Google admin ({ADMIN_AUTHORIZED_EMAIL}) sekali klik untuk menyinkronkan data ke database cloud permanen.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isAuthorizedFirebaseAdmin(firebaseUser) ? (
                  <>
                    <button
                      type="button"
                      disabled={isCloudSyncing}
                      onClick={handleForceSyncToCloud}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                      <span>Sinkronkan Cloud</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => signOutFirebase()}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 font-semibold cursor-pointer"
                    >
                      Putus Cloud
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isCloudSyncing}
                    onClick={handleConnectGoogleCloud}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isCloudSyncing ? 'Menghubungkan...' : 'Hubungkan Cloud Google'}</span>
                  </button>
                )}
              </div>
            </div>

            {!isAuthorizedFirebaseAdmin(firebaseUser) && unauthorizedDomain && (
              <div className="mt-3 pt-3 border-t border-rose-200/80 space-y-2.5 text-[11px] text-rose-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Domain Vercel <strong>{unauthorizedDomain}</strong> belum didaftarkan di daftar <em>Authorized domains</em> Firebase Authentication. Lakukan langkah singkat sekali ini (tanpa perlu deploy ulang):
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-rose-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {unauthorizedDomain}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(unauthorizedDomain);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 2500);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                      >
                        {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedDomain ? 'Domain Tersalin!' : '1. Salin Domain'}</span>
                      </button>
                      <a
                        href={FIREBASE_AUTHORIZED_DOMAINS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>2. Buka Pengaturan Domain Firebase</span>
                      </a>
                    </div>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed">
                    <li>Klik <strong>Buka Pengaturan Domain Firebase</strong> (login dengan <strong>{ADMIN_AUTHORIZED_EMAIL}</strong>).</li>
                    <li>Buka tab <strong>Authorized domains</strong> → klik <strong>Add domain</strong> → tempel <strong>{unauthorizedDomain}</strong> → klik <strong>Add</strong>.</li>
                    <li>Kembali ke halaman ini lalu klik <strong>Hubungkan Cloud Google</strong> kembali.</li>
                  </ol>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    Alternatif instan: Anda juga dapat menghubungkan &amp; mengelola data melalui{' '}
                    <a
                      href={AISTUDIO_SHARED_APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-700 underline"
                    >
                      Portal Resmi AI Studio
                    </a>{' '}
                    — perubahan otomatis tampil di domain Vercel ini secara <em>real-time</em>.
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Layanan Aktif</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {Math.max(
                      dashboardStats?.stats?.totalActiveServices || 0,
                      links.filter((l) => l.isActive).length
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ikon siap diakses</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Prestasi Santri</span>
                  <p className="text-2xl font-extrabold text-amber-600 mt-1">
                    {achievements.length}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {achievements.filter((a) => a.status === 'pending').length} Menunggu Verifikasi
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Kontak Panitia</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {committeeContacts.length}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Narahubung aktif</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Total Klik Layanan</span>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                    {Math.max(
                      dashboardStats?.stats?.totalClicks || 0,
                      links.reduce((sum, l) => sum + (l.clicksCount || 0), 0)
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Aktivitas klik riil</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Kunjungan Portal</span>
                  <p className="text-2xl font-extrabold text-blue-600 mt-1">
                    {dashboardStats?.stats?.totalVisitors || 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Pengunjung tercatat</p>
                </div>
              </div>

              {/* Quick Content Actions */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Aksi Cepat Pengelolaan Konten</h4>
                    <p className="text-xs text-slate-500">
                      Setiap perubahan yang disimpan di sini akan langsung tampil di halaman publik secara real-time.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <button
                    onClick={() => setActiveTab('links')}
                    className="p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition-colors cursor-pointer"
                  >
                    <Grid className="w-4 h-4 text-emerald-700 mb-1.5" />
                    <p className="font-bold text-slate-900">Ikon Layanan</p>
                    <p className="text-[11px] text-slate-500">{links.length} layanan</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('announcements')}
                    className="p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4 text-amber-600 mb-1.5" />
                    <p className="font-bold text-slate-900">Pengumuman</p>
                    <p className="text-[11px] text-slate-500">{announcements.length} item</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className="p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition-colors cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-amber-600 mb-1.5" />
                    <p className="font-bold text-slate-900">Prestasi Madrasah</p>
                    <p className="text-[11px] text-slate-500">{madrasahAchievements.length} galeri</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('contacts')}
                    className="p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition-colors cursor-pointer"
                  >
                    <Phone className="w-4 h-4 text-emerald-700 mb-1.5" />
                    <p className="font-bold text-slate-900">Kontak Panitia</p>
                    <p className="text-[11px] text-slate-500">{committeeContacts.length} kontak</p>
                  </button>
                </div>
              </div>

              {/* Real Visits Chart & Top 5 Services */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Visits Chart (Visual CSS Bars based on real numbers) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-900 mb-1">
                    Kunjungan Harian (7 Hari Terakhir)
                  </h4>
                  <p className="text-xs text-slate-500 mb-6">
                    Grafik statistik kunjungan berdasarkan data riil dari tabel VISITORS.
                  </p>

                  <div className="h-44 flex items-end gap-2 pt-6">
                    {dashboardStats?.dailyVisits?.map((day: any) => {
                      const maxVal = Math.max(...(dashboardStats?.dailyVisits?.map((d: any) => d.count) || [1]), 1);
                      const heightPercent = Math.max(8, Math.round((day.count / maxVal) * 100));
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="text-[10px] font-bold text-slate-600">{day.count}</span>
                          <div
                            className="w-full rounded-t-lg bg-emerald-600 hover:bg-emerald-700 transition-all cursor-default"
                            style={{ height: `${heightPercent}%` }}
                            title={`${day.label}: ${day.count} kunjungan`}
                          ></div>
                          <span className="text-[10px] text-slate-500 truncate w-full text-center">
                            {day.label.split(',')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top 5 Services */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-900 mb-1">
                    5 Layanan Paling Banyak Dikunjungi
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Peringkat layanan terpopuler berdasarkan klik pengunjung.
                  </p>

                  {dashboardStats?.topServices?.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Belum ada klik layanan yang tercatat.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dashboardStats?.topServices?.map((srv: any, idx: number) => (
                        <div
                          key={srv.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-bold text-xs text-slate-900">{srv.name}</p>
                              <p className="text-[10px] text-slate-500">{srv.categoryName}</p>
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {srv.clicksCount} Klik
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity Logs */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-sm text-slate-900 mb-1">Aktivitas Sistem Terbaru</h4>
                <p className="text-xs text-slate-500 mb-4">Audit log real-time dari tindakan pengguna dan sistem.</p>
                <div className="divide-y divide-slate-100">
                  {dashboardStats?.recentActivities?.map((act: any) => (
                    <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-slate-800 font-semibold">{act.action}</strong>
                        <p className="text-slate-500 text-[11px]">{act.details}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-4">
                        {new Date(act.timestamp).toLocaleTimeString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PORTAL IDENTITY */}
          {activeTab === 'identity' && siteSettings && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs max-w-3xl">
              <h3 className="text-base font-bold text-slate-900 mb-1">Identitas Lembaga & Portal</h3>
              <p className="text-xs text-slate-500 mb-6">
                Informasi ini ditampilkan di header, hero banner, QR poster, dan footer publik.
              </p>

              <form onSubmit={handleSaveSiteSettings} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lembaga</label>
                    <input
                      type="text"
                      value={siteSettings.institutionName}
                      onChange={(e) => setSiteSettings({ ...siteSettings, institutionName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Portal</label>
                    <input
                      type="text"
                      value={siteSettings.portalName}
                      onChange={(e) => setSiteSettings({ ...siteSettings, portalName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tagline Slogan</label>
                  <input
                    type="text"
                    value={siteSettings.tagline}
                    onChange={(e) => setSiteSettings({ ...siteSettings, tagline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deskripsi Singkat</label>
                  <textarea
                    rows={3}
                    value={siteSettings.description}
                    onChange={(e) => setSiteSettings({ ...siteSettings, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white text-xs leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Warna Utama (Brand Primary)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={siteSettings.primaryColor}
                        onChange={(e) => setSiteSettings({ ...siteSettings, primaryColor: e.target.value })}
                        className="w-10 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={siteSettings.primaryColor}
                        onChange={(e) => setSiteSettings({ ...siteSettings, primaryColor: e.target.value })}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Warna Aksen (Brand Accent / Gold)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={siteSettings.accentColor}
                        onChange={(e) => setSiteSettings({ ...siteSettings, accentColor: e.target.value })}
                        className="w-10 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={siteSettings.accentColor}
                        onChange={(e) => setSiteSettings({ ...siteSettings, accentColor: e.target.value })}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor WhatsApp Resmi</label>
                    <input
                      type="text"
                      value={siteSettings.whatsappNumber}
                      onChange={(e) => setSiteSettings({ ...siteSettings, whatsappNumber: e.target.value })}
                      placeholder="+6281234567890"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Resmi</label>
                    <input
                      type="email"
                      value={siteSettings.email}
                      onChange={(e) => setSiteSettings({ ...siteSettings, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Lembaga</label>
                  <input
                    type="text"
                    value={siteSettings.address}
                    onChange={(e) => setSiteSettings({ ...siteSettings, address: e.target.value })}
                    placeholder="Contoh: Jl. Raya Madrasah No. ..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                {/* Branding Visual: Logo, Favicon & Hero Banner */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <h4 className="font-bold text-slate-900">Logo, Favicon &amp; Banner Hero</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <label className="block font-semibold text-slate-700">Logo Lembaga</label>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Unggah Logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const compressed = await compressImageFileToDataUrl(file, 800, 400000);
                              setSiteSettings({ ...siteSettings, logoUrl: compressed });
                            }}
                          />
                        </label>
                        {siteSettings.logoUrl && (
                          <button
                            type="button"
                            onClick={() => setSiteSettings({ ...siteSettings, logoUrl: '' })}
                            className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={siteSettings.logoUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, logoUrl: e.target.value })}
                        placeholder="URL gambar logo atau data:image/..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                      />
                      {siteSettings.logoUrl && (
                        <img src={siteSettings.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded-lg border bg-white p-1" />
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <label className="block font-semibold text-slate-700">Favicon Tab Browser</label>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Unggah Favicon</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const compressed = await compressImageFileToDataUrl(file, 256, 200000);
                              setSiteSettings({ ...siteSettings, faviconUrl: compressed });
                            }}
                          />
                        </label>
                        {siteSettings.faviconUrl && (
                          <button
                            type="button"
                            onClick={() => setSiteSettings({ ...siteSettings, faviconUrl: '' })}
                            className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={siteSettings.faviconUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, faviconUrl: e.target.value })}
                        placeholder="URL favicon atau data:image/..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                      />
                      {siteSettings.faviconUrl && (
                        <img src={siteSettings.faviconUrl} alt="Favicon" className="h-8 w-8 object-contain rounded border bg-white p-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block font-semibold text-slate-700">Gambar Latar Hero Banner (Opsional)</label>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Unggah Gambar Banner</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const compressed = await compressImageFileToDataUrl(file, 1400, 520000);
                            setSiteSettings({ ...siteSettings, bannerUrl: compressed });
                          }}
                        />
                      </label>
                      {siteSettings.bannerUrl && (
                        <button
                          type="button"
                          onClick={() => setSiteSettings({ ...siteSettings, bannerUrl: '' })}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold cursor-pointer"
                        >
                          Hapus Banner
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={siteSettings.bannerUrl || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, bannerUrl: e.target.value })}
                      placeholder="https://... atau data:image/..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                    />
                    {siteSettings.bannerUrl && (
                      <img src={siteSettings.bannerUrl} alt="Hero Banner" className="w-full h-24 object-cover rounded-lg border" />
                    )}
                  </div>
                </div>

                {/* Official Social Media & Website Links in Footer */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <h4 className="font-bold text-slate-900">Tautan Media Sosial &amp; Website Resmi (Footer Publik)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Instagram URL</label>
                      <input
                        type="text"
                        value={siteSettings.instagramUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, instagramUrl: e.target.value })}
                        placeholder="https://instagram.com/..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Facebook URL</label>
                      <input
                        type="text"
                        value={siteSettings.facebookUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, facebookUrl: e.target.value })}
                        placeholder="https://facebook.com/..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">YouTube URL</label>
                      <input
                        type="text"
                        value={siteSettings.youtubeUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, youtubeUrl: e.target.value })}
                        placeholder="https://youtube.com/@..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">TikTok URL</label>
                      <input
                        type="text"
                        value={siteSettings.tiktokUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, tiktokUrl: e.target.value })}
                        placeholder="https://tiktok.com/@..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Website Utama Lembaga</label>
                      <input
                        type="text"
                        value={siteSettings.websiteUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, websiteUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Teks Hak Cipta (Footer Copyright)</label>
                  <input
                    type="text"
                    value={siteSettings.copyrightText || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, copyrightText: e.target.value })}
                    placeholder="© 2026 MA Plus Ma'hadul Muta'allimin."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Simpan Perubahan Identitas
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: HOME SETTINGS */}
          {activeTab === 'home_settings' && siteSettings && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs max-w-2xl">
              <h3 className="text-base font-bold text-slate-900 mb-1">Pengaturan Tampilan Halaman Utama</h3>
              <p className="text-xs text-slate-500 mb-6">
                Aktifkan atau nonaktifkan modul yang ingin ditampilkan kepada pengunjung. Perubahan langsung diterapkan ke halaman publik.
              </p>

              <div className="space-y-4">
                {[
                  { key: 'heroEnabled', label: 'Tampilkan Hero Section & Banner Utama' },
                  { key: 'searchEnabled', label: 'Tampilkan Kolom Pencarian Layanan' },
                  { key: 'categoriesEnabled', label: 'Tampilkan Tab Navigasi Kategori' },
                  { key: 'announcementsEnabled', label: 'Tampilkan Menu Pengumuman Penting' },
                  { key: 'registrationsEnabled', label: 'Tampilkan Pendaftaran / PPDB' },
                  { key: 'documentsEnabled', label: 'Tampilkan Dokumen Unduhan' },
                ].map((item) => {
                  const val = (siteSettings as any)[item.key];
                  return (
                    <label
                      key={item.key}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(val)}
                        onChange={async (e) => {
                          const updated = { ...siteSettings, [item.key]: e.target.checked };
                          setSiteSettings(updated);
                          try {
                            const res = await fetch('/api/admin/settings', {
                              method: 'PUT',
                              headers: authHeaders,
                              body: JSON.stringify(updated),
                            });
                            const cloudReady = isCloudAdminReady();
                            if (cloudReady) {
                              await saveSiteSettingsToFirestore(updated);
                            }
                            if (res.ok || cloudReady) {
                              showNotification('success', `"${item.label}" diperbarui dan langsung disinkronkan.`);
                              await syncAfterChange();
                            } else {
                              showNotification('error', 'Gagal menyimpan perubahan pengaturan.');
                            }
                          } catch (err: any) {
                            showNotification('error', err.message || 'Kesalahan jaringan.');
                          }
                        }}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SERVICE LINKS CRUD */}
          {activeTab === 'links' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Koleksi Ikon Layanan Digital</h3>
                  <p className="text-xs text-slate-500">
                    Setiap ikon terhubung ke URL tujuan dan dapat diurutkan serta dikelompokkan.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setEditingLink({
                        name: '',
                        categoryId: categories[0]?.id || '',
                        description: '',
                        iconType: 'lucide',
                        icon: 'Globe',
                        targetUrl: 'https://',
                        targetOpen: '_blank',
                        order: links.length + 1,
                        isActive: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Layanan</span>
                  </button>
                </div>
              </div>

              {/* Links Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {links.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    Belum ada ikon layanan. Klik tombol <strong>Tambah Layanan</strong> untuk menambahkan.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Ikon</th>
                          <th className="py-3 px-4 font-semibold">Nama Layanan</th>
                          <th className="py-3 px-4 font-semibold">Kategori</th>
                          <th className="py-3 px-4 font-semibold">URL Tujuan</th>
                          <th className="py-3 px-4 font-semibold">Klik</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {links.map((link) => {
                          const catName = categories.find((c) => c.id === link.categoryId)?.name || '-';
                          return (
                            <tr key={link.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                                  {link.iconType === 'image' || link.iconType === 'upload' ? (
                                    <img src={link.icon} alt="" className="w-5 h-5 object-contain" />
                                  ) : (
                                    <IconRenderer name={link.icon} className="w-4 h-4 text-amber-300" />
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900">{link.name}</td>
                              <td className="py-3 px-4 text-slate-500">{catName}</td>
                              <td className="py-3 px-4 font-mono text-slate-600 truncate max-w-xs">{link.targetUrl}</td>
                              <td className="py-3 px-4 font-bold text-emerald-700">{link.clicksCount || 0}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    link.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {link.isActive ? 'Aktif' : 'Nonaktif'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => handleDuplicateLink(link)}
                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                                    title="Duplikasi Layanan"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingLink(link)}
                                    className="p-1.5 hover:bg-slate-100 rounded text-emerald-700 cursor-pointer"
                                    title="Edit Layanan"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLink(link)}
                                    className="p-1.5 hover:bg-rose-50 rounded text-rose-600 cursor-pointer"
                                    title="Hapus Layanan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: CATEGORIES CRUD */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Kategori Layanan</h3>
                  <p className="text-xs text-slate-500">
                    Kategori mengelompokkan layanan agar pengunjung mudah menavigasi portal.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingCategory({
                      name: '',
                      description: '',
                      icon: 'Folder',
                      order: categories.length + 1,
                      isActive: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kategori</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.length === 0 ? (
                  <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Belum ada kategori yang dibuat.
                  </div>
                ) : (
                  categories.map((cat) => {
                    const linksCount = links.filter((l) => l.categoryId === cat.id).length;
                    return (
                      <div
                        key={cat.id}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-emerald-800">
                              <IconRenderer name={cat.icon} className="w-5 h-5 text-emerald-700" />
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {cat.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 mb-1">{cat.name}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                            {cat.description || 'Tidak ada deskripsi'}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">{linksCount} Layanan Terhubung</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingCategory(cat)}
                              className="p-1 text-slate-600 hover:text-emerald-700 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1 text-slate-600 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 6: PRESTASI MADRASAH & STUDENT ACHIEVEMENTS MANAGEMENT */}
          {activeTab === 'achievements' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Prestasi Madrasah & Verifikasi Prestasi Santri (MA PLUS MM)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kelola galeri foto & deskripsi singkat Prestasi Madrasah (tampil di samping Pengumuman Penting) serta verifikasi pengajuan prestasi santri.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setEditingMadrasahAchievement({
                        title: '',
                        category: 'Tahfidz & Sains',
                        level: 'Tingkat Nasional',
                        recipient: 'Santri MA PLUS MM',
                        year: String(new Date().getFullYear()),
                        photoUrl: '',
                        shortDescription: '',
                        order: madrasahAchievements.length + 1,
                        isActive: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Prestasi Madrasah</span>
                  </button>
                </div>
              </div>

              {/* Sub-tab switcher */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  onClick={() => setAchievementSubTab('madrasah')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    achievementSubTab === 'madrasah'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>Galeri Prestasi Madrasah ({madrasahAchievements.length})</span>
                </button>
                <button
                  onClick={() => setAchievementSubTab('student')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    achievementSubTab === 'student'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Verifikasi Pengajuan Santri ({achievements.length})</span>
                  {achievements.filter((a) => a.status === 'pending').length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                      {achievements.filter((a) => a.status === 'pending').length} Baru
                    </span>
                  )}
                </button>
              </div>

              {/* SUB-TAB 1: GALERI PRESTASI MADRASAH */}
              {achievementSubTab === 'madrasah' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {madrasahAchievements.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
                      Belum ada data foto prestasi madrasah. Klik &quot;Tambah Prestasi Madrasah&quot; untuk menambahkan.
                    </div>
                  ) : (
                    madrasahAchievements.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
                      >
                        <div className="relative h-40 bg-slate-100 border-b border-slate-100">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-emerald-950 flex flex-col items-center justify-center text-white">
                              <Trophy className="w-8 h-8 text-amber-300 mb-1" />
                              <span className="text-[10px] font-bold text-amber-200">Tanpa Foto</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold shadow-xs">
                              {item.category}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.isActive ? 'bg-emerald-700 text-white' : 'bg-slate-600 text-white'
                              }`}
                            >
                              {item.isActive ? 'Aktif' : 'Disembunyikan'}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between text-xs">
                          <div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                              <span className="font-semibold text-emerald-700">{item.level}</span>
                              <span>Tahun {item.year}</span>
                            </div>
                            <h4 className="font-bold text-slate-900 line-clamp-2 mb-1">{item.title}</h4>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{item.shortDescription}</p>
                            <p className="text-[11px] text-slate-600">
                              Peraih: <strong className="text-slate-900">{item.recipient}</strong>
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Urutan #{item.order}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setEditingMadrasahAchievement(item)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 cursor-pointer"
                                title="Edit Prestasi Madrasah"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMadrasahAchievement(item.id)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 cursor-pointer"
                                title="Hapus Prestasi Madrasah"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SUB-TAB 2: VERIFIKASI PRESTASI SANTRI */}
              {achievementSubTab === 'student' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {achievements.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    Belum ada pengajuan prestasi santri yang masuk ke sistem.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Nama Santri & NISN</th>
                          <th className="py-3 px-4 font-semibold">Prestasi & Kejuaraan</th>
                          <th className="py-3 px-4 font-semibold">Tingkat & Peringkat</th>
                          <th className="py-3 px-4 font-semibold">Penyelenggara & Tahun</th>
                          <th className="py-3 px-4 font-semibold">Dokumen Sertifikat</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Aksi Verifikasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {achievements.map((ach) => (
                          <tr key={ach.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900">{ach.studentName}</p>
                              <p className="font-mono text-[11px] text-slate-500">NISN: {ach.registrationNumberOrNisn}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{ach.achievementTitle}</p>
                              <span className="capitalize text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {ach.field}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-800">{ach.level}</p>
                              <p className="text-emerald-700 font-bold text-[11px]">{ach.rank}</p>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              <p className="truncate max-w-[140px]">{ach.organizer || '-'}</p>
                              <p className="text-[11px] text-slate-400">Tahun {ach.year}</p>
                            </td>
                            <td className="py-3 px-4">
                              {ach.certificateUrl ? (
                                <button
                                  onClick={() => setSelectedAchievementCert(ach)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-200 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Lihat Piagam</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Tanpa berkas</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  ach.status === 'verified'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : ach.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {ach.status === 'verified'
                                  ? 'Terverifikasi'
                                  : ach.status === 'rejected'
                                  ? 'Ditolak'
                                  : 'Menunggu'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {ach.status !== 'verified' && (
                                  <button
                                    onClick={() => handleVerifyAchievement(ach.id, 'verified')}
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                                    title="Sahkan & Verifikasi Prestasi"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                {ach.status !== 'rejected' && (
                                  <button
                                    onClick={() => handleVerifyAchievement(ach.id, 'rejected')}
                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer"
                                    title="Tolak Pengajuan"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteAchievement(ach.id)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                                  title="Hapus Data Prestasi"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* TAB 7: COMMITTEE CONTACTS MANAGEMENT */}
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Saluran WhatsApp Resmi & Kontak Panitia MA PLUS MM
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daftar narahubung panitia yang muncul saat pengunjung mengklik tombol &quot;Hubungi MA PLUS MM&quot; atau &quot;Saluran WhatsApp Resmi&quot;.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingContact({
                      role: '',
                      name: '',
                      whatsappNumber: '+628',
                      notes: '08:00 - 15:00 WIB',
                      isAvailable: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kontak Panitia</span>
                </button>
              </div>

              {/* Committee Contacts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {committeeContacts.length === 0 ? (
                  <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Belum ada narahubung panitia yang dikonfigurasi.
                  </div>
                ) : (
                  committeeContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {contact.role}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              contact.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {contact.isAvailable ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mb-1">{contact.name}</h4>
                        <p className="font-mono text-xs text-slate-600 mb-1">
                          WA: {contact.whatsappNumber}
                        </p>
                        {contact.notes && (
                          <p className="text-[11px] text-slate-500">
                            Layanan: {contact.notes}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                        <a
                          href={`https://wa.me/${contact.whatsappNumber.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Uji Chat WhatsApp</span>
                        </a>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingContact(contact)}
                            className="p-1 text-slate-600 hover:text-emerald-700 cursor-pointer"
                            title="Edit Narahubung"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="p-1 text-slate-600 hover:text-rose-600 cursor-pointer"
                            title="Hapus Narahubung"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 10: QR CODE GENERATOR & POSTER */}
          {activeTab === 'qrcode' && qrSettings && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    One QR Code – One Portal Generator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Satu kode QR tetap untuk seluruh layanan, meskipun layanan diperbarui atau ditambah.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintPoster}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Poster A4</span>
                  </button>
                  {adminQrDataUrl && (
                    <a
                      href={adminQrDataUrl}
                      download="QR_PORTAL_DIGITAL_RESMI.png"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh PNG</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Printable Poster Section */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto text-center poster-container">
                <div className="border-b border-slate-200 pb-4 mb-6">
                  <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-wider">
                    {siteSettings?.institutionName || 'LEMBAGA PENDIDIKAN & DAKWAH'}
                  </h2>
                  <h3 className="text-sm font-bold text-emerald-800 mt-0.5">
                    {qrSettings.posterTitle || 'PORTAL DIGITAL TERPADU'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    {qrSettings.posterSubtitle || 'Pusat Akses Seluruh Aplikasi, Dokumen, dan Layanan Resmi'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mb-4">
                  {adminQrDataUrl ? (
                    <img
                      src={adminQrDataUrl}
                      alt="QR Code Resmi"
                      className="w-64 h-64 mx-auto object-contain"
                    />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center text-xs text-slate-400">
                      Membuat QR Code...
                    </div>
                  )}
                </div>

                <p className="font-bold text-xs text-slate-800 mb-1">
                  {qrSettings.posterFooter || 'Buka kamera smartphone dan arahkan ke kode QR di atas.'}
                </p>
                <p className="text-[11px] font-mono text-emerald-700 font-semibold">
                  {qrSettings.portalUrl || window.location.origin}
                </p>
              </div>

              {/* QR Settings Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto text-xs no-print">
                <h4 className="font-bold text-slate-900 mb-4">Pengaturan Desain QR Code</h4>
                <form onSubmit={handleSaveQrSettings} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Warna Kode QR</label>
                      <input
                        type="color"
                        value={qrSettings.foregroundColor}
                        onChange={(e) => setQrSettings({ ...qrSettings, foregroundColor: e.target.value })}
                        className="w-full h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Warna Latar</label>
                      <input
                        type="color"
                        value={qrSettings.backgroundColor}
                        onChange={(e) => setQrSettings({ ...qrSettings, backgroundColor: e.target.value })}
                        className="w-full h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">URL Portal Utama (Opsional)</label>
                    <input
                      type="text"
                      value={qrSettings.portalUrl || ''}
                      onChange={(e) => setQrSettings({ ...qrSettings, portalUrl: e.target.value })}
                      placeholder={window.location.origin}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Judul Poster</label>
                    <input
                      type="text"
                      value={qrSettings.posterTitle}
                      onChange={(e) => setQrSettings({ ...qrSettings, posterTitle: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Subjudul Poster</label>
                    <input
                      type="text"
                      value={qrSettings.posterSubtitle}
                      onChange={(e) => setQrSettings({ ...qrSettings, posterSubtitle: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Catatan Kaki Poster</label>
                    <input
                      type="text"
                      value={qrSettings.posterFooter || ''}
                      onChange={(e) => setQrSettings({ ...qrSettings, posterFooter: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    Simpan &amp; Perbarui Tampilan QR
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 11: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-1">Statistik & Analitik Riil</h3>
                <p className="text-xs text-slate-500 mb-6">
                  Setiap interaksi dicatat langsung tanpa manipulasi atau angka tiruan.
                </p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Total Kunjungan</span>
                    <p className="text-xl font-bold text-slate-900">{dashboardStats?.stats?.totalVisitors || 0}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Total Klik Tautan</span>
                    <p className="text-xl font-bold text-emerald-700">
                      {Math.max(
                        dashboardStats?.stats?.totalClicks || 0,
                        links.reduce((sum, l) => sum + (l.clicksCount || 0), 0)
                      )}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Layanan Aktif</span>
                    <p className="text-xl font-bold text-slate-900">
                      {Math.max(
                        dashboardStats?.stats?.totalActiveServices || 0,
                        links.filter((l) => l.isActive).length
                      )}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Kategori Aktif</span>
                    <p className="text-xl font-bold text-slate-900">
                      {Math.max(
                        dashboardStats?.stats?.totalCategories || 0,
                        categories.filter((c) => c.isActive).length
                      )}
                    </p>
                  </div>
                </div>

                <h4 className="font-bold text-xs text-slate-800 mb-3">Distribusi Klik per Kategori</h4>
                <div className="space-y-2">
                  {dashboardStats?.categoryClicks?.map((item: any) => (
                    <div key={item.categoryName} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-slate-700">{item.categoryName}</span>
                      <span className="font-bold text-emerald-700">{item.count} Klik</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 14: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Cadangan &amp; Pemulihan Database</h3>
                    <p className="text-xs text-slate-500">
                      Amankan database DB_PORTAL_DIGITAL atau pulihkan dari file JSON cadangan.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleTriggerBackup}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Buat Backup Sekarang</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportDatabaseJson}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh File JSON</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-xs text-slate-800 mb-3">Riwayat Cadangan Tersimpan</h4>
                  <div className="divide-y divide-slate-100 text-xs">
                    {backupLogs.length === 0 ? (
                      <p className="text-slate-400 py-4 text-center">Belum ada riwayat backup.</p>
                    ) : (
                      backupLogs.map((b) => (
                        <div key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{b.fileName}</p>
                            <p className="text-[11px] text-slate-500">
                              Oleh {b.createdBy} • {(b.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold shrink-0">
                            {b.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowRestoreModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pulihkan Database dari Teks JSON Cadangan</span>
                  </button>
                  <button
                    onClick={handleResetPortalData}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Semua Konten Portal</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 15: ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Audit Log Aktivitas Sistem</h3>
                <p className="text-xs text-slate-500">Riwayat seluruh aksi autentikasi, CRUD, dan pengaturan.</p>
              </div>
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Waktu</th>
                      <th className="py-2.5 px-4 font-semibold">Pengguna</th>
                      <th className="py-2.5 px-4 font-semibold">Aksi</th>
                      <th className="py-2.5 px-4 font-semibold">Rincian</th>
                      <th className="py-2.5 px-4 font-semibold">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{log.username}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">{log.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 16: GOOGLE APPS SCRIPT EXPORT */}
          {activeTab === 'gas_export' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Koleksi Source Code Lengkap Google Apps Script (DB_PORTAL_DIGITAL)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Seluruh 16 file .gs dan 7 file .html siap disalin atau diintegrasikan ke proyek Google Apps Script Anda.
                    </p>
                  </div>
                  {selectedGasFile && (
                    <button
                      onClick={() => handleCopyCode(selectedGasFile.code)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer shrink-0"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-amber-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode ? 'Kode Tersalin!' : `Salin ${selectedGasFile.name}`}</span>
                    </button>
                  )}
                </div>

                {/* File Switcher Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 mb-4 scrollbar-thin">
                  {gasFiles.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => setSelectedGasFile(file)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors cursor-pointer ${
                        selectedGasFile?.name === file.name
                          ? 'bg-emerald-700 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {file.name}
                    </button>
                  ))}
                </div>

                {/* Code Preview Box */}
                {selectedGasFile && (
                  <div>
                    <div className="flex items-center justify-between bg-slate-900 text-slate-400 px-4 py-2 rounded-t-xl text-xs font-mono">
                      <span>{selectedGasFile.name} — {selectedGasFile.description}</span>
                    </div>
                    <pre className="bg-slate-950 text-slate-100 p-4 rounded-b-xl overflow-x-auto text-xs font-mono max-h-[60vh] leading-relaxed">
                      <code>{selectedGasFile.code}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Pengumuman</h3>
                  <p className="text-xs text-slate-500">
                    Pengumuman resmi yang tampil di Menu Pengumuman Penting saat status Dipublikasikan.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingAnnouncement({
                      title: '',
                      content: '',
                      imageUrl: '',
                      publishDate: new Date().toISOString().split('T')[0],
                      status: 'published',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pengumuman</span>
                </button>
              </div>

              <div className="space-y-3">
                {announcements.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Belum ada pengumuman yang diterbitkan.
                  </div>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {ann.imageUrl && (
                          <img
                            src={ann.imageUrl}
                            alt={ann.title}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                ann.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {ann.status === 'published' ? 'Dipublikasikan' : 'Draft'}
                            </span>
                            <span className="text-[11px] text-slate-400">{ann.publishDate}</span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 mb-1">{ann.title}</h4>
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{ann.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                        <button
                          onClick={() => setEditingAnnouncement(ann)}
                          className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                          title="Edit Pengumuman"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Hapus pengumuman ini?')) {
                              const res = await fetch(`/api/admin/announcements/${ann.id}`, {
                                method: 'DELETE',
                                headers: authHeaders,
                              });
                              const cloudReady = isCloudAdminReady();
                              if (cloudReady) {
                                await deleteAnnouncementFromFirestore(ann.id);
                              }
                              if (res.ok || cloudReady) {
                                showNotification('success', 'Pengumuman berhasil dihapus.');
                                await syncAfterChange();
                              }
                            }
                          }}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus Pengumuman"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: REGISTRATIONS */}
          {activeTab === 'registrations' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Pendaftaran &amp; PPDB</h3>
                  <p className="text-xs text-slate-500">
                    Hubungkan ke formulir pendaftaran (seperti Google Forms atau sistem internal).
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingRegistration({
                      title: '',
                      description: '',
                      formUrl: 'https://',
                      bannerUrl: '',
                      status: 'open',
                      startDate: '',
                      endDate: '',
                      isActive: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pendaftaran</span>
                </button>
              </div>

              <div className="space-y-3">
                {registrations.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Belum ada program pendaftaran yang dibuka.
                  </div>
                ) : (
                  registrations.map((reg) => (
                    <div key={reg.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${reg.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                            {reg.status === 'open' ? 'Buka' : 'Tutup'}
                          </span>
                          {!reg.isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Disembunyikan
                            </span>
                          )}
                          {reg.startDate && (
                            <span className="text-[11px] text-slate-400">
                              {reg.startDate} s/d {reg.endDate || 'Selesai'}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">{reg.title}</h4>
                        <p className="text-xs text-slate-500 truncate">{reg.formUrl}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setEditingRegistration(reg)}
                          className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                          title="Edit Pendaftaran"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Hapus pendaftaran ini?')) {
                              const res = await fetch(`/api/admin/registrations/${reg.id}`, {
                                method: 'DELETE',
                                headers: authHeaders,
                              });
                              const cloudReady = isCloudAdminReady();
                              if (cloudReady) {
                                await deleteRegistrationFromFirestore(reg.id);
                              }
                              if (res.ok || cloudReady) {
                                showNotification('success', 'Program pendaftaran berhasil dihapus.');
                                await syncAfterChange();
                              }
                            }
                          }}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus Pendaftaran"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 9: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Dokumen Unduhan</h3>
                  <p className="text-xs text-slate-500">Berkas panduan, formulir offline, dan brosur resmi.</p>
                </div>
                <button
                  onClick={() =>
                    setEditingDocument({
                      title: '',
                      description: '',
                      category: 'Umum',
                      fileUrl: 'https://',
                      fileType: 'PDF',
                      fileSize: '1.2 MB',
                      isActive: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Dokumen</span>
                </button>
              </div>

              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Belum ada dokumen yang diunggah.
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{doc.fileType}</span>
                          {!doc.isActive && (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Nonaktif</span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 mt-1 truncate">{doc.title}</h4>
                        <p className="text-[11px] text-slate-500">{doc.downloadCount || 0} Kali Diunduh</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingDocument(doc)}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                          title="Edit Dokumen"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Hapus dokumen ini?')) {
                              const res = await fetch(`/api/admin/documents/${doc.id}`, {
                                method: 'DELETE',
                                headers: authHeaders,
                              });
                              const cloudReady = isCloudAdminReady();
                              if (cloudReady) {
                                await deleteDocumentFromFirestore(doc.id);
                              }
                              if (res.ok || cloudReady) {
                                showNotification('success', 'Dokumen berhasil dihapus.');
                                await syncAfterChange();
                              }
                            }
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 12: USERS */}
          {activeTab === 'users' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Pengguna &amp; Operator</h3>
                  <p className="text-xs text-slate-500">Daftar akun pengelola portal terdaftar.</p>
                </div>
                <button
                  onClick={() => setShowNewUserModal(true)}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Tambah Pengguna
                </button>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {usersList.map((u) => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{u.fullName} <span className="font-normal text-slate-400">(@{u.username})</span></p>
                      <p className="text-[11px] text-slate-500">Role: {u.role} • Status: {u.isActive ? 'Aktif' : 'Nonaktif'}</p>
                    </div>
                    {u.id !== session.user.id && (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/admin/users/${u.id}/toggle-status`, {
                            method: 'PUT',
                            headers: authHeaders,
                          });
                          if (res.ok) {
                            showNotification('success', `Status pengguna @${u.username} diperbarui.`);
                            await loadAllData();
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold border rounded-lg cursor-pointer shrink-0"
                      >
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 13: SYSTEM CONFIG */}
          {activeTab === 'system' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-xl text-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Konfigurasi Sistem & Keamanan</h3>
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 rounded-xl flex justify-between">
                  <span className="text-slate-600">Nama Database</span>
                  <span className="font-mono font-bold text-slate-900">DB_PORTAL_DIGITAL</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl flex justify-between">
                  <span className="text-slate-600">Algoritma Enkripsi</span>
                  <span className="font-mono font-bold text-slate-900">PBKDF2-HMAC-SHA-256 (100.000 iterasi)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl flex justify-between">
                  <span className="text-slate-600">Maksimal Percobaan Login</span>
                  <span className="font-mono font-bold text-slate-900">5 Percobaan (Lockout 15 Menit)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl flex justify-between">
                  <span className="text-slate-600">Durasi Masa Berlaku Sesi</span>
                  <span className="font-mono font-bold text-slate-900">8 Jam</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ----------------- MODAL: EDIT SERVICE LINK ----------------- */}
      {editingLink && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-lg w-full shadow-2xl relative text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingLink.id ? 'Edit Layanan Digital' : 'Tambah Layanan Digital Baru'}
            </h3>
            <p className="text-slate-500 mb-4">Lengkapi informasi ikon dan URL tujuan.</p>

            <form onSubmit={handleSaveLink} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Layanan</label>
                <input
                  type="text"
                  required
                  value={editingLink.name || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, name: e.target.value })}
                  placeholder="Contoh: Instagram Resmi / PPDB Online"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                <select
                  value={editingLink.categoryId || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL Tujuan</label>
                <input
                  type="text"
                  required
                  value={editingLink.targetUrl || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, targetUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              {/* Icon Selection Options */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">
                  Pilih Format Ikon / Logo Layanan
                </label>

                {/* Option 1: Official High-Res Brand Badges */}
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <span className="font-bold text-[11px] text-emerald-900 block mb-1.5">
                    Logo Otentik Layanan Resmi (Rekomendasi MA PLUS MM):
                  </span>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {Object.values(OFFICIAL_BRAND_ASSETS).map((asset) => {
                      const dataUrl = getSvgDataUrl(asset.svgBadge);
                      const isSelected = editingLink.icon === dataUrl;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            setEditingLink({
                              ...editingLink,
                              iconType: 'image',
                              icon: dataUrl,
                              name: editingLink.name || asset.name,
                              description: editingLink.description || asset.description,
                              targetUrl: editingLink.targetUrl === 'https://' ? asset.defaultUrl : editingLink.targetUrl,
                            });
                          }}
                          className={`p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-white ring-2 ring-emerald-600 shadow-md border-emerald-600'
                              : 'bg-white/80 hover:bg-white border-slate-200 hover:border-emerald-300'
                          }`}
                          title={asset.name}
                        >
                          <img src={dataUrl} alt={asset.name} className="w-7 h-7 object-contain" />
                          <span className="text-[9px] text-slate-600 truncate w-full text-center mt-1">
                            {asset.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Option 2: Upload Custom Logo Image */}
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah Gambar / Logo Sendiri</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const compressed = await compressImageFileToDataUrl(file, 512, 350000);
                          setEditingLink({
                            ...editingLink,
                            iconType: 'upload',
                            icon: compressed,
                          });
                        }
                      }}
                    />
                  </label>
                  {editingLink.iconType === 'upload' && editingLink.icon && (
                    <div className="flex items-center gap-2 ml-auto">
                      <img src={editingLink.icon} alt="Preview" className="w-7 h-7 object-contain rounded border" />
                      <span className="text-[10px] text-emerald-700 font-semibold">Tersimpan</span>
                    </div>
                  )}
                </div>

                {/* Option 3: Lucide Icon Selector */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Atau gunakan Ikon Grafis Vektor (Lucide):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {AVAILABLE_LUCIDE_ICONS.slice(0, 36).map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setEditingLink({ ...editingLink, icon: iconName, iconType: 'lucide' })}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          editingLink.icon === iconName && editingLink.iconType === 'lucide'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={iconName}
                      >
                        <IconRenderer name={iconName} className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Singkat</label>
                <input
                  type="text"
                  value={editingLink.description || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, description: e.target.value })}
                  placeholder="Keterangan singkat"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cara Buka Tautan</label>
                  <select
                    value={editingLink.targetOpen || '_blank'}
                    onChange={(e) => setEditingLink({ ...editingLink, targetOpen: e.target.value as '_blank' | '_self' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="_blank">Tab Baru (_blank)</option>
                    <option value="_self">Halaman Sama (_self)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    value={editingLink.order ?? 1}
                    onChange={(e) => setEditingLink({ ...editingLink, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <span className="font-semibold text-slate-700">Tampilkan di Halaman Publik (Aktif)</span>
                <input
                  type="checkbox"
                  checked={editingLink.isActive ?? true}
                  onChange={(e) => setEditingLink({ ...editingLink, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  Simpan Layanan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT CATEGORY ----------------- */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-xs">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingCategory.id ? 'Edit Kategori' : 'Tambah Kategori Baru'}
            </h3>
            <p className="text-slate-500 mb-4">Atur nama dan ikon kategori.</p>

            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kategori</label>
                <input
                  type="text"
                  required
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Contoh: Media Sosial, Akademik, Layanan Santri"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi</label>
                <input
                  type="text"
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ikon Kategori</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {AVAILABLE_LUCIDE_ICONS.slice(0, 20).map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setEditingCategory({ ...editingCategory, icon: iconName })}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        editingCategory.icon === iconName
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <IconRenderer name={iconName} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    value={editingCategory.order ?? 1}
                    onChange={(e) => setEditingCategory({ ...editingCategory, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <label className="flex items-center justify-between p-2.5 mt-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <span className="font-semibold text-slate-700">Aktif</span>
                  <input
                    type="checkbox"
                    checked={editingCategory.isActive ?? true}
                    onChange={(e) => setEditingCategory({ ...editingCategory, isActive: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT ANNOUNCEMENT (WITH IMAGE UPLOAD) ----------------- */}
      {editingAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingAnnouncement.id ? 'Edit Pengumuman' : 'Pengumuman Baru'}
            </h3>
            <p className="text-slate-500 mb-4">
              Pengumuman dengan gambar akan ditampilkan dalam kartu banner visual di halaman publik.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const isEdit = Boolean(editingAnnouncement.id);
                const url = isEdit
                  ? `/api/admin/announcements/${editingAnnouncement.id}`
                  : '/api/admin/announcements';
                const res = await fetch(url, {
                  method: isEdit ? 'PUT' : 'POST',
                  headers: authHeaders,
                  body: JSON.stringify(editingAnnouncement),
                });
                const data = await res.json().catch(() => ({}));
                const cloudReady = isCloudAdminReady();
                if (!res.ok && !cloudReady) {
                  showNotification('error', data.error || 'Gagal menyimpan pengumuman.');
                  return;
                }
                const savedAnn: Announcement = data.announcement || {
                  id: editingAnnouncement.id || crypto.randomUUID(),
                  title: (editingAnnouncement.title || '').trim(),
                  content: (editingAnnouncement.content || '').trim(),
                  imageUrl: editingAnnouncement.imageUrl || '',
                  publishDate: editingAnnouncement.publishDate || new Date().toISOString().split('T')[0],
                  expiryDate: editingAnnouncement.expiryDate || '',
                  status: editingAnnouncement.status === 'draft' ? 'draft' : 'published',
                  createdAt: editingAnnouncement.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                if (cloudReady) {
                  await saveAnnouncementToFirestore(savedAnn);
                }
                showNotification(
                  'success',
                  `Pengumuman berhasil ${isEdit ? 'diperbarui' : 'diterbitkan'}.`
                );
                setEditingAnnouncement(null);
                await syncAfterChange();
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  value={editingAnnouncement.title || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                  placeholder="Contoh: Pembukaan PPDB Santri Baru 2026/2027"
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>

              {/* Upload Image for Announcement */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="block font-semibold text-slate-800">
                  Gambar / Spanduk Pengumuman
                </label>
                <p className="text-[11px] text-slate-500">
                  Admin dapat mengunggah file gambar langsung untuk ditampilkan sebagai kartu visual.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih Berkas Gambar</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const compressed = await compressImageFileToDataUrl(file, 1280, 520000);
                          setEditingAnnouncement({
                            ...editingAnnouncement,
                            imageUrl: compressed,
                          });
                        }
                      }}
                    />
                  </label>
                  <span className="text-slate-400 text-[11px]">atau masukkan URL:</span>
                </div>

                <input
                  type="text"
                  placeholder="https://... atau data:image/..."
                  value={editingAnnouncement.imageUrl || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, imageUrl: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-[11px]"
                />

                {/* Live Image Preview */}
                {editingAnnouncement.imageUrl && (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group">
                    <img
                      src={editingAnnouncement.imageUrl}
                      alt="Pratinjau Pengumuman"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingAnnouncement({ ...editingAnnouncement, imageUrl: '' })}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg cursor-pointer"
                      title="Hapus Gambar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                      Pratinjau Tampilan Publik
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Tanggal Publikasi</label>
                  <input
                    type="date"
                    value={editingAnnouncement.publishDate || ''}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, publishDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Status</label>
                  <select
                    value={editingAnnouncement.status || 'published'}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        status: e.target.value as 'published' | 'draft',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  >
                    <option value="published">Dipublikasikan (Tampil)</option>
                    <option value="draft">Draft (Sembunyikan)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Isi Informasi</label>
                <textarea
                  rows={4}
                  required
                  value={editingAnnouncement.content || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, content: e.target.value })}
                  placeholder="Rincian lengkap pengumuman resmi..."
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAnnouncement(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                >
                  {editingAnnouncement.id ? 'Simpan Perubahan' : 'Terbitkan Pengumuman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT REGISTRATION ----------------- */}
      {editingRegistration && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-lg w-full shadow-2xl relative text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingRegistration.id ? 'Edit Program Pendaftaran / PPDB' : 'Pendaftaran Baru / PPDB'}
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const isEdit = Boolean(editingRegistration.id);
                const url = isEdit
                  ? `/api/admin/registrations/${editingRegistration.id}`
                  : '/api/admin/registrations';
                const res = await fetch(url, {
                  method: isEdit ? 'PUT' : 'POST',
                  headers: authHeaders,
                  body: JSON.stringify(editingRegistration),
                });
                const data = await res.json().catch(() => ({}));
                const cloudReady = isCloudAdminReady();
                if (!res.ok && !cloudReady) {
                  showNotification('error', data.error || 'Gagal menyimpan program pendaftaran.');
                  return;
                }
                const savedReg: Registration = data.registration || {
                  id: editingRegistration.id || crypto.randomUUID(),
                  title: (editingRegistration.title || '').trim(),
                  description: (editingRegistration.description || '').trim(),
                  bannerUrl: editingRegistration.bannerUrl || '',
                  formUrl: (editingRegistration.formUrl || '').trim(),
                  startDate: editingRegistration.startDate || '',
                  endDate: editingRegistration.endDate || '',
                  status: editingRegistration.status === 'closed' ? 'closed' : 'open',
                  order: Number(editingRegistration.order ?? registrations.length + 1),
                  isActive: editingRegistration.isActive ?? true,
                  createdAt: editingRegistration.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                if (cloudReady) {
                  await saveRegistrationToFirestore(savedReg);
                }
                showNotification(
                  'success',
                  `Program pendaftaran berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`
                );
                setEditingRegistration(null);
                await syncAfterChange();
              }}
              className="space-y-3 mt-4"
            >
              <div>
                <label className="block font-semibold mb-1">Nama Program Pendaftaran</label>
                <input
                  type="text"
                  required
                  value={editingRegistration.title || ''}
                  onChange={(e) => setEditingRegistration({ ...editingRegistration, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">URL Formulir (Google Forms / Website)</label>
                <input
                  type="text"
                  required
                  value={editingRegistration.formUrl || ''}
                  onChange={(e) => setEditingRegistration({ ...editingRegistration, formUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={editingRegistration.description || ''}
                  onChange={(e) => setEditingRegistration({ ...editingRegistration, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={editingRegistration.startDate || ''}
                    onChange={(e) => setEditingRegistration({ ...editingRegistration, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tanggal Berakhir</label>
                  <input
                    type="date"
                    value={editingRegistration.endDate || ''}
                    onChange={(e) => setEditingRegistration({ ...editingRegistration, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-semibold mb-1">Status Pendaftaran</label>
                  <select
                    value={editingRegistration.status || 'open'}
                    onChange={(e) =>
                      setEditingRegistration({
                        ...editingRegistration,
                        status: e.target.value as 'open' | 'closed',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  >
                    <option value="open">Sedang Dibuka</option>
                    <option value="closed">Telah Ditutup</option>
                  </select>
                </div>
                <label className="flex items-center justify-between p-2.5 mt-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <span className="font-semibold text-slate-700">Tampilkan di Publik</span>
                  <input
                    type="checkbox"
                    checked={editingRegistration.isActive ?? true}
                    onChange={(e) => setEditingRegistration({ ...editingRegistration, isActive: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRegistration(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl cursor-pointer font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Simpan Pendaftaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT DOCUMENT ----------------- */}
      {editingDocument && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl relative text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingDocument.id ? 'Edit Dokumen Unduhan' : 'Tambah Dokumen Unduhan'}
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const isEdit = Boolean(editingDocument.id);
                const url = isEdit ? `/api/admin/documents/${editingDocument.id}` : '/api/admin/documents';
                const res = await fetch(url, {
                  method: isEdit ? 'PUT' : 'POST',
                  headers: authHeaders,
                  body: JSON.stringify(editingDocument),
                });
                const data = await res.json().catch(() => ({}));
                const cloudReady = isCloudAdminReady();
                if (!res.ok && !cloudReady) {
                  showNotification('error', data.error || 'Gagal menyimpan dokumen.');
                  return;
                }
                const savedDoc: DocumentItem = data.document || {
                  id: editingDocument.id || crypto.randomUUID(),
                  title: (editingDocument.title || '').trim(),
                  description: (editingDocument.description || '').trim(),
                  category: (editingDocument.category || 'Umum').trim(),
                  fileUrl: (editingDocument.fileUrl || '').trim(),
                  fileType: (editingDocument.fileType || 'PDF').toUpperCase(),
                  fileSize: editingDocument.fileSize || '0 KB',
                  downloadCount: Number(editingDocument.downloadCount || 0),
                  isActive: editingDocument.isActive ?? true,
                  createdAt: editingDocument.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                if (cloudReady) {
                  await saveDocumentToFirestore(savedDoc);
                }
                showNotification('success', `Dokumen berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
                setEditingDocument(null);
                await syncAfterChange();
              }}
              className="space-y-3 mt-4"
            >
              <div>
                <label className="block font-semibold mb-1">Judul Dokumen</label>
                <input
                  type="text"
                  required
                  value={editingDocument.title || ''}
                  onChange={(e) => setEditingDocument({ ...editingDocument, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Deskripsi Singkat</label>
                <input
                  type="text"
                  value={editingDocument.description || ''}
                  onChange={(e) => setEditingDocument({ ...editingDocument, description: e.target.value })}
                  placeholder="Contoh: Brosur resmi atau panduan pendaftaran"
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">URL File / Download Link</label>
                <input
                  type="text"
                  required
                  value={editingDocument.fileUrl || ''}
                  onChange={(e) => setEditingDocument({ ...editingDocument, fileUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Kategori</label>
                  <input
                    type="text"
                    value={editingDocument.category || 'Umum'}
                    onChange={(e) => setEditingDocument({ ...editingDocument, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tipe File</label>
                  <input
                    type="text"
                    value={editingDocument.fileType || 'PDF'}
                    onChange={(e) => setEditingDocument({ ...editingDocument, fileType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Ukuran File</label>
                  <input
                    type="text"
                    value={editingDocument.fileSize || '1.0 MB'}
                    onChange={(e) => setEditingDocument({ ...editingDocument, fileSize: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <span className="font-semibold text-slate-700">Tampilkan di Halaman Publik</span>
                <input
                  type="checkbox"
                  checked={editingDocument.isActive ?? true}
                  onChange={(e) => setEditingDocument({ ...editingDocument, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDocument(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl cursor-pointer font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Simpan Dokumen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: NEW USER ----------------- */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-xs">
            <h3 className="font-bold text-base text-slate-900 mb-1">Tambah Pengguna Baru</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/users', {
                  method: 'POST',
                  headers: authHeaders,
                  body: JSON.stringify(newUserForm),
                });
                const data = await res.json();
                if (!res.ok) {
                  showNotification('error', data.error || 'Gagal membuat pengguna');
                  return;
                }
                showNotification('success', 'Pengguna berhasil dibuat');
                setShowNewUserModal(false);
                await loadAllData();
              }}
              className="space-y-3 mt-4"
            >
              <div>
                <label className="block font-semibold mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Password Baru</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                >
                  <option value="operator">Operator</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Buat Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: RESTORE JSON ----------------- */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative text-xs">
            <h3 className="font-bold text-base text-rose-800 mb-1">Pemulihan Cadangan Database</h3>
            <p className="text-slate-500 mb-4">
              Tempelkan konten JSON cadangan ke dalam area teks di bawah ini.
            </p>
            <form onSubmit={handleRestoreDatabase} className="space-y-3">
              <textarea
                rows={8}
                required
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                placeholder='{"USERS": [...], "LINKS": [...]}'
                className="w-full p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl border border-slate-700"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Pulihkan Database Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT COMMITTEE CONTACT ----------------- */}
      {editingContact && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-xs">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingContact.id ? 'Edit Kontak Panitia' : 'Tambah Kontak Panitia Baru'}
            </h3>
            <p className="text-slate-500 mb-4">
              Narahubung resmi yang tampil di direktori &quot;Hubungi MA PLUS MM&quot; dan &quot;Saluran WhatsApp Resmi&quot;.
            </p>

            <form onSubmit={handleSaveContact} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Nama Panitia / Unit Layanan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Panitia PPDB 2026/2027 / Panitia Prestasi"
                  value={editingContact.role || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Nama Petugas / Ustadz</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ust. M. Ridwan, S.Pd."
                  value={editingContact.name || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">
                  Nomor WhatsApp (Gunakan awalan +62)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: +6281234567890"
                  value={editingContact.whatsappNumber || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, whatsappNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Jam Layanan Konsultasi / Catatan</label>
                <input
                  type="text"
                  placeholder="Contoh: 08:00 - 15:00 WIB / Konsultasi PPDB"
                  value={editingContact.notes || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">Status Aktif di Halaman Publik</span>
                <input
                  type="checkbox"
                  checked={editingContact.isAvailable ?? true}
                  onChange={(e) => setEditingContact({ ...editingContact, isAvailable: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingContact(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                >
                  Simpan Kontak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: VIEW ACHIEVEMENT CERTIFICATE ----------------- */}
      {selectedAchievementCert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Verifikasi Berkas Piagam
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  {selectedAchievementCert.achievementTitle}
                </h3>
                <p className="text-slate-500 text-xs">
                  Oleh: <strong>{selectedAchievementCert.studentName}</strong> (NISN: {selectedAchievementCert.registrationNumberOrNisn})
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedAchievementCert.level} • {selectedAchievementCert.rank} • Tahun {selectedAchievementCert.year}
                </p>
              </div>

              <button
                onClick={() => setSelectedAchievementCert(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {/* Document Preview */}
            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 flex items-center justify-center min-h-[260px] max-h-[50vh] overflow-hidden mb-4">
              {selectedAchievementCert.certificateUrl.startsWith('data:image') || selectedAchievementCert.certificateUrl.startsWith('http') ? (
                <img
                  src={selectedAchievementCert.certificateUrl}
                  alt={selectedAchievementCert.achievementTitle}
                  className="max-h-[46vh] w-auto max-w-full object-contain rounded-xl shadow-xs"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">{selectedAchievementCert.certificateFileName}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Dokumen PDF/Berkas Lampiran</p>
                </div>
              )}
            </div>

            {selectedAchievementCert.notes && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl mb-4 text-[11px] text-amber-900">
                <strong>Catatan Pendaftar:</strong> {selectedAchievementCert.notes}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <a
                href={selectedAchievementCert.certificateUrl}
                download={selectedAchievementCert.certificateFileName}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Berkas Piagam</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleVerifyAchievement(selectedAchievementCert.id, 'rejected');
                    setSelectedAchievementCert(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 cursor-pointer"
                >
                  Tolak Berkas
                </button>
                <button
                  onClick={() => {
                    handleVerifyAchievement(selectedAchievementCert.id, 'verified');
                    setSelectedAchievementCert(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Sahkan & Verifikasi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: ADD / EDIT MADRASAH ACHIEVEMENT ----------------- */}
      {editingMadrasahAchievement && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-xs my-8">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {editingMadrasahAchievement.id ? 'Edit Prestasi Madrasah' : 'Tambah Prestasi Madrasah Baru'}
                </h3>
              </div>
              <button
                onClick={() => setEditingMadrasahAchievement(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSaveMadrasahAchievement} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Judul Prestasi / Kejuaraan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingMadrasahAchievement.title || ''}
                  onChange={(e) =>
                    setEditingMadrasahAchievement({ ...editingMadrasahAchievement, title: e.target.value })
                  }
                  placeholder="misal: Juara 1 Nasional Lomba Robotik Madrasah"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori / Bidang</label>
                  <input
                    type="text"
                    value={editingMadrasahAchievement.category || ''}
                    onChange={(e) =>
                      setEditingMadrasahAchievement({ ...editingMadrasahAchievement, category: e.target.value })
                    }
                    placeholder="Tahfidz / Sains / Bahasa"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tingkat Kejuaraan</label>
                  <input
                    type="text"
                    value={editingMadrasahAchievement.level || ''}
                    onChange={(e) =>
                      setEditingMadrasahAchievement({ ...editingMadrasahAchievement, level: e.target.value })
                    }
                    placeholder="Tingkat Nasional / Provinsi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Peraih / Tim</label>
                  <input
                    type="text"
                    value={editingMadrasahAchievement.recipient || ''}
                    onChange={(e) =>
                      setEditingMadrasahAchievement({ ...editingMadrasahAchievement, recipient: e.target.value })
                    }
                    placeholder="Santri / Kafilah MA PLUS MM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahun</label>
                  <input
                    type="text"
                    value={editingMadrasahAchievement.year || ''}
                    onChange={(e) =>
                      setEditingMadrasahAchievement({ ...editingMadrasahAchievement, year: e.target.value })
                    }
                    placeholder="2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Foto Dokumentasi Prestasi (Unggah Gambar atau URL)
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        showNotification('error', 'Ukuran foto maksimal 5 MB.');
                        return;
                      }
                      const compressed = await compressImageFileToDataUrl(file, 1280, 520000);
                      setEditingMadrasahAchievement({
                        ...editingMadrasahAchievement,
                        photoUrl: compressed,
                      });
                    }}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editingMadrasahAchievement.photoUrl || ''}
                    onChange={(e) =>
                      setEditingMadrasahAchievement({ ...editingMadrasahAchievement, photoUrl: e.target.value })
                    }
                    placeholder="Atau tempel URL foto https://..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-[11px]"
                  />
                  {editingMadrasahAchievement.photoUrl && (
                    <div className="h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img
                        src={editingMadrasahAchievement.photoUrl}
                        alt="Preview Foto Prestasi"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi Singkat Prestasi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingMadrasahAchievement.shortDescription || ''}
                  onChange={(e) =>
                    setEditingMadrasahAchievement({
                      ...editingMadrasahAchievement,
                      shortDescription: e.target.value,
                    })
                  }
                  placeholder="Jelaskan secara singkat capaian dan keunggulan prestasi ini..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingMadrasahAchievement.isActive !== false}
                    onChange={(e) =>
                      setEditingMadrasahAchievement({
                        ...editingMadrasahAchievement,
                        isActive: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-700">Tampilkan di Halaman Utama</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMadrasahAchievement(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm cursor-pointer"
                  >
                    Simpan Prestasi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
