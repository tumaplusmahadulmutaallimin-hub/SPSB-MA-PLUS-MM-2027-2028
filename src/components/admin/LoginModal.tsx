import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AuthSession, AuthStatus } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: AuthSession, mustChangePassword: boolean) => void;
  onFirstTimeAccess: (session: AuthSession) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onFirstTimeAccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstTimeLoading, setIsFirstTimeLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  // Check auth status whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      fetch('/api/auth/status')
        .then((res) => res.json())
        .then((data: AuthStatus) => {
          setAuthStatus(data);
          if (data.currentAdminHint && !data.hasCustomAdminCreated) {
            setUsername(data.currentAdminHint);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle 1-Click First-Time Access
  const handleFirstTimeClick = async () => {
    setErrorMessage('');
    setIsFirstTimeLoading(true);

    try {
      const res = await fetch('/api/auth/first-time-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal menggunakan akses pertama kali.');
        setIsFirstTimeLoading(false);
        return;
      }

      onFirstTimeAccess(data.session);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsFirstTimeLoading(false);
    }
  };

  // Handle Standard Login Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Login gagal. Periksa username dan password Anda.');
        setIsLoading(false);
        return;
      }

      onLoginSuccess(data.session, Boolean(data.mustChangePassword));
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  const isSetupMode = authStatus ? !authStatus.hasCustomAdminCreated : true;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800 mx-auto mb-3 shadow-xs">
          <Lock className="w-6 h-6 text-emerald-600" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 text-center mb-1">
          Login Administrator
        </h3>
        <p className="text-xs text-slate-500 text-center mb-5">
          Portal Digital Terpadu MA PLUS MM
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* ---------------- 1-CLICK FIRST TIME ACCESS SECTION ---------------- */}
        {isSetupMode ? (
          <div className="mb-5 p-4 rounded-2xl bg-linear-to-br from-emerald-50 via-emerald-50/50 to-amber-50/60 border border-emerald-200 shadow-xs text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold tracking-wider uppercase">
                Akses Pertama Kali
              </span>
              <span className="text-[11px] font-bold text-amber-900">Belum Ada Password</span>
            </div>
            <p className="text-xs text-slate-700 mb-3 leading-relaxed">
              Masuk langsung dengan 1-klik di bawah untuk segera menentukan <strong>Username</strong> dan <strong>Password Pribadi</strong> Anda sendiri sebelum masuk Dashboard.
            </p>
            <button
              type="button"
              onClick={handleFirstTimeClick}
              disabled={isFirstTimeLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isFirstTimeLoading ? 'Membuka Akses...' : '1-Klik Masuk & Buat Akun Pribadi'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Akun pribadi aktif. Masukkan Username dan Password Anda.</span>
          </div>
        )}

        {isSetupMode && (
          <div className="relative flex py-1 items-center mb-4">
            <div className="grow border-t border-slate-200"></div>
            <span className="shrink mx-3 text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Atau Masuk Manual
            </span>
            <div className="grow border-t border-slate-200"></div>
          </div>
        )}

        {/* ---------------- STANDARD CREDENTIALS FORM ---------------- */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username Administrator
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password Anda"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 focus:ring-4 focus:ring-slate-300 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk Dashboard'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-center text-slate-400">
          Dilindungi enkripsi PBKDF2-HMAC-SHA-256 & pembatasan percobaan login.
        </p>
      </div>
    </div>
  );
};
