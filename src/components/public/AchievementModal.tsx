import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  Search,
  Check,
  Upload,
  FileCheck,
  AlertCircle,
  FileText,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import {
  compressImageFileToDataUrl,
  createStudentAchievementInFirestore,
} from '../../lib/firestorePortal';
import { parseJsonSafe } from '../../lib/http';
import { trackPortalEvent } from '../../lib/telemetry';
import type { StudentAchievement } from '../../types';

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionName: string;
}

export const AchievementModal: React.FC<AchievementModalProps> = ({
  isOpen,
  onClose,
  institutionName,
}) => {
  const [step, setStep] = useState<'select_applicant' | 'fill_form' | 'success'>('select_applicant');
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantResults, setApplicantResults] = useState<any[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<{ name: string; nisn: string; registeredProgram: string } | null>(null);

  const [manualName, setManualName] = useState('');
  const [manualNisn, setManualNisn] = useState('');
  const [manualProgram, setManualProgram] = useState('PPDB MA Plus MM');

  // Form states
  const [achievementTitle, setAchievementTitle] = useState('');
  const [field, setField] = useState<StudentAchievement['field']>('tahfidz');
  const [level, setLevel] = useState<StudentAchievement['level']>('Provinsi');
  const [rank, setRank] = useState<StudentAchievement['rank']>('Juara 1');
  const [organizer, setOrganizer] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [certificateData, setCertificateData] = useState<string>('');
  const [certificateName, setCertificateName] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [tandaTerimaCode, setTandaTerimaCode] = useState('');

  // Search applicants from server (requires >= 2 characters for privacy & accuracy)
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = applicantSearch.trim();
    if (trimmed.length < 2) {
      setApplicantResults([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/public/achievements/search-applicant?query=${encodeURIComponent(trimmed)}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? parseJsonSafe(res) : { results: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.results)) {
          setApplicantResults(data.results);
        }
      })
      .catch(() => {
        if (!cancelled) setApplicantResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [applicantSearch, isOpen]);

  if (!isOpen) return null;

  // Handle certificate file upload (with image compression for Firestore limit)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Ukuran file maksimal 5 MB.');
      return;
    }

    setCertificateName(file.name);
    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressImageFileToDataUrl(file, 1400, 580000);
        setCertificateData(compressed);
        return;
      } catch {
        // fallback to FileReader
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (result.length > 740000) {
        setErrorMessage('Ukuran berkas PDF/non-gambar melebihi batas simpan cloud (~500 KB). Silakan unggah foto/scan gambar (JPG/PNG).');
        return;
      }
      setCertificateData(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectApplicant = (applicant: any) => {
    setErrorMessage('');
    setSelectedApplicant(applicant);
    setStep('fill_form');
  };

  const handleManualApplicantProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualNisn.trim()) {
      setErrorMessage('Nama pendaftar dan NISN / Nomor Pendaftaran PPDB wajib diisi.');
      return;
    }
    setErrorMessage('');
    setSelectedApplicant({
      name: manualName.trim(),
      nisn: manualNisn.trim(),
      registeredProgram: manualProgram.trim() || 'Pendaftar PPDB MA Plus MM',
    });
    setStep('fill_form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicant) {
      setErrorMessage('Silakan pilih nama pendaftar yang sudah terdaftar terlebih dahulu.');
      return;
    }
    if (!achievementTitle.trim()) {
      setErrorMessage('Nama prestasi / kejuaraan wajib diisi.');
      return;
    }
    if (!certificateData) {
      setErrorMessage('Harap unggah berkas sertifikat / piagam pendukung.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    const submissionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ach_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const nowIso = new Date().toISOString();

    const payloadBody: StudentAchievement = {
      id: submissionId,
      studentName: selectedApplicant.name.trim(),
      registrationNumberOrNisn: selectedApplicant.nisn.trim(),
      achievementTitle: achievementTitle.trim(),
      field,
      level,
      rank,
      organizer: organizer.trim(),
      year: year.trim(),
      certificateUrl: certificateData,
      certificateFileName: certificateName || 'piagam_prestasi.pdf',
      notes: notes.trim(),
      status: 'pending',
      submittedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      const [apiOutcome, cloudOutcome] = await Promise.allSettled([
        fetch('/api/public/achievements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody),
        }).then(async (res) => {
          const data = await parseJsonSafe(res);
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Gagal menyimpan prestasi ke server.');
          }
          return data;
        }),
        createStudentAchievementInFirestore(payloadBody),
      ]);

      const apiSucceeded = apiOutcome.status === 'fulfilled';
      const cloudSucceeded = cloudOutcome.status === 'fulfilled';

      if (!apiSucceeded && !cloudSucceeded) {
        const apiErr = apiOutcome.status === 'rejected' ? apiOutcome.reason?.message : '';
        const cloudErr = cloudOutcome.status === 'rejected' ? cloudOutcome.reason?.message : '';
        setErrorMessage(apiErr || cloudErr || 'Gagal mengirimkan pendaftaran prestasi.');
        setIsSubmitting(false);
        return;
      }

      const resolvedId =
        (apiSucceeded && apiOutcome.value?.achievementId) ? String(apiOutcome.value.achievementId) : submissionId;

      void trackPortalEvent({
        eventType: 'ACHIEVEMENT_SUBMIT',
        targetId: resolvedId,
        targetName: achievementTitle.trim(),
        path: '/#achievement-portal',
        details: `Pengajuan prestasi "${achievementTitle.trim()}" (${level})`,
      });

      setTandaTerimaCode(resolvedId.substring(0, 8).toUpperCase());
      setStep('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    setStep('select_applicant');
    setSelectedApplicant(null);
    setManualName('');
    setManualNisn('');
    setAchievementTitle('');
    setCertificateData('');
    setCertificateName('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 text-xs">
        <button
          onClick={resetAll}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto mb-3 shadow-xs">
            <Award className="w-6 h-6 text-amber-600" />
          </div>
          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Jalur Prestasi Santri
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1.5">
            Pendaftaran Prestasi Calon Santri & Siswa
          </h3>
          <p className="text-slate-500 max-w-md mx-auto mt-1">
            Syarat mendaftar prestasi: Anda harus sudah mendaftar sebelumnya di sistem PPDB {institutionName}.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: SELECT OR IDENTIFY APPLICANT */}
        {step === 'select_applicant' && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <p className="font-semibold mb-0.5">Langkah 1: Identifikasi Data Pendaftaran PPDB Anda</p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Cari nama yang sudah terdata atau masukkan Nama Lengkap &amp; NISN / Nomor Pendaftaran PPDB Anda untuk melanjutkan unggah piagam prestasi.
              </p>
            </div>

            <form onSubmit={handleManualApplicantProceed} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <p className="font-bold text-slate-800 text-xs">Konfirmasi Identitas Pendaftar Terdaftar</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Pendaftar *</label>
                  <input
                    type="text"
                    required
                    placeholder="Sesuai formulir PPDB"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NISN / No. Pendaftaran *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 0081234567"
                    value={manualNisn}
                    onChange={(e) => setManualNisn(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jalur / Program Pendaftaran</label>
                <input
                  type="text"
                  placeholder="PPDB MA Plus MM"
                  value={manualProgram}
                  onChange={(e) => setManualProgram(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Lanjutkan ke Formulir &amp; Unggah Dokumen
              </button>
            </form>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama pendaftar yang sudah terdata (min. 2 huruf)..."
                  value={applicantSearch}
                  onChange={(e) => setApplicantSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {applicantSearch.trim().length > 0 && applicantSearch.trim().length < 2 && (
                <p className="text-[11px] text-slate-400 px-1">
                  Ketik minimal 2 karakter untuk mencari data pendaftar.
                </p>
              )}

              {applicantResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {applicantResults.map((app) => (
                    <div
                      key={`${app.name}-${app.nisn}`}
                      onClick={() => handleSelectApplicant(app)}
                      className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">{app.name}</p>
                        <p className="text-[11px] text-slate-500">NISN / No: {app.nisn} • {app.registeredProgram}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px]">
                        Pilih Nama
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: FILL ACHIEVEMENT FORM */}
        {step === 'fill_form' && selectedApplicant && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selected Applicant Card */}
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">{selectedApplicant.name}</p>
                  <p className="text-[11px] text-emerald-800">NISN: {selectedApplicant.nisn}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('select_applicant')}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Ganti Pendaftar
              </button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Prestasi / Kejuaraan / Lomba <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Juara 1 Musabaqah Hifdzil Qur'an 10 Juz"
                value={achievementTitle}
                onChange={(e) => setAchievementTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bidang Prestasi</label>
                <select
                  value={field}
                  onChange={(e) => setField(e.target.value as StudentAchievement['field'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="tahfidz">Tahfidz Al-Qur'an</option>
                  <option value="akademik">Akademik / Sains / Matematika</option>
                  <option value="keagamaan">Kitab Kuning & Keagamaan</option>
                  <option value="seni_budaya">Kaligrafi & Seni Islami</option>
                  <option value="olahraga">Olahraga & Bela Diri</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tingkat Kejuaraan</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as StudentAchievement['level'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="Kecamatan">Kecamatan</option>
                  <option value="Kabupaten/Kota">Kabupaten / Kota</option>
                  <option value="Provinsi">Provinsi</option>
                  <option value="Nasional">Nasional</option>
                  <option value="Internasional">Internasional</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Peringkat Juara</label>
                <select
                  value={rank}
                  onChange={(e) => setRank(e.target.value as StudentAchievement['rank'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="Juara 1">Juara 1</option>
                  <option value="Juara 2">Juara 2</option>
                  <option value="Juara 3">Juara 3</option>
                  <option value="Harapan 1">Harapan 1</option>
                  <option value="Harapan 2">Harapan 2</option>
                  <option value="Finalis / Peserta">Finalis / Peserta</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Penyelenggara</label>
                <input
                  type="text"
                  placeholder="Kemenag / Pemda / Diknas"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tahun Perolehan</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* Document Upload Area */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Unggah Dokumen Piagam / Sertifikat Pendukung <span className="text-rose-500">*</span>
              </label>
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 text-center bg-slate-50 hover:bg-emerald-50/20 transition-all relative">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required={!certificateData}
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center">
                  <Upload className="w-6 h-6 text-emerald-600 mb-1.5" />
                  {certificateName ? (
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>{certificateName} (Berkas Terlampir)</span>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-800">Klik atau tarik file piagam ke sini</p>
                      <p className="text-[11px] text-slate-500">Mendukung format PDF, PNG, JPG (Maks. 5 MB)</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
              <textarea
                rows={2}
                placeholder="Keterangan singkat mengenai kejuaraan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('select_applicant')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Mengunggah Data...' : 'Kirim Berkas Prestasi'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-7 h-7 text-emerald-600" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Pendaftaran Prestasi Berhasil!</h4>
            <p className="text-slate-600 max-w-sm mx-auto leading-relaxed">
              Berkas piagam dan data prestasi atas nama <strong>{selectedApplicant?.name}</strong> telah tersimpan di sistem verifikasi panitia.
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-xs mx-auto">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                Kode Tanda Terima Prestasi
              </span>
              <span className="font-mono text-base font-extrabold text-emerald-800 tracking-wider">
                PRS-{tandaTerimaCode}
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Panitia akan melakukan verifikasi keaslian piagam dan menginformasikan hasil seleksi beasiswa prestasi melalui WhatsApp resmi.
            </p>

            <div className="pt-2">
              <button
                onClick={resetAll}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
