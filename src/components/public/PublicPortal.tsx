import React, { useState, useMemo } from 'react';
import {
  Search,
  QrCode,
  ExternalLink,
  MessageCircle,
  Mail,
  Download,
  Calendar,
  Sparkles,
  Lock,
  ChevronRight,
  Share2,
  X,
  Check,
  FileText,
  AlertCircle,
  Award,
  Phone,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Category,
  ServiceLink,
  Announcement,
  Registration,
  DocumentItem,
  SiteSettings,
  CommitteeContact,
} from '../../types';
import { IconRenderer } from '../common/IconRenderer';
import { CommitteeModal } from './CommitteeModal';
import { AchievementModal } from './AchievementModal';

interface PublicPortalProps {
  siteSettings: SiteSettings;
  categories: Category[];
  links: ServiceLink[];
  announcements: Announcement[];
  registrations: Registration[];
  documents: DocumentItem[];
  committeeContacts?: CommitteeContact[];
  onOpenAdminLogin: () => void;
  onLinkClick: (link: ServiceLink) => void;
  onDocumentDownload: (doc: DocumentItem) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  siteSettings,
  categories,
  links,
  announcements,
  registrations,
  documents,
  committeeContacts = [],
  onOpenAdminLogin,
  onLinkClick,
  onDocumentDownload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showCommitteeModal, setShowCommitteeModal] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeAnnouncementModal, setActiveAnnouncementModal] = useState<Announcement | null>(null);

  // Generate QR code for the modal
  const handleOpenQrModal = async () => {
    try {
      const portalUrl = window.location.origin;
      const res = await fetch(
        `/api/public/qr-image?url=${encodeURIComponent(portalUrl)}&dark=${encodeURIComponent(
          siteSettings.primaryColor || '#065f46'
        )}`
      );
      const data = await res.json();
      if (data.dataUrl) {
        setQrDataUrl(data.dataUrl);
      }
    } catch (err) {
      console.error('Failed to generate QR:', err);
    }
    setShowQrModal(true);
  };

  const handleCopyPortalLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Handle service card click
  const handleCardClick = (link: ServiceLink) => {
    if (link.targetUrl === '#achievement-portal' || link.name.toLowerCase().includes('prestasi')) {
      setShowAchievementModal(true);
      return;
    }
    if (link.targetUrl === '#committee-contacts' || link.name.toLowerCase().includes('saluran whatsapp')) {
      setShowCommitteeModal(true);
      return;
    }
    if (link.targetUrl === '#ppdb-registration') {
      const element = document.getElementById('ppdb-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    onLinkClick(link);
  };

  // Filter links by search query and category
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      const matchesCategory =
        selectedCategoryId === 'all' || link.categoryId === selectedCategoryId;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const catName = categories.find((c) => c.id === link.categoryId)?.name || '';
      return (
        link.name.toLowerCase().includes(q) ||
        link.description.toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q)
      );
    });
  }, [links, categories, selectedCategoryId, searchQuery]);

  // Primary brand colors
  const brandPrimary = siteSettings.primaryColor || '#065f46';
  const brandAccent = siteSettings.accentColor || '#d97706';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* ----------------- TOP INSTITUTION BAR ----------------- */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-3">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3 min-w-0">
            {siteSettings.logoUrl ? (
              <img
                src={siteSettings.logoUrl}
                alt={siteSettings.institutionName}
                className="w-11 h-11 object-contain rounded-xl border border-slate-200 shrink-0"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0"
                style={{ backgroundColor: brandPrimary }}
              >
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight truncate">
                {siteSettings.institutionName || "MA PLUS MA'HADUL MUTA'ALLIMIN"}
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-800 font-semibold truncate">
                {siteSettings.portalName || 'PORTAL DIGITAL TERPADU'}
              </p>
            </div>
          </div>

          {/* Quick Actions & Contact Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Primary Request: HUBUNGI MA PLUS MM */}
            <button
              onClick={() => setShowCommitteeModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
              title="Hubungi Panitia & Kontak Resmi MA Plus MM"
            >
              <MessageCircle className="w-4 h-4 text-emerald-200" />
              <span className="hidden sm:inline">Hubungi MA PLUS MM</span>
              <span className="sm:hidden">Kontak</span>
            </button>

            <button
              onClick={handleOpenQrModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
              title="Tampilkan QR Code Portal"
            >
              <QrCode className="w-4 h-4 text-amber-600" />
              <span className="hidden md:inline">QR Portal</span>
            </button>

            <button
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="Akses Dashboard Administrator"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* ----------------- HERO BANNER SECTION ----------------- */}
      {siteSettings.heroEnabled && (
        <section
          className="relative text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8 overflow-hidden shadow-inner"
          style={{
            background: `linear-gradient(135deg, ${brandPrimary} 0%, #064e3b 60%, #022c22 100%)`,
          }}
        >
          {/* Subtle Islamic Geometric Backdrop Pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>

          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-amber-300 text-xs font-bold border border-white/15 mb-4 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{siteSettings.tagline || 'One QR Code – One Portal – All Digital Services'}</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
              {siteSettings.institutionName || "MA PLUS MA'HADUL MUTA'ALLIMIN"}
            </h2>

            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl mx-auto mb-6 leading-relaxed">
              {siteSettings.description ||
                'Pusat akses resmi seluruh layanan digital, pendaftaran PPDB, pendaftaran prestasi, dan saluran informasi resmi MA Plus MM.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="#services-section"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer"
                style={{ backgroundColor: brandAccent, color: '#ffffff' }}
              >
                <span>Buka Ikon Layanan</span>
                <ChevronRight className="w-4 h-4" />
              </a>

              <button
                onClick={() => setShowAchievementModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white text-emerald-900 hover:bg-slate-100 shadow-md transition-all cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-600" />
                <span>Daftarkan Prestasi</span>
              </button>

              <button
                onClick={() => setShowCommitteeModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md shadow-xs transition-all cursor-pointer"
              >
                <Phone className="w-4 h-4 text-emerald-300" />
                <span>Saluran WhatsApp Panitia</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ----------------- MENU PENGUMUMAN PENTING (DENGAN GAMBAR TAMPILAN ADMIN) ----------------- */}
      {announcements.length > 0 && siteSettings.announcementsEnabled && (
        <section className="bg-amber-50/70 border-b border-amber-200/80 py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
                <h3 className="text-sm sm:text-base font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Menu Pengumuman Penting</span>
                </h3>
              </div>
              <span className="text-xs text-amber-800 font-semibold">
                {announcements.length} Informasi Resmi
              </span>
            </div>

            {/* Display Announcement Cards with Uploaded Image Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => setActiveAnnouncementModal(ann)}
                  className="bg-white rounded-2xl border border-amber-200/80 hover:border-amber-400 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer group"
                >
                  {/* Uploaded Announcement Image Preview */}
                  {ann.imageUrl ? (
                    <div className="relative w-full h-44 rounded-xl overflow-hidden mb-3 bg-slate-100 border border-slate-200">
                      <img
                        src={ann.imageUrl}
                        alt={ann.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-amber-600 text-white font-bold text-[10px] rounded-lg shadow-sm uppercase tracking-wider">
                        Penting
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-950 p-4 mb-3 flex items-center justify-center text-white text-center">
                      <Sparkles className="w-6 h-6 text-amber-300 mb-1" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                        Dipublikasikan: {ann.publishDate}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 mb-1.5 leading-snug">
                        {ann.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {ann.content}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-800 group-hover:text-amber-900">
                      <span>Lihat Rincian Pengumuman</span>
                      <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------- MAIN SERVICES CONTENT (ICON BERJEJER KOTAK) ----------------- */}
      <main id="services-section" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Search & Category Filter Ribbon */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Pusat Akses Layanan Digital
              </h3>
              <p className="text-xs text-slate-500">
                Klik ikon kotak layanan untuk membuka formulir, media sosial, dokumen, atau rincian kontak resmi.
              </p>
            </div>

            {/* Search Input */}
            {siteSettings.searchEnabled && (
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Instagram, YouTube, Pendaftaran..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Category Chips */}
          {siteSettings.categoriesEnabled && categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Semua Layanan ({links.length})
              </button>

              {categories.map((cat) => {
                const count = links.filter((l) => l.categoryId === cat.id).length;
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                    style={isSelected ? { backgroundColor: brandPrimary } : undefined}
                  >
                    <IconRenderer name={cat.icon} className="w-3.5 h-3.5" />
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ----------------- SERVICE ICONS GRID (KOTAK BERBASIS GAMBAR) ----------------- */}
        {filteredLinks.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              Belum ada layanan yang ditambahkan.
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              Silakan tambahkan ikon layanan, formulir pendaftaran, dan media sosial resmi melalui dashboard administrator.
            </p>
            <button
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm cursor-pointer"
              style={{ backgroundColor: brandPrimary }}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Buka Dashboard Administrator</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredLinks.map((link) => {
              const category = categories.find((c) => c.id === link.categoryId);
              const isSpecialAction =
                link.targetUrl === '#achievement-portal' ||
                link.targetUrl === '#committee-contacts' ||
                link.name.toLowerCase().includes('prestasi') ||
                link.name.toLowerCase().includes('whatsapp');

              return (
                <div
                  key={link.id}
                  onClick={() => handleCardClick(link)}
                  className="group relative bg-white rounded-3xl p-5 border border-slate-200/90 hover:border-emerald-500 hover:shadow-xl transition-all duration-200 flex flex-col items-center text-center cursor-pointer transform hover:-translate-y-1.5"
                >
                  {/* Category Pill Tag */}
                  {category && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 truncate max-w-full">
                      {category.name}
                    </span>
                  )}

                  {/* High-Resolution Image / SVG Badge Container */}
                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl flex items-center justify-center mb-3.5 transition-transform duration-200 group-hover:scale-105 shadow-sm">
                    {link.iconType === 'image' || link.iconType === 'upload' ? (
                      <img
                        src={link.icon}
                        alt={link.name}
                        className="w-full h-full object-contain rounded-2xl drop-shadow-sm"
                      />
                    ) : (
                      <div
                        className="w-full h-full rounded-2xl flex items-center justify-center text-white shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${brandPrimary} 0%, #047857 100%)`,
                        }}
                      >
                        <IconRenderer name={link.icon} className="w-10 h-10 text-amber-300" />
                      </div>
                    )}
                  </div>

                  {/* Service Title */}
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1 mb-1.5">
                    {link.name}
                  </h4>

                  {/* Short Description */}
                  {link.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-4">
                      {link.description}
                    </p>
                  )}

                  {/* Action Button Footer */}
                  <div className="mt-auto pt-2 w-full flex items-center justify-center text-[11px] font-bold text-emerald-700 group-hover:text-emerald-800">
                    <span>{isSpecialAction ? 'Buka Menu' : 'Buka Layanan'}</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ----------------- PPDB & REGISTRATIONS SECTION ----------------- */}
        {registrations.length > 0 && siteSettings.registrationsEnabled && (
          <div id="ppdb-section" className="mt-14">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  <span>Formulir Pendaftaran & PPDB MA Plus MM</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Penerimaan peserta didik dan santri baru tahun ajaran 2026/2027.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registrations.map((reg) => (
                <div
                  key={reg.id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          reg.status === 'open'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {reg.status === 'open' ? 'Sedang Dibuka' : 'Telah Ditutup'}
                      </span>
                      {reg.startDate && (
                        <span className="text-[11px] text-slate-500">
                          {reg.startDate} s/d {reg.endDate || 'Selesai'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-base text-slate-900 mb-1.5">{reg.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed mb-5">
                      {reg.description}
                    </p>
                  </div>

                  <a
                    href={reg.formUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      reg.status === 'open'
                        ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>{reg.status === 'open' ? 'Isi Formulir Pendaftaran Sekarang' : 'Pendaftaran Ditutup'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- DOCUMENTS SECTION ----------------- */}
        {documents.length > 0 && siteSettings.documentsEnabled && (
          <div className="mt-14">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span>Dokumen, Brosur & Panduan Resmi</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Unduh berkas kurikulum, jadwal seleksi, dan brosur resmi MA Plus MM.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {doc.fileType || 'PDF'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate mt-1">{doc.title}</h4>
                    <p className="text-[11px] text-slate-500 truncate">{doc.description || doc.category}</p>
                  </div>
                  <button
                    onClick={() => onDocumentDownload(doc)}
                    className="shrink-0 p-2.5 text-emerald-700 hover:bg-emerald-50 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                    title="Unduh Dokumen"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ----------------- FOOTER ----------------- */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Identity Column */}
          <div>
            <h4 className="text-white font-bold text-sm mb-2">
              {siteSettings.institutionName || "MA PLUS MA'HADUL MUTA'ALLIMIN"}
            </h4>
            <p className="text-slate-400 leading-relaxed mb-3">
              {siteSettings.description}
            </p>
            {siteSettings.address && (
              <p className="text-slate-400">
                <strong className="text-slate-300">Alamat:</strong> {siteSettings.address}
              </p>
            )}
          </div>

          {/* Contact Column */}
          <div>
            <h4 className="text-white font-bold text-sm mb-2">Kontak Panitia & Madrasah</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setShowCommitteeModal(true)}
                  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Lihat Kontak Person Panitia PPDB</span>
                </button>
              </li>
              {siteSettings.whatsappNumber && (
                <li className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WA Utama: {siteSettings.whatsappNumber}</span>
                </li>
              )}
              {siteSettings.email && (
                <li className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Email: {siteSettings.email}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Social Media Column */}
          <div>
            <h4 className="text-white font-bold text-sm mb-2">Saluran Resmi & Media Sosial</h4>
            <div className="flex items-center gap-3">
              {siteSettings.instagramUrl && (
                <a
                  href={siteSettings.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors"
                  title="Instagram"
                >
                  <IconRenderer name="Instagram" className="w-4 h-4" />
                </a>
              )}
              {siteSettings.youtubeUrl && (
                <a
                  href={siteSettings.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors"
                  title="YouTube"
                >
                  <IconRenderer name="Youtube" className="w-4 h-4" />
                </a>
              )}
              {siteSettings.tiktokUrl && (
                <a
                  href={siteSettings.tiktokUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors"
                  title="TikTok"
                >
                  <IconRenderer name="Video" className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="mt-5">
              <button
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Masuk Dashboard Administrator</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500">
          <p>{siteSettings.copyrightText || `© ${new Date().getFullYear()} MA Plus Ma'hadul Muta'allimin.`}</p>
          <p className="text-[11px]">One QR Code – One Portal – All Digital Services</p>
        </div>
      </footer>

      {/* ----------------- MODAL: SALURAN WHATSAPP PANITIA ----------------- */}
      <CommitteeModal
        isOpen={showCommitteeModal}
        onClose={() => setShowCommitteeModal(false)}
        contacts={committeeContacts}
        institutionName={siteSettings.institutionName || 'MA Plus MM'}
      />

      {/* ----------------- MODAL: DAFTARKAN PRESTASI SANTRI ----------------- */}
      <AchievementModal
        isOpen={showAchievementModal}
        onClose={() => setShowAchievementModal(false)}
        institutionName={siteSettings.institutionName || 'MA Plus MM'}
      />

      {/* ----------------- QR MODAL ----------------- */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white mb-3 shadow-sm"
              style={{ backgroundColor: brandPrimary }}
            >
              <QrCode className="w-6 h-6 text-amber-300" />
            </div>

            <h3 className="font-bold text-slate-900 text-base mb-1">
              QR Code Portal Utama
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pindai kode QR ini menggunakan kamera smartphone untuk membuka portal secara instan.
            </p>

            {qrDataUrl ? (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block mb-4 shadow-inner">
                <img
                  src={qrDataUrl}
                  alt="QR Code Portal"
                  className="w-56 h-56 mx-auto object-contain"
                />
              </div>
            ) : (
              <div className="w-56 h-56 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400 mb-4">
                Memuat QR Code...
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCopyPortalLink}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tersalin!' : 'Salin URL'}</span>
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download="QR_PORTAL_MA_PLUS_MM.png"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                  style={{ backgroundColor: brandPrimary }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PNG</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- ANNOUNCEMENT DETAILS MODAL (FULL LIGHTBOX) ----------------- */}
      {activeAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setActiveAnnouncementModal(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase">
              Pengumuman Penting
            </span>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 mt-2 mb-2 leading-snug">
              {activeAnnouncementModal.title}
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Dipublikasikan pada: {activeAnnouncementModal.publishDate}
            </p>

            {activeAnnouncementModal.imageUrl && (
              <div className="rounded-2xl overflow-hidden mb-4 border border-slate-200">
                <img
                  src={activeAnnouncementModal.imageUrl}
                  alt={activeAnnouncementModal.title}
                  className="w-full h-auto max-h-72 object-cover"
                />
              </div>
            )}

            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {activeAnnouncementModal.content}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveAnnouncementModal(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- COMMITTEE CONTACTS DIRECTORY MODAL ----------------- */}
      <CommitteeModal
        isOpen={showCommitteeModal}
        onClose={() => setShowCommitteeModal(false)}
        contacts={committeeContacts}
        institutionName={siteSettings.institutionName}
      />

      {/* ----------------- STUDENT ACHIEVEMENT REGISTRATION MODAL ----------------- */}
      <AchievementModal
        isOpen={showAchievementModal}
        onClose={() => setShowAchievementModal(false)}
        institutionName={siteSettings.institutionName}
      />
    </div>
  );
};
