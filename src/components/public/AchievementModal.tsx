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

  // Form states
  const [achievementTitle, setAchievementTitle] = useState('');
  const [field, setField] = useState('tahfidz');
  const [level, setLevel] = useState('Provinsi');
  const [rank, setRank] = useState('Juara 1');
  const [organizer, setOrganizer] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [certificateData, setCertificateData] = useState<string>('');
  const [certificateName, setCertificateName] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [tandaTerimaCode, setTandaTerimaCode] = useState('');

  // Search applicants from server
  useEffect(() => {
    if (isOpen) {
      fetch(`/api/public/achievements/search-applicant?query=${encodeURIComponent(applicantSearch)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.results) setApplicantResults(data.results);
        })
        .catch(() => {});
    }
  }, [applicantSearch, isOpen]);

  if (!isOpen) return null;

  // Handle certificate file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Ukuran file maksimal 5 MB.');
      return;
    }

    setCertificateName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCertificateData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectApplicant = (applicant: any) => {
    setSelectedApplicant(applicant);
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

    try {
      const res = await fetch('/api/public/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedApplicant.name,
          registrationNumberOrNisn: selectedApplicant.nisn,
          achievementTitle,
          field,
          level,
          rank,
          organizer,
          year,
          certificateUrl: certificateData,
          certificateFileName: certificateName || 'piagam_prestasi.pdf',
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal mengirimkan pendaftaran prestasi.');
        setIsSubmitting(false);
        return;
      }

      setTandaTerimaCode(data.achievementId.substring(0, 8).toUpperCase());
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

        {/* STEP 1: SELECT APPLICANT */}
        {step === 'select_applicant' && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <p className="font-semibold mb-0.5">Langkah 1: Temukan Data Pendaftaran Anda</p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Ketik nama calon santri atau NISN Anda yang telah terdaftar pada formulir pendaftaran PPDB sebelumnya untuk memilih nama.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau NISN pendaftar..."
                value={applicantSearch}
                onChange={(e) => setApplicantSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-700">Pilih Nama Pendaftar:</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {applicantResults.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl">
                    Nama pendaftar tidak ditemukan. Pastikan Anda telah mengisi formulir pendaftaran terlebih dahulu.
                  </div>
                ) : (
                  applicantResults.map((app) => (
                    <div
                      key={app.nisn}
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
                  ))
                )}
              </div>
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
                  onChange={(e) => setField(e.target.value)}
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
                  onChange={(e) => setLevel(e.target.value)}
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
                  onChange={(e) => setRank(e.target.value)}
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
