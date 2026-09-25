import React, { useState, useRef, useEffect } from 'react';
import { User, CleaningReport, KondisiAkhir } from '../types';
import { 
  INITIAL_AREAS, 
  INITIAL_CHECKLIST_ITEMS, 
  getTodayDateString, 
  getCurrentTimeString 
} from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { 
  Camera, 
  Upload, 
  CheckSquare, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Sparkles, 
  Clock, 
  Calendar, 
  FileText,
  HelpCircle,
  Check,
  AlertTriangle,
  Wrench,
  Loader2
} from 'lucide-react';

interface ReportFormProps {
  currentUser: User | null;
  officers: User[];
  onSubmitSuccess: (newReport: CleaningReport) => void;
  onViewDashboard: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  currentUser,
  officers,
  onSubmitSuccess,
  onViewDashboard,
}) => {
  // 1. Nama Petugas
  // If current logged-in user is a petugas, default to their name
  const [selectedPetugas, setSelectedPetugas] = useState<string>('');
  
  // 2. Area
  const [selectedArea, setSelectedArea] = useState<string>('KM MASJID PUTRA');
  const [isAreaOther, setIsAreaOther] = useState<boolean>(false);
  const [customAreaText, setCustomAreaText] = useState<string>('');

  // 3. Checklist
  const [selectedChecklist, setSelectedChecklist] = useState<string[]>([
    'Kloset Bersih',
    'Kran Ada',
    'Ember Ada',
    'Air ada',
    'Gayung Ada',
  ]);
  const [hasCustomChecklist, setHasCustomChecklist] = useState<boolean>(false);
  const [customChecklistText, setCustomChecklistText] = useState<string>('');

  // 4. Kondisi Akhir
  const [kondisiAkhir, setKondisiAkhir] = useState<KondisiAkhir>('Bersih');

  // 5. Keterangan Tambahan
  const [keterangan, setKeterangan] = useState<string>('');

  // 6. Upload Bukti
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<CleaningReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync selected petugas when currentUser changes
  useEffect(() => {
    if (currentUser?.role === 'petugas') {
      setSelectedPetugas(currentUser.name);
    } else if (!selectedPetugas && officers.length > 0) {
      setSelectedPetugas(officers[0].name);
    }
  }, [currentUser, officers]);

  // Toggle checklist item
  const toggleChecklistItem = (item: string) => {
    setSelectedChecklist((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Select all default checklists
  const handleSelectAllChecklist = () => {
    setSelectedChecklist([...INITIAL_CHECKLIST_ITEMS]);
  };

  // Clear all checklists
  const handleClearChecklist = () => {
    setSelectedChecklist([]);
  };

  // Handle Photo selection/upload with compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    setErrorMsg('');

    try {
      const newPhotoUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImage(file);
        newPhotoUrls.push(compressed);
      }
      setPhotos((prev) => [...prev, ...newPhotoUrls]);
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal memproses gambar. Pastikan format foto didukung.');
    } finally {
      setIsCompressing(false);
      // Reset inputs so user can choose again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentUser) {
      setErrorMsg('Akses ditolak: Anda harus login sebagai Petugas untuk mengirim laporan.');
      return;
    }

    if (!selectedPetugas) {
      setErrorMsg('Silakan pilih Nama Petugas terlebih dahulu.');
      return;
    }

    if (isAreaOther && !customAreaText.trim()) {
      setErrorMsg('Mohon sebutkan nama area jika memilih opsi "Other".');
      return;
    }

    if (selectedChecklist.length === 0 && (!hasCustomChecklist || !customChecklistText.trim())) {
      setErrorMsg('Mohon centang setidaknya satu item Checklist Kebersihan.');
      return;
    }

    if (photos.length === 0) {
      setErrorMsg('Upload bukti kegiatan wajib dilampirkan (minimal 1 foto).');
      return;
    }

    setIsSubmitting(true);

    // Build finalized checklist
    const finalChecklist = [...selectedChecklist];
    if (hasCustomChecklist && customChecklistText.trim()) {
      finalChecklist.push(customChecklistText.trim());
    }

    const matchedOfficer = officers.find((o) => o.name === selectedPetugas);

    const reportData: Omit<CleaningReport, 'id' | 'timestamp'> = {
      tanggal: getTodayDateString(),
      waktu: getCurrentTimeString(),
      petugasId: matchedOfficer ? matchedOfficer.id : (currentUser?.id || 'officer-general'),
      namaPetugas: selectedPetugas,
      area: isAreaOther ? (customAreaText.trim() || 'Other') : selectedArea,
      isAreaOther,
      areaCustom: isAreaOther ? customAreaText.trim() : undefined,
      checklist: finalChecklist,
      checklistCustom: hasCustomChecklist ? customChecklistText.trim() : undefined,
      kondisiAkhir,
      keteranganTambahan: keterangan.trim(),
      fotoBukti: photos,
      statusVerifikasi: 'Menunggu',
    };

    setTimeout(() => {
      // Simulate slight realistic save delay
      try {
        const fullReport: CleaningReport = {
          ...reportData,
          id: `rep-${Date.now()}`,
          timestamp: Date.now(),
        };
        onSubmitSuccess(fullReport);
        setSubmitSuccess(fullReport);
        setIsSubmitting(false);
      } catch (err) {
        console.error(err);
        setErrorMsg('Terjadi kesalahan saat menyimpan laporan.');
        setIsSubmitting(false);
      }
    }, 450);
  };

  const handleResetForNew = () => {
    setSubmitSuccess(null);
    setPhotos([]);
    setKeterangan('');
    setKondisiAkhir('Bersih');
    setSelectedChecklist([...INITIAL_CHECKLIST_ITEMS]);
    setIsAreaOther(false);
    setCustomAreaText('');
    setHasCustomChecklist(false);
    setCustomChecklistText('');
  };

  // Strict Access Guard: Non-users / guests cannot view or submit the form
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Akses Dibatasi: Masuk Sebagai Petugas
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mb-6 leading-relaxed">
            Non-user / Tamu hanya memiliki akses untuk melihat Dashboard laporan kebersihan. Untuk mengisi formulir ini, silakan masuk ke akun Petugas Anda terlebih dahulu.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onViewDashboard}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all"
            >
              Kembali ke Dashboard Laporan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success view
  if (submitSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xl p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Laporan Berhasil Terkirim!
          </h2>
          <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
            Terima kasih atas dedikasi dan kerja keras Anda menjaga kebersihan di lingkungan Sekolah Cendekia BAZNAS.
          </p>

          {/* Report Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto mb-6 space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Petugas:</span>
              <span className="font-bold text-slate-800">{submitSuccess.namaPetugas}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Area:</span>
              <span className="font-bold text-slate-800">{submitSuccess.area}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Kondisi Akhir:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${
                submitSuccess.kondisiAkhir === 'Bersih'
                  ? 'bg-emerald-100 text-emerald-800'
                  : submitSuccess.kondisiAkhir === 'Ada Kerusakan'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {submitSuccess.kondisiAkhir}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Waktu Lapor:</span>
              <span className="text-slate-700">{submitSuccess.tanggal} • {submitSuccess.waktu} WIB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Bukti Foto:</span>
              <span className="text-slate-700 font-medium">{submitSuccess.fotoBukti.length} Foto Terlampir</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleResetForNew}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors text-sm"
            >
              + Input Laporan Area Lain
            </button>
            <button
              onClick={onViewDashboard}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-xl transition-colors text-sm"
            >
              Lihat di Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Google Form Style Header Box */}
      <div className="bg-white rounded-2xl border-t-8 border-t-emerald-700 border-x border-b border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-5 sm:p-7 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Formulir Resmi
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {getTodayDateString()}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {getCurrentTimeString()} WIB
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
            LAPORAN KEBERSIHAN KAMAR MANDI PETUGAS
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Formulir bagi Petugas Kebersihan Sekolah Cendekia BAZNAS
          </p>
        </div>

        <div className="bg-rose-50/60 px-5 sm:px-7 py-2 text-rose-700 text-xs font-medium border-t border-rose-100 flex items-center gap-1.5">
          <span className="font-bold text-rose-600 text-sm leading-none">*</span>
          <span>Menunjukkan pertanyaan wajib diisi</span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Perhatian</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Question 1: Nama Petugas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            1. Nama Petugas <span className="text-rose-600">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Pilih nama Anda dari daftar petugas kebersihan
          </p>

          <div className="relative">
            <select
              value={selectedPetugas}
              onChange={(e) => setSelectedPetugas(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="" disabled>-- Pilih Nama Petugas --</option>
              {/* Prioritize standard 3 officers from prompt: IDAY M YUSUF, ABDUL KODIR, WAHYUDIN */}
              {['IDAY M YUSUF', 'ABDUL KODIR', 'WAHYUDIN'].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {/* Plus any extra registered officers not in the initial 3 */}
              {officers
                .filter((o) => !['IDAY M YUSUF', 'ABDUL KODIR', 'WAHYUDIN'].includes(o.name))
                .map((officer) => (
                  <option key={officer.id} value={officer.name}>
                    {officer.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Quick select pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            {['IDAY M YUSUF', 'ABDUL KODIR', 'WAHYUDIN'].map((name) => (
              <button
                type="button"
                key={name}
                onClick={() => setSelectedPetugas(name)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  selectedPetugas === name
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2: Area yang dibersihkan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            2. Area yang dibersihkan <span className="text-rose-600">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Pilih satu area kamar mandi / tempat wudhu yang telah selesai dibersihkan
          </p>

          <div className="space-y-2.5">
            {INITIAL_AREAS.map((area) => (
              <label
                key={area}
                className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                  !isAreaOther && selectedArea === area
                    ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-semibold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="area_selection"
                  checked={!isAreaOther && selectedArea === area}
                  onChange={() => {
                    setIsAreaOther(false);
                    setSelectedArea(area);
                  }}
                  className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
                <span className="ml-3 text-sm">{area}</span>
              </label>
            ))}

            {/* Other Area Option */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                isAreaOther
                  ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <label className="flex items-center cursor-pointer mb-2">
                <input
                  type="radio"
                  name="area_selection"
                  checked={isAreaOther}
                  onChange={() => setIsAreaOther(true)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
                <span className="ml-3 text-sm font-medium text-slate-800">
                  Other (Area Lainnya):
                </span>
              </label>

              {isAreaOther && (
                <input
                  type="text"
                  placeholder="Tuliskan nama lokasi/area..."
                  value={customAreaText}
                  onChange={(e) => setCustomAreaText(e.target.value)}
                  className="w-full ml-7 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>

        {/* Question 3: Checklist Kebersihan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <label className="block text-slate-900 font-bold text-sm sm:text-base">
                3. Checklist Kebersihan, centang jika kondisi bersih dan ada <span className="text-rose-600">*</span>
              </label>
              <p className="text-xs text-slate-500">
                Centang semua yang memenuhi standar kebersihan
              </p>
            </div>

            {/* Fast actions */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllChecklist}
                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={handleClearChecklist}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            {INITIAL_CHECKLIST_ITEMS.map((item) => {
              const isChecked = selectedChecklist.includes(item);
              return (
                <label
                  key={item}
                  className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-emerald-50/70 border-emerald-400 text-emerald-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleChecklistItem(item)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="ml-3 text-sm">{item}</span>
                  {isChecked && <Check className="w-4 h-4 ml-auto text-emerald-600" />}
                </label>
              );
            })}
          </div>

          {/* Other checklist item */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasCustomChecklist}
                onChange={(e) => setHasCustomChecklist(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="ml-3 text-sm font-medium text-slate-700">
                Other (Kelengkapan / Kondisi Tambahan):
              </span>
            </label>
            {hasCustomChecklist && (
              <input
                type="text"
                placeholder="Contoh: Keset kering, Pewangi terpasang..."
                value={customChecklistText}
                onChange={(e) => setCustomChecklistText(e.target.value)}
                className="mt-2 ml-7 w-[calc(100%-1.75rem)] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>
        </div>

        {/* Question 4: Kondisi Akhir Area */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            4. Kondisi Akhir Area <span className="text-rose-600">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Pilih status akhir kondisi setelah dibersihkan
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Bersih */}
            <label
              className={`flex flex-col p-4 rounded-xl border cursor-pointer text-center transition-all ${
                kondisiAkhir === 'Bersih'
                  ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="kondisi_akhir"
                checked={kondisiAkhir === 'Bersih'}
                onChange={() => setKondisiAkhir('Bersih')}
                className="sr-only"
              />
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-slate-900">Bersih</span>
              <span className="text-[11px] text-slate-500 mt-1">
                Kondisi rapi, wangi & siap pakai
              </span>
            </label>

            {/* Perlu Pengecekan Ulang */}
            <label
              className={`flex flex-col p-4 rounded-xl border cursor-pointer text-center transition-all ${
                kondisiAkhir === 'Perlu Pengecekan Ulang'
                  ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="kondisi_akhir"
                checked={kondisiAkhir === 'Perlu Pengecekan Ulang'}
                onChange={() => setKondisiAkhir('Perlu Pengecekan Ulang')}
                className="sr-only"
              />
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-slate-900">Perlu Pengecekan Ulang</span>
              <span className="text-[11px] text-slate-500 mt-1">
                Butuh tinjauan ulang / pasokan
              </span>
            </label>

            {/* Ada Kerusakan */}
            <label
              className={`flex flex-col p-4 rounded-xl border cursor-pointer text-center transition-all ${
                kondisiAkhir === 'Ada Kerusakan'
                  ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="kondisi_akhir"
                checked={kondisiAkhir === 'Ada Kerusakan'}
                onChange={() => setKondisiAkhir('Ada Kerusakan')}
                className="sr-only"
              />
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-2">
                <Wrench className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-slate-900">Ada Kerusakan</span>
              <span className="text-[11px] text-slate-500 mt-1">
                Kran bocor, pintu rusak, dll.
              </span>
            </label>
          </div>
        </div>

        {/* Question 5: Keterangan Tambahan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            5. Keterangan Tambahan
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Jika ada kerusakan atau perlu pengecekan supervisor
          </p>

          <textarea
            rows={3}
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Tuliskan catatan detail jika ada kendala, perlengkapan yang habis, atau kerusakan fasilitas..."
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
          />

          {/* Quick chips suggestions */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[
              'Kran air dol / bocor',
              'Sabun cuci tangan habis',
              'Lampu kamar mandi mati',
              'Gagang pintu rusak',
              'Lantai sangat licin',
              'Saluran pembuangan mampet',
            ].map((chip) => (
              <button
                type="button"
                key={chip}
                onClick={() =>
                  setKeterangan((prev) => (prev ? `${prev}, ${chip}` : chip))
                }
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Question 6: Upload Bukti Kegiatan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            6. Upload Bukti Kegiatan <span className="text-rose-600">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-4">
            Upload foto setelah dibersihkan atau jika ada kerusakan sebagai bukti dokumentasi
          </p>

          {/* Photo Buttons */}
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Direct Camera Capture (Mobile Friendly) */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isCompressing}
              className="flex-1 min-w-[140px] flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs sm:text-sm shadow-sm transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Ambil Foto (Kamera)</span>
            </button>

            {/* Gallery Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="flex-1 min-w-[140px] flex items-center justify-center space-x-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs sm:text-sm border border-slate-300 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Pilih Dari Galeri</span>
            </button>

            {/* Hidden Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          {/* Compression Indicator */}
          {isCompressing && (
            <div className="flex items-center justify-center py-4 text-emerald-700 text-xs font-medium space-x-2 bg-emerald-50 rounded-xl mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mengoptimasi foto...</span>
            </div>
          )}

          {/* Photos Preview Grid */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((url, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 shadow-xs"
                >
                  <img
                    src={url}
                    alt={`Bukti kegiatan ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1.5 right-1.5">
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-colors"
                      title="Hapus foto ini"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-[11px] font-semibold">
                    Foto Bukti #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => cameraInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Belum ada foto bukti diunggah
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik tombol di atas atau tap di sini untuk memotret hasil kebersihan
              </p>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isCompressing}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-base shadow-md shadow-emerald-700/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Mengirim Laporan...</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-5 h-5" />
                <span>Kirim Laporan Kebersihan</span>
              </>
            )}
          </button>
          <p className="text-center text-xs text-slate-500 mt-2">
            Laporan akan langsung tercatat dan dapat dilihat oleh supervisor di dashboard.
          </p>
        </div>
      </form>
    </div>
  );
};
