import React, { useState, useMemo, useEffect } from 'react';
import { CleaningReport, User, KondisiAkhir, MasterRoom, RoomSchedule } from '../types';
import { INITIAL_AREAS, exportReportsToCsv, getTodayDateString } from '../utils/storage';
import { getDayIndex } from '../utils/formStorage';
import { downloadReportsPdf } from '../utils/pdfExport';
import { extractGoogleDriveFileId, getGoogleDriveImageCandidates } from '../utils/imageCompressor';
import { doesReportNeedPhotoHydration } from '../services/firestoreSync';
import {
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Search,
  Download,
  Printer,
  FileDown,
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
  ShieldCheck,
  X,
  Lock,
  CheckCheck,
  BarChart2,
  Sun,
  Moon,
  Activity,
  AlertOctagon,
  ArrowRight,
  Target,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  CalendarRange,
  Building2,
  SlidersHorizontal,
  RotateCcw,
  ExternalLink,
  ImageOff,
  Camera,
} from 'lucide-react';

export function formatMonthIndo(yearMonth: string): string {
  if (!yearMonth) return '';
  const [y, m] = yearMonth.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const monthIdx = parseInt(m, 10) - 1;
  return `${monthNames[monthIdx] || m} ${y}`;
}

export function shiftMonth(yearMonth: string, delta: number): string {
  if (!yearMonth) return '';
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
}

const isTestAreaName = (name?: string) =>
  /^(test|tes|testing|coba|dummy|sample|other)$/i.test((name || '').trim());

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ReportPhotoImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  compact?: boolean;
}> = ({ src, alt, className = '', compact = false }) => {
  const candidates = useMemo(() => getGoogleDriveImageCandidates(src), [src]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCandidateIdx(0);
    setFailed(false);
  }, [src]);

  if (failed || candidates.length === 0) {
    const isExternalUrl = !!extractGoogleDriveFileId(src) || src.startsWith('http');
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 text-center ${
          compact ? 'p-3 gap-1.5' : 'p-6 gap-2.5 min-w-[260px] min-h-[180px] rounded-xl bg-slate-900 text-slate-200'
        }`}
      >
        <ImageOff className={compact ? 'w-5 h-5 text-slate-400' : 'w-8 h-8 text-slate-400'} />
        <span className={compact ? 'text-[11px] font-medium leading-tight' : 'text-xs font-medium'}>
          {isExternalUrl ? 'Pratinjau foto Google Drive dibatasi' : 'Foto tidak dapat dimuat'}
        </span>
        {isExternalUrl && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 font-semibold underline ${
              compact ? 'text-[11px] text-emerald-700 hover:text-emerald-900' : 'text-xs text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <ExternalLink className="w-3 h-3" />
            <span>Buka Foto di Google Drive</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <img
      src={candidates[candidateIdx]}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        if (candidateIdx < candidates.length - 1) {
          setCandidateIdx((prev) => prev + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
};

interface DashboardViewProps {
  reports: CleaningReport[];
  currentUser: User | null;
  officers: User[];
  allUsers?: User[];
  masterRooms?: MasterRoom[];
  roomSchedules?: RoomSchedule[];
  onAddNewReport: (areaName?: string) => void;
  onUpdateReport: (id: string, updates: Partial<CleaningReport>) => void;
  onDeleteReport: (id: string) => void;
  onOpenPrintModal: (filteredReports: CleaningReport[], periodeLabel?: string) => void;
  onOpenLoginModal?: (reason?: string, tab?: string) => void;
  onSwitchUser?: (user: User) => void;
  isFirestoreQuotaLimited?: boolean;
  onLoadOlderReports?: () => Promise<{ loadedCount: number; quotaExceeded?: boolean }>;
  onLoadReportPhotos?: (reportId: string) => Promise<string[] | null>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reports,
  currentUser,
  officers,
  allUsers = [],
  masterRooms = [],
  roomSchedules = [],
  onAddNewReport,
  onUpdateReport,
  onDeleteReport,
  onOpenPrintModal,
  onOpenLoginModal,
  isFirestoreQuotaLimited = false,
  onLoadOlderReports,
  onLoadReportPhotos,
}) => {
  // Filters state
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'specific_month' | 'all'>('today');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getTodayDateString().slice(0, 7));
  const [selectedOfficer, setSelectedOfficer] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedKondisi, setSelectedKondisi] = useState<string>('all');
  const [selectedStatusVerifikasi, setSelectedStatusVerifikasi] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Target chart view mode: 'rooms' | 'weekly' | 'monthly'
  const [targetChartView, setTargetChartView] = useState<'rooms' | 'weekly' | 'monthly'>('rooms');

  // Room Analytics Dashboard state
  const [roomTimeRange, setRoomTimeRange] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [roomSortBy, setRoomSortBy] = useState<'cleanRate' | 'reports' | 'issues'>('cleanRate');
  const [selectedRoomForDetail, setSelectedRoomForDetail] = useState<string>('KM MASJID PUTRA');

  // Detail Modal
  const [activeReportDetail, setActiveReportDetail] = useState<CleaningReport | null>(null);
  const currentDetailReport = useMemo(
    () => (activeReportDetail ? reports.find((r) => r.id === activeReportDetail.id) || activeReportDetail : null),
    [activeReportDetail, reports]
  );
  const [supervisorNoteInput, setSupervisorNoteInput] = useState<string>('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedModalSupervisorId, setSelectedModalSupervisorId] = useState<string>('');
  const [loadingPhotosReportId, setLoadingPhotosReportId] = useState<string | null>(null);
  const [isLoadingOlderReports, setIsLoadingOlderReports] = useState<boolean>(false);
  const [hasRequestedOlderReports, setHasRequestedOlderReports] = useState<boolean>(false);

  // Target chart inspected date (null = today)
  const [inspectedTargetDate, setInspectedTargetDate] = useState<string | null>(null);

  // In-place notification toast
  const [approvalToast, setApprovalToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showApprovalToast = (message: string, type: 'success' | 'info' = 'success') => {
    setApprovalToast({ message, type });
    setTimeout(() => {
      setApprovalToast(null);
    }, 3500);
  };

  const todayStr = getTodayDateString();

  // Top Export PDF Period Filter State (Month & Year)
  const [pdfFilterMonth, setPdfFilterMonth] = useState<string>(() => getTodayDateString().slice(5, 7));
  const [pdfFilterYear, setPdfFilterYear] = useState<string>(() => getTodayDateString().slice(0, 4));

  const pdfAvailableYears = useMemo(() => {
    const yearsSet = new Set<string>([todayStr.slice(0, 4)]);
    reports.forEach((r) => {
      if (r.tanggal && r.tanggal.length >= 4) {
        yearsSet.add(r.tanggal.slice(0, 4));
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [reports, todayStr]);

  const pdfFilteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (!r.tanggal) return false;
      if (pdfFilterYear !== 'all' && r.tanggal.slice(0, 4) !== pdfFilterYear) return false;
      if (pdfFilterMonth !== 'all' && r.tanggal.slice(5, 7) !== pdfFilterMonth) return false;
      return true;
    });
  }, [reports, pdfFilterYear, pdfFilterMonth]);

  const pdfPeriodeMeta = useMemo(() => {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const monthLabel =
      pdfFilterMonth === 'all'
        ? 'Semua Bulan'
        : monthNames[parseInt(pdfFilterMonth, 10) - 1] || pdfFilterMonth;
    if (pdfFilterMonth !== 'all' && pdfFilterYear !== 'all') {
      return {
        label: `${monthLabel} ${pdfFilterYear}`,
        fileName: `Rekap_Kebersihan_SCB_${pdfFilterYear}-${pdfFilterMonth}.pdf`,
      };
    }
    if (pdfFilterMonth === 'all' && pdfFilterYear !== 'all') {
      return {
        label: `Tahun ${pdfFilterYear} (Semua Bulan)`,
        fileName: `Rekap_Kebersihan_SCB_Tahun_${pdfFilterYear}.pdf`,
      };
    }
    if (pdfFilterMonth !== 'all' && pdfFilterYear === 'all') {
      return {
        label: `Bulan ${monthLabel} (Semua Tahun)`,
        fileName: `Rekap_Kebersihan_SCB_Bulan_${pdfFilterMonth}.pdf`,
      };
    }
    return {
      label: 'Semua Periode',
      fileName: 'Rekap_Kebersihan_SCB_Semua_Periode.pdf',
    };
  }, [pdfFilterMonth, pdfFilterYear]);

  // Active & mandatory room lists (synced with Master Rooms, excluding test entries)
  const activeRoomsList = useMemo(() => {
    if (masterRooms && masterRooms.length > 0) {
      const valid = masterRooms
        .filter((r) => r.isActive !== false && r.name && !isTestAreaName(r.name))
        .map((r) => r.name.trim());
      if (valid.length > 0) return Array.from(new Set(valid));
    }
    return INITIAL_AREAS;
  }, [masterRooms]);

  const mandatoryRoomsList = useMemo(() => {
    if (masterRooms && masterRooms.length > 0) {
      const activeMandatory = masterRooms.filter(
        (r) => r.isActive !== false && r.isMandatoryDaily !== false && r.name && !isTestAreaName(r.name)
      );
      if (activeMandatory.length > 0) return Array.from(new Set(activeMandatory.map((r) => r.name.trim())));
    }
    return INITIAL_AREAS;
  }, [masterRooms]);

  // Helper to determine if an issue report has received follow-up or resolution
  const isReportFollowedUp = (report: CleaningReport, allReports: CleaningReport[]) => {
    if (report.statusVerifikasi === 'Disetujui') return true;
    const newerCleanReport = allReports.find((r) => {
      const isSameArea = r.isAreaOther
        ? (r.areaCustom || '').trim().toLowerCase() === (report.areaCustom || '').trim().toLowerCase()
        : r.area === report.area;
      return (
        isSameArea &&
        r.id !== report.id &&
        (r.timestamp > report.timestamp || (r.tanggal === report.tanggal && r.waktu > report.waktu)) &&
        r.kondisiAkhir === 'Bersih'
      );
    });
    return !!newerCleanReport;
  };

  // Quick category filter
  const [quickTagFilter, setQuickTagFilter] = useState<'all' | 'unresolved' | 'pending_approval' | 'clean' | 'damage'>('all');

  const isSupervisorOrAdmin = useMemo(() => {
    return (
      currentUser?.role === 'supervisor' ||
      currentUser?.role === 'superadmin' ||
      currentUser?.email === 'operasional.scb@gmail.com'
    );
  }, [currentUser]);

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.email === 'operasional.scb@gmail.com';

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
          id: 'user-supervisor-windi',
          name: 'WINDI',
          email: 'operasional.ga2022@gmail.com',
          username: 'windi',
          password: 'supervisor123',
          pin: '1234',
          role: 'supervisor' as const,
          isActive: true,
          createdAt: '2026-09-29',
          avatarColor: 'from-emerald-600 to-teal-700',
        },
      ];
    }
    return list;
  }, [allUsers]);

  const verificationCounts = useMemo(() => {
    const pending = reports.filter((r) => r.statusVerifikasi === 'Menunggu').length;
    const approved = reports.filter((r) => r.statusVerifikasi === 'Disetujui').length;
    const needsRepair = reports.filter((r) => r.statusVerifikasi === 'Perlu Perbaikan').length;
    return { pending, approved, needsRepair };
  }, [reports]);

  const todayReports = useMemo(() => {
    return reports.filter((r) => r.tanggal === todayStr);
  }, [reports, todayStr]);

  const unresolvedIssuesList = useMemo(() => {
    return reports.filter(
      (r) =>
        (r.kondisiAkhir === 'Ada Kerusakan' || r.kondisiAkhir === 'Perlu Pengecekan Ulang') &&
        !isReportFollowedUp(r, reports)
    );
  }, [reports]);

  // Dynamic officer options for dropdowns (strictly active Petugas Kebersihan accounts)
  const availableOfficerNames = useMemo(() => {
    const set = new Set<string>();
    (officers || []).forEach((o) => {
      if (o.isActive !== false && o.role === 'petugas' && o.name) set.add(o.name);
    });
    (allUsers || []).forEach((u) => {
      if (u.isActive !== false && u.role === 'petugas' && u.name) set.add(u.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [officers, allUsers]);

  // Filtered reports logic
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (dateFilter === 'today' && r.tanggal !== todayStr) return false;
      if (dateFilter === '7days') {
        const diffDays = (Date.now() - r.timestamp) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      if (dateFilter === 'month') {
        const currentMonthPrefix = todayStr.slice(0, 7);
        if (!r.tanggal || !r.tanggal.startsWith(currentMonthPrefix)) return false;
      }
      if (dateFilter === 'specific_month') {
        if (!r.tanggal || !r.tanggal.startsWith(selectedMonth)) return false;
      }

      if (quickTagFilter === 'unresolved' && !(r.kondisiAkhir !== 'Bersih' && !isReportFollowedUp(r, reports))) {
        return false;
      }
      if (quickTagFilter === 'pending_approval' && r.statusVerifikasi !== 'Menunggu') {
        return false;
      }
      if (quickTagFilter === 'clean' && r.kondisiAkhir !== 'Bersih') {
        return false;
      }
      if (quickTagFilter === 'damage' && r.kondisiAkhir !== 'Ada Kerusakan') {
        return false;
      }

      if (selectedOfficer !== 'all' && r.namaPetugas !== selectedOfficer) {
        return false;
      }

      if (selectedArea !== 'all' && r.area !== selectedArea) {
        return false;
      }

      if (selectedKondisi !== 'all' && r.kondisiAkhir !== selectedKondisi) {
        return false;
      }

      if (selectedStatusVerifikasi !== 'all' && r.statusVerifikasi !== selectedStatusVerifikasi) {
        return false;
      }

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
  }, [
    reports,
    dateFilter,
    selectedMonth,
    quickTagFilter,
    selectedOfficer,
    selectedArea,
    selectedKondisi,
    selectedStatusVerifikasi,
    searchQuery,
    todayStr,
  ]);

  // Operational KPI calculations
  const stats = useMemo(() => {
    const totalToday = todayReports.length;
    const cleanCount = todayReports.filter((r) => r.kondisiAkhir === 'Bersih').length;

    const reviewPendingList = reports.filter(
      (r) => r.kondisiAkhir === 'Perlu Pengecekan Ulang' && !isReportFollowedUp(r, reports)
    );
    const damagePendingList = reports.filter(
      (r) => r.kondisiAkhir === 'Ada Kerusakan' && !isReportFollowedUp(r, reports)
    );

    const reviewCount = reviewPendingList.length;
    const damageCount = damagePendingList.length;

    const reviewResolvedCount = reports.filter(
      (r) => r.kondisiAkhir === 'Perlu Pengecekan Ulang' && isReportFollowedUp(r, reports)
    ).length;
    const damageResolvedCount = reports.filter(
      (r) => r.kondisiAkhir === 'Ada Kerusakan' && isReportFollowedUp(r, reports)
    ).length;

    const cleanPercentage = totalToday > 0 ? Math.round((cleanCount / totalToday) * 100) : 0;

    return {
      totalToday,
      cleanCount,
      reviewCount,
      damageCount,
      reviewResolvedCount,
      damageResolvedCount,
      cleanPercentage,
    };
  }, [reports, todayReports]);

  // Shift Monitoring for today
  const shiftStats = useMemo(() => {
    let pagi = 0;
    let siang = 0;
    let sore = 0;

    todayReports.forEach((r) => {
      const hour = parseInt((r.waktu || '00:00').split(':')[0], 10);
      if (hour < 11) pagi++;
      else if (hour < 15) siang++;
      else sore++;
    });

    return { pagi, siang, sore };
  }, [todayReports]);

  // Field Officer Daily Summary (strictly active Petugas Kebersihan accounts)
  const officerStats = useMemo(() => {
    const activeRoster = (officers || []).filter(
      (o) => o.isActive !== false && o.role === 'petugas' && o.name
    );

    return activeRoster
      .map((officer) => {
        const cleanOfficerName = officer.name.trim().toLowerCase();
        const matchingReports = todayReports.filter(
          (r) =>
            (r.petugasId && r.petugasId === officer.id) ||
            (r.namaPetugas && r.namaPetugas.trim().toLowerCase() === cleanOfficerName)
        );
        let clean = 0;
        let issues = 0;
        let lastTime = '-';

        matchingReports.forEach((r) => {
          if (r.kondisiAkhir === 'Bersih') clean += 1;
          else issues += 1;
          if (lastTime === '-' || r.waktu > lastTime) {
            lastTime = r.waktu;
          }
        });

        const total = matchingReports.length;
        return {
          id: officer.id,
          name: officer.name,
          total,
          clean,
          issues,
          lastTime,
          cleanRate: total > 0 ? Math.round((clean / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [todayReports, officers]);

  const cleanlinessRating = useMemo(() => {
    const rate = stats.cleanPercentage;
    if (stats.totalToday === 0) {
      return { label: 'Menunggu Data', toneClass: 'text-slate-600' };
    }
    if (rate >= 85) {
      return { label: 'Sangat Prima', toneClass: 'text-emerald-700' };
    }
    if (rate >= 65) {
      return { label: 'Standar Terpenuhi', toneClass: 'text-blue-700' };
    }
    return { label: 'Perlu Perhatian', toneClass: 'text-amber-700' };
  }, [stats]);

  // Operational Schedule (Senin s/d Sabtu)
  const operationalSchedule = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 6;
    const dayNames = ['Ahad (Minggu)', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return {
      dayOfWeek,
      isWorkingDay,
      dayName: dayNames[dayOfWeek],
    };
  }, []);

  // Today's Room Target Status
  const todayRoomTargetStatus = useMemo(() => {
    const totalTarget = mandatoryRoomsList.length;
    const reportedRooms: Array<{ areaName: string; latestReport: CleaningReport; totalToday: number }> = [];
    const unreportedRooms: string[] = [];

    mandatoryRoomsList.forEach((areaName) => {
      const normalized = areaName.trim().toUpperCase();
      const areaReps = todayReports.filter((r) => (r.area || '').trim().toUpperCase() === normalized);
      if (areaReps.length > 0) {
        reportedRooms.push({
          areaName,
          latestReport: areaReps[0],
          totalToday: areaReps.length,
        });
      } else {
        unreportedRooms.push(areaName);
      }
    });

    const reportedCount = reportedRooms.length;
    const percentage = totalTarget > 0 ? Math.round((reportedCount / totalTarget) * 100) : 100;

    return {
      totalTarget,
      reportedCount,
      unreportedCount: unreportedRooms.length,
      percentage,
      isTargetAchieved: reportedCount === totalTarget,
      reportedRooms,
      unreportedRooms,
    };
  }, [todayReports, mandatoryRoomsList]);

  const activeTargetDate = inspectedTargetDate || todayStr;
  const isInspectingToday = activeTargetDate === todayStr;

  const activeTargetReports = useMemo(() => {
    return reports.filter((r) => r.tanggal === activeTargetDate);
  }, [reports, activeTargetDate]);

  // Active Room Target Status for inspected date
  const activeRoomTargetStatus = useMemo(() => {
    const inspectedDayIndex = getDayIndex(activeTargetDate);
    const totalTarget = mandatoryRoomsList.length;
    const items = mandatoryRoomsList.map((areaName) => {
      const cleanArea = areaName.trim().toUpperCase();
      const areaReps = activeTargetReports.filter((r) => (r.area || '').trim().toUpperCase() === cleanArea);
      const isReported = areaReps.length > 0;
      const latestReport = areaReps[0];

      let schedule = (roomSchedules || []).find(
        (s) =>
          s.roomName &&
          s.roomName.trim().toUpperCase() === cleanArea &&
          Array.isArray(s.daysOfWeek) &&
          s.daysOfWeek.includes(inspectedDayIndex)
      );

      if (!schedule) {
        schedule = (roomSchedules || []).find(
          (s) => s.roomName && s.roomName.trim().toUpperCase() === cleanArea
        );
      }

      const assignedOfficer = (allUsers || officers || []).find(
        (u) =>
          u.role === 'petugas' &&
          u.isActive !== false &&
          ((schedule?.officerId && u.id === schedule.officerId) ||
            (schedule?.officerName && u.name.trim().toLowerCase() === schedule.officerName.trim().toLowerCase()))
      );
      const scheduledOfficerName = assignedOfficer?.name || 'Semua Petugas';

      return {
        areaName,
        isReported,
        total: areaReps.length,
        latestKondisi: latestReport?.kondisiAkhir as KondisiAkhir | undefined,
        latestPetugas: latestReport?.namaPetugas,
        latestWaktu: latestReport?.waktu,
        latestReport,
        reportId: latestReport?.id,
        scheduledOfficer: scheduledOfficerName,
        isCurrentUserAssigned: Boolean(
          schedule &&
            currentUser &&
            (currentUser.id === schedule.officerId ||
              (assignedOfficer && currentUser.id === assignedOfficer.id) ||
              (schedule.officerName &&
                currentUser.name.trim().toLowerCase() === schedule.officerName.trim().toLowerCase()))
        ),
      };
    });

    const reportedCount = items.filter((i) => i.isReported).length;
    const unreportedCount = totalTarget - reportedCount;
    const percentage = totalTarget > 0 ? Math.round((reportedCount / totalTarget) * 100) : 100;

    return {
      items,
      totalTarget,
      reportedCount,
      unreportedCount,
      percentage,
      isTargetAchieved: reportedCount === totalTarget,
    };
  }, [activeTargetReports, mandatoryRoomsList, roomSchedules, activeTargetDate, currentUser, allUsers, officers]);

  // Weekly Target Fulfillment Chart (Senin s/d Sabtu)
  const weeklyTargetStats = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const offsetToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + offsetToMonday);
    mondayDate.setHours(0, 0, 0, 0);

    const dayConfigs = [
      { name: 'Senin', short: 'Sen' },
      { name: 'Selasa', short: 'Sel' },
      { name: 'Rabu', short: 'Rab' },
      { name: 'Kamis', short: 'Kam' },
      { name: 'Jumat', short: 'Jum' },
      { name: 'Sabtu', short: 'Sab' },
    ];

    const todayDateString = getTodayDateString();
    const target = mandatoryRoomsList.length || 1;

    const days = dayConfigs.map((config, index) => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + index);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayReps = reports.filter((r) => r.tanggal === dateStr);
      const reportedAreas = mandatoryRoomsList.filter((areaName) =>
        dayReps.some((r) => (r.area || '').trim().toUpperCase() === areaName.trim().toUpperCase())
      );
      const count = reportedAreas.length;
      const percentage = Math.round((count / target) * 100);

      return {
        dayName: config.name,
        shortName: config.short,
        dateStr,
        displayDate: `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`,
        totalReports: dayReps.length,
        reportedCount: count,
        targetCount: target,
        missingCount: target - count,
        percentage,
        isToday: dateStr === todayDateString,
        isPast: dateStr < todayDateString,
        isFuture: dateStr > todayDateString,
        isTargetMet: count >= target,
      };
    });

    const elapsedDays = days.filter((d) => d.isPast || d.isToday);
    const averageCompliance =
      elapsedDays.length > 0
        ? Math.round(elapsedDays.reduce((sum, d) => sum + d.percentage, 0) / elapsedDays.length)
        : 0;
    const targetMetDaysCount = elapsedDays.filter((d) => d.isTargetMet).length;
    const totalWeeklyReports = days.reduce((sum, d) => sum + d.totalReports, 0);

    return {
      days,
      elapsedDaysCount: elapsedDays.length,
      averageCompliance,
      targetMetDaysCount,
      totalWeeklyReports,
    };
  }, [reports, mandatoryRoomsList]);

  // Available months
  const availableMonths = useMemo(() => {
    const currentMonthStr = todayStr.slice(0, 7);
    const set = new Set<string>([currentMonthStr]);
    reports.forEach((r) => {
      if (r.tanggal && r.tanggal.length >= 7) {
        set.add(r.tanggal.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [reports, todayStr]);

  // Monthly statistics
  const monthlyTargetStats = useMemo(() => {
    const targetMonth = selectedMonth || todayStr.slice(0, 7);
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const monthReports = reports.filter((r) => r.tanggal && r.tanggal.startsWith(targetMonth));
    const totalReports = monthReports.length;
    const cleanReports = monthReports.filter((r) => r.kondisiAkhir === 'Bersih').length;
    const cleanPercentage = totalReports > 0 ? Math.round((cleanReports / totalReports) * 100) : 0;
    const reviewReports = monthReports.filter((r) => r.kondisiAkhir === 'Perlu Pengecekan Ulang').length;
    const damageReports = monthReports.filter((r) => r.kondisiAkhir === 'Ada Kerusakan').length;

    const target = mandatoryRoomsList.length || 1;
    const dailyBreakdown: Array<{
      dateStr: string;
      dayNum: number;
      dayOfWeek: number;
      isWorkingDay: boolean;
      totalReports: number;
      reportedAreasCount: number;
      percentage: number;
      isTargetMet: boolean;
    }> = [];

    let totalWorkingDays = 0;
    let fullComplianceDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay();
      const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 6;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const repsOnDay = monthReports.filter((r) => r.tanggal === dateStr);
      const reportedAreas = mandatoryRoomsList.filter((areaName) =>
        repsOnDay.some((r) => (r.area || '').trim().toUpperCase() === areaName.trim().toUpperCase())
      );
      const count = reportedAreas.length;
      const percentage = Math.round((count / target) * 100);
      const isTargetMet = count >= target;

      if (isWorkingDay) {
        totalWorkingDays++;
        if (isTargetMet) fullComplianceDays++;
      }

      dailyBreakdown.push({
        dateStr,
        dayNum: day,
        dayOfWeek,
        isWorkingDay,
        totalReports: repsOnDay.length,
        reportedAreasCount: count,
        percentage,
        isTargetMet,
      });
    }

    const weeklyBuckets: Array<{
      weekLabel: string;
      weekNum: number;
      dateRange: string;
      reportsCount: number;
      cleanCount: number;
      avgCoverage: number;
      fullTargetDays: number;
      workingDaysCount: number;
    }> = [];

    const numWeeks = Math.ceil(daysInMonth / 7);
    for (let w = 0; w < numWeeks; w++) {
      const startDay = w * 7 + 1;
      const endDay = Math.min((w + 1) * 7, daysInMonth);
      const daysInWeek = dailyBreakdown.filter((d) => d.dayNum >= startDay && d.dayNum <= endDay);
      const repsInWeek = monthReports.filter((r) => {
        const parts = (r.tanggal || '').split('-');
        const dNum = parseInt(parts[2] || '0', 10);
        return dNum >= startDay && dNum <= endDay;
      });
      const cleanInWeek = repsInWeek.filter((r) => r.kondisiAkhir === 'Bersih').length;
      const workingDaysInWeek = daysInWeek.filter((d) => d.isWorkingDay);
      const avgCoverage =
        workingDaysInWeek.length > 0
          ? Math.round(workingDaysInWeek.reduce((acc, d) => acc + d.percentage, 0) / workingDaysInWeek.length)
          : 0;
      const fullTargetDays = workingDaysInWeek.filter((d) => d.isTargetMet).length;

      weeklyBuckets.push({
        weekLabel: `Mg ${w + 1}`,
        weekNum: w + 1,
        dateRange: `${startDay}–${endDay}`,
        reportsCount: repsInWeek.length,
        cleanCount: cleanInWeek,
        avgCoverage,
        fullTargetDays,
        workingDaysCount: workingDaysInWeek.length,
      });
    }

    const monthlyComplianceRate =
      totalWorkingDays > 0 ? Math.round((fullComplianceDays / totalWorkingDays) * 100) : 0;

    return {
      targetMonth,
      formattedMonth: formatMonthIndo(targetMonth),
      totalReports,
      cleanReports,
      cleanPercentage,
      reviewReports,
      damageReports,
      totalWorkingDays,
      fullComplianceDays,
      monthlyComplianceRate,
      weeklyBuckets,
    };
  }, [reports, selectedMonth, todayStr, mandatoryRoomsList]);

  // Room Analytics Engine
  const roomAnalyticsData = useMemo(() => {
    let filteredForRooms = reports;

    if (roomTimeRange === 'today') {
      filteredForRooms = reports.filter((r) => r.tanggal === todayStr);
    } else if (roomTimeRange === '7days') {
      const now = new Date();
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6);
      const past7Str = formatLocalYmd(past7);
      filteredForRooms = reports.filter((r) => r.tanggal >= past7Str && r.tanggal <= todayStr);
    } else if (roomTimeRange === 'month') {
      filteredForRooms = reports.filter((r) => r.tanggal.startsWith(selectedMonth));
    }

    const roomStats = activeRoomsList.map((areaName) => {
      const normalizedTarget = areaName.trim().toUpperCase();
      const areaReps = filteredForRooms.filter(
        (r) => (r.area || '').trim().toUpperCase() === normalizedTarget
      );
      const allTimeAreaReps = reports.filter(
        (r) => (r.area || '').trim().toUpperCase() === normalizedTarget
      );

      const total = areaReps.length;
      const cleanCount = areaReps.filter((r) => r.kondisiAkhir === 'Bersih').length;
      const reviewCount = areaReps.filter((r) => r.kondisiAkhir === 'Perlu Pengecekan Ulang').length;
      const damageCount = areaReps.filter((r) => r.kondisiAkhir === 'Ada Kerusakan').length;

      const cleanRate = total > 0 ? Math.round((cleanCount / total) * 100) : 0;
      const reviewRate = total > 0 ? Math.round((reviewCount / total) * 100) : 0;
      const damageRate = total > 0 ? Math.round((damageCount / total) * 100) : 0;

      const checklistItems = ['Kloset Bersih', 'Kran Ada', 'Ember Ada', 'Air ada', 'Gayung Ada'];
      const checklistBreakdown = checklistItems.map((item) => {
        const checkedCount = areaReps.filter((r) => r.checklist && r.checklist.includes(item)).length;
        const rate = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
        return { item, checkedCount, rate };
      });

      const officerCounts: Record<string, number> = {};
      areaReps.forEach((r) => {
        officerCounts[r.namaPetugas] = (officerCounts[r.namaPetugas] || 0) + 1;
      });
      const topOfficers = Object.entries(officerCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const trendDays: {
        dateStr: string;
        displayDate: string;
        dayShort: string;
        status: 'clean' | 'review' | 'damage' | 'none';
      }[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dStr = formatLocalYmd(d);
        const rep = allTimeAreaReps.find((r) => r.tanggal === dStr);
        let status: 'clean' | 'review' | 'damage' | 'none' = 'none';
        if (rep) {
          if (rep.kondisiAkhir === 'Bersih') status = 'clean';
          else if (rep.kondisiAkhir === 'Ada Kerusakan') status = 'damage';
          else status = 'review';
        }
        trendDays.push({
          dateStr: dStr,
          displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
          dayShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()],
          status,
        });
      }

      const isCleanedToday = reports.some(
        (r) => (r.area || '').trim().toUpperCase() === normalizedTarget && r.tanggal === todayStr
      );

      return {
        areaName,
        total,
        cleanCount,
        reviewCount,
        damageCount,
        cleanRate,
        reviewRate,
        damageRate,
        checklistBreakdown,
        topOfficers,
        trendDays,
        isCleanedToday,
      };
    });

    const sortedRooms = [...roomStats].sort((a, b) => {
      if (roomSortBy === 'cleanRate') {
        if (b.cleanRate !== a.cleanRate) return b.cleanRate - a.cleanRate;
        return b.total - a.total;
      }
      if (roomSortBy === 'reports') return b.total - a.total;
      if (roomSortBy === 'issues') return b.reviewCount + b.damageCount - (a.reviewCount + a.damageCount);
      return 0;
    });

    const totalClean = roomStats.reduce((acc, r) => acc + r.cleanCount, 0);
    const totalAll = roomStats.reduce((acc, r) => acc + r.total, 0);
    const overallCleanRate = totalAll > 0 ? Math.round((totalClean / totalAll) * 100) : 0;

    return {
      rooms: sortedRooms,
      overallCleanRate,
      totalReportsFiltered: totalAll,
    };
  }, [reports, activeRoomsList, roomTimeRange, selectedMonth, todayStr, roomSortBy]);

  const selectedRoomStats = useMemo(() => {
    return (
      roomAnalyticsData.rooms.find((r) => r.areaName === selectedRoomForDetail) ||
      roomAnalyticsData.rooms[0]
    );
  }, [roomAnalyticsData, selectedRoomForDetail]);

  // Load older reports (>35 days) on demand only when user explicitly switches to all / specific month
  useEffect(() => {
    const needsOlderWindow =
      dateFilter === 'all' || dateFilter === 'specific_month' || roomTimeRange === 'all';
    if (!needsOlderWindow || hasRequestedOlderReports || !onLoadOlderReports) return;

    setHasRequestedOlderReports(true);
    setIsLoadingOlderReports(true);
    onLoadOlderReports()
      .catch(() => {})
      .finally(() => {
        setIsLoadingOlderReports(false);
      });
  }, [dateFilter, roomTimeRange, hasRequestedOlderReports, onLoadOlderReports]);

  const handleOpenDetail = (report: CleaningReport) => {
    setSelectedImageIndex(null);
    setActiveReportDetail(report);
    setSupervisorNoteInput(report.catatanSupervisor || '');
    if (currentUser?.role === 'supervisor' || currentUser?.role === 'superadmin') {
      setSelectedModalSupervisorId(currentUser.id);
    } else if (registeredSupervisors.length > 0) {
      setSelectedModalSupervisorId(registeredSupervisors[0].id);
    }

    const needsPhotoHydration =
      Boolean(onLoadReportPhotos) && doesReportNeedPhotoHydration(report);

    if (needsPhotoHydration && onLoadReportPhotos) {
      setLoadingPhotosReportId(report.id);
      onLoadReportPhotos(report.id)
        .then((fullPhotos) => {
          if (fullPhotos && fullPhotos.length > 0) {
            setActiveReportDetail((prev) =>
              prev && prev.id === report.id
                ? { ...prev, fotoBukti: fullPhotos, fotoCount: fullPhotos.length }
                : prev
            );
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoadingPhotosReportId((prev) => (prev === report.id ? null : prev));
        });
    }
  };

  const handleExecuteVerification = (
    reportId: string,
    status: 'Disetujui' | 'Perlu Perbaikan',
    note?: string,
    customVerifierName?: string
  ) => {
    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    if (!isSupervisorOrAdmin || !currentUser) {
      onOpenLoginModal?.('Akses Dibatasi: Hanya Supervisor atau Superadmin yang dapat melakukan verifikasi laporan.');
      return;
    }

    const verifierName = customVerifierName || currentUser.name;
    const verifierRole = currentUser.role === 'superadmin' ? 'Superadmin' : 'Supervisor';

    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    const nowDate = getTodayDateString();
    const noteToSave = note !== undefined ? note : supervisorNoteInput.trim() || report.catatanSupervisor || '';

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

    if (status === 'Disetujui') {
      showApprovalToast(`Laporan ${report.area} berhasil disetujui`);
    } else {
      showApprovalToast(`Laporan ${report.area} ditandai perlu perbaikan`, 'info');
    }
  };

  const handleDirectCardVerify = (report: CleaningReport, status: 'Disetujui' | 'Perlu Perbaikan') => {
    const supervisorName =
      (currentUser?.role === 'supervisor' || currentUser?.role === 'superadmin') && currentUser.name
        ? currentUser.name
        : registeredSupervisors[0]?.name || 'SUPERVISOR SARPRAS SCB';

    handleExecuteVerification(report.id, status, undefined, supervisorName);
  };

  const handleVerifyReport = (status: 'Disetujui' | 'Perlu Perbaikan') => {
    if (!activeReportDetail) return;
    const supervisorName =
      (currentUser?.role === 'supervisor' || currentUser?.role === 'superadmin') && currentUser.name
        ? currentUser.name
        : registeredSupervisors.find((s) => s.id === selectedModalSupervisorId)?.name ||
          registeredSupervisors[0]?.name ||
          'SUPERVISOR SARPRAS SCB';

    handleExecuteVerification(
      activeReportDetail.id,
      status,
      supervisorNoteInput.trim() || undefined,
      supervisorName
    );
  };

  const handleBulkApprovePending = () => {
    const pendingList = reports.filter((r) => r.statusVerifikasi === 'Menunggu');
    if (pendingList.length === 0) return;

    const verifierName =
      (currentUser?.role === 'supervisor' || currentUser?.role === 'superadmin') && currentUser.name
        ? currentUser.name
        : registeredSupervisors[0]?.name || 'SUPERVISOR SARPRAS SCB';
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

    showApprovalToast(`Berhasil menyetujui sekaligus ${pendingList.length} laporan kebersihan.`);
  };

  const hasActiveFilters =
    selectedOfficer !== 'all' ||
    selectedArea !== 'all' ||
    selectedKondisi !== 'all' ||
    selectedStatusVerifikasi !== 'all' ||
    quickTagFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    dateFilter !== 'today';

  const resetAllFilters = () => {
    setSelectedOfficer('all');
    setSelectedArea('all');
    setSelectedKondisi('all');
    setSelectedStatusVerifikasi('all');
    setQuickTagFilter('all');
    setSearchQuery('');
    setDateFilter('today');
  };

  const scrollToReportsTable = () => {
    const tableElem = document.getElementById('report-history-table');
    if (tableElem) {
      tableElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. COMMAND HEADER & EXPORT BAR */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-medium">
            <span>Sekolah Cendekia BAZNAS</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {!currentUser && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  onClick={() =>
                    onOpenLoginModal
                      ? onOpenLoginModal('Masuk ke Akun Petugas Kebersihan atau Pengelola SCB')
                      : onAddNewReport()
                  }
                  className="text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Mode Tamu (Login Petugas)</span>
                </button>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Dashboard Kebersihan &amp; Sanitasi
          </h1>
          <p className="text-sm text-slate-500">
            Pemantauan target ruangan harian, indeks mutu kebersihan, dan verifikasi laporan petugas.
          </p>
        </div>

        {/* Unified Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Period Filter + Export PDF */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 shrink-0" />
            <select
              aria-label="Pilih Bulan Export PDF"
              value={pdfFilterMonth}
              onChange={(e) => setPdfFilterMonth(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 py-1 px-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Bulan</option>
              <option value="01">Januari</option>
              <option value="02">Februari</option>
              <option value="03">Maret</option>
              <option value="04">April</option>
              <option value="05">Mei</option>
              <option value="06">Juni</option>
              <option value="07">Juli</option>
              <option value="08">Agustus</option>
              <option value="09">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
            </select>
            <span className="text-slate-300 text-xs">/</span>
            <select
              aria-label="Pilih Tahun Export PDF"
              value={pdfFilterYear}
              onChange={(e) => setPdfFilterYear(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 py-1 px-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer tabular-nums"
            >
              {pdfAvailableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
              <option value="all">Semua Tahun</option>
            </select>
            <button
              onClick={() => {
                if (pdfFilteredReports.length === 0) {
                  showApprovalToast(`Tidak ada data laporan pada periode ${pdfPeriodeMeta.label}.`, 'info');
                  return;
                }
                downloadReportsPdf(pdfFilteredReports, {
                  periodeLabel: pdfPeriodeMeta.label,
                  fileName: pdfPeriodeMeta.fileName,
                  currentUser,
                });
                showApprovalToast(
                  `PDF periode ${pdfPeriodeMeta.label} (${pdfFilteredReports.length} laporan) diunduh.`,
                  'success'
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title={`Download PDF Tabel A4 periode ${pdfPeriodeMeta.label} (${pdfFilteredReports.length} data)`}
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export PDF</span>
              <span className="font-mono text-[11px] text-slate-300 tabular-nums">({pdfFilteredReports.length})</span>
            </button>
          </div>

          <button
            onClick={() => onOpenPrintModal(pdfFilteredReports, pdfPeriodeMeta.label)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            title={`Pratinjau lembar rekap periode ${pdfPeriodeMeta.label}`}
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak</span>
          </button>

          <button
            onClick={() => exportReportsToCsv(filteredReports)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            title="Download CSV/Excel sesuai filter tabel"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => onAddNewReport()}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
              currentUser
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            {currentUser ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{currentUser ? 'Input Laporan' : 'Login & Input'}</span>
          </button>
        </div>
      </div>

      {/* UNIFIED OPERATIONAL ACTION STRIP (Single focused alert — zero banner stacking) */}
      {operationalSchedule.isWorkingDay && todayRoomTargetStatus.unreportedCount > 0 ? (
        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-sm font-bold text-rose-950">
                  {todayRoomTargetStatus.unreportedCount} ruangan belum dilaporkan hari ini
                </h2>
                <span className="text-xs text-rose-700 font-medium tabular-nums">
                  ({todayRoomTargetStatus.reportedCount}/{todayRoomTargetStatus.totalTarget} terpenuhi)
                </span>
                {unresolvedIssuesList.length > 0 && (
                  <>
                    <span className="text-rose-300" aria-hidden="true">·</span>
                    <button
                      onClick={() => {
                        setQuickTagFilter('unresolved');
                        setDateFilter('all');
                        scrollToReportsTable();
                      }}
                      className="text-xs font-semibold text-amber-800 hover:underline cursor-pointer"
                    >
                      {unresolvedIssuesList.length} temuan kendala butuh tindak lanjut
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {todayRoomTargetStatus.unreportedRooms.map((roomName) => (
                  <button
                    key={roomName}
                    onClick={() => onAddNewReport(roomName)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-100 text-rose-900 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                    title={`Isi laporan ${roomName}`}
                  >
                    <Plus className="w-3 h-3 text-rose-600" />
                    <span>{roomName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => onAddNewReport(todayRoomTargetStatus.unreportedRooms[0])}
            className="self-start lg:self-center shrink-0 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Laporkan Sekarang</span>
          </button>
        </div>
      ) : unresolvedIssuesList.length > 0 ? (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {unresolvedIssuesList.length} temuan kendala atau kerusakan menunggu tindak lanjut
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {operationalSchedule.isWorkingDay
                  ? `Target harian ${todayRoomTargetStatus.reportedCount}/${todayRoomTargetStatus.totalTarget} ruangan telah terpenuhi. Klik untuk meninjau temuan.`
                  : 'Hari Ahad adalah jadwal libur rutin; sistem tetap mencatat laporan insidental.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setQuickTagFilter('unresolved');
              setDateFilter('all');
              scrollToReportsTable();
            }}
            className="self-start sm:self-center shrink-0 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>Lihat {unresolvedIssuesList.length} Temuan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-950">
            {operationalSchedule.isWorkingDay ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="font-semibold">
              {operationalSchedule.isWorkingDay
                ? `Seluruh ${todayRoomTargetStatus.totalTarget} ruangan wajib sudah dilaporkan hari ini dan tidak ada kerusakan tertunda.`
                : 'Hari Ahad (Libur Rutin Operasional Senin–Sabtu) · Semua fasilitas terpantau aman.'}
            </span>
          </div>
          <span className="text-emerald-700 font-semibold tabular-nums shrink-0">
            Target Harian: {todayRoomTargetStatus.reportedCount}/{todayRoomTargetStatus.totalTarget}
          </span>
        </div>
      )}

      {/* 2. 4-COLUMN EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Target Ruangan Hari Ini */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Target Ruangan Hari Ini</span>
            <Target className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="tabular-nums">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {todayRoomTargetStatus.reportedCount}
              </span>
              <span className="text-base font-bold text-slate-400">/{todayRoomTargetStatus.totalTarget}</span>
            </div>
            <span className="text-sm font-bold text-emerald-700 tabular-nums">
              {todayRoomTargetStatus.percentage}%
            </span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  todayRoomTargetStatus.isTargetAchieved ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
                style={{ width: `${todayRoomTargetStatus.percentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {operationalSchedule.dayName} · {stats.totalToday} laporan masuk
            </p>
          </div>
        </div>

        {/* KPI 2: Indeks Kebersihan */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Indeks Kebersihan Hari Ini</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stats.cleanPercentage}%
            </span>
            <span className={`text-xs font-semibold ${cleanlinessRating.toneClass}`}>
              {cleanlinessRating.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 tabular-nums">
            {stats.cleanCount} dari {stats.totalToday} inspeksi berkondisi bersih
          </p>
        </div>

        {/* KPI 3: Menunggu Verifikasi / Perlu Cek */}
        <button
          type="button"
          onClick={() => {
            setQuickTagFilter(quickTagFilter === 'pending_approval' ? 'all' : 'pending_approval');
            setDateFilter('all');
            scrollToReportsTable();
          }}
          className={`bg-white p-4 sm:p-5 rounded-xl border text-left transition-colors flex flex-col justify-between cursor-pointer ${
            quickTagFilter === 'pending_approval'
              ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
          title="Klik untuk memfilter laporan yang menunggu persetujuan"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">Menunggu Verifikasi</span>
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {verificationCounts.pending}
            </span>
            <span className="text-xs text-slate-500">laporan</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 tabular-nums">
            {stats.reviewCount > 0 ? (
              <span className="text-amber-700 font-semibold">{stats.reviewCount} perlu cek ulang belum selesai</span>
            ) : (
              <span>{verificationCounts.approved} laporan sudah disetujui</span>
            )}
          </p>
        </button>

        {/* KPI 4: Temuan Kerusakan */}
        <button
          type="button"
          onClick={() => {
            setQuickTagFilter(quickTagFilter === 'damage' ? 'all' : 'damage');
            setDateFilter('all');
            scrollToReportsTable();
          }}
          className={`bg-white p-4 sm:p-5 rounded-xl border text-left transition-colors flex flex-col justify-between cursor-pointer ${
            quickTagFilter === 'damage'
              ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
          title="Klik untuk memfilter laporan dengan temuan kerusakan"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">Kerusakan Aktif</span>
            <Wrench className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className={`text-2xl sm:text-3xl font-extrabold ${stats.damageCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {stats.damageCount}
            </span>
            <span className="text-xs text-slate-500">belum tuntas</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 tabular-nums">
            {stats.damageResolvedCount > 0
              ? `${stats.damageResolvedCount} perbaikan sebelumnya selesai`
              : 'Tidak ada kerusakan tertunda'}
          </p>
        </button>
      </div>

      {/* 3. OPERATIONAL WORKSPACE: LIVE ROOM STATUS MATRIX (8 COLS) + SHIFT & OFFICERS (4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 8 Columns: Room Status Matrix */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Status Inspeksi Ruangan</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {isInspectingToday ? `Hari Ini (${operationalSchedule.dayName}, ${todayStr})` : `Tanggal Terpilih: ${activeTargetDate}`} ·{' '}
                  {activeRoomTargetStatus.reportedCount} dari {activeRoomTargetStatus.totalTarget} titik terlaporkan
                </p>
              </div>
              <div className="flex items-center gap-2">
                {inspectedTargetDate && (
                  <button
                    onClick={() => setInspectedTargetDate(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Kembali ke Hari Ini
                  </button>
                )}
              </div>
            </div>

            {/* Clean 2-column grid of Room Status Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {activeRoomTargetStatus.items.map((room) => (
                <div
                  key={room.areaName}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                    room.isReported
                      ? 'border-slate-200 bg-white hover:bg-slate-50/70'
                      : 'border-rose-200 bg-rose-50/30 hover:bg-rose-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{room.areaName}</h3>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        Jadwal: <span className="font-medium text-slate-700">{room.scheduledOfficer}</span>
                      </p>
                    </div>

                    {room.isReported ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 whitespace-nowrap ${
                          room.latestKondisi === 'Bersih'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : room.latestKondisi === 'Ada Kerusakan'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{room.latestKondisi === 'Ada Kerusakan' ? 'Rusak' : room.latestKondisi === 'Bersih' ? 'Bersih' : 'Cek Ulang'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold shrink-0 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Belum Lapor</span>
                      </span>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    {room.isReported ? (
                      <>
                        <span className="text-slate-600 truncate tabular-nums">
                          {room.latestPetugas} · {room.latestWaktu} WIB ({room.total}x)
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {room.latestReport && (
                            <button
                              onClick={() => handleOpenDetail(room.latestReport!)}
                              className="text-emerald-700 hover:text-emerald-900 font-semibold hover:underline cursor-pointer whitespace-nowrap"
                            >
                              Detail
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-rose-700 font-medium truncate">
                          {room.isCurrentUserAssigned ? 'Tugas Anda hari ini' : 'Menunggu laporan petugas'}
                        </span>
                        {currentUser?.role === 'petugas' && !room.isCurrentUserAssigned ? (
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">Bukan jadwal</span>
                        ) : (
                          <button
                            onClick={() => onAddNewReport(room.areaName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Laporkan</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Shift Coverage & Officer Activity */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between gap-5">
          {/* Shift Distribution */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Inspeksi per Shift</span>
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">{stats.totalToday} total</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-100 mt-3 text-center">
              <div className="px-2 py-1">
                <div className="inline-flex items-center justify-center text-amber-500 mb-1">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="text-xl font-extrabold text-slate-900 tabular-nums">{shiftStats.pagi}</div>
                <div className="text-[11px] text-slate-500">Pagi · 06–11</div>
              </div>
              <div className="px-2 py-1">
                <div className="inline-flex items-center justify-center text-orange-500 mb-1">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="text-xl font-extrabold text-slate-900 tabular-nums">{shiftStats.siang}</div>
                <div className="text-[11px] text-slate-500">Siang · 11–15</div>
              </div>
              <div className="px-2 py-1">
                <div className="inline-flex items-center justify-center text-indigo-500 mb-1">
                  <Moon className="w-4 h-4" />
                </div>
                <div className="text-xl font-extrabold text-slate-900 tabular-nums">{shiftStats.sore}</div>
                <div className="text-[11px] text-slate-500">Sore · 15–21</div>
              </div>
            </div>
          </div>

          {/* Officer Activity Today */}
          <div className="pt-4 border-t border-slate-100 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Aktivitas Petugas</span>
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {officerStats.filter((o) => o.total > 0).length} aktif hari ini
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {officerStats.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Belum ada petugas kebersihan aktif.</p>
                ) : (
                  officerStats.map((officer) => (
                    <button
                      key={officer.id || officer.name}
                      type="button"
                      onClick={() => {
                        const next = selectedOfficer === officer.name ? 'all' : officer.name;
                        setSelectedOfficer(next);
                        if (next !== 'all') scrollToReportsTable();
                      }}
                      className={`w-full flex items-center justify-between py-2.5 px-2 rounded-lg text-left transition-colors cursor-pointer ${
                        selectedOfficer === officer.name ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50'
                      }`}
                      title={`Filter laporan oleh ${officer.name}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {officer.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{officer.name}</p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {officer.lastTime !== '-' ? `Terakhir ${officer.lastTime} WIB` : 'Belum ada laporan hari ini'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0 ml-2">
                        {officer.total} lap
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100">
              Klik nama petugas untuk memfilter daftar laporan di bawah.
            </p>
          </div>
        </div>
      </div>

      {/* 4. ANALYTICS & TREND SECTION (FULL WIDTH, CLEAN TABBED WORKSPACE) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Analisis Kualitas &amp; Kepatuhan Target</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {targetChartView === 'rooms'
                ? 'Perbandingan performa kebersihan tiap kamar mandi dan detail tren 7 hari terakhir'
                : targetChartView === 'weekly'
                ? 'Tingkat pemenuhan target ruangan harian Senin–Sabtu (klik batang hari untuk meninjau tanggal tersebut)'
                : `Rekapitulasi kepatuhan dan laporan kebersihan bulan ${monthlyTargetStats.formattedMonth}`}
            </p>
          </div>

          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl gap-1 self-start sm:self-auto shrink-0">
            <button
              onClick={() => setTargetChartView('rooms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                targetChartView === 'rooms' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Per Ruangan</span>
            </button>
            <button
              onClick={() => setTargetChartView('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                targetChartView === 'weekly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Mingguan</span>
            </button>
            <button
              onClick={() => setTargetChartView('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                targetChartView === 'monthly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5 text-slate-600" />
              <span>Bulanan</span>
            </button>
          </div>
        </div>

        {targetChartView === 'rooms' ? (
          <div className="space-y-5">
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg gap-1 self-start">
                {(
                  [
                    { id: 'today', label: 'Hari Ini' },
                    { id: '7days', label: '7 Hari' },
                    { id: 'month', label: 'Bulan Ini' },
                    { id: 'all', label: 'Semua' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setRoomTimeRange(opt.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      roomTimeRange === opt.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Bersih
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" /> Perlu Cek
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Rusak
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    aria-label="Urutkan Grafik Ruangan"
                    value={roomSortBy}
                    onChange={(e) => setRoomSortBy(e.target.value as 'cleanRate' | 'reports' | 'issues')}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="cleanRate">Urut: Indeks Bersih (%)</option>
                    <option value="reports">Urut: Laporan Terbanyak</option>
                    <option value="issues">Urut: Kendala Terbanyak</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2-Column Split: Left Bar Comparison (7 cols) | Right Selected Room Deep Dive (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
              <div className="lg:col-span-7 space-y-2.5">
                {roomAnalyticsData.rooms.map((room) => {
                  const isSelected = selectedRoomStats?.areaName === room.areaName;
                  return (
                    <button
                      key={room.areaName}
                      type="button"
                      onClick={() => setSelectedRoomForDetail(room.areaName)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/40 border-emerald-500'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate">{room.areaName}</span>
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            · {room.isCleanedToday ? 'Aktif hari ini' : 'Belum hari ini'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 tabular-nums text-xs">
                          <span className="text-slate-500">{room.total} lap</span>
                          <span
                            className={`font-bold ${
                              room.cleanRate >= 80
                                ? 'text-emerald-700'
                                : room.cleanRate >= 50
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {room.cleanRate}% bersih
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        {room.total > 0 ? (
                          <>
                            <div
                              className="bg-emerald-500 h-full transition-all duration-500"
                              style={{ width: `${room.cleanRate}%` }}
                            />
                            <div
                              className="bg-amber-400 h-full transition-all duration-500"
                              style={{ width: `${room.reviewRate}%` }}
                            />
                            <div
                              className="bg-rose-500 h-full transition-all duration-500"
                              style={{ width: `${room.damageRate}%` }}
                            />
                          </>
                        ) : (
                          <div className="w-full bg-slate-200 h-full" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 tabular-nums">
                        <span>
                          {room.cleanCount} bersih · {room.reviewCount} cek ulang · {room.damageCount} rusak
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          {isSelected ? 'Ditampilkan' : 'Lihat tren →'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Selected Room Deep Dive */}
              {selectedRoomStats && (
                <div className="lg:col-span-5 lg:border-l lg:border-slate-100 lg:pl-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-700">Detail Ruangan Terpilih</span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedRoomStats.areaName}</h3>
                        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {selectedRoomStats.total} laporan · {selectedRoomStats.cleanRate}% indeks bersih
                        </p>
                      </div>
                      <button
                        onClick={() => onAddNewReport(selectedRoomStats.areaName)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Laporkan</span>
                      </button>
                    </div>

                    {/* 7-Day Timeline */}
                    <div>
                      <span className="text-xs font-semibold text-slate-700 block mb-2">
                        Tren Kondisi 7 Hari Terakhir
                      </span>
                      <div className="grid grid-cols-7 gap-1.5 text-center">
                        {selectedRoomStats.trendDays.map((day) => (
                          <div
                            key={day.dateStr}
                            className={`py-2 px-1 rounded-lg border text-xs ${
                              day.status === 'clean'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : day.status === 'review'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : day.status === 'damage'
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                            title={`${day.dayShort} (${day.dateStr})`}
                          >
                            <p className="text-[10px] font-bold">{day.dayShort}</p>
                            <p className="text-[10px] opacity-75 tabular-nums">{day.displayDate}</p>
                            <div className="mt-1 font-bold text-xs">
                              {day.status === 'clean' ? '✓' : day.status === 'review' ? '!' : day.status === 'damage' ? '✕' : '–'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Checklist Completion Rates */}
                    <div>
                      <span className="text-xs font-semibold text-slate-700 block mb-2">
                        Keterpenuhan Checklist ({selectedRoomStats.total} laporan)
                      </span>
                      <div className="space-y-2">
                        {selectedRoomStats.checklistBreakdown.map((chk) => (
                          <div key={chk.item} className="space-y-1">
                            <div className="flex items-center justify-between text-xs tabular-nums">
                              <span className="text-slate-600">{chk.item}</span>
                              <span className="font-bold text-slate-900">{chk.rate}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${chk.rate}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 truncate">
                      {selectedRoomStats.topOfficers.length > 0
                        ? `Teraktif: ${selectedRoomStats.topOfficers[0].name} (${selectedRoomStats.topOfficers[0].count}x)`
                        : 'Belum ada aktivitas pada rentang ini'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedArea(selectedRoomStats.areaName);
                        setDateFilter('all');
                        scrollToReportsTable();
                      }}
                      className="text-emerald-700 hover:text-emerald-900 font-semibold hover:underline shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      Lihat di Tabel →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : targetChartView === 'weekly' ? (
          /* WEEKLY BAR CHART */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Jadwal wajib Senin–Sabtu ({mandatoryRoomsList.length} ruangan per hari)</span>
              <span className="font-bold text-emerald-700 tabular-nums">
                Rata-rata minggu ini: {weeklyTargetStats.averageCompliance}% ({weeklyTargetStats.targetMetDaysCount}/{weeklyTargetStats.elapsedDaysCount} hari 100%)
              </span>
            </div>

            <div className="relative pt-6 pb-2">
              <div className="absolute top-6 left-0 right-0 flex items-center gap-2 pointer-events-none">
                <div className="w-full border-b border-dashed border-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded whitespace-nowrap">
                  Target 100%
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-44 pt-4">
                {weeklyTargetStats.days.map((day) => {
                  const isSelected = activeTargetDate === day.dateStr;
                  return (
                    <button
                      key={day.dayName}
                      type="button"
                      onClick={() => setInspectedTargetDate(day.dateStr === todayStr ? null : day.dateStr)}
                      className={`flex flex-col items-center justify-end h-full cursor-pointer group p-2 rounded-xl transition-colors ${
                        isSelected ? 'bg-emerald-50 ring-1 ring-emerald-500' : 'hover:bg-slate-50'
                      }`}
                      title={`${day.dayName} (${day.dateStr}): ${day.reportedCount}/${day.targetCount} ruangan`}
                    >
                      <div className="text-xs font-bold text-slate-700 mb-1.5 tabular-nums">
                        {day.isFuture ? '–' : `${day.reportedCount}/${day.targetCount}`}
                      </div>
                      <div className="w-full max-w-[56px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-28">
                        <div
                          className={`w-full transition-all duration-500 rounded-t-lg ${
                            day.isFuture
                              ? 'bg-slate-200 h-1'
                              : day.isTargetMet
                              ? 'bg-emerald-500 group-hover:bg-emerald-600'
                              : day.percentage > 0
                              ? 'bg-amber-500 group-hover:bg-amber-600'
                              : 'bg-rose-400 group-hover:bg-rose-500'
                          }`}
                          style={{ height: day.isFuture ? '4px' : `${Math.max(day.percentage, 8)}%` }}
                        />
                      </div>
                      <div className="text-center mt-2 w-full">
                        <p className="text-xs font-bold text-slate-800">{day.dayName}</p>
                        <p className="text-[11px] text-slate-400 tabular-nums">
                          {day.displayDate} {day.isToday ? '· Hari Ini' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* MONTHLY HISTORY & ANALYTICS */
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1">
                <button
                  onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  aria-label="Pilih Bulan Riwayat"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthIndo(m)} {m === todayStr.slice(0, 7) ? '(Bulan Ini)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  setDateFilter('specific_month');
                  scrollToReportsTable();
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Tampilkan {monthlyTargetStats.totalReports} Laporan di Tabel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
              <div className="p-3.5 text-center tabular-nums">
                <span className="text-xs text-slate-500 block">Total Laporan</span>
                <strong className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                  {monthlyTargetStats.totalReports}
                </strong>
              </div>
              <div className="p-3.5 text-center tabular-nums">
                <span className="text-xs text-slate-500 block">Indeks Bersih</span>
                <strong className="text-xl font-extrabold text-emerald-700 mt-0.5 block">
                  {monthlyTargetStats.cleanPercentage}%
                </strong>
              </div>
              <div className="p-3.5 text-center tabular-nums">
                <span className="text-xs text-slate-500 block">Hari Target Penuh</span>
                <strong className="text-xl font-extrabold text-blue-700 mt-0.5 block">
                  {monthlyTargetStats.fullComplianceDays}/{monthlyTargetStats.totalWorkingDays}
                </strong>
              </div>
              <div className="p-3.5 text-center tabular-nums">
                <span className="text-xs text-slate-500 block">Temuan Kendala</span>
                <strong className="text-xl font-extrabold text-amber-700 mt-0.5 block">
                  {monthlyTargetStats.reviewReports + monthlyTargetStats.damageReports}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {monthlyTargetStats.weeklyBuckets.map((bucket) => (
                <div key={bucket.weekLabel} className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 tabular-nums">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{bucket.weekLabel}</span>
                    <span className="text-[11px] text-slate-400">Tgl {bucket.dateRange}</span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">{bucket.avgCoverage}%</div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${bucket.avgCoverage}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">{bucket.reportsCount} laporan</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. REPORTS LOG & VERIFICATION SECTION */}
      <div id="report-history-table" className="space-y-4">
        {/* Supervisor Action Bar when pending reports exist */}
        {isSupervisorOrAdmin && verificationCounts.pending > 0 && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-800">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong className="tabular-nums">{verificationCounts.pending} laporan</strong> menunggu persetujuan supervisor ({currentUser?.name}).
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setSelectedStatusVerifikasi('Menunggu');
                  setDateFilter('all');
                }}
                className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-800 font-semibold rounded-lg border border-blue-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Tampilkan Pending
              </button>
              <button
                onClick={handleBulkApprovePending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Setujui Semua</span>
              </button>
            </div>
          </div>
        )}

        {/* Unified Filter & Search Container */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Riwayat &amp; Daftar Laporan</h2>
                {isLoadingOlderReports && (
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Memuat riwayat lama...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 tabular-nums">
                Menampilkan {filteredReports.length} dari {reports.length} laporan tersimpan
              </p>
              {isFirestoreQuotaLimited && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Kuota baca harian Firestore sedang mencapai batas gratis; menampilkan data cache lokal perangkat.
                </p>
              )}
            </div>

            {/* Quick Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: `Semua (${reports.length})` },
                  { id: 'unresolved', label: `Butuh Tindak Lanjut (${unresolvedIssuesList.length})` },
                  { id: 'pending_approval', label: `Menunggu Verifikasi (${verificationCounts.pending})` },
                  { id: 'clean', label: `Bersih (${reports.filter((r) => r.kondisiAkhir === 'Bersih').length})` },
                  { id: 'damage', label: `Kerusakan (${reports.filter((r) => r.kondisiAkhir === 'Ada Kerusakan').length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setQuickTagFilter(tab.id);
                    if (tab.id !== 'all' && dateFilter === 'today') {
                      setDateFilter('all');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    quickTagFilter === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + Date Tabs + View Mode */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari laporan berdasarkan petugas, area, atau catatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {(
                  [
                    { id: 'today', label: 'Hari Ini' },
                    { id: '7days', label: '7 Hari' },
                    { id: 'month', label: 'Bulan Ini' },
                    { id: 'all', label: 'Semua' },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setDateFilter(d.id);
                      if (d.id === 'month') setSelectedMonth(todayStr.slice(0, 7));
                    }}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      dateFilter === d.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
                <CalendarRange className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <select
                  aria-label="Filter Histori Bulan"
                  value={dateFilter === 'specific_month' ? selectedMonth : dateFilter === 'month' ? todayStr.slice(0, 7) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedMonth(e.target.value);
                      setDateFilter('specific_month');
                    }
                  }}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Pilih Bulan
                  </option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthIndo(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-slate-600">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                  title="Tampilan Kartu"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-emerald-700 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                  title="Tampilan Tabel"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Attribute Filter Selects */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 text-xs">
            <select
              aria-label="Filter Petugas"
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Petugas</option>
              {availableOfficerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter Area"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Area Ruangan</option>
              {activeRoomsList.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter Kondisi Akhir"
              value={selectedKondisi}
              onChange={(e) => setSelectedKondisi(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Kondisi</option>
              <option value="Bersih">Bersih</option>
              <option value="Perlu Pengecekan Ulang">Perlu Pengecekan Ulang</option>
              <option value="Ada Kerusakan">Ada Kerusakan</option>
            </select>

            <select
              aria-label="Filter Status Verifikasi"
              value={selectedStatusVerifikasi}
              onChange={(e) => setSelectedStatusVerifikasi(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Status Verifikasi</option>
              <option value="Menunggu">Menunggu ({verificationCounts.pending})</option>
              <option value="Disetujui">Disetujui ({verificationCounts.approved})</option>
              <option value="Perlu Perbaikan">Perlu Perbaikan ({verificationCounts.needsRepair})</option>
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 tabular-nums">
                Filter aktif: <strong className="text-slate-900">{filteredReports.length} laporan</strong> ditemukan
              </span>
              <button
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            </div>
          )}
        </div>

        {/* Reports Content: Empty / Grid / Table */}
        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Tidak ada laporan yang cocok dengan filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {dateFilter === 'today'
                ? 'Belum ada laporan yang masuk untuk hari ini. Anda dapat mengubah rentang waktu ke "7 Hari" atau "Semua".'
                : 'Coba ubah kata kunci pencarian atau reset filter yang sedang aktif.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={() => setDateFilter('all')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Tampilkan Semua Waktu
                </button>
              )}
              <button
                onClick={() => onAddNewReport()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                + Input Laporan Baru
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => {
              const followedUp = report.kondisiAkhir === 'Bersih' || isReportFollowedUp(report, reports);
              return (
                <div
                  key={report.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden flex flex-col"
                >
                  {/* Photo Evidence Thumbnail */}
                  <div
                    className="relative aspect-16/9 bg-slate-100 cursor-pointer group overflow-hidden"
                    onClick={() => handleOpenDetail(report)}
                  >
                    {report.fotoBukti && report.fotoBukti.length > 0 ? (
                      <ReportPhotoImage
                        src={report.fotoBukti[0]}
                        alt={`Bukti ${report.area}`}
                        compact
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
                        <Building2 className="w-5 h-5 text-slate-300" />
                        <span>Tidak ada foto</span>
                      </div>
                    )}

                    {/* Top Status Scrim Overlay */}
                    <div className="absolute inset-x-0 top-0 p-2.5 bg-gradient-to-b from-black/45 to-transparent flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          report.kondisiAkhir === 'Bersih'
                            ? 'bg-emerald-600 text-white'
                            : report.kondisiAkhir === 'Ada Kerusakan'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {report.kondisiAkhir}
                      </span>

                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          report.statusVerifikasi === 'Disetujui'
                            ? 'bg-white/95 text-emerald-800'
                            : report.statusVerifikasi === 'Perlu Perbaikan'
                            ? 'bg-white/95 text-rose-800'
                            : 'bg-slate-900/80 text-white'
                        }`}
                      >
                        {report.statusVerifikasi}
                      </span>
                    </div>

                    {(report.fotoCount ?? report.fotoBukti?.length ?? 0) > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/65 text-white text-[11px] font-medium px-2 py-0.5 rounded-md tabular-nums">
                        {report.fotoCount ?? report.fotoBukti?.length ?? 0} Foto
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug">{report.area}</h3>
                        {report.kondisiAkhir !== 'Bersih' && (
                          <span
                            className={`text-[11px] font-semibold shrink-0 ${
                              followedUp ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {followedUp ? '· Selesai' : '· Perlu Tindak Lanjut'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                        <span className="font-semibold text-slate-700">{report.namaPetugas}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {report.tanggal} {report.waktu} WIB
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        {report.checklist.slice(0, 3).map((item) => `✓ ${item}`).join('  ')}
                        {report.checklist.length > 3 ? `  +${report.checklist.length - 3} lainnya` : ''}
                      </p>

                      {report.keteranganTambahan && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg line-clamp-2">
                          <span className="font-semibold text-slate-700">Catatan:</span> {report.keteranganTambahan}
                        </p>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                      <button
                        onClick={() => handleOpenDetail(report)}
                        className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Detail</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {report.statusVerifikasi === 'Menunggu' && isSupervisorOrAdmin ? (
                          <>
                            <button
                              onClick={() => handleDirectCardVerify(report, 'Disetujui')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Setujui</span>
                            </button>
                            <button
                              onClick={() => handleDirectCardVerify(report, 'Perlu Perbaikan')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-[11px] border border-rose-200 transition-colors cursor-pointer"
                            >
                              Perbaikan
                            </button>
                          </>
                        ) : report.diverifikasiOleh ? (
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                            {report.diverifikasiOleh.split(' (')[0]}
                          </span>
                        ) : null}

                        {isSuperAdmin && (
                          <button
                            onClick={() => onDeleteReport(report.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Hapus Laporan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Petugas</th>
                    <th className="py-3 px-4">Area Ruangan</th>
                    <th className="py-3 px-4">Kondisi</th>
                    <th className="py-3 px-4">Checklist</th>
                    <th className="py-3 px-4">Catatan</th>
                    <th className="py-3 px-4">Verifikasi</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        <div className="font-semibold text-slate-900">{report.waktu} WIB</div>
                        <div className="text-[11px] text-slate-400">{report.tanggal}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                        {report.namaPetugas}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{report.area}</span>
                          {(report.fotoCount ?? report.fotoBukti?.length ?? 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[11px] font-normal text-slate-400 tabular-nums"
                              title={`${report.fotoCount ?? report.fotoBukti?.length ?? 0} foto bukti`}
                            >
                              <Camera className="w-3 h-3" />
                              {report.fotoCount ?? report.fotoBukti?.length ?? 0}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            report.kondisiAkhir === 'Bersih'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : report.kondisiAkhir === 'Ada Kerusakan'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {report.kondisiAkhir}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-slate-600">
                        {report.checklist.join(', ')}
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-slate-600">
                        {report.keteranganTambahan || '–'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold ${
                            report.statusVerifikasi === 'Disetujui'
                              ? 'text-emerald-700'
                              : report.statusVerifikasi === 'Perlu Perbaikan'
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {report.statusVerifikasi}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {report.statusVerifikasi === 'Menunggu' && isSupervisorOrAdmin && (
                            <button
                              onClick={() => handleDirectCardVerify(report, 'Disetujui')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Setujui</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetail(report)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg cursor-pointer"
                          >
                            Detail
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => onDeleteReport(report.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
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
      </div>

      {/* DETAIL MODAL WITH SUPERVISOR VERIFICATION */}
      {currentDetailReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-emerald-700">Detail Laporan Kebersihan</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      currentDetailReport.statusVerifikasi === 'Disetujui'
                        ? 'text-emerald-700'
                        : currentDetailReport.statusVerifikasi === 'Perlu Perbaikan'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {currentDetailReport.statusVerifikasi}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{currentDetailReport.area}</h3>
              </div>
              <button
                onClick={() => setActiveReportDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs tabular-nums">
                <div>
                  <span className="text-slate-400 block font-medium">Petugas</span>
                  <strong className="text-slate-900 text-sm">{currentDetailReport.namaPetugas}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Waktu Lapor</span>
                  <strong className="text-slate-900 text-sm">
                    {currentDetailReport.tanggal} · {currentDetailReport.waktu}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Kondisi Akhir</span>
                  <strong
                    className={`inline-block font-bold mt-0.5 ${
                      currentDetailReport.kondisiAkhir === 'Bersih'
                        ? 'text-emerald-700'
                        : currentDetailReport.kondisiAkhir === 'Ada Kerusakan'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {currentDetailReport.kondisiAkhir}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Bukti Foto</span>
                  <strong className="text-slate-900 text-sm">
                    {currentDetailReport.fotoCount ?? currentDetailReport.fotoBukti?.length ?? 0} Terlampir
                  </strong>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Foto Bukti Kegiatan</span>
                  <span className="text-slate-400 font-normal normal-case">
                    {loadingPhotosReportId === currentDetailReport.id
                      ? 'Memuat foto resolusi penuh...'
                      : 'Klik foto untuk perbesar'}
                  </span>
                </h4>
                {currentDetailReport.fotoBukti && currentDetailReport.fotoBukti.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {currentDetailReport.fotoBukti.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedImageIndex(i)}
                        className="aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity relative group"
                      >
                        <ReportPhotoImage
                          src={url}
                          alt={`Foto bukti ${i + 1}`}
                          compact
                          className="w-full h-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                          Perbesar Foto
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Tidak ada foto dilampirkan.</p>
                )}

                {currentDetailReport.drivePhotoLinks && currentDetailReport.drivePhotoLinks.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-slate-500 font-medium">Arsip Google Drive:</span>
                    {currentDetailReport.drivePhotoLinks.map((driveUrl, idx) => (
                      <a
                        key={idx}
                        href={driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Foto {idx + 1}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Checklist Kebersihan Terpenuhi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentDetailReport.checklist.map((item, idx) => (
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

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                  Catatan Petugas
                </h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  {currentDetailReport.keteranganTambahan || 'Tidak ada catatan tambahan.'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Evaluasi &amp; Persetujuan Supervisor</span>
                  </h4>
                  {currentDetailReport.diverifikasiOleh && (
                    <span className="text-[11px] text-slate-600 tabular-nums">
                      Oleh: <strong>{currentDetailReport.diverifikasiOleh}</strong> ({currentDetailReport.diverifikasiPada})
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Catatan Evaluasi Supervisor:
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
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui Laporan</span>
                  </button>

                  <button
                    onClick={() => handleVerifyReport('Perlu Perbaikan')}
                    className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Minta Perbaikan</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setActiveReportDetail(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-PLACE APPROVAL TOAST NOTIFICATION */}
      {approvalToast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{approvalToast.message}</span>
          </div>
        </div>
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {selectedImageIndex !== null &&
        currentDetailReport?.fotoBukti?.[selectedImageIndex] && (
          <div
            className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
            onClick={() => setSelectedImageIndex(null)}
          >
            <div
              className="relative max-w-5xl max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <ReportPhotoImage
                src={currentDetailReport.fotoBukti[selectedImageIndex]}
                alt={`Bukti foto ${selectedImageIndex + 1} resolusi HD`}
                className="max-w-full max-h-[88vh] object-contain rounded-xl shadow-2xl"
              />
              <button
                onClick={() => setSelectedImageIndex(null)}
                className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
