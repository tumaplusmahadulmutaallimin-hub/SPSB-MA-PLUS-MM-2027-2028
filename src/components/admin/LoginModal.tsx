import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { AuthSession } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: AuthSession, mustChangePassword: boolean) => void;
  initialCredentialsNote?: { username: string; tempPass: string } | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialCredentialsNote,
}) => {
  const [username, setUsername] = useState(initialCredentialsNote?.username || '');
  const [password, setPassword] = useState(initialCredentialsNote?.tempPass || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Login gagal. Periksa username dan password.');
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800 mx-auto mb-3 shadow-xs">
          <Lock className="w-6 h-6 text-emerald-600" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 text-center mb-1">
          Login Administrator
        </h3>
        <p className="text-xs text-slate-500 text-center mb-6">
          Pusat Pengelolaan Portal Digital Terpadu
        </p>

        {initialCredentialsNote && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Kredensial Sementara Ditemukan</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Username: <strong className="font-mono text-slate-900">{initialCredentialsNote.username}</strong><br />
              Password Sementara telah diisikan otomatis di bawah.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
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
                placeholder="Masukkan password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-700 hover:bg-emerald-800 focus:ring-4 focus:ring-emerald-200 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk Dashboard'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-center text-slate-400">
          Dilindungi dengan enkripsi PBKDF2-HMAC-SHA-256 & pembatasan percobaan login.
        </p>
      </div>
    </div>
  );
};
