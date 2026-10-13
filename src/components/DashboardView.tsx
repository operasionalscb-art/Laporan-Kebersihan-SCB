import React, { useState, useMemo } from 'react';
import { CleaningReport, User, KondisiAkhir } from '../types';
import { INITIAL_AREAS, exportReportsToCsv, getTodayDateString } from '../utils/storage';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Wrench, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Calendar, 
  Clock, 
  User as UserIcon, 
  MapPin, 
  Check, 
  Eye, 
  Plus, 
  Trash2, 
  LayoutGrid, 
  List, 
  Sparkles,
  ShieldCheck,
  CheckSquare,
  X,
  ExternalLink,
  Lock,
  UserCheck,
  CheckCheck
} from 'lucide-react';

interface DashboardViewProps {
  reports: CleaningReport[];
  currentUser: User | null;
  officers: User[];
  allUsers?: User[];
  onAddNewReport: () => void;
  onUpdateReport: (id: string, updates: Partial<CleaningReport>) => void;
  onDeleteReport: (id: string) => void;
  onOpenPrintModal: (filteredReports: CleaningReport[]) => void;
  onOpenLoginModal?: (reason?: string, tab?: 'quick_petugas' | 'email_admin') => void;
  onSwitchUser?: (user: User) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reports,
  currentUser,
  officers,
  allUsers = [],
  onAddNewReport,
  onUpdateReport,
  onDeleteReport,
  onOpenPrintModal,
  onOpenLoginModal,
  onSwitchUser,
}) => {
  // Filters state
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [selectedOfficer, setSelectedOfficer] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedKondisi, setSelectedKondisi] = useState<string>('all');
  const [selectedStatusVerifikasi, setSelectedStatusVerifikasi] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Detail Modal
  const [activeReportDetail, setActiveReportDetail] = useState<CleaningReport | null>(null);
  const [supervisorNoteInput, setSupervisorNoteInput] = useState<string>('');
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedModalSupervisorId, setSelectedModalSupervisorId] = useState<string>('');

  // Quick Supervisor Verification Modal for non-logged-in supervisors
  const [quickVerifyTargetReport, setQuickVerifyTargetReport] = useState<{
    report: CleaningReport;
    status: 'Disetujui' | 'Perlu Perbaikan';
  } | null>(null);
  const [selectedQuickSupervisorId, setSelectedQuickSupervisorId] = useState<string>('');
  const [quickSupervisorPin, setQuickSupervisorPin] = useState<string>('');
  const [quickVerifyError, setQuickVerifyError] = useState<string>('');

  const todayStr = getTodayDateString();

  // Supervisor / Admin Detection
  const isSupervisorOrAdmin = useMemo(() => {
    return (
      currentUser?.role === 'supervisor' ||
      currentUser?.role === 'superadmin' ||
      currentUser?.email === 'operasional.scb@gmail.com'
    );
  }, [currentUser]);

  const registeredSupervisors = useMemo(() => {
    const list = (allUsers || []).filter(
      (u) =>
        (u.role === 'supervisor' ||
          u.role === 'superadmin' ||
          u.email === 'operasional.scb@gmail.com') &&
        u.isActive !== false
    );
    if (list.length === 0) {
      return [
        {
          id: 'user-supervisor-1',
          name: 'SUPERVISOR SARPRAS SCB',
          email: 'supervisor@scb.sch.id',
          username: 'supervisor',
          password: 'supervisor123',
          pin: '1234',
          role: 'supervisor' as const,
          phone: '081234567890',
          isActive: true,
          createdAt: '2026-01-05',
          avatarColor: 'from-blue-600 to-indigo-700',
        },
      ];
    }
    return list;
  }, [allUsers]);

  // Verification counts for quick badges
  const verificationCounts = useMemo(() => {
    const pending = reports.filter((r) => r.statusVerifikasi === 'Menunggu').length;
    const approved = reports.filter((r) => r.statusVerifikasi === 'Disetujui').length;
    const needsRepair = reports.filter((r) => r.statusVerifikasi === 'Perlu Perbaikan').length;
    return { pending, approved, needsRepair };
  }, [reports]);

  // Filtered reports logic
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Date filter
      if (dateFilter === 'today' && r.tanggal !== todayStr) return false;
      if (dateFilter === '7days') {
        const diffDays = (Date.now() - r.timestamp) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      if (dateFilter === 'month') {
        const diffDays = (Date.now() - r.timestamp) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      // Officer filter
      if (selectedOfficer !== 'all' && r.namaPetugas !== selectedOfficer) {
        return false;
      }

      // Area filter
      if (selectedArea !== 'all' && r.area !== selectedArea) {
        return false;
      }

      // Kondisi filter
      if (selectedKondisi !== 'all' && r.kondisiAkhir !== selectedKondisi) {
        return false;
      }

      // Status Verifikasi filter
      if (selectedStatusVerifikasi !== 'all' && r.statusVerifikasi !== selectedStatusVerifikasi) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchArea = r.area.toLowerCase().includes(query);
        const matchPetugas = r.namaPetugas.toLowerCase().includes(query);
        const matchKet = (r.keteranganTambahan || '').toLowerCase().includes(query);
        const matchChecklist = r.checklist.some((c) => c.toLowerCase().includes(query));
        if (!matchArea && !matchPetugas && !matchKet && !matchChecklist) {
          return false;
        }
      }

      return true;
    });
  }, [reports, dateFilter, selectedOfficer, selectedArea, selectedKondisi, selectedStatusVerifikasi, searchQuery, todayStr]);

  // Operational KPI calculations for today
  const todayReports = useMemo(() => {
    return reports.filter((r) => r.tanggal === todayStr);
  }, [reports, todayStr]);

  const stats = useMemo(() => {
    const totalToday = todayReports.length;
    const cleanCount = todayReports.filter((r) => r.kondisiAkhir === 'Bersih').length;
    const reviewCount = todayReports.filter((r) => r.kondisiAkhir === 'Perlu Pengecekan Ulang').length;
    const damageCount = todayReports.filter((r) => r.kondisiAkhir === 'Ada Kerusakan').length;

    const cleanPercentage = totalToday > 0 ? Math.round((cleanCount / totalToday) * 100) : 0;

    return { totalToday, cleanCount, reviewCount, damageCount, cleanPercentage };
  }, [todayReports]);

  // Area coverage status for today
  const areaCoverage = useMemo(() => {
    return INITIAL_AREAS.map((areaName) => {
      const reportsForArea = todayReports.filter((r) => r.area === areaName);
      const isCleaned = reportsForArea.length > 0;
      const latestReport = reportsForArea[0]; // sorted newest first
      return {
        areaName,
        isCleaned,
        total: reportsForArea.length,
        latestKondisi: latestReport?.kondisiAkhir,
        latestPetugas: latestReport?.namaPetugas,
        latestWaktu: latestReport?.waktu,
      };
    });
  }, [todayReports]);

  const handleOpenDetail = (report: CleaningReport) => {
    setActiveReportDetail(report);
    setSupervisorNoteInput(report.catatanSupervisor || '');
    if (currentUser?.role === 'supervisor' || currentUser?.role === 'superadmin') {
      setSelectedModalSupervisorId(currentUser.id);
    } else if (registeredSupervisors.length > 0) {
      setSelectedModalSupervisorId(registeredSupervisors[0].id);
    }
  };

  // Direct Execution of Verification
  const handleExecuteVerification = (
    reportId: string,
    status: 'Disetujui' | 'Perlu Perbaikan',
    note?: string,
    customVerifierName?: string
  ) => {
    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    let verifierName = customVerifierName;
    let verifierRole = 'Supervisor';

    if (!verifierName) {
      if (currentUser) {
        verifierName = currentUser.name;
        verifierRole = currentUser.role === 'superadmin' ? 'Superadmin' : 'Supervisor';
      } else {
        const firstSup = registeredSupervisors[0];
        verifierName = firstSup ? firstSup.name : 'SUPERVISOR SARPRAS SCB';
        verifierRole = 'Supervisor';
      }
    } else {
      const foundUser = (allUsers || []).find((u) => u.name === verifierName);
      if (foundUser) {
        verifierRole = foundUser.role === 'superadmin' ? 'Superadmin' : 'Supervisor';
      } else if (currentUser?.role === 'superadmin') {
        verifierRole = 'Superadmin';
      }
    }

    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    const nowDate = getTodayDateString();

    const noteToSave = note !== undefined ? note : (supervisorNoteInput.trim() || report.catatanSupervisor || '');

    const updates: Partial<CleaningReport> = {
      statusVerifikasi: status,
      catatanSupervisor: noteToSave,
      diverifikasiOleh: `${verifierName} (${verifierRole})`,
      diverifikasiPada: `${nowDate} ${nowTime} WIB`,
    };

    onUpdateReport(reportId, updates);

    if (activeReportDetail && activeReportDetail.id === reportId) {
      setActiveReportDetail({
        ...activeReportDetail,
        ...updates,
      });
    }
  };

  // Direct 1-Click Verification Trigger from Cards / Table
  const handleDirectCardVerify = (
    report: CleaningReport,
    status: 'Disetujui' | 'Perlu Perbaikan'
  ) => {
    if (isSupervisorOrAdmin && currentUser) {
      // Supervisor is already logged in, directly verify without prompt!
      handleExecuteVerification(report.id, status, undefined, currentUser.name);
    } else {
      // Prompt quick supervisor login modal with registered accounts
      setQuickVerifyTargetReport({ report, status });
      const firstSupervisor = registeredSupervisors[0];
      if (firstSupervisor) {
        setSelectedQuickSupervisorId(firstSupervisor.id);
      }
      setQuickSupervisorPin('');
      setQuickVerifyError('');
    }
  };

  // Verification triggered inside Detail Modal
  const handleVerifyReport = (status: 'Disetujui' | 'Perlu Perbaikan') => {
    if (!activeReportDetail) return;

    if (isSupervisorOrAdmin && currentUser) {
      // Direct verification using logged-in supervisor account
      handleExecuteVerification(
        activeReportDetail.id,
        status,
        supervisorNoteInput.trim() || undefined,
        currentUser.name
      );
    } else {
      // Direct verification using selected registered supervisor account
      const selectedSup =
        registeredSupervisors.find((s) => s.id === selectedModalSupervisorId) ||
        registeredSupervisors[0];

      if (selectedSup) {
        if (onSwitchUser) {
          onSwitchUser(selectedSup);
        }
        handleExecuteVerification(
          activeReportDetail.id,
          status,
          supervisorNoteInput.trim() || undefined,
          selectedSup.name
        );
      } else {
        handleExecuteVerification(
          activeReportDetail.id,
          status,
          supervisorNoteInput.trim() || undefined,
          'SUPERVISOR SARPRAS SCB'
        );
      }
    }
  };

  // Confirm Quick Supervisor Verify for non-logged in users
  const handleConfirmQuickSupervisorVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVerifyTargetReport) return;

    const supervisorUser = registeredSupervisors.find(
      (u) => u.id === selectedQuickSupervisorId
    );

    if (!supervisorUser) {
      setQuickVerifyError('Pilih akun supervisor terlebih dahulu.');
      return;
    }

    // Switch active user to supervisor so session remains active
    if (onSwitchUser) {
      onSwitchUser(supervisorUser);
    }

    // Execute verification immediately with supervisor name
    handleExecuteVerification(
      quickVerifyTargetReport.report.id,
      quickVerifyTargetReport.status,
      undefined,
      supervisorUser.name
    );

    setQuickVerifyTargetReport(null);
  };

  // Bulk approve all pending reports by Supervisor
  const handleBulkApprovePending = () => {
    const pendingList = reports.filter((r) => r.statusVerifikasi === 'Menunggu');
    if (pendingList.length === 0) return;

    if (!confirm(`Setujui sekaligus seluruh ${pendingList.length} laporan kebersihan yang menunggu persetujuan supervisor?`)) {
      return;
    }

    const verifierName = currentUser?.name || registeredSupervisors[0]?.name || 'SUPERVISOR SARPRAS SCB';
    const verifierRole = currentUser?.role === 'superadmin' ? 'Superadmin' : 'Supervisor';
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    const nowDate = getTodayDateString();

    for (const rep of pendingList) {
      onUpdateReport(rep.id, {
        statusVerifikasi: 'Disetujui',
        diverifikasiOleh: `${verifierName} (${verifierRole})`,
        diverifikasiPada: `${nowDate} ${nowTime} WIB`,
      });
    }
  };

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.email === 'operasional.scb@gmail.com';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Monitoring Operasional
            </span>
            <span className="text-xs text-slate-500">
              Update Terkini: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Dashboard Laporan Kebersihan Kamar Mandi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Sekolah Cendekia BAZNAS (SCB) • Pemantauan harian sanitasi dan fasilitas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenPrintModal(filteredReports)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition-colors"
            title="Cetak format A4 untuk rekap harian/mingguan"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak Rekap</span>
          </button>

          <button
            onClick={() => exportReportsToCsv(filteredReports)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition-colors"
            title="Download data laporan dalam format CSV/Excel"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={onAddNewReport}
            className={`flex items-center space-x-1.5 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all ${
              currentUser
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            {currentUser ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-emerald-700" />}
            <span>{currentUser ? 'Input Laporan Baru' : 'Input Laporan (Kunci Petugas)'}</span>
          </button>
        </div>
      </div>

      {/* Guest Notice Callout if non-user */}
      {!currentUser && (
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-950 text-sm">Mode Tamu / Non-User Aktif (Hanya Melihat Dashboard)</p>
              <p className="text-emerald-800 text-xs mt-0.5">
                Anda hanya dapat memantau data kebersihan, melihat foto dokumentasi, dan mencetak rekap. Fitur pengisian laporan terkunci khusus akun Petugas.
              </p>
            </div>
          </div>
          <button
            onClick={onAddNewReport}
            className="self-start sm:self-auto shrink-0 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Masuk Akun Petugas</span>
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Laporan Hari Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats.totalToday}
            </span>
            <span className="text-xs text-slate-500">laporan masuk</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            {stats.cleanPercentage}% area berkondisi bersih
          </p>
        </div>

        {/* Bersih */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kondisi Bersih
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stats.cleanCount}
            </span>
            <span className="text-xs text-slate-500">lokasi</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Siap & nyaman digunakan santri/staf
          </p>
        </div>

        {/* Perlu Pengecekan */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Perlu Pengecekan
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">
              {stats.reviewCount}
            </span>
            <span className="text-xs text-slate-500">lokasi</span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">
            {stats.reviewCount > 0 ? 'Perlu follow-up perlengkapan' : 'Tidak ada antrean'}
          </p>
        </div>

        {/* Ada Kerusakan */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ada Kerusakan
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-600">
              {stats.damageCount}
            </span>
            <span className="text-xs text-slate-500">fasilitas</span>
          </div>
          <p className="text-[11px] text-rose-700 font-medium mt-1">
            {stats.damageCount > 0 ? 'Perlu tindakan tim Sarpras' : 'Semua fasilitas prima'}
          </p>
        </div>
      </div>

      {/* Operational Area Coverage Status Bar (Interactive overview of the 6 areas) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Cakupan Area Hari Ini (Standar 6 Titik Kamar Mandi SCB)
            </h2>
            <p className="text-xs text-slate-500">
              Status pembersihan titik utama kamar mandi Sekolah Cendekia BAZNAS pada hari ini
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full shrink-0">
            {areaCoverage.filter((a) => a.isCleaned).length} dari {INITIAL_AREAS.length} Titik Tercover
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {areaCoverage.map((area) => (
            <div
              key={area.areaName}
              onClick={() => setSelectedArea(area.areaName)}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                selectedArea === area.areaName
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50'
                  : area.isCleaned
                  ? 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800 truncate pr-1">
                  {area.areaName}
                </span>
                {area.isCleaned ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                )}
              </div>

              {area.isCleaned ? (
                <div className="space-y-0.5 text-[11px]">
                  <p className="text-slate-500 truncate">Oleh: {area.latestPetugas}</p>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-slate-400">{area.latestWaktu} WIB</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        area.latestKondisi === 'Bersih'
                          ? 'bg-emerald-100 text-emerald-800'
                          : area.latestKondisi === 'Ada Kerusakan'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {area.latestKondisi === 'Ada Kerusakan' ? 'Rusak' : area.latestKondisi === 'Bersih' ? 'Bersih' : 'Cek'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Belum dilaporkan</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari laporan (nama petugas, area, catatan kerusakan)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date range filter tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start md:self-auto text-xs font-medium">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateFilter === 'today'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setDateFilter('7days')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateFilter === '7days'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateFilter === 'month'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateFilter === 'all'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
          </div>

          {/* View mode toggle (Grid vs Table) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-slate-600">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
              }`}
              title="Tampilan Grid Kartu"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
              }`}
              title="Tampilan Tabel"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Officer filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter Petugas:
            </label>
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Semua Petugas</option>
              {['IDAY M YUSUF', 'ABDUL KODIR', 'WAHYUDIN'].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {officers
                .filter((o) => !['IDAY M YUSUF', 'ABDUL KODIR', 'WAHYUDIN'].includes(o.name))
                .map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Area filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter Area:
            </label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Semua Area</option>
              {INITIAL_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          {/* Kondisi filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter Kondisi Akhir:
            </label>
            <select
              value={selectedKondisi}
              onChange={(e) => setSelectedKondisi(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Semua Kondisi</option>
              <option value="Bersih">Bersih</option>
              <option value="Perlu Pengecekan Ulang">Perlu Pengecekan Ulang</option>
              <option value="Ada Kerusakan">Ada Kerusakan</option>
            </select>
          </div>

          {/* Status Verifikasi filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Status Verifikasi:
            </label>
            <select
              value={selectedStatusVerifikasi}
              onChange={(e) => setSelectedStatusVerifikasi(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="all">Semua Status Verifikasi</option>
              <option value="Menunggu">⏳ Menunggu ({verificationCounts.pending})</option>
              <option value="Disetujui">✅ Disetujui ({verificationCounts.approved})</option>
              <option value="Perlu Perbaikan">⚠️ Perlu Perbaikan ({verificationCounts.needsRepair})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Supervisor Mode Active Banner */}
      {isSupervisorOrAdmin && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Wewenang Persetujuan Laporan (Level Supervisor Aktif)</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] uppercase">
                  {currentUser?.role === 'superadmin' ? 'Super Admin' : 'Supervisor Sarpras SCB'}
                </span>
              </div>
              <p className="text-slate-600 mt-0.5">
                Masuk sebagai: <strong className="text-blue-900">{currentUser?.name}</strong>. Anda memiliki wewenang penuh level supervisor untuk menyetujui hasil kebersihan atau meminta perbaikan ulang.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {verificationCounts.pending > 0 && (
              <>
                <button
                  onClick={() => setSelectedStatusVerifikasi('Menunggu')}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{verificationCounts.pending} Menunggu Persetujuan</span>
                </button>
                <button
                  onClick={handleBulkApprovePending}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                  title="Setujui sekaligus seluruh laporan yang berstatus Menunggu"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Setujui Semua ({verificationCounts.pending})</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filter status indicator & reset */}
      {(selectedOfficer !== 'all' || selectedArea !== 'all' || selectedKondisi !== 'all' || selectedStatusVerifikasi !== 'all' || searchQuery || dateFilter !== 'today') && (
        <div className="flex items-center justify-between text-xs text-slate-600 bg-emerald-50/60 border border-emerald-100 px-3.5 py-2 rounded-xl">
          <span>
            Menampilkan <strong className="text-emerald-800">{filteredReports.length}</strong> laporan sesuai filter
          </span>
          <button
            onClick={() => {
              setSelectedOfficer('all');
              setSelectedArea('all');
              setSelectedKondisi('all');
              setSelectedStatusVerifikasi('all');
              setSearchQuery('');
              setDateFilter('today');
            }}
            className="text-emerald-700 font-bold hover:underline"
          >
            Reset Semua Filter
          </button>
        </div>
      )}

      {/* Reports Display: Grid View or Table View */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Tidak ada laporan ditemukan
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Coba sesuaikan tanggal atau pilihan filter Anda, atau buat laporan baru sekarang.
          </p>
          <button
            onClick={onAddNewReport}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl"
          >
            + Input Laporan Baru
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              {/* Card Photo Preview */}
              <div
                className="relative aspect-16/9 bg-slate-100 cursor-pointer group overflow-hidden"
                onClick={() => handleOpenDetail(report)}
              >
                {report.fotoBukti && report.fotoBukti.length > 0 ? (
                  <img
                    src={report.fotoBukti[0]}
                    alt={`Bukti ${report.area}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                    Tidak ada foto
                  </div>
                )}

                {/* Status Badges Overlay */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs ${
                      report.kondisiAkhir === 'Bersih'
                        ? 'bg-emerald-600 text-white'
                        : report.kondisiAkhir === 'Ada Kerusakan'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {report.kondisiAkhir}
                  </span>
                </div>

                <div className="absolute top-2.5 right-2.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${
                      report.statusVerifikasi === 'Disetujui'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : report.statusVerifikasi === 'Perlu Perbaikan'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-slate-900/80 text-white border-transparent'
                    }`}
                  >
                    {report.statusVerifikasi}
                  </span>
                </div>

                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  {report.fotoBukti.length} Foto
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">
                      {report.area}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <strong className="text-slate-700">{report.namaPetugas}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {report.tanggal} {report.waktu}
                    </span>
                  </div>

                  {/* Checklist Pills */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {report.checklist.slice(0, 3).map((item, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                      >
                        ✓ {item}
                      </span>
                    ))}
                    {report.checklist.length > 3 && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                        +{report.checklist.length - 3} lagi
                      </span>
                    )}
                  </div>

                  {/* Keterangan */}
                  {report.keteranganTambahan && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2 mb-3">
                      <strong className="text-slate-700">Catatan:</strong> {report.keteranganTambahan}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  <button
                    onClick={() => handleOpenDetail(report)}
                    className="flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Detail</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {report.statusVerifikasi === 'Menunggu' ? (
                      <>
                        <button
                          onClick={() => handleDirectCardVerify(report, 'Disetujui')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-xs flex items-center gap-1 transition-colors"
                          title="Setujui laporan langsung sesuai akun terdaftar"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Setujui</span>
                        </button>
                        <button
                          onClick={() => handleDirectCardVerify(report, 'Perlu Perbaikan')}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] border border-rose-200 flex items-center gap-1 transition-colors"
                          title="Minta perbaikan langsung sesuai akun terdaftar"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Perbaikan</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Oleh: <strong>{report.diverifikasiOleh?.split(' ')[0] || 'Supervisor'}</strong>
                      </span>
                    )}

                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          if (confirm(`Hapus laporan ${report.area} oleh ${report.namaPetugas}?`)) {
                            onDeleteReport(report.id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Hapus Laporan (Admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4">Area Kamar Mandi</th>
                  <th className="py-3 px-4">Kondisi Akhir</th>
                  <th className="py-3 px-4">Checklist Lengkap</th>
                  <th className="py-3 px-4">Keterangan / Temuan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{report.waktu} WIB</div>
                      <div className="text-[10px] text-slate-400">{report.tanggal}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900">
                      {report.namaPetugas}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{report.area}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                          report.kondisiAkhir === 'Bersih'
                            ? 'bg-emerald-100 text-emerald-800'
                            : report.kondisiAkhir === 'Ada Kerusakan'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {report.kondisiAkhir}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px] truncate">
                      {report.checklist.join(', ')}
                    </td>
                    <td className="py-3 px-4 max-w-[220px] truncate text-slate-600">
                      {report.keteranganTambahan || '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          report.statusVerifikasi === 'Disetujui'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : report.statusVerifikasi === 'Perlu Perbaikan'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {report.statusVerifikasi}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {report.statusVerifikasi === 'Menunggu' && (
                          <>
                            <button
                              onClick={() => handleDirectCardVerify(report, 'Disetujui')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors shadow-xs"
                              title="Setujui langsung sesuai akun terdaftar"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Setujui</span>
                            </button>
                            <button
                              onClick={() => handleDirectCardVerify(report, 'Perlu Perbaikan')}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-[11px] border border-rose-200 transition-colors"
                              title="Minta perbaikan langsung sesuai akun terdaftar"
                            >
                              Perbaikan
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleOpenDetail(report)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-colors"
                        >
                          Detail
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => {
                              if (confirm(`Hapus laporan ${report.area}?`)) {
                                onDeleteReport(report.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL WITH SUPERVISOR VERIFICATION */}
      {activeReportDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Detail Laporan Kebersihan
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeReportDetail.statusVerifikasi === 'Disetujui'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeReportDetail.statusVerifikasi === 'Perlu Perbaikan'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Verifikasi: {activeReportDetail.statusVerifikasi}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {activeReportDetail.area}
                </h3>
              </div>
              <button
                onClick={() => setActiveReportDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm">
              {/* Primary Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Petugas</span>
                  <strong className="text-slate-900 text-sm">{activeReportDetail.namaPetugas}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Waktu Lapor</span>
                  <strong className="text-slate-900 text-sm">
                    {activeReportDetail.tanggal} • {activeReportDetail.waktu}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Kondisi Akhir</span>
                  <span
                    className={`inline-block font-bold mt-0.5 px-2 py-0.5 rounded text-[11px] ${
                      activeReportDetail.kondisiAkhir === 'Bersih'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeReportDetail.kondisiAkhir === 'Ada Kerusakan'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeReportDetail.kondisiAkhir}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Bukti Foto</span>
                  <strong className="text-slate-900 text-sm">
                    {activeReportDetail.fotoBukti?.length || 0} Terlampir
                  </strong>
                </div>
              </div>

              {/* Photo Evidence Gallery */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Foto Bukti Kegiatan</span>
                  <span className="text-slate-400 font-normal">Klik untuk perbesar</span>
                </h4>
                {activeReportDetail.fotoBukti && activeReportDetail.fotoBukti.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {activeReportDetail.fotoBukti.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedImagePreview(url)}
                        className="aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity relative group"
                      >
                        <img
                          src={url}
                          alt="Foto bukti"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                          Perbesar Foto
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Tidak ada foto dilampirkan.</p>
                )}
              </div>

              {/* Checklist details */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Checklist Kebersihan Terpenuhi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeReportDetail.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs font-medium"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Keterangan Tambahan */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                  Keterangan Tambahan / Catatan Petugas
                </h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  {activeReportDetail.keteranganTambahan || 'Tidak ada catatan tambahan.'}
                </div>
              </div>

              {/* Supervisor Approval Box */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Persetujuan Laporan Kebersihan (Level Supervisor)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Kendali mutu & evaluasi resmi kebersihan fasilitas Sekolah Cendekia BAZNAS
                    </p>
                  </div>
                  {activeReportDetail.diverifikasiOleh && (
                    <span className="text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 self-start sm:self-auto shrink-0">
                      Disetujui: <strong>{activeReportDetail.diverifikasiOleh}</strong> ({activeReportDetail.diverifikasiPada})
                    </span>
                  )}
                </div>

                {/* Verifier Identity Indicator / Registered Account Selection */}
                {isSupervisorOrAdmin && currentUser ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                          Level Akun Berwenang: Supervisor Aktif
                        </span>
                        <span>
                          <strong>{currentUser.name}</strong> ({currentUser.role === 'superadmin' ? 'Super Admin' : 'Supervisor Sarpras SCB'})
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-xs">
                      Persetujuan Siap
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between text-blue-900 font-bold">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        Persetujuan Laporan: Khusus Akun Level Supervisor
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                        Wewenang Supervisor
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Persetujuan dan evaluasi laporan adalah wewenang resmi level <strong>Supervisor Sarpras</strong>. Pilih akun supervisor terdaftar untuk mengesahkan laporan:
                    </p>
                    <select
                      value={selectedModalSupervisorId || (registeredSupervisors[0]?.id || '')}
                      onChange={(e) => setSelectedModalSupervisorId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                    >
                      {registeredSupervisors.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.role === 'superadmin' ? 'Superadmin' : 'Supervisor'}) • {sup.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Catatan Evaluasi Supervisor / Arahan Perbaikan:
                  </label>
                  <input
                    type="text"
                    value={supervisorNoteInput}
                    onChange={(e) => setSupervisorNoteInput(e.target.value)}
                    placeholder="Contoh: Sudah bersih sesuai standar, mohon pastikan keset selalu kering..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleVerifyReport('Disetujui')}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui Laporan (Sesuai Standar)</span>
                  </button>

                  <button
                    onClick={() => handleVerifyReport('Perlu Perbaikan')}
                    className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Minta Perbaikan Ulang</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setActiveReportDetail(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SUPERVISOR VERIFICATION MODAL */}
      {quickVerifyTargetReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-sm sm:text-base">
                  Persetujuan Laporan (Level Supervisor Terdaftar)
                </h3>
              </div>
              <button
                onClick={() => setQuickVerifyTargetReport(null)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmQuickSupervisorVerify} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Area Kamar Mandi:</span>
                  <strong className="text-slate-900">{quickVerifyTargetReport.report.area}</strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Petugas Pelaksana:</span>
                  <strong className="text-slate-900">{quickVerifyTargetReport.report.namaPetugas}</strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Status Keputusan:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      quickVerifyTargetReport.status === 'Disetujui'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {quickVerifyTargetReport.status === 'Disetujui'
                      ? '✓ Setujui (Sesuai Standar)'
                      : '⚠️ Minta Perbaikan Ulang'}
                  </span>
                </div>
              </div>

              {quickVerifyError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {quickVerifyError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Akun Supervisor / Verifikator Terdaftar:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {registeredSupervisors.map((sup) => (
                    <label
                      key={sup.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                        selectedQuickSupervisorId === sup.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="quick_supervisor"
                          checked={selectedQuickSupervisorId === sup.id}
                          onChange={() => setSelectedQuickSupervisorId(sup.id)}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{sup.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {sup.email} • {sup.role === 'superadmin' ? 'Superadmin' : 'Supervisor Sarpras'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                        Terdaftar
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickVerifyTargetReport(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sahkan Persetujuan Sebagai Supervisor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {selectedImagePreview && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImagePreview(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={selectedImagePreview}
              alt="Bukti foto resolusi tinggi"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
