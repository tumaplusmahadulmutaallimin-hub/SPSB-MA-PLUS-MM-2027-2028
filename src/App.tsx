/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Category,
  ServiceLink,
  Announcement,
  Registration,
  DocumentItem,
  SiteSettings,
  AuthSession,
  SetupCredentials,
} from './types';
import { PublicPortal } from './components/public/PublicPortal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LoginModal } from './components/admin/LoginModal';
import { ChangePasswordModal } from './components/admin/ChangePasswordModal';
import { ShieldAlert, Copy, Check, Lock, X } from 'lucide-react';

const SESSION_STORAGE_KEY = 'PORTAL_AUTH_SESSION_V1';

export default function App() {
  const [currentView, setCurrentView] = useState<'public' | 'admin'>('public');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [initialCredentials, setInitialCredentials] = useState<SetupCredentials | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Public portal data
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<ServiceLink[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [committeeContacts, setCommitteeContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch public portal data
  const loadPublicData = async () => {
    try {
      const res = await fetch('/api/public/portal');
      if (res.ok) {
        const data = await res.json();
        setSiteSettings(data.siteSettings);
        setCategories(data.categories || []);
        setLinks(data.links || []);
        setAnnouncements(data.announcements || []);
        setRegistrations(data.registrations || []);
        setDocuments(data.documents || []);
        setCommitteeContacts(data.committeeContacts || []);
      }
    } catch (err) {
      console.error('Failed to load public portal data:', err);
    } finally {
      setLoading(false);
    }
  };

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

    // Check setup info (first time admin credentials)
    fetch('/api/auth/setup-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.credentials && !data.credentials.temporaryPassword.startsWith('***')) {
          setInitialCredentials(data.credentials);
        }
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
            headers: { Authorization: `Bearer ${parsed.token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.user) {
                setSession(parsed);
                if (data.user.mustChangePassword) {
                  setShowChangePasswordModal(true);
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
  }, []);

  // Handle successful login
  const handleLoginSuccess = (newSession: AuthSession, mustChangePassword: boolean) => {
    setSession(newSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));

    if (mustChangePassword) {
      setShowChangePasswordModal(true);
    } else {
      setCurrentView('admin');
    }
  };

  // Handle password changed
  const handlePasswordChanged = (updatedSession: AuthSession) => {
    setSession(updatedSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
    setShowChangePasswordModal(false);
    setInitialCredentials(null);
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

  // Copy initial credentials
  const handleCopyInitialCreds = () => {
    if (!initialCredentials) return;
    const text = `Kredensial Administrator Awal Portal Digital Terpadu\nUsername: ${initialCredentials.username}\nPassword Sementara: ${initialCredentials.temporaryPassword}`;
    navigator.clipboard.writeText(text);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
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

  return (
    <div className="min-h-screen">
      {/* ----------------- INITIAL SETUP CREDENTIALS BANNER ----------------- */}
      {initialCredentials && (
        <div className="bg-amber-500 text-slate-950 px-4 py-3 font-medium text-xs border-b border-amber-600 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-950 shrink-0" />
              <div>
                <p className="font-bold text-xs sm:text-sm">
                  Kredensial Administrator Awal Dihasilkan Otomatis
                </p>
                <p className="text-[11px] text-amber-950/80">
                  Username: <strong className="font-mono">{initialCredentials.username}</strong> | Password Sementara:{' '}
                  <strong className="font-mono bg-amber-600/30 px-1.5 py-0.5 rounded text-slate-950">
                    {initialCredentials.temporaryPassword}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyInitialCreds}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {copiedCreds ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCreds ? 'Tersalin!' : 'Salin Kredensial'}</span>
              </button>

              <button
                onClick={() => {
                  setShowLoginModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold text-xs transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Login Sekarang</span>
              </button>

              <button
                onClick={() => setInitialCredentials(null)}
                className="p-1 text-amber-950 hover:text-black cursor-pointer"
                title="Tutup Pesan"
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
              institutionName: 'Lembaga Pendidikan & Dakwah Terpadu',
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
          onOpenAdminLogin={() => setShowLoginModal(true)}
          onLinkClick={handleLinkClick}
          onDocumentDownload={handleDocumentDownload}
        />
      )}

      {/* ----------------- LOGIN MODAL ----------------- */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        initialCredentialsNote={
          initialCredentials
            ? {
                username: initialCredentials.username,
                tempPass: initialCredentials.temporaryPassword,
              }
            : null
        }
      />

      {/* ----------------- MANDATORY CHANGE PASSWORD MODAL ----------------- */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        token={session?.token || ''}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );
}
