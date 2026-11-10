import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  User, 
  CleaningReport, 
  KondisiAkhir, 
  MasterRoom, 
  MasterChecklist, 
  FormSettings, 
  RoomSchedule 
} from '../types';
import { 
  INITIAL_AREAS, 
  INITIAL_CHECKLIST_ITEMS, 
  getTodayDateString, 
  getCurrentTimeString 
} from '../utils/storage';
import { 
  getMasterRooms, 
  getMasterChecklists, 
  getFormSettings, 
  getRoomSchedules, 
  getOfficerScheduledRooms, 
  getScheduledOfficerForRoom, 
  isOfficerAllowedToReportRoom,
  getIndonesianDayName,
  getDayIndex
} from '../utils/formStorage';
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
  Loader2,
  Lock,
  Building2,
  ShieldCheck,
  UserCheck,
  Info
} from 'lucide-react';

interface ReportFormProps {
  currentUser: User | null;
  officers: User[];
  masterRooms?: MasterRoom[];
  masterChecklists?: MasterChecklist[];
  formSettings?: FormSettings;
  roomSchedules?: RoomSchedule[];
  initialArea?: string | null;
  onSubmitSuccess: (newReport: CleaningReport) => void;
  onViewDashboard: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  currentUser,
  officers,
  masterRooms: propMasterRooms,
  masterChecklists: propMasterChecklists,
  formSettings: propFormSettings,
  roomSchedules: propRoomSchedules,
  initialArea,
  onSubmitSuccess,
  onViewDashboard,
}) => {
  // Master data sources (with fallback to storage helpers)
  const allRooms = propMasterRooms || getMasterRooms();
  const activeRooms = allRooms.filter((r) => r.isActive !== false);
  const allChecklists = propMasterChecklists || getMasterChecklists();
  const activeChecklists = allChecklists.filter((c) => c.isActive !== false);
  const activeSettings = propFormSettings || getFormSettings();
  const allSchedules = propRoomSchedules || getRoomSchedules();

  const todayStr = getTodayDateString();
  const todayDayIndex = getDayIndex(todayStr);
  const todayDayName = getIndonesianDayName(todayDayIndex);

  const isOfficer = currentUser?.role === 'petugas';
  const isSuperOrSpv = currentUser?.role === 'superadmin' || currentUser?.role === 'supervisor';

  // Rooms assigned to currentUser today (dynamically reactive to propRoomSchedules updates)
  const myAssignedRoomsToday = useMemo(() => {
    return currentUser
      ? getOfficerScheduledRooms(currentUser.id, currentUser.name, todayStr, allSchedules)
      : [];
  }, [currentUser, todayStr, allSchedules]);

  // 1. Nama Petugas
  const [selectedPetugas, setSelectedPetugas] = useState<string>('');

  // 2. Area
  // Auto-pick the first room assigned to this officer, or initialArea, or first active room
  const defaultArea = initialArea 
    ? initialArea 
    : isOfficer && myAssignedRoomsToday.length > 0 
    ? myAssignedRoomsToday[0] 
    : (activeRooms[0]?.name || 'KM MASJID PUTRA');

  const [selectedArea, setSelectedArea] = useState<string>(defaultArea);

  // Sync selected area when myAssignedRoomsToday changes
  useEffect(() => {
    if (isOfficer && myAssignedRoomsToday.length > 0 && !myAssignedRoomsToday.includes(selectedArea)) {
      setSelectedArea(myAssignedRoomsToday[0]);
    }
  }, [isOfficer, myAssignedRoomsToday, selectedArea]);
  const [isAreaOther, setIsAreaOther] = useState<boolean>(false);
  const [customAreaText, setCustomAreaText] = useState<string>('');

  useEffect(() => {
    if (initialArea) {
      setSelectedArea(initialArea);
      setIsAreaOther(false);
    } else if (isOfficer && myAssignedRoomsToday.length > 0 && !myAssignedRoomsToday.includes(selectedArea)) {
      setSelectedArea(myAssignedRoomsToday[0]);
    }
  }, [initialArea, myAssignedRoomsToday.length]);

  // 3. Checklist
  const defaultChecklistLabels = activeChecklists
    .filter((c) => c.isRequired)
    .map((c) => c.label);

  const [selectedChecklist, setSelectedChecklist] = useState<string[]>(
    defaultChecklistLabels.length > 0 ? defaultChecklistLabels : ['Kloset Bersih', 'Kran Ada', 'Ember Ada', 'Air ada', 'Gayung Ada']
  );
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

  // Select all active checklists
  const handleSelectAllChecklist = () => {
    setSelectedChecklist(activeChecklists.map((c) => c.label));
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
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ==========================================
  // ACCESS VALIDATION & FORM SUBMISSION
  // Rule: "kegiatan hanya bisa dilaporkan oleh petugas terjadwal"
  // ==========================================
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentUser) {
      setErrorMsg('Akses ditolak: Anda harus login via Google terlebih dahulu.');
      return;
    }

    if (!selectedPetugas) {
      setErrorMsg('Silakan pilih Nama Petugas terlebih dahulu.');
      return;
    }

    const targetAreaName = isAreaOther ? (customAreaText.trim() || 'Other') : selectedArea;

    // ENFORCE: Room Officer Assignment Check
    if (isOfficer) {
      const permission = isOfficerAllowedToReportRoom(
        currentUser.id,
        currentUser.name,
        targetAreaName,
        todayStr,
        currentUser.role,
        allSchedules
      );

      if (!permission.allowed) {
        setErrorMsg(
          `⛔ Akses Dibatasi: ${permission.reason || `Ruangan "${targetAreaName}" hari ini (${todayDayName}) ditugaskan kepada ${permission.scheduledOfficer}. Anda hanya berwenang melaporkan ruangan tugas Anda: ${myAssignedRoomsToday.join(', ')}.`}`
        );
        return;
      }
    }

    if (isAreaOther && !customAreaText.trim()) {
      setErrorMsg('Mohon sebutkan nama area jika memilih opsi "Other".');
      return;
    }

    if (selectedChecklist.length === 0 && (!hasCustomChecklist || !customChecklistText.trim())) {
      setErrorMsg('Mohon centang setidaknya satu item Checklist Kebersihan.');
      return;
    }

    // Photo requirement validation based on formSettings
    const minRequiredPhotos = activeSettings.requirePhoto ? activeSettings.minPhotos || 1 : 0;
    if (photos.length < minRequiredPhotos) {
      setErrorMsg(`Upload bukti kegiatan wajib dilampirkan (minimal ${minRequiredPhotos} foto).`);
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
      tanggal: todayStr,
      waktu: getCurrentTimeString(),
      petugasId: matchedOfficer ? matchedOfficer.id : (currentUser?.id || 'officer-general'),
      namaPetugas: selectedPetugas,
      area: targetAreaName,
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
    }, 400);
  };

  const handleResetForNew = () => {
    setSubmitSuccess(null);
    setPhotos([]);
    setKeterangan('');
    setHasCustomChecklist(false);
    setCustomChecklistText('');
    setCustomAreaText('');
    setIsAreaOther(false);
    setKondisiAkhir('Bersih');
    setSelectedChecklist(defaultChecklistLabels);
    if (isOfficer && myAssignedRoomsToday.length > 0) {
      setSelectedArea(myAssignedRoomsToday[0]);
    }
  };

  // SUCCESS SCREEN
  if (submitSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <CheckCircle className="w-9 h-9" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
            Laporan Kebersihan Berhasil Disimpan!
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Laporan untuk <strong>{submitSuccess.area}</strong> telah tersimpan di sistem dan disinkronkan secara realtime.
          </p>

          {/* Report Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left max-w-md mx-auto mb-6 space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Petugas Terjadwal:</span>
              <span className="font-bold text-slate-800">{submitSuccess.namaPetugas}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Area Ruangan:</span>
              <span className="font-bold text-slate-800">{submitSuccess.area}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Kondisi Akhir:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
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
              <span className="text-slate-700 font-mono">{submitSuccess.tanggal} • {submitSuccess.waktu} WIB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Bukti Foto:</span>
              <span className="text-slate-700 font-bold">{submitSuccess.fotoBukti.length} Foto Terlampir</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleResetForNew}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors text-xs sm:text-sm cursor-pointer"
            >
              + Input Laporan Ruangan Lain
            </button>
            <button
              onClick={onViewDashboard}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors text-xs sm:text-sm cursor-pointer"
            >
              Lihat di Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Google Form Style Header Box */}
      <div className="bg-white rounded-2xl border-t-8 border-t-emerald-700 border-x border-b border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-7 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Formulir Resmi
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              {todayDayName}, {todayStr}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              {getCurrentTimeString()} WIB
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            LAPORAN KEBERSIHAN KAMAR MANDI PETUGAS
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Sekolah Cendekia BAZNAS (SCB) • Divisi Sarana & Prasarana
          </p>

          {activeSettings.guidelinesText && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{activeSettings.guidelinesText}</span>
            </div>
          )}
        </div>

        {/* Schedule Enforcement Banner for Officers */}
        {isOfficer ? (
          <div className="bg-emerald-50 px-5 sm:px-7 py-3 border-t border-emerald-100 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Jadwal Anda Hari Ini ({todayDayName}):{' '}
                <strong className="text-emerald-900">
                  {myAssignedRoomsToday.length > 0 ? myAssignedRoomsToday.join(', ') : 'Tidak ada jadwal ruangan hari ini'}
                </strong>
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-white/70 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
              Kunci Petugas Terjadwal Aktif
            </span>
          </div>
        ) : isSuperOrSpv ? (
          <div className="bg-blue-50 px-5 sm:px-7 py-2.5 border-t border-blue-100 text-xs text-blue-900 flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Mode Pengawas/Superadmin: Anda memiliki hak akses penuh melaporkan seluruh area kamar mandi.
            </span>
          </div>
        ) : null}

        <div className="bg-rose-50/50 px-5 sm:px-7 py-2 text-rose-700 text-xs font-semibold border-t border-rose-100 flex items-center gap-1.5">
          <span className="font-bold text-rose-600 text-sm leading-none">*</span>
          <span>Menunjukkan pertanyaan wajib diisi</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-rose-900">Validasi Pengisian Form</p>
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Question 1: Nama Petugas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            1. Nama Petugas Kebersihan <span className="text-rose-600">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Nama personel yang bertugas dan bertanggung jawab atas kebersihan area
          </p>

          <div className="relative">
            <select
              value={selectedPetugas}
              onChange={(e) => setSelectedPetugas(e.target.value)}
              disabled={isOfficer}
              required
              className={`w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer ${
                isOfficer ? 'opacity-80 bg-slate-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="" disabled>-- Pilih Nama Petugas --</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.name}>
                  {officer.name} ({officer.email})
                </option>
              ))}
            </select>
          </div>

          {isOfficer && (
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              Terkunci otomatis sesuai akun Google Anda: <strong>{currentUser.name}</strong>
            </p>
          )}
        </div>

        {/* Question 2: Area yang dibersihkan (Enforcing Schedule Rule) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
            <label className="block text-slate-900 font-bold text-sm sm:text-base">
              2. Area yang Dibersihkan <span className="text-rose-600">*</span>
            </label>
            <span className="text-xs text-slate-500">
              Hari ini: <strong>{todayDayName}</strong>
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            {isOfficer 
              ? 'Pilih ruangan yang ditugaskan kepada Anda hari ini. Ruangan di luar jadwal Anda akan terkunci.'
              : 'Pilih titik sanitasi kamar mandi / tempat wudhu yang telah selesai diinspeksi.'}
          </p>

          <div className="space-y-2.5">
            {activeRooms.map((room) => {
              const schedule = getScheduledOfficerForRoom(room.name, todayStr);
              const isAssignedToCurrentUser = !isOfficer || myAssignedRoomsToday.includes(room.name);
              const isSelected = !isAreaOther && selectedArea === room.name;
              const scheduledOfficerName = schedule?.officerName || 'Semua Petugas';

              return (
                <label
                  key={room.id}
                  onClick={() => {
                    if (!isAssignedToCurrentUser) {
                      setErrorMsg(`⛔ Ruangan "${room.name}" hari ini ditugaskan kepada ${scheduledOfficerName}. Anda hanya dapat melaporkan ruangan tugas Anda.`);
                    }
                  }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all ${
                    !isAssignedToCurrentUser
                      ? 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 font-bold shadow-xs cursor-pointer ring-1 ring-emerald-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="area_selection"
                      disabled={!isAssignedToCurrentUser}
                      checked={isSelected}
                      onChange={() => {
                        if (isAssignedToCurrentUser) {
                          setIsAreaOther(false);
                          setSelectedArea(room.name);
                          setErrorMsg('');
                        }
                      }}
                      className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                    />
                    <div className="ml-3">
                      <span className="text-sm font-semibold">{room.name}</span>
                      {room.zone && (
                        <span className="text-[10px] text-slate-400 block sm:inline sm:ml-2">
                          • {room.zone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-0 flex items-center gap-1.5 self-start sm:self-auto pl-7 sm:pl-0">
                    {isAssignedToCurrentUser ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Tugas Anda Hari Ini</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Jadwal: {scheduledOfficerName}</span>
                      </span>
                    )}
                  </div>
                </label>
              );
            })}

            {/* Other Area Option */}
            {activeSettings.allowOtherRoom && (
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isAreaOther
                    ? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
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
                  <span className="ml-3 text-sm font-bold text-slate-800">
                    Other (Area Khusus / Titik Tambahan Lainnya):
                  </span>
                </label>

                {isAreaOther && (
                  <input
                    type="text"
                    placeholder="Tuliskan nama lokasi/area spesifik..."
                    value={customAreaText}
                    onChange={(e) => setCustomAreaText(e.target.value)}
                    className="w-full ml-7 px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    autoFocus
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Question 3: Checklist Kebersihan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <label className="block text-slate-900 font-bold text-sm sm:text-base">
                3. Checklist Fasilitas & Kebersihan <span className="text-rose-600">*</span>
              </label>
              <p className="text-xs text-slate-500">
                Centang setiap poin yang telah diperiksa dan dalam kondisi bersih serta berfungsi baik
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllChecklist}
                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={handleClearChecklist}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="space-y-2.5 mt-3">
            {activeChecklists.map((item) => {
              const isChecked = selectedChecklist.includes(item.label);

              return (
                <label
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-semibold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleChecklistItem(item.label)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="ml-3 text-sm">{item.label}</span>
                  </div>

                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    item.category === 'Kebersihan'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.category === 'Fasilitas'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.category}
                  </span>
                </label>
              );
            })}

            {/* Custom Checklist Option */}
            {activeSettings.allowCustomChecklist && (
              <div
                className={`p-3 rounded-xl border transition-all ${
                  hasCustomChecklist
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <label className="flex items-center cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={hasCustomChecklist}
                    onChange={(e) => setHasCustomChecklist(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-800">
                    Tambahkan Poin Checklist Lainnya:
                  </span>
                </label>

                {hasCustomChecklist && (
                  <input
                    type="text"
                    placeholder="Contoh: Keset kering & wangi..."
                    value={customChecklistText}
                    onChange={(e) => setCustomChecklistText(e.target.value)}
                    className="w-full ml-7 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Question 4: Kondisi Akhir */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            4. Kondisi Akhir Ruangan <span className="text-rose-600">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Pilih status evaluasi kebersihan dan kelayakan ruangan setelah dibersihkan
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                value: 'Bersih' as KondisiAkhir,
                label: 'Bersih',
                desc: 'Seluruh fasilitas lengkap, bersih, harum, dan siap pakai',
                icon: CheckCircle,
                badge: 'Standar Optimal',
                color: 'emerald',
              },
              {
                value: 'Perlu Pengecekan Ulang' as KondisiAkhir,
                label: 'Perlu Pengecekan',
                desc: 'Ada kekurangan minor atau fasilitas yang perlu perhatian',
                icon: AlertTriangle,
                badge: 'Perhatian',
                color: 'amber',
              },
              {
                value: 'Ada Kerusakan' as KondisiAkhir,
                label: 'Ada Kerusakan',
                desc: 'Kran bocor, kloset tersumbat, atau butuh perbaikan sarpras',
                icon: Wrench,
                badge: 'Perlu Tindakan',
                color: 'rose',
              },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = kondisiAkhir === opt.value;

              return (
                <label
                  key={opt.value}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? opt.color === 'emerald'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                        : opt.color === 'amber'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 ring-1 ring-amber-500'
                        : 'bg-rose-50 border-rose-500 text-rose-950 ring-1 ring-rose-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{opt.label}</span>
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{opt.desc}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200">
                      {opt.badge}
                    </span>
                    <input
                      type="radio"
                      name="kondisi_akhir"
                      checked={isSelected}
                      onChange={() => setKondisiAkhir(opt.value)}
                      className="w-4 h-4 text-emerald-600"
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Question 5: Keterangan Tambahan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            5. Keterangan Tambahan (Opsional)
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Tuliskan catatan khusus, kendala fasilitas, atau laporan perbaikan jika ada
          </p>

          <textarea
            rows={3}
            placeholder="Contoh: Kran air nomor 2 agak longgar, sudah dilaporkan ke bagian sarpras..."
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        {/* Question 6: Upload Bukti Foto Kegiatan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300">
          <label className="block text-slate-900 font-bold text-sm sm:text-base mb-1">
            6. Upload Bukti Foto Kegiatan {activeSettings.requirePhoto && <span className="text-rose-600">*</span>}
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Ambil foto langsung dengan kamera ponsel atau pilih dari galeri dokumen (minimal {activeSettings.minPhotos || 1} foto)
          </p>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isCompressing}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>Ambil Foto Kamera</span>
            </button>

            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Pilih dari Galeri</span>
            </button>
          </div>

          {/* Photo Previews */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative rounded-xl overflow-hidden border border-slate-200 group aspect-4/3 bg-slate-100">
                  <img src={photo} alt={`Bukti ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-700 transition-colors"
                    title="Hapus Foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                    Foto #{index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {isCompressing && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-emerald-700 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mengoptimalkan foto...</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="submit"
            disabled={isSubmitting || isCompressing}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Laporan...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Kirim Laporan Kebersihan</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onViewDashboard}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline"
          >
            Batal & Kembali ke Dashboard
          </button>
        </div>
      </form>
    </div>
  );
};
