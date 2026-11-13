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
} from 'lucide-react';
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

interface AdminDashboardProps {
  session: AuthSession;
  onLogout: () => void;
  onViewPublicPortal: () => void;
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
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Initial data loading
  const loadAllData = async () => {
    setLoading(true);
    try {
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
      ] = await Promise.all([
        fetch('/api/admin/dashboard', { headers: authHeaders }),
        fetch('/api/admin/categories', { headers: authHeaders }),
        fetch('/api/admin/links', { headers: authHeaders }),
        fetch('/api/admin/announcements', { headers: authHeaders }),
        fetch('/api/admin/registrations', { headers: authHeaders }),
        fetch('/api/admin/documents', { headers: authHeaders }),
        fetch('/api/admin/settings', { headers: authHeaders }),
        fetch('/api/admin/qr-settings', { headers: authHeaders }),
        fetch('/api/admin/activity-logs', { headers: authHeaders }),
        fetch('/api/admin/users', { headers: authHeaders }),
        fetch('/api/admin/backups', { headers: authHeaders }),
        fetch('/api/admin/achievements', { headers: authHeaders }),
        fetch('/api/admin/committee-contacts', { headers: authHeaders }),
        fetch('/api/admin/madrasah-achievements', { headers: authHeaders }),
      ]);

      if (dashRes.ok) setDashboardStats(await dashRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (linkRes.ok) setLinks(await linkRes.json());
      if (annRes.ok) setAnnouncements(await annRes.json());
      if (regRes.ok) setRegistrations(await regRes.json());
      if (docRes.ok) setDocuments(await docRes.json());
      if (settRes.ok) setSiteSettings(await settRes.json());
      if (qrRes.ok) setQrSettings(await qrRes.json());
      if (logsRes.ok) setActivityLogs(await logsRes.json());
      if (usersRes.ok) setUsersList(await usersRes.json());
      if (backupsRes.ok) setBackupLogs(await backupsRes.json());
      if (achRes.ok) setAchievements(await achRes.json());
      if (contactsRes.ok) setCommitteeContacts(await contactsRes.json());
      if (madrasahAchRes.ok) setMadrasahAchievements(await madrasahAchRes.json());
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      showNotification('error', 'Gagal memuat sebagian data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch GAS files when tab is selected
  useEffect(() => {
    if (activeTab === 'gas_export') {
      fetch('/api/admin/gas-files', { headers: authHeaders })
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
      fetch(`/api/public/qr-image?url=${encodeURIComponent(url)}&dark=${encodeURIComponent(qrSettings.foregroundColor || '#065f46')}&light=${encodeURIComponent(qrSettings.backgroundColor || '#ffffff')}&size=360`)
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
      const data = await res.json();

      if (!res.ok) {
        showNotification('error', data.error || 'Gagal menyimpan kategori.');
        return;
      }

      showNotification('success', `Kategori berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
      setEditingCategory(null);
      loadAllData();
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
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Gagal menghapus kategori.');
        return;
      }
      showNotification('success', `Kategori "${cat.name}" berhasil dihapus.`);
      loadAllData();
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
      const data = await res.json();

      if (!res.ok) {
        showNotification('error', data.error || 'Gagal menyimpan layanan.');
        return;
      }

      showNotification('success', `Layanan berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
      setEditingLink(null);
      loadAllData();
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
      if (res.ok) {
        showNotification('success', `Layanan "${link.name}" berhasil digandakan.`);
        loadAllData();
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
      if (res.ok) {
        showNotification('success', `Layanan "${link.name}" berhasil dihapus.`);
        loadAllData();
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
      if (res.ok) {
        showNotification('success', 'Pengaturan identitas dan tampilan portal berhasil disimpan.');
        loadAllData();
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
      if (res.ok) {
        showNotification('success', 'Pengaturan QR Code dan Poster berhasil diperbarui.');
        // Refresh preview
        const url = qrSettings.portalUrl || window.location.origin;
        const qrRes = await fetch(`/api/public/qr-image?url=${encodeURIComponent(url)}&dark=${encodeURIComponent(qrSettings.foregroundColor || '#065f46')}&light=${encodeURIComponent(qrSettings.backgroundColor || '#ffffff')}&size=360`);
        const qrData = await qrRes.json();
        if (qrData.dataUrl) setAdminQrDataUrl(qrData.dataUrl);
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Seed initial starter pack
  const handleSeedStarter = async () => {
    const confirmed = window.confirm(
      'Apakah Anda ingin memasukkan paket layanan contoh awal (Media Sosial, Akademik, Raport)? Perhatian: Database saat ini kosong sesuai standar keamanan.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/seed-starter', {
        method: 'POST',
        headers: authHeaders,
      });
      if (res.ok) {
        showNotification('success', 'Paket layanan awal berhasil ditambahkan ke database.');
        loadAllData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Seed Official MA PLUS MM Pack (8 Authentic Badges)
  const handleSeedMaPlusMm = async () => {
    const confirmed = window.confirm(
      'Aktifkan Paket Resmi MA PLUS MM (8 Layanan: Formulir PPDB, Instagram, YouTube, TikTok, Google Maps, Daftarkan Prestasi, Portal Web, Saluran WhatsApp) dengan logo otentik resolusi tinggi?'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/seed-ma-plus-mm', {
        method: 'POST',
        headers: authHeaders,
      });
      if (res.ok) {
        showNotification(
          'success',
          '8 Layanan Resmi MA PLUS MM dengan logo gambar otentik berhasil diaktifkan!'
        );
        loadAllData();
      } else {
        const data = await res.json();
        showNotification('error', data.error || 'Gagal mengaktifkan paket layanan MA Plus MM.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setLoading(false);
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
      if (res.ok) {
        showNotification(
          'success',
          `Status prestasi berhasil diubah menjadi: ${status === 'verified' ? 'Terverifikasi' : 'Ditolak'}`
        );
        loadAllData();
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
      if (res.ok) {
        showNotification('success', 'Data prestasi berhasil dihapus.');
        loadAllData();
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

      if (res.ok) {
        showNotification('success', `Kontak panitia berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`);
        setEditingContact(null);
        loadAllData();
      } else {
        const data = await res.json();
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
      if (res.ok) {
        showNotification('success', 'Kontak panitia berhasil dihapus.');
        loadAllData();
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
        loadAllData();
      }
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
      loadAllData();
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
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-800">
      {/* ----------------- SIDEBAR NAVIGATION ----------------- */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } shrink-0 bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 border-r border-slate-800 no-print`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-xs text-white uppercase tracking-wider truncate">
                Admin Portal
              </span>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            title="Ciutkan Sidebar"
          >
            <ChevronDown className={`w-4 h-4 transform ${isSidebarOpen ? '-rotate-90' : 'rotate-90'}`} />
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
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-slate-800 text-xs">
          {isSidebarOpen && (
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
            {isSidebarOpen && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* ----------------- MAIN CONTENT AREA ----------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize">
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
            {loading && <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onViewPublicPortal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lihat Halaman Publik</span>
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
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Layanan Aktif</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {dashboardStats?.stats?.totalActiveServices || 0}
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
                    {dashboardStats?.stats?.totalClicks || 0}
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

              {/* Special MA PLUS MM Official Services Setup Banner */}
              <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 rounded-2xl p-6 text-white border border-emerald-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[10px] uppercase tracking-wider">
                        Paket Resmi Lembaga
                      </span>
                      <h4 className="font-bold text-sm text-white">
                        Inisialisasi 8 Layanan Resmi MA PLUS MM
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-200/90 leading-relaxed mt-1">
                      Mengisi portal dengan 8 ikon berlogo gambar otentik: <strong>Formulir PPDB, Instagram, YouTube, TikTok, Google Maps, Daftarkan Prestasi, Portal Web,</strong> dan <strong>Saluran WhatsApp Resmi</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                  <button
                    onClick={handleSeedMaPlusMm}
                    className="w-full md:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Aktifkan 8 Layanan MA PLUS MM</span>
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
                Aktifkan atau nonaktifkan modul yang ingin ditampilkan kepada pengunjung.
              </p>

              <div className="space-y-4">
                {[
                  { key: 'heroEnabled', label: 'Tampilkan Hero Section & Banner Utama' },
                  { key: 'searchEnabled', label: 'Tampilkan Kolom Pencarian Layanan' },
                  { key: 'categoriesEnabled', label: 'Tampilkan Tab Navigasi Kategori' },
                  { key: 'announcementsEnabled', label: 'Tampilkan Pengumuman Berjalan' },
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
                        onChange={(e) => {
                          const updated = { ...siteSettings, [item.key]: e.target.checked };
                          setSiteSettings(updated);
                          fetch('/api/admin/settings', {
                            method: 'PUT',
                            headers: authHeaders,
                            body: JSON.stringify(updated),
                          });
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Koleksi Ikon Layanan Digital</h3>
                  <p className="text-xs text-slate-500">
                    Setiap ikon terhubung ke URL tujuan dan dapat diurutkan serta dikelompokkan.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSeedMaPlusMm}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Paket 8 Layanan MA PLUS MM</span>
                  </button>
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

          {/* TAB 6: STUDENT ACHIEVEMENTS MANAGEMENT */}
          {activeTab === 'achievements' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Akademik & Pengajuan Prestasi Santri (MA PLUS MM)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verifikasi berkas sertifikat atau piagam prestasi yang diajukan oleh santri/calon santri terdaftar.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                    {achievements.filter((a) => a.status === 'pending').length} Menunggu Verifikasi
                  </span>
                </div>
              </div>

              {/* Achievements Table */}
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

                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    Simpan & Perbarui Tampilan QR
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
                    <p className="text-xl font-bold text-emerald-700">{dashboardStats?.stats?.totalClicks || 0}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Layanan Aktif</span>
                    <p className="text-xl font-bold text-slate-900">{dashboardStats?.stats?.totalActiveServices || 0}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Kategori Aktif</span>
                    <p className="text-xl font-bold text-slate-900">{dashboardStats?.stats?.totalCategories || 0}</p>
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
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Cadangan & Pemulihan Database</h3>
                    <p className="text-xs text-slate-500">
                      Amankan database DB_PORTAL_DIGITAL atau pulihkan dari file JSON cadangan.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTriggerBackup}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Buat Backup Sekarang</span>
                    </button>
                    <a
                      href="/api/admin/export-database"
                      download
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh File JSON</span>
                    </a>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-xs text-slate-800 mb-3">Riwayat Cadangan Tersimpan</h4>
                  <div className="divide-y divide-slate-100 text-xs">
                    {backupLogs.length === 0 ? (
                      <p className="text-slate-400 py-4 text-center">Belum ada riwayat backup.</p>
                    ) : (
                      backupLogs.map((b) => (
                        <div key={b.id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{b.fileName}</p>
                            <p className="text-[11px] text-slate-500">
                              Oleh {b.createdBy} • {(b.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                            {b.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setShowRestoreModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-rose-600" />
                    <span>Pulihkan Database dari Teks JSON Cadangan</span>
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Pengumuman</h3>
                  <p className="text-xs text-slate-500">
                    Pengumuman resmi yang tampil di banner publik saat status Dipublikasikan.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingAnnouncement({
                      title: '',
                      content: '',
                      publishDate: new Date().toISOString().split('T')[0],
                      status: 'published',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
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
                    <div key={ann.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between gap-4">
                      <div>
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
                      <button
                        onClick={async () => {
                          if (window.confirm('Hapus pengumuman ini?')) {
                            await fetch(`/api/admin/announcements/${ann.id}`, { method: 'DELETE', headers: authHeaders });
                            loadAllData();
                          }
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: REGISTRATIONS */}
          {activeTab === 'registrations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Pendaftaran & PPDB</h3>
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
                      status: 'open',
                      startDate: '',
                      endDate: '',
                      isActive: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
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
                    <div key={reg.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${reg.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                          {reg.status === 'open' ? 'Buka' : 'Tutup'}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">{reg.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">{reg.formUrl}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm('Hapus pendaftaran ini?')) {
                            await fetch(`/api/admin/registrations/${reg.id}`, { method: 'DELETE', headers: authHeaders });
                            loadAllData();
                          }
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 9: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
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
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{doc.fileType}</span>
                        <h4 className="font-bold text-xs text-slate-900 mt-1">{doc.title}</h4>
                        <p className="text-[11px] text-slate-500">{doc.downloadCount || 0} Kali Diunduh</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm('Hapus dokumen ini?')) {
                            await fetch(`/api/admin/documents/${doc.id}`, { method: 'DELETE', headers: authHeaders });
                            loadAllData();
                          }
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 12: USERS */}
          {activeTab === 'users' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Pengguna & Operator</h3>
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
                  <div key={u.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{u.fullName} <span className="font-normal text-slate-400">(@{u.username})</span></p>
                      <p className="text-[11px] text-slate-500">Role: {u.role} • Status: {u.isActive ? 'Aktif' : 'Nonaktif'}</p>
                    </div>
                    {u.id !== session.user.id && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/admin/users/${u.id}/toggle-status`, { method: 'PUT', headers: authHeaders });
                          loadAllData();
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold border rounded-lg cursor-pointer"
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-xs">
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setEditingLink({
                              ...editingLink,
                              iconType: 'upload',
                              icon: reader.result as string,
                            });
                          };
                          reader.readAsDataURL(file);
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
                await fetch('/api/admin/announcements', {
                  method: 'POST',
                  headers: authHeaders,
                  body: JSON.stringify(editingAnnouncement),
                });
                setEditingAnnouncement(null);
                loadAllData();
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setEditingAnnouncement({
                              ...editingAnnouncement,
                              imageUrl: reader.result as string,
                            });
                          };
                          reader.readAsDataURL(file);
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
                  Terbitkan Pengumuman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT REGISTRATION ----------------- */}
      {editingRegistration && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-xs">
            <h3 className="font-bold text-base text-slate-900 mb-1">Pendaftaran Baru / PPDB</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await fetch('/api/admin/registrations', {
                  method: 'POST',
                  headers: authHeaders,
                  body: JSON.stringify(editingRegistration),
                });
                setEditingRegistration(null);
                loadAllData();
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
                <input
                  type="text"
                  value={editingRegistration.description || ''}
                  onChange={(e) => setEditingRegistration({ ...editingRegistration, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRegistration(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl cursor-pointer"
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-xs">
            <h3 className="font-bold text-base text-slate-900 mb-1">Tambah Dokumen Unduhan</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await fetch('/api/admin/documents', {
                  method: 'POST',
                  headers: authHeaders,
                  body: JSON.stringify(editingDocument),
                });
                setEditingDocument(null);
                loadAllData();
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
                <label className="block font-semibold mb-1">URL File / Download Link</label>
                <input
                  type="text"
                  required
                  value={editingDocument.fileUrl || ''}
                  onChange={(e) => setEditingDocument({ ...editingDocument, fileUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
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
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDocument(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl cursor-pointer"
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
                loadAllData();
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
    </div>
  );
};
