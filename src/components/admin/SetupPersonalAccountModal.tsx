import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { AuthSession } from '../../types';

interface SetupPersonalAccountModalProps {
  isOpen: boolean;
  token?: string;
  defaultUsername?: string;
  onAccountCreated: (newSession: AuthSession) => void;
}

export const SetupPersonalAccountModal: React.FC<SetupPersonalAccountModalProps> = ({
  isOpen,
  token,
  defaultUsername = 'admin_maplusmm',
  onAccountCreated,
}) => {
  const [username, setUsername] = useState(defaultUsername);
  const [fullName, setFullName] = useState('Administrator MA PLUS MM');
  const [email, setEmail] = useState('tumaplusmahadulmutaallimin@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const hasMinLength = password.length >= 6;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isUsernameValid = username.trim().length >= 3;

  const isFormValid = hasMinLength && passwordsMatch && isUsernameValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isUsernameValid) {
      setErrorMessage('Username minimal 3 karakter.');
      return;
    }

    if (!hasMinLength) {
      setErrorMessage('Password minimal 6 karakter demi privasi dan keamanan.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('Konfirmasi password tidak cocok dengan password baru.');
      return;
    }

    setIsLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/setup-personal-account', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          newUsername: username.trim(),
          fullName: fullName.trim(),
          email: email.trim(),
          newPassword: password,
          confirmPassword: confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal menyimpan akun administrator pribadi.');
        setIsLoading(false);
        return;
      }

      onAccountCreated(data.session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative border-2 border-emerald-600/30 my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Badge */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shadow-sm">
            <ShieldCheck className="w-8 h-8 text-emerald-700" />
          </div>
        </div>

        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Langkah Wajib Masuk Pertama</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
            Buat Akun Administrator Pribadi
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto">
            MA PLUS MA'HADUL MUTA'ALLIMIN (MA PLUS MM)
          </p>
        </div>

        {/* Security Notice Box */}
        <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            <KeyRound className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Privasi & Keamanan Lembaga Terjamin:</span>
              <p className="text-emerald-800 mt-0.5">
                Tentukan <strong>Username</strong> dan <strong>Password Pribadi</strong> Anda sekarang sebelum membuka Dashboard. Setelah disimpan, akses 1-klik akan ditutup secara permanen dan sistem hanya dapat diakses dengan akun Anda.
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Username Administrator Baru <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="misal: admin_maplusmm"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Gunakan huruf kecil, angka, atau underscore. Ini dipakai saat login berikutnya.
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Lengkap / Jabatan Admin
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="misal: Administrator MA PLUS MM"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Resmi Lembaga
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tumaplusmahadulmutaallimin@gmail.com"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Password Baru */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password Baru Pribadi <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password pilihan Anda (min. 6 karakter)"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono transition-all"
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

          {/* Konfirmasi Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ulangi Konfirmasi Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password baru Anda"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p
                className={`text-[11px] mt-1 font-medium flex items-center gap-1 ${
                  passwordsMatch ? 'text-emerald-600' : 'text-rose-500'
                }`}
              >
                {passwordsMatch ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Password cocok
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" /> Konfirmasi password belum cocok
                  </>
                )}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-700 hover:bg-emerald-800 focus:ring-4 focus:ring-emerald-300 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Menyimpan Akun & Mengunci Sistem...</span>
            ) : (
              <>
                <span>Simpan Akun Pribadi & Masuk Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-center text-slate-400">
          Enkripsi aman PBKDF2-HMAC-SHA-256 dengan garam kriptografis unik.
        </p>
      </div>
    </div>
  );
};
