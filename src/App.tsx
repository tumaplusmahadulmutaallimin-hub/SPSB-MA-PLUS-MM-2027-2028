/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Category,
  ServiceLink,
  Announcement,
  Registration,
  DocumentItem,
  SiteSettings,
  AuthSession,
  MadrasahAchievement,
} from './types';
import { PublicPortal } from './components/public/PublicPortal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LoginModal } from './components/admin/LoginModal';
import { SetupPersonalAccountModal } from './components/admin/SetupPersonalAccountModal';
import { Lock, X, Sparkles, ArrowRight } from 'lucide-react';
import { AuthStatus } from './types';

const SESSION_STORAGE_KEY = 'PORTAL_AUTH_SESSION_V1';
const PORTAL_SYNC_STORAGE_KEY = 'PORTAL_LAST_SYNC_TS';
const PORTAL_SYNC_CHANNEL = 'portal_digital_sync';

export default function App() {
  const [currentView, setCurrentView] = useState<'public' | 'admin'>('public');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSetupAccountModal, setShowSetupAccountModal] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [dismissBanner, setDismissBanner] = useState(false);

  // Public portal data
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<ServiceLink[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [committeeContacts, setCommitteeContacts] = useState<any[]>([]);
  const [madrasahAchievements, setMadrasahAchievements] = useState<MadrasahAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch public portal data with cache bypass
  const loadPublicData = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/portal?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setSiteSettings(data.siteSettings);
        setCategories(data.categories || []);
        setLinks(data.links || []);
        setAnnouncements(data.announcements || []);
        setRegistrations(data.registrations || []);
        setDocuments(data.documents || []);
        setCommitteeContacts(data.committeeContacts || []);
        setMadrasahAchievements(data.madrasahAchievements || []);
      }
    } catch (err) {
      console.error('Failed to load public portal data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Broadcast admin update to current state and any other open browser tabs
  const notifyPortalUpdated = useCallback(() => {
    loadPublicData();
    try {
      localStorage.setItem(PORTAL_SYNC_STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore storage restrictions
    }
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(PORTAL_SYNC_CHANNEL);
        ch.postMessage({ type: 'PORTAL_UPDATED', at: Date.now() });
        ch.close();
      } catch {
        // ignore BroadcastChannel restrictions
      }
    }
  }, [loadPublicData]);

  // Dynamically sync browser title, meta description, and favicon with admin siteSettings
  useEffect(() => {
    if (!siteSettings) return;
    const portalName = siteSettings.portalName || 'Portal Digital Terpadu';
    const institutionName = siteSettings.institutionName || "MA PLUS MA'HADUL MUTA'ALLIMIN";
    const fullTitle = `${portalName} - ${institutionName}`;
    document.title = fullTitle;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && siteSettings.description) {
      descMeta.setAttribute('content', siteSettings.description);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', fullTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && siteSettings.description) {
      ogDesc.setAttribute('content', siteSettings.description);
    }

    const iconHref = siteSettings.faviconUrl || siteSettings.logoUrl;
    if (iconHref) {
      let linkEl = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.rel = 'icon';
        document.head.appendChild(linkEl);
      }
      linkEl.href = iconHref;
    }
  }, [siteSettings]);

  // Listen to cross-tab updates, window focus, visibility, and periodic refresh
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PORTAL_SYNC_STORAGE_KEY) {
        loadPublicData();
      }
    };
    const handleFocus = () => {
      loadPublicData();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadPublicData();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(PORTAL_SYNC_CHANNEL);
        channel.onmessage = () => {
          loadPublicData();
        };
      } catch {
        channel = null;
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && currentView === 'public') {
        loadPublicData();
      }
    }, 15000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channel) channel.close();
      window.clearInterval(intervalId);
    };
  }, [loadPublicData, currentView]);

  // Check existing session & setup info on mount
  useEffect(() => {
    // Record anonymous visitor hit
    const visitorId = localStorage.getItem('PORTAL_VISITOR_UUID') || Math.random().toString(36).substring(2);
    localStorage.setItem('PORTAL_VISITOR_UUID', visitorId);

    fetch('/api/public/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, path: window.location.pathname }),
    }).catch(() => {});

    // Check system auth status (whether personal admin has been set up)
    fetch('/api/auth/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: AuthStatus) => {
        setAuthStatus(data);
      })
      .catch(() => {});

    // Check existing stored session
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed: AuthSession = JSON.parse(stored);
        if (parsed.expiresAt > Date.now()) {
          // Verify with server
          fetch('/api/auth/me', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${parsed.token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.user) {
                setSession(parsed);
                if (data.user.mustChangePassword) {
                  setShowSetupAccountModal(true);
                }
              } else {
                localStorage.removeItem(SESSION_STORAGE_KEY);
              }
            })
            .catch(() => {
              localStorage.removeItem(SESSION_STORAGE_KEY);
            });
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    loadPublicData();
  }, [loadPublicData]);

  // Handle successful standard login
  const handleLoginSuccess = (newSession: AuthSession, mustChangePassword: boolean) => {
    setSession(newSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));

    if (mustChangePassword) {
      setShowSetupAccountModal(true);
    } else {
      setCurrentView('admin');
    }
  };

  // Handle 1-click first-time access
  const handleFirstTimeAccess = (newSession: AuthSession) => {
    setSession(newSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    setShowLoginModal(false);
    setShowSetupAccountModal(true);
  };

  // Direct 1-click first-time access from banner
  const handleBannerFirstTimeClick = async () => {
    try {
      const res = await fetch('/api/auth/first-time-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleFirstTimeAccess(data.session);
      } else {
        setShowLoginModal(true);
      }
    } catch {
      setShowLoginModal(true);
    }
  };

  // Handle account created & secured
  const handleAccountCreated = (updatedSession: AuthSession) => {
    setSession(updatedSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
    setShowSetupAccountModal(false);
    setAuthStatus({ hasCustomAdminCreated: true, isSetupMode: false });
    setCurrentView('admin');
  };

  // Handle logout
  const handleLogout = async () => {
    if (session?.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
    }
    setSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentView('public');
    loadPublicData();
  };

  // Handle link click & track real analytics
  const handleLinkClick = async (link: ServiceLink) => {
    const visitorId = localStorage.getItem('PORTAL_VISITOR_UUID') || 'anon';
    try {
      fetch(`/api/public/click/${link.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      }).catch(() => {});
    } catch {}

    // Open target URL
    if (link.targetOpen === '_self') {
      if (link.targetUrl.startsWith('#')) {
        const el = document.getElementById(link.targetUrl.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }
      window.location.href = link.targetUrl;
    } else {
      window.open(link.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Handle document download & track download count
  const handleDocumentDownload = async (doc: DocumentItem) => {
    try {
      fetch(`/api/public/download/${doc.id}`, { method: 'POST' }).catch(() => {});
    } catch {}
    window.open(doc.fileUrl, '_blank');
  };

  if (loading && !siteSettings) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold tracking-wider uppercase text-emerald-400">
          Memuat Portal Digital Terpadu...
        </p>
      </div>
    );
  }

  const isSetupMode = authStatus ? !authStatus.hasCustomAdminCreated : false;

  return (
    <div className="min-h-screen">
      {/* ----------------- FIRST-TIME 1-CLICK SETUP BANNER ----------------- */}
      {isSetupMode && !dismissBanner && (
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white px-4 py-3 font-medium text-xs border-b border-emerald-600 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shrink-0">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-amber-200">
                  Akses Masuk Administrator Pertama Kali (1-Klik)
                </p>
                <p className="text-[11px] text-emerald-100">
                  Belum memiliki password? Masuk langsung 1-klik untuk membuat <strong>Username</strong> & <strong>Password Pribadi</strong> Anda sebelum membuka Dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleBannerFirstTimeClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>1-Klik Masuk & Buat Akun</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
              </button>

              <button
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-950 text-white font-medium text-xs transition-colors cursor-pointer border border-emerald-600/60"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Login Manual</span>
              </button>

              <button
                onClick={() => setDismissBanner(true)}
                className="p-1 text-emerald-300 hover:text-white cursor-pointer"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- ACTIVE VIEW ROUTER ----------------- */}
      {currentView === 'admin' && session ? (
        <AdminDashboard
          session={session}
          onLogout={handleLogout}
          onDataUpdated={notifyPortalUpdated}
          onViewPublicPortal={() => {
            setCurrentView('public');
            loadPublicData();
          }}
        />
      ) : (
        <PublicPortal
          siteSettings={
            siteSettings || {
              portalName: 'Portal Digital Terpadu',
              institutionName: "MA PLUS MA'HADUL MUTA'ALLIMIN",
              tagline: 'One QR Code – One Portal – All Digital Services',
              description: 'Pusat akses seluruh layanan digital resmi.',
              logoUrl: '',
              faviconUrl: '',
              bannerUrl: '',
              primaryColor: '#065f46',
              accentColor: '#d97706',
              whatsappNumber: '',
              email: '',
              address: '',
              instagramUrl: '',
              facebookUrl: '',
              youtubeUrl: '',
              tiktokUrl: '',
              websiteUrl: '',
              copyrightText: '',
              heroEnabled: true,
              announcementsEnabled: true,
              registrationsEnabled: true,
              documentsEnabled: true,
              searchEnabled: true,
              categoriesEnabled: true,
              updatedAt: '',
            }
          }
          categories={categories}
          links={links}
          announcements={announcements}
          registrations={registrations}
          documents={documents}
          committeeContacts={committeeContacts}
          madrasahAchievements={madrasahAchievements}
          onOpenAdminLogin={() => {
            if (session && !session.user.mustChangePassword) {
              setCurrentView('admin');
            } else if (session && session.user.mustChangePassword) {
              setShowSetupAccountModal(true);
            } else {
              setShowLoginModal(true);
            }
          }}
          onLinkClick={handleLinkClick}
          onDocumentDownload={handleDocumentDownload}
        />
      )}

      {/* ----------------- LOGIN MODAL ----------------- */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        onFirstTimeAccess={handleFirstTimeAccess}
      />

      {/* ----------------- MANDATORY SETUP PERSONAL ACCOUNT MODAL ----------------- */}
      <SetupPersonalAccountModal
        isOpen={showSetupAccountModal}
        token={session?.token}
        defaultUsername={session?.user?.username !== 'admin_portal' ? session?.user?.username : 'admin_maplusmm'}
        onAccountCreated={handleAccountCreated}
      />
    </div>
  );
}
