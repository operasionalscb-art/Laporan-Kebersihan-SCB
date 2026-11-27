import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  CleaningReport,
  MasterRoom,
  RoomSchedule,
  SupervisorInspectionItem,
  SupervisorInspectionStatus,
} from '../types';
import {
  fetchSupervisorInspectionByDateFromCloud,
  saveSupervisorInspectionToCloud,
  getCachedSupervisorInspection,
  getLocalSupervisorInspectionDraft,
  saveLocalSupervisorInspectionDraft,
} from '../services/firestoreSync';
import { getTodayDateString } from '../utils/storage';
import {
  ClipboardCheck,
  RefreshCw,
  Save,
  Star,
  CheckCircle2,
  AlertTriangle,
  Search,
  Copy,
  Check,
  Calendar,
  Loader2,
  Trash2,
  ShieldCheck,
} from 'lucide-react';

interface SupervisorPatrolProps {
  currentUser: User;
  reports: CleaningReport[];
  masterRooms: MasterRoom[];
  roomSchedules: RoomSchedule[];
  isCloudSynced: boolean;
  isFirestoreQuotaLimited: boolean;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const QUICK_PATROL_NOTES: string[] = [
  'Bersih & wangi',
  'Lantai masih basah',
  'Wastafel perlu dilap',
  'Tempat sampah penuh',
  'Aroma kurang segar',
  'Kran / alat perlu perbaikan',
];

function formatShortTimeWib(ms: number): string {
  try {
    const t = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms));
    return `${t} WIB`;
  } catch {
    return new Date(ms).toTimeString().slice(0, 5);
  }
}

function formatReadableTimestamp(ms: number): string {
  if (!ms) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export const SupervisorPatrol: React.FC<SupervisorPatrolProps> = ({
  currentUser,
  reports,
  masterRooms,
  roomSchedules,
  isCloudSynced,
  isFirestoreQuotaLimited,
  onShowToast,
}) => {
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [itemsByRoom, setItemsByRoom] = useState<Record<string, SupervisorInspectionItem>>({});
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState<boolean>(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
  const [lastFetchedAtMs, setLastFetchedAtMs] = useState<number>(0);
  const [lastSavedAtMs, setLastSavedAtMs] = useState<number>(0);
  const [loadedFromCache, setLoadedFromCache] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'UNCHECKED' | 'Sesuai' | 'Perlu Perbaikan' | 'Temuan Baru'
  >('ALL');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const activeRooms = useMemo(() => {
    const active = masterRooms.filter((r) => r.isActive !== false);
    const base = active.length > 0 ? active : masterRooms;
    return [...base].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [masterRooms]);

  const mapItemsArrayToRecord = (arr: SupervisorInspectionItem[]): Record<string, SupervisorInspectionItem> => {
    const rec: Record<string, SupervisorInspectionItem> = {};
    for (const item of arr) {
      if (item && item.roomName) {
        rec[item.roomName.trim().toUpperCase()] = item;
      }
    }
    return rec;
  };

  const loadDateInspection = async (dateStr: string, forceRefresh = false) => {
    setIsLoadingCloud(true);
    try {
      const localDraft = !forceRefresh ? getLocalSupervisorInspectionDraft(dateStr) : null;
      const cached = getCachedSupervisorInspection(dateStr);

      if (localDraft && localDraft.length > 0) {
        setItemsByRoom(mapItemsArrayToRecord(localDraft));
        setHasUnsavedDraft(true);
        setLastFetchedAtMs(cached.fetchedAtMs);
        setLastSavedAtMs(cached.doc?.updatedAtMs || 0);
        setLoadedFromCache(true);
        return;
      }

      const res = await fetchSupervisorInspectionByDateFromCloud(dateStr, forceRefresh);
      const loadedItems = res.inspection?.items || [];
      setItemsByRoom(mapItemsArrayToRecord(loadedItems));
      setHasUnsavedDraft(false);
      setLastFetchedAtMs(res.fetchedAtMs);
      setLastSavedAtMs(res.inspection?.updatedAtMs || 0);
      setLoadedFromCache(res.fromCache);

      if (forceRefresh) {
        if (res.quotaExceeded) {
          onShowToast('Kuota Firestore penuh. Menampilkan data patroli cache lokal.', 'info');
        } else {
          onShowToast(
            res.inspection
              ? `Data patroli tanggal ${dateStr} berhasil dimuat.`
              : `Belum ada catatan patroli Cloud pada tanggal ${dateStr}.`,
            'info'
          );
        }
      }
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadDateInspection(selectedDate, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Match officer reports from in-memory reports for selectedDate (0 Firestore reads)
  const reportByRoomKey = useMemo(() => {
    const map = new Map<string, CleaningReport>();
    const dayReports = reports
      .filter((r) => r.tanggal === selectedDate)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    for (const rep of dayReports) {
      const displayArea = (rep.isAreaOther && rep.areaCustom ? rep.areaCustom : rep.area)
        .trim()
        .toUpperCase();
      if (displayArea && !map.has(displayArea)) {
        map.set(displayArea, rep);
      }
    }
    return map;
  }, [reports, selectedDate]);

  // Match scheduled officer for selectedDate weekday (0 Firestore reads)
  const scheduledOfficerByRoomKey = useMemo(() => {
    const map = new Map<string, string>();
    const parsedDate = new Date(`${selectedDate}T12:00:00`);
    const jsDay = parsedDate.getDay(); // 0=Sun .. 6=Sat
    const weekday = jsDay === 0 ? 7 : jsDay;
    for (const sch of roomSchedules) {
      if (sch.isActive === false) continue;
      if (Array.isArray(sch.daysOfWeek) && !sch.daysOfWeek.includes(weekday)) continue;
      const key = (sch.roomName || '').trim().toUpperCase();
      if (key && sch.officerName) {
        map.set(key, sch.officerName);
      }
    }
    return map;
  }, [roomSchedules, selectedDate]);

  const updateRoomItem = (
    roomName: string,
    patch: Partial<SupervisorInspectionItem>,
    linkedReportId?: string
  ) => {
    const key = roomName.trim().toUpperCase();
    const nowMs = Date.now();
    setItemsByRoom((prev) => {
      const existing = prev[key];
      const nextItem: SupervisorInspectionItem = {
        roomName,
        status: patch.status ?? existing?.status ?? 'Sesuai',
        score:
          patch.score ??
          existing?.score ??
          (patch.status === 'Perlu Perbaikan' ? 3 : patch.status === 'Temuan Baru' ? 2 : 5),
        notes: patch.notes ?? existing?.notes ?? '',
        checkedAtMs: nowMs,
        checkedAtLabel: formatShortTimeWib(nowMs),
        inspectorName: currentUser.name,
        linkedReportId: linkedReportId ?? existing?.linkedReportId,
      };
      const nextRecord = { ...prev, [key]: nextItem };
      saveLocalSupervisorInspectionDraft(selectedDate, Object.values(nextRecord));
      return nextRecord;
    });
    setHasUnsavedDraft(true);
  };

  const removeRoomItem = (roomName: string) => {
    const key = roomName.trim().toUpperCase();
    setItemsByRoom((prev) => {
      const nextRecord = { ...prev };
      delete nextRecord[key];
      saveLocalSupervisorInspectionDraft(selectedDate, Object.values(nextRecord));
      return nextRecord;
    });
    setHasUnsavedDraft(true);
  };

  const handleMarkReportedRoomsMatch = () => {
    const nowMs = Date.now();
    const timeLabel = formatShortTimeWib(nowMs);
    let added = 0;

    setItemsByRoom((prev) => {
      const nextRecord = { ...prev };
      for (const room of activeRooms) {
        const key = room.name.trim().toUpperCase();
        if (nextRecord[key]) continue;
        const rep = reportByRoomKey.get(key);
        if (rep && rep.kondisiAkhir === 'Bersih') {
          nextRecord[key] = {
            roomName: room.name,
            status: 'Sesuai',
            score: 5,
            notes: 'Kondisi riil sesuai laporan harian',
            checkedAtMs: nowMs,
            checkedAtLabel: timeLabel,
            inspectorName: currentUser.name,
            linkedReportId: rep.id,
          };
          added++;
        }
      }
      if (added > 0) {
        saveLocalSupervisorInspectionDraft(selectedDate, Object.values(nextRecord));
      }
      return nextRecord;
    });

    if (added > 0) {
      setHasUnsavedDraft(true);
      onShowToast(`${added} area yang sudah dilaporkan Bersih ditandai Sesuai (draft lokal).`, 'success');
    } else {
      onShowToast('Tidak ada sisa area berstatus Bersih yang belum dicek.', 'info');
    }
  };

  const handleSaveToCloud = async () => {
    const itemsList = Object.values(itemsByRoom);
    setIsSavingCloud(true);
    try {
      const res = await saveSupervisorInspectionToCloud(selectedDate, itemsList, currentUser);
      if (res.status === 'synced') {
        setHasUnsavedDraft(false);
        setLastSavedAtMs(res.inspection?.updatedAtMs || Date.now());
        setLastFetchedAtMs(Date.now());
        setLoadedFromCache(false);
        onShowToast(
          `Patroli tanggal ${selectedDate} (${itemsList.length} area) tersimpan ke Cloud dalam 1 Write.`,
          'success'
        );
      } else {
        onShowToast(res.message || 'Disimpan sebagai draft lokal.', 'info');
      }
    } finally {
      setIsSavingCloud(false);
    }
  };

  const stats = useMemo(() => {
    const list = Object.values(itemsByRoom);
    const checkedCount = list.length;
    const matchCount = list.filter((i) => i.status === 'Sesuai').length;
    const issueCount = list.filter((i) => i.status !== 'Sesuai').length;
    const avgScore =
      checkedCount > 0
        ? list.reduce((acc, i) => acc + (i.score || 0), 0) / checkedCount
        : 0;
    return { checkedCount, matchCount, issueCount, avgScore };
  }, [itemsByRoom]);

  const filteredRooms = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activeRooms.filter((room) => {
      const key = room.name.trim().toUpperCase();
      const item = itemsByRoom[key];
      const officer =
        reportByRoomKey.get(key)?.namaPetugas || scheduledOfficerByRoomKey.get(key) || '';

      if (statusFilter === 'UNCHECKED' && item) return false;
      if (
        (statusFilter === 'Sesuai' ||
          statusFilter === 'Perlu Perbaikan' ||
          statusFilter === 'Temuan Baru') &&
        item?.status !== statusFilter
      ) {
        return false;
      }

      if (!q) return true;
      return (
        room.name.toLowerCase().includes(q) ||
        (room.zone || '').toLowerCase().includes(q) ||
        officer.toLowerCase().includes(q) ||
        (item?.notes || '').toLowerCase().includes(q)
      );
    });
  }, [activeRooms, itemsByRoom, reportByRoomKey, scheduledOfficerByRoomKey, searchTerm, statusFilter]);

  const handleCopyWhatsappRecap = async () => {
    const checkedItems = Object.values(itemsByRoom);
    if (checkedItems.length === 0) {
      onShowToast('Belum ada ruangan yang dicek pada tanggal ini.', 'info');
      return;
    }
    const lines = [
      `*LAPORAN PATROLI / INSPEKSI SILANG SUPERVISOR SCB*`,
      `Tanggal: ${selectedDate}`,
      `Supervisor: ${currentUser.name}`,
      `Total Area Dicek: ${stats.checkedCount}/${activeRooms.length} (Skor Rata-rata: ${stats.avgScore.toFixed(1)}/5)`,
      `Sesuai: ${stats.matchCount} | Perlu Perbaikan/Temuan: ${stats.issueCount}`,
      '',
      '*Rincian Area:*',
      ...checkedItems.map(
        (item, idx) =>
          `${idx + 1}. ${item.roomName} — *${item.status}* (Skor ${item.score}/5)${
            item.notes ? `\n   Catatan: ${item.notes}` : ''
          }`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSummary(true);
      onShowToast('Rekap patroli berhasil disalin untuk WhatsApp.', 'success');
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      onShowToast('Gagal menyalin otomatis ke clipboard.', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Area Supervisor &amp; Superadmin</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>1 Dokumen per Hari (Mode Hemat Kuota)</span>
            <span aria-hidden="true">·</span>
            <span>
              {hasUnsavedDraft
                ? 'Draft lokal belum dikirim ke Cloud'
                : lastSavedAtMs > 0
                ? `Tersinkron ${formatReadableTimestamp(lastSavedAtMs)}`
                : loadedFromCache && lastFetchedAtMs > 0
                ? 'Cache lokal aktif (0 Read)'
                : 'Siap diisi'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Kartu Inspeksi Silang &amp; Patroli Kebersihan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Audit fisik lapangan untuk membandingkan laporan petugas dengan kondisi riil kamar mandi. Seluruh ruangan pada tanggal yang sama disimpan ke dalam satu dokumen harian.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none tabular-nums"
              aria-label="Pilih tanggal inspeksi"
            />
          </div>

          <button
            type="button"
            disabled={isLoadingCloud}
            onClick={() => loadDateInspection(selectedDate, true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCloud ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsappRecap}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedSummary ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{copiedSummary ? 'Tersalin' : 'Salin Rekap WA'}</span>
          </button>

          <button
            type="button"
            disabled={isSavingCloud}
            onClick={handleSaveToCloud}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
              hasUnsavedDraft
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {isSavingCloud ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>
              {isSavingCloud
                ? 'Menyimpan...'
                : hasUnsavedDraft
                ? 'Simpan Patroli ke Cloud'
                : 'Simpan / Perbarui Cloud'}
            </span>
          </button>
        </div>
      </div>

      {/* Warning if offline / quota limited */}
      {(!isCloudSynced || isFirestoreQuotaLimited) && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <span>
            {isFirestoreQuotaLimited
              ? 'Kuota Firestore harian sedang penuh. Hasil cek lapangan tetap tersimpan aman di draft lokal perangkat Anda.'
              : 'Sesi Cloud belum terhubung. Hasil inspeksi tersimpan lokal dan dapat dikirim ke Cloud setelah login terverifikasi.'}
          </span>
        </div>
      )}

      {/* 4-Column KPI Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">Progres Patroli</p>
          <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-bold text-slate-900">{stats.checkedCount}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {activeRooms.length} area</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tanggal {selectedDate}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-xs text-emerald-700 font-semibold">Sesuai Laporan</p>
          <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-bold text-emerald-700">{stats.matchCount}</span>
            <span className="text-xs text-slate-400 font-semibold">area</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Kebersihan lapangan tervalidasi</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-xs text-amber-700 font-semibold">Perlu Perbaikan / Temuan</p>
          <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-bold text-amber-700">{stats.issueCount}</span>
            <span className="text-xs text-slate-400 font-semibold">area</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Butuh tindak lanjut petugas/sarpras</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-xs text-slate-600 font-semibold">Skor Rata-Rata</p>
          <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-bold text-slate-900">
              {stats.checkedCount > 0 ? stats.avgScore.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-slate-400 font-semibold">/ 5.0</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Penilaian kualitas sanitasi fisik</p>
        </div>
      </div>

      {/* Filter & Quick Helper Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari ruangan, zona, atau petugas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'UNCHECKED', label: 'Belum Dicek' },
                { id: 'Sesuai', label: 'Sesuai' },
                { id: 'Perlu Perbaikan', label: 'Perlu Perbaikan' },
                { id: 'Temuan Baru', label: 'Temuan Baru' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleMarkReportedRoomsMatch}
          className="self-start lg:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Tandai Sisa Area Bersih = Sesuai</span>
        </button>
      </div>

      {/* Checklist Area List */}
      {isLoadingCloud && Object.keys(itemsByRoom).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          <span>Memuat catatan patroli tanggal {selectedDate}...</span>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
          <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">Tidak ada area yang sesuai dengan filter saat ini.</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {filteredRooms.map((room) => {
            const key = room.name.trim().toUpperCase();
            const item = itemsByRoom[key];
            const rep = reportByRoomKey.get(key);
            const scheduledOfficer = scheduledOfficerByRoomKey.get(key);
            const isChecked = Boolean(item);

            return (
              <div
                key={room.id}
                className={`p-4 sm:p-5 transition-colors ${
                  isChecked ? 'bg-white' : 'bg-slate-50/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left: Room Title & Cross-check Info */}
                  <div className="space-y-1.5 lg:w-5/12">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {room.name}
                      </h3>
                      {isChecked && (
                        <button
                          type="button"
                          onClick={() => removeRoomItem(room.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Batalkan cek untuk area ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{room.zone || 'Area Umum'}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Jadwal: {scheduledOfficer || 'Belum dijadwalkan'}
                      </span>
                      {room.isMandatoryDaily && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600 font-medium">Wajib Harian</span>
                        </>
                      )}
                    </div>

                    {/* Officer report comparison (0 reads) */}
                    <div className="pt-1 text-xs">
                      {rep ? (
                        <div className="inline-flex flex-wrap items-center gap-1.5 text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold">Laporan Petugas:</span>
                          <span>{rep.namaPetugas}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{rep.waktu} WIB</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              rep.kondisiAkhir === 'Bersih'
                                ? 'text-emerald-700 font-semibold'
                                : 'text-amber-700 font-semibold'
                            }
                          >
                            {rep.kondisiAkhir}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500">({rep.statusVerifikasi})</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-slate-500">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Belum ada laporan petugas pada tanggal ini</span>
                        </div>
                      )}
                    </div>

                    {item && (
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        Dicek pukul {item.checkedAtLabel} oleh {item.inspectorName}
                      </p>
                    )}
                  </div>

                  {/* Right: Patrol Input Controls */}
                  <div className="lg:w-7/12 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {/* Status segmented selector */}
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
                        {(
                          [
                            { value: 'Sesuai', activeClass: 'bg-emerald-600 text-white shadow-xs' },
                            { value: 'Perlu Perbaikan', activeClass: 'bg-amber-600 text-white shadow-xs' },
                            { value: 'Temuan Baru', activeClass: 'bg-rose-600 text-white shadow-xs' },
                          ] as Array<{ value: SupervisorInspectionStatus; activeClass: string }>
                        ).map((opt) => {
                          const selected = item?.status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                updateRoomItem(
                                  room.name,
                                  {
                                    status: opt.value,
                                    score:
                                      opt.value === 'Sesuai'
                                        ? Math.max(4, item?.score || 5)
                                        : opt.value === 'Perlu Perbaikan'
                                        ? Math.min(3, item?.score || 3)
                                        : 2,
                                  },
                                  rep?.id
                                )
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                selected
                                  ? opt.activeClass
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                              }`}
                            >
                              {opt.value}
                            </button>
                          );
                        })}
                      </div>

                      {/* 1-5 Star Rating */}
                      <div className="flex items-center gap-1 self-start sm:self-center">
                        {[1, 2, 3, 4, 5].map((starVal) => {
                          const active = (item?.score || 0) >= starVal;
                          return (
                            <button
                              key={starVal}
                              type="button"
                              onClick={() =>
                                updateRoomItem(
                                  room.name,
                                  {
                                    score: starVal,
                                    status:
                                      item?.status ??
                                      (starVal >= 4 ? 'Sesuai' : 'Perlu Perbaikan'),
                                  },
                                  rep?.id
                                )
                              }
                              className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              aria-label={`Beri skor ${starVal} dari 5 untuk ${room.name}`}
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  active
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-300'
                                }`}
                              />
                            </button>
                          );
                        })}
                        <span className="ml-1 text-xs font-semibold text-slate-500 tabular-nums">
                          {item ? `${item.score}/5` : '-/5'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Feedback Note Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {QUICK_PATROL_NOTES.map((quickText) => {
                        const isPicked = item?.notes === quickText;
                        return (
                          <button
                            key={quickText}
                            type="button"
                            onClick={() =>
                              updateRoomItem(
                                room.name,
                                {
                                  notes: isPicked ? '' : quickText,
                                  status:
                                    item?.status ??
                                    (quickText === 'Bersih & wangi' ? 'Sesuai' : 'Perlu Perbaikan'),
                                },
                                rep?.id
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                              isPicked
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {quickText}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Note Input */}
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="Catatan lapangan supervisor (opsional)..."
                      value={item?.notes || ''}
                      onChange={(e) =>
                        updateRoomItem(room.name, { notes: e.target.value }, rep?.id)
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
