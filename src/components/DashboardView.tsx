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
  CheckCheck,
  TrendingUp,
  BarChart2,
  Sun,
  Moon,
  Award,
  Activity,
  AlertOctagon,
  ThumbsUp,
  Layers,
  ArrowRight,
  Target,
  CalendarDays,
  BellRing,
  Info,
  ChevronLeft,
  ChevronRight,
  History,
  CalendarRange
} from 'lucide-react';

export function formatMonthIndo(yearMonth: string): string {
  if (!yearMonth) return '';
  const [y, m] = yearMonth.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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

interface DashboardViewProps {
  reports: CleaningReport[];
  currentUser: User | null;
  officers: User[];
  allUsers?: User[];
  onAddNewReport: (areaName?: string) => void;
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
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'specific_month' | 'all'>('today');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getTodayDateString().slice(0, 7));
  const [selectedOfficer, setSelectedOfficer] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedKondisi, setSelectedKondisi] = useState<string>('all');
  const [selectedStatusVerifikasi, setSelectedStatusVerifikasi] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Target chart view mode: 'weekly' (Senin s/d Sabtu) or 'monthly' (Histori Bulanan)
  const [targetChartView, setTargetChartView] = useState<'weekly' | 'monthly'>('weekly');

  // Detail Modal
  const [activeReportDetail, setActiveReportDetail] = useState<CleaningReport | null>(null);
  const [supervisorNoteInput, setSupervisorNoteInput] = useState<string>('');
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedModalSupervisorId, setSelectedModalSupervisorId] = useState<string>('');

  // Target chart inspected date (null = today)
  const [inspectedTargetDate, setInspectedTargetDate] = useState<string | null>(null);

  // In-place approval notification (zero popup windows)
  const [approvalToast, setApprovalToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showApprovalToast = (message: string, type: 'success' | 'info' = 'success') => {
    setApprovalToast({ message, type });
    setTimeout(() => {
      setApprovalToast(null);
    }, 3500);
  };

  const todayStr = getTodayDateString();

  // Helper to determine if an issue report has received follow-up or resolution
  const isReportFollowedUp = (report: CleaningReport, allReports: CleaningReport[]) => {
    // 1. If supervisor already approved / marked as resolved
    if (report.statusVerifikasi === 'Disetujui') {
      return true;
    }

    // 2. If there is a newer report for the exact same area that is 'Bersih', it has been resolved
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

  // Quick category tag filter
  const [quickTagFilter, setQuickTagFilter] = useState<'all' | 'unresolved' | 'pending_approval' | 'clean' | 'damage'>('all');

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

  // Operational reports for today
  const todayReports = useMemo(() => {
    return reports.filter((r) => r.tanggal === todayStr);
  }, [reports, todayStr]);

  // Unresolved critical findings needing follow-up
  const unresolvedIssuesList = useMemo(() => {
    return reports.filter(
      (r) =>
        (r.kondisiAkhir === 'Ada Kerusakan' || r.kondisiAkhir === 'Perlu Pengecekan Ulang') &&
        !isReportFollowedUp(r, reports)
    );
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
        const currentMonthPrefix = todayStr.slice(0, 7);
        if (!r.tanggal || !r.tanggal.startsWith(currentMonthPrefix)) return false;
      }
      if (dateFilter === 'specific_month') {
        if (!r.tanggal || !r.tanggal.startsWith(selectedMonth)) return false;
      }

      // Quick Tag Filter
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

  // Operational KPI calculations for today
  const stats = useMemo(() => {
    const totalToday = todayReports.length;
    const cleanCount = todayReports.filter((r) => r.kondisiAkhir === 'Bersih').length;

    // Calculate issues that have NOT received follow up or resolution
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

  // Shift Monitoring for today (Pagi: 06:00-10:59, Siang: 11:00-14:59, Sore/Malam: 15:00-21:00)
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

  // Field Officer Daily Summary & Activity
  const officerStats = useMemo(() => {
    const map = new Map<string, { total: number; clean: number; issues: number; lastTime: string }>();

    // Standard officers list
    const names = ['IDAY M YUSUF', 'ABDUL KODIR', 'WAHYUDIN'];
    names.forEach((n) => {
      map.set(n, { total: 0, clean: 0, issues: 0, lastTime: '-' });
    });

    todayReports.forEach((r) => {
      const name = r.namaPetugas;
      const cur = map.get(name) || { total: 0, clean: 0, issues: 0, lastTime: '-' };
      cur.total += 1;
      if (r.kondisiAkhir === 'Bersih') cur.clean += 1;
      else cur.issues += 1;
      if (cur.lastTime === '-' || r.waktu > cur.lastTime) {
        cur.lastTime = r.waktu;
      }
      map.set(name, cur);
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      ...data,
      cleanRate: data.total > 0 ? Math.round((data.clean / data.total) * 100) : 0,
    }));
  }, [todayReports]);

  // Cleanliness quality rating badge
  const cleanlinessRating = useMemo(() => {
    const rate = stats.cleanPercentage;
    if (stats.totalToday === 0) {
      return {
        label: 'Menunggu Data Hari Ini',
        subtext: 'Belum ada laporan checklist yang masuk hari ini',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        barColor: 'bg-slate-400',
      };
    }
    if (rate >= 85) {
      return {
        label: 'Sangat Prima & Higienis',
        subtext: `${stats.cleanCount} dari ${stats.totalToday} inspeksi dalam kondisi bersih sempurna`,
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        barColor: 'bg-emerald-500',
      };
    }
    if (rate >= 65) {
      return {
        label: 'Standar Terpenuhi',
        subtext: 'Mayoritas area bersih dengan beberapa catatan ringan',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        barColor: 'bg-blue-500',
      };
    }
    return {
      label: 'Perlu Perhatian & Follow-up',
      subtext: 'Terdapat temuan kendala yang perlu diselesaikan petugas',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      barColor: 'bg-amber-500',
    };
  }, [stats]);

  // SCB Operational Schedule: Senin s/d Sabtu (Monday through Saturday)
  const operationalSchedule = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Ahad/Minggu, 1 = Senin, ..., 6 = Sabtu
    const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 6; // Senin s/d Sabtu
    const dayNames = ['Ahad (Minggu)', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return {
      dayOfWeek,
      isWorkingDay,
      dayName: dayNames[dayOfWeek],
      scheduleRuleText: 'Senin s/d Sabtu • Target 100% Seluruh Ruangan Dilaporkan Setiap Hari',
    };
  }, []);

  // Today's Room Target Status specifically for the high-priority Alert Banner
  const todayRoomTargetStatus = useMemo(() => {
    const totalTarget = INITIAL_AREAS.length; // 6 standard rooms
    const reportedRooms: Array<{
      areaName: string;
      latestReport: CleaningReport;
      totalToday: number;
    }> = [];
    const unreportedRooms: string[] = [];

    INITIAL_AREAS.forEach((areaName) => {
      const areaReps = todayReports.filter((r) => r.area === areaName);
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
    const percentage = Math.round((reportedCount / totalTarget) * 100);
    const isTargetAchieved = reportedCount === totalTarget;

    return {
      totalTarget,
      reportedCount,
      unreportedCount: unreportedRooms.length,
      percentage,
      isTargetAchieved,
      reportedRooms,
      unreportedRooms,
    };
  }, [todayReports]);

  // Active target date being inspected (defaults to today)
  const activeTargetDate = inspectedTargetDate || todayStr;
  const isInspectingToday = activeTargetDate === todayStr;

  const activeTargetReports = useMemo(() => {
    return reports.filter((r) => r.tanggal === activeTargetDate);
  }, [reports, activeTargetDate]);

  // Active Room Target Status for the selected/inspected date in the Target Dashboard
  const activeRoomTargetStatus = useMemo(() => {
    const totalTarget = INITIAL_AREAS.length;
    const items = INITIAL_AREAS.map((areaName) => {
      const areaReps = activeTargetReports.filter((r) => r.area === areaName);
      const isReported = areaReps.length > 0;
      const latestReport = areaReps[0];
      return {
        areaName,
        isReported,
        total: areaReps.length,
        latestKondisi: latestReport?.kondisiAkhir as KondisiAkhir | undefined,
        latestPetugas: latestReport?.namaPetugas,
        latestWaktu: latestReport?.waktu,
        reportId: latestReport?.id,
      };
    });

    const reportedCount = items.filter((i) => i.isReported).length;
    const unreportedCount = totalTarget - reportedCount;
    const percentage = Math.round((reportedCount / totalTarget) * 100);
    const isTargetAchieved = reportedCount === totalTarget;

    return {
      items,
      totalTarget,
      reportedCount,
      unreportedCount,
      percentage,
      isTargetAchieved,
    };
  }, [activeTargetReports]);

  // Weekly Target Fulfillment Chart (Senin s/d Sabtu)
  const weeklyTargetStats = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon, 6 is Sat
    // Offset to get Monday of this week:
    // Sun (0) -> -6 days
    // Mon (1) -> 0 days
    // Tue (2) -> -1 days, etc.
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

    const days = dayConfigs.map((config, index) => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + index);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayReps = reports.filter((r) => r.tanggal === dateStr);
      const reportedAreas = INITIAL_AREAS.filter((areaName) =>
        dayReps.some((r) => r.area === areaName)
      );
      const count = reportedAreas.length;
      const target = INITIAL_AREAS.length;
      const percentage = Math.round((count / target) * 100);
      const isToday = dateStr === todayDateString;
      const isPast = dateStr < todayDateString;
      const isFuture = dateStr > todayDateString;
      const isTargetMet = count >= target;

      return {
        dayName: config.name,
        shortName: config.short,
        dateStr,
        displayDate: `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`,
        totalReports: dayReps.length,
        reportedCount: count,
        missingCount: target - count,
        percentage,
        isToday,
        isPast,
        isFuture,
        isTargetMet,
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
  }, [reports]);

  // Backward-compatible areaCoverage for quick area filter
  const areaCoverage = useMemo(() => {
    return activeRoomTargetStatus.items.map((item) => ({
      areaName: item.areaName,
      isCleaned: item.isReported,
      total: item.total,
      latestKondisi: item.latestKondisi,
      latestPetugas: item.latestPetugas,
      latestWaktu: item.latestWaktu,
    }));
  }, [activeRoomTargetStatus]);

  // List of available months based on reports data and current month
  const availableMonths = useMemo(() => {
    const currentMonthStr = todayStr.slice(0, 7);
    const set = new Set<string>();
    set.add(currentMonthStr);
    reports.forEach((r) => {
      if (r.tanggal && r.tanggal.length >= 7) {
        set.add(r.tanggal.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [reports, todayStr]);

  // Monthly statistics & history overview for the selected month
  const monthlyTargetStats = useMemo(() => {
    const targetMonth = selectedMonth || todayStr.slice(0, 7);
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Number of days in this month
    const daysInMonth = new Date(year, month, 0).getDate();

    // Reports in this month
    const monthReports = reports.filter((r) => r.tanggal && r.tanggal.startsWith(targetMonth));
    const totalReports = monthReports.length;
    const cleanReports = monthReports.filter((r) => r.kondisiAkhir === 'Bersih').length;
    const cleanPercentage = totalReports > 0 ? Math.round((cleanReports / totalReports) * 100) : 0;
    const reviewReports = monthReports.filter((r) => r.kondisiAkhir === 'Perlu Pengecekan Ulang').length;
    const damageReports = monthReports.filter((r) => r.kondisiAkhir === 'Ada Kerusakan').length;

    // Daily breakdown for the month
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
      const dayOfWeek = d.getDay(); // 0 is Sun, 1 is Mon, ..., 6 is Sat
      const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 6; // Senin s/d Sabtu
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const repsOnDay = monthReports.filter((r) => r.tanggal === dateStr);
      const reportedAreas = INITIAL_AREAS.filter((areaName) => repsOnDay.some((r) => r.area === areaName));
      const count = reportedAreas.length;
      const percentage = Math.round((count / INITIAL_AREAS.length) * 100);
      const isTargetMet = count >= INITIAL_AREAS.length;

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

    // Weekly buckets (Minggu 1, 2, 3, 4, 5)
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
        const parts = r.tanggal.split('-');
        const dNum = parseInt(parts[2], 10);
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
        dateRange: `${startDay}-${endDay}`,
        reportsCount: repsInWeek.length,
        cleanCount: cleanInWeek,
        avgCoverage,
        fullTargetDays,
        workingDaysCount: workingDaysInWeek.length,
      });
    }

    // Room performance breakdown across the month
    const roomMonthlySummary = INITIAL_AREAS.map((areaName) => {
      const areaReps = monthReports.filter((r) => r.area === areaName);
      const cleanCount = areaReps.filter((r) => r.kondisiAkhir === 'Bersih').length;
      return {
        areaName,
        totalReports: areaReps.length,
        cleanCount,
        cleanRate: areaReps.length > 0 ? Math.round((cleanCount / areaReps.length) * 100) : 0,
      };
    });

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
      dailyBreakdown,
      weeklyBuckets,
      roomMonthlySummary,
    };
  }, [reports, selectedMonth, todayStr]);

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

    // In-place confirmation notification without opening any popup window or modal
    if (status === 'Disetujui') {
      showApprovalToast(`✓ Laporan ${report.area} berhasil disetujui`);
    } else {
      showApprovalToast(`⚠️ Laporan ${report.area} ditandai perlu perbaikan`, 'info');
    }
  };

  // Direct 1-Click Approval Trigger from Cards / Table - ZERO POPUPS OR WINDOWS
  const handleDirectCardVerify = (
    report: CleaningReport,
    status: 'Disetujui' | 'Perlu Perbaikan'
  ) => {
    // Determine verifier name from active user or default supervisor
    const supervisorName =
      (currentUser?.role === 'supervisor' || currentUser?.role === 'superadmin') && currentUser.name
        ? currentUser.name
        : registeredSupervisors[0]?.name || 'SUPERVISOR SARPRAS SCB';

    // Directly execute approval in-place: no popup modal, no navigation, no new window!
    handleExecuteVerification(report.id, status, undefined, supervisorName);
  };

  // In-Place Verification inside Detail Modal
  const handleVerifyReport = (status: 'Disetujui' | 'Perlu Perbaikan') => {
    if (!activeReportDetail) return;

    const supervisorName =
      (currentUser?.role === 'supervisor' || currentUser?.role === 'superadmin') && currentUser.name
        ? currentUser.name
        : (registeredSupervisors.find((s) => s.id === selectedModalSupervisorId)?.name ||
           registeredSupervisors[0]?.name ||
           'SUPERVISOR SARPRAS SCB');

    handleExecuteVerification(
      activeReportDetail.id,
      status,
      supervisorNoteInput.trim() || undefined,
      supervisorName
    );
  };

  // Bulk approve all pending reports by Supervisor directly in-place without browser confirm popup
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

    showApprovalToast(`✓ Berhasil menyetujui sekaligus ${pendingList.length} laporan kebersihan!`);
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
            onClick={() => onAddNewReport()}
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
            onClick={() => onAddNewReport()}
            className="self-start sm:self-auto shrink-0 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Masuk Akun Petugas</span>
          </button>
        </div>
      )}

      {/* TARGET OPERATIONAL ALERT BANNER (Senin s/d Sabtu • Wajib 100% Ruangan Terlaporkan) */}
      {operationalSchedule.isWorkingDay ? (
        todayRoomTargetStatus.unreportedCount > 0 ? (
          <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/10 border-2 border-rose-400 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs relative">
                  <AlertOctagon className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider">
                      ALERT TARGET HARIAN
                    </span>
                    <span className="text-xs font-bold text-rose-950">
                      Jadwal Petugas: Senin s/d Sabtu • Wajib 100% Terlaporkan
                    </span>
                  </div>
                  <h3 className="font-black text-rose-950 text-base sm:text-lg mt-1">
                    ⚠️ {todayRoomTargetStatus.unreportedCount} Ruangan Belum Dilaporkan Hari Ini!
                  </h3>
                  <p className="text-xs text-rose-800 mt-0.5 max-w-2xl">
                    Semua 6 kamar mandi SCB wajib dilaporkan setiap hari kerja. Baru tercapai{' '}
                    <strong>{todayRoomTargetStatus.reportedCount} dari {todayRoomTargetStatus.totalTarget} ruangan ({todayRoomTargetStatus.percentage}%)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onAddNewReport(todayRoomTargetStatus.unreportedRooms[0])}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Input Laporan Ruangan Tertunda</span>
                </button>
              </div>
            </div>

            {/* List of Missing Rooms with Instant 1-Click Action */}
            <div className="mt-3.5 pt-3 border-t border-rose-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-rose-900 mr-1 flex items-center gap-1">
                  <BellRing className="w-3.5 h-3.5 text-rose-600" />
                  Daftar Ruangan Belum Terlaporkan:
                </span>
                {todayRoomTargetStatus.unreportedRooms.map((roomName) => (
                  <button
                    key={roomName}
                    onClick={() => onAddNewReport(roomName)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs shadow-2xs transition-all hover:scale-105"
                    title={`Klik untuk langsung isi laporan ${roomName}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>{roomName}</span>
                    <span className="text-[10px] text-rose-600 font-normal underline ml-1">+ Laporkan</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] uppercase">
                    TARGET HARIAN 100% TERCAPAI
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold">
                    Jadwal Operasional: {operationalSchedule.dayName}
                  </span>
                </div>
                <h3 className="font-black text-emerald-950 text-sm sm:text-base mt-0.5">
                  🎉 Seluruh 6 Ruangan Kamar Mandi Telah Selesai Dilaporkan Hari Ini!
                </h3>
                <p className="text-emerald-800 text-xs mt-0.5">
                  Semua titik kamar mandi Sekolah Cendekia BAZNAS telah diinspeksi dan dilaporkan sesuai target harian operasional Senin s/d Sabtu.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-900 font-extrabold rounded-xl text-xs border border-emerald-300">
                ✓ 6/6 Ruangan Terpenuhi
              </span>
            </div>
          </div>
        )
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">
                Hari Ahad / Minggu: Jadwal Libur Rutin Operasional Petugas
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                Jadwal tugas wajib harian petugas kebersihan SCB berlangsung <strong>Senin s/d Sabtu</strong>. Laporan insidental di hari libur tetap dicatat otomatis dalam sistem.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-200 text-slate-800 font-semibold rounded-full text-[11px] shrink-0">
            Jadwal Rutin: Senin s/d Sabtu
          </span>
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
        <div
          onClick={() => setSelectedKondisi(selectedKondisi === 'Perlu Pengecekan Ulang' ? 'all' : 'Perlu Pengecekan Ulang')}
          className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-xs cursor-pointer transition-all hover:shadow-md ${
            selectedKondisi === 'Perlu Pengecekan Ulang'
              ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/20'
              : 'border-slate-200'
          }`}
          title="Klik untuk memfilter laporan yang perlu pengecekan ulang"
        >
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
            <span className="text-xs text-slate-500">belum follow-up</span>
          </div>
          <p className="text-[11px] font-medium mt-1 flex items-center gap-1.5">
            {stats.reviewCount > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-amber-800 font-semibold">{stats.reviewCount} belum mendapatkan tindak lanjut</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 font-semibold">Semua sudah ditindaklanjuti</span>
              </>
            )}
          </p>
          {stats.reviewResolvedCount > 0 && (
            <p className="text-[10px] text-slate-400 mt-1">
              ✓ {stats.reviewResolvedCount} laporan terdahulu sudah selesai ditindaklanjuti
            </p>
          )}
        </div>

        {/* Ada Kerusakan */}
        <div
          onClick={() => setSelectedKondisi(selectedKondisi === 'Ada Kerusakan' ? 'all' : 'Ada Kerusakan')}
          className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-xs cursor-pointer transition-all hover:shadow-md ${
            selectedKondisi === 'Ada Kerusakan'
              ? 'border-rose-500 ring-2 ring-rose-400/30 bg-rose-50/20'
              : 'border-slate-200'
          }`}
          title="Klik untuk memfilter laporan dengan kerusakan fasilitas"
        >
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
            <span className="text-xs text-slate-500">belum ditindaklanjuti</span>
          </div>
          <p className="text-[11px] font-medium mt-1 flex items-center gap-1.5">
            {stats.damageCount > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="text-rose-800 font-semibold">{stats.damageCount} belum ada tindak lanjut teknisi</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 font-semibold">Semua kerusakan sudah tuntas diperbaiki</span>
              </>
            )}
          </p>
          {stats.damageResolvedCount > 0 && (
            <p className="text-[10px] text-slate-400 mt-1">
              ✓ {stats.damageResolvedCount} perbaikan fasilitas telah selesai
            </p>
          )}
        </div>
      </div>

      {/* DASHBOARD & GRAFIK TARGET PEMENUHAN RUANGAN (SENIN S/D SABTU) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        {/* Header Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                Target Operasional 100%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Jadwal: Senin s/d Sabtu
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              Grafik & Pemenuhan Target Harian Ruangan
            </h2>
            <p className="text-xs text-slate-500">
              Target Standar SCB: Semua 6 ruangan kamar mandi wajib diinspeksi & dilaporkan setiap hari (Senin–Sabtu)
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {inspectedTargetDate && (
              <button
                onClick={() => setInspectedTargetDate(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                title="Kembali melihat target hari ini"
              >
                <span>Lihat Hari Ini</span>
              </button>
            )}
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
              {isInspectingToday ? (
                <span>Inspeksi Hari Ini ({operationalSchedule.dayName})</span>
              ) : (
                <span>Melihat Tanggal: {activeTargetDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* Top 2-Card Row: Metric Gauge & Weekly Target Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card 1 (Col 1-5): Daily Target Achievement Gauge */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-emerald-50/30 p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-600" />
                  Capaian Target {isInspectingToday ? 'Hari Ini' : 'Tanggal Terpilih'}
                </span>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    activeRoomTargetStatus.isTargetAchieved
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  {activeRoomTargetStatus.isTargetAchieved ? '100% Target Tercapai' : `Tertunda ${activeRoomTargetStatus.unreportedCount} Ruangan`}
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-2">
                <div>
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {activeRoomTargetStatus.reportedCount}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-slate-400">
                    {' '}/ {activeRoomTargetStatus.totalTarget}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold ml-2">Ruangan Terlaporkan</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                    {activeRoomTargetStatus.percentage}%
                  </span>
                </div>
              </div>

              {/* Visual Progress Bar with 100% Target Marker */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                  <span>Progres Pemenuhan</span>
                  <span className="text-emerald-700 font-bold">Target SCB: 100% (6/6 Ruangan)</span>
                </div>
                <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden relative p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      activeRoomTargetStatus.isTargetAchieved
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : activeRoomTargetStatus.percentage > 0
                        ? 'bg-gradient-to-r from-amber-500 to-emerald-500'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: `${activeRoomTargetStatus.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sub-metrics breakdown */}
            <div className="pt-4 mt-4 border-t border-slate-200/70 grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Sudah Dilaporkan</span>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  {activeRoomTargetStatus.reportedCount} <span className="text-xs font-normal text-slate-500">titik</span>
                </p>
                <p className="text-[10px] text-slate-400">Tercatat di sistem</p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] font-bold text-rose-700 uppercase">Belum Dilaporkan</span>
                <p className="text-lg font-black text-rose-600 mt-0.5">
                  {activeRoomTargetStatus.unreportedCount} <span className="text-xs font-normal text-slate-500">titik</span>
                </p>
                <p className="text-[10px] text-slate-400">
                  {activeRoomTargetStatus.unreportedCount > 0 ? 'Perlu tindakan segera' : 'Nihil keterlambatan'}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2 (Col 6-12): Target Chart & Monthly History (Weekly vs Monthly Toggle) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              {/* Card 2 Header with View Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    {targetChartView === 'weekly' ? (
                      <BarChart2 className="w-4 h-4 text-blue-600" />
                    ) : (
                      <CalendarRange className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {targetChartView === 'weekly'
                        ? 'Grafik Target Mingguan (Senin s/d Sabtu)'
                        : `Histori & Target Bulanan: ${monthlyTargetStats.formattedMonth}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {targetChartView === 'weekly'
                      ? 'Tingkat ketercapaian target 6 ruangan pada setiap hari kerja dalam minggu ini'
                      : 'Rekapitulasi riwayat ketercapaian target operasional selama sebulan penuh'}
                  </p>
                </div>

                {/* View Switcher: Mingguan vs Bulanan */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setTargetChartView('weekly')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                      targetChartView === 'weekly'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Mingguan</span>
                  </button>
                  <button
                    onClick={() => setTargetChartView('monthly')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                      targetChartView === 'monthly'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Bulanan & Histori</span>
                  </button>
                </div>
              </div>

              {targetChartView === 'weekly' ? (
                /* VIEW 1: WEEKLY BAR CHART (SENIN S/D SABTU) */
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Capaian harian jadwal kerja Senin–Sabtu:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Rata-rata: {weeklyTargetStats.averageCompliance}%
                    </span>
                  </div>

                  {/* The 6-Day Weekly Bar Chart */}
                  <div className="relative pt-6 pb-2">
                    {/* 100% Target Reference Benchmark Line */}
                    <div className="absolute top-6 left-0 right-0 flex items-center gap-2 pointer-events-none z-10">
                      <div className="w-full border-b-2 border-dashed border-emerald-400/80" />
                      <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded whitespace-nowrap">
                        Target 100% (6 Ruangan)
                      </span>
                    </div>

                    {/* Bars Grid */}
                    <div className="grid grid-cols-6 gap-2 sm:gap-3 items-end h-36 pt-4">
                      {weeklyTargetStats.days.map((day) => {
                        const isSelected = activeTargetDate === day.dateStr;
                        return (
                          <div
                            key={day.dayName}
                            onClick={() => setInspectedTargetDate(day.dateStr === todayStr ? null : day.dateStr)}
                            className={`flex flex-col items-center justify-end h-full cursor-pointer group transition-all p-1 rounded-xl ${
                              isSelected
                                ? 'bg-slate-100 ring-2 ring-emerald-500'
                                : 'hover:bg-slate-50'
                            }`}
                            title={`${day.dayName} (${day.dateStr}): ${day.reportedCount}/6 ruangan (${day.percentage}%) - Klik untuk tinjau`}
                          >
                            {/* Day Target Status Label above Bar */}
                            <div className="text-[10px] font-black text-slate-700 mb-1 transition-transform group-hover:-translate-y-0.5">
                              {day.isFuture ? (
                                <span className="text-slate-300">-</span>
                              ) : (
                                <span>{day.reportedCount}/6</span>
                              )}
                            </div>

                            {/* Bar Body */}
                            <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-24 relative">
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
                                style={{
                                  height: day.isFuture ? '4px' : `${Math.max(day.percentage, 8)}%`,
                                }}
                              />
                            </div>

                            {/* Day Info Below Bar */}
                            <div className="text-center mt-2 w-full">
                              <p className="text-[11px] font-black text-slate-800 truncate">
                                {day.shortName}
                              </p>
                              <p className="text-[9px] text-slate-400 font-medium truncate">
                                {day.displayDate}
                              </p>
                              {day.isToday && (
                                <span className="inline-block mt-0.5 px-1 py-0.2 bg-emerald-600 text-white rounded text-[8px] font-black tracking-wider uppercase">
                                  Hari Ini
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* VIEW 2: MONTHLY HISTORY & ANALYTICS OVERVIEW */
                <div className="space-y-3.5">
                  {/* Month Navigator Header */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                        className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors"
                        title="Bulan Sebelumnya"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        {availableMonths.map((m) => (
                          <option key={m} value={m}>
                            {formatMonthIndo(m)} {m === todayStr.slice(0, 7) ? '(Bulan Ini)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                        className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors"
                        title="Bulan Berikutnya"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedMonth !== todayStr.slice(0, 7) && (
                        <button
                          onClick={() => setSelectedMonth(todayStr.slice(0, 7))}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition-colors"
                        >
                          Bulan Ini
                        </button>
                      )}
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {monthlyTargetStats.totalReports} Laporan
                      </span>
                    </div>
                  </div>

                  {/* Monthly 4-Metric Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Total Laporan</span>
                      <strong className="text-base font-black text-slate-900">{monthlyTargetStats.totalReports}</strong>
                      <span className="text-[9px] text-slate-400 block mt-0.5">sepanjang bulan</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 block">Indeks Bersih</span>
                      <strong className="text-base font-black text-emerald-800">{monthlyTargetStats.cleanPercentage}%</strong>
                      <span className="text-[9px] text-emerald-600 block mt-0.5">{monthlyTargetStats.cleanReports} lap bersih</span>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100">
                      <span className="text-[10px] text-blue-700 block">Target Penuh</span>
                      <strong className="text-base font-black text-blue-800">{monthlyTargetStats.fullComplianceDays} Hari</strong>
                      <span className="text-[9px] text-blue-600 block mt-0.5">dari {monthlyTargetStats.totalWorkingDays} hr kerja</span>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100">
                      <span className="text-[10px] text-amber-700 block">Kendala/Rusak</span>
                      <strong className="text-base font-black text-amber-800">{monthlyTargetStats.reviewReports + monthlyTargetStats.damageReports}</strong>
                      <span className="text-[9px] text-amber-600 block mt-0.5">temuan terlapor</span>
                    </div>
                  </div>

                  {/* Weekly Progress Breakdown (Minggu 1 s/d 5) */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-600 block">
                      Rata-rata Ketercapaian per Minggu ({monthlyTargetStats.formattedMonth}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {monthlyTargetStats.weeklyBuckets.map((bucket) => (
                        <div key={bucket.weekLabel} className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                          <p className="text-[10px] font-bold text-slate-700">{bucket.weekLabel}</p>
                          <p className="text-[9px] text-slate-400">{bucket.dateRange}</p>
                          <p className="text-xs font-black text-slate-900 mt-1">
                            {bucket.avgCoverage}%
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {bucket.reportsCount} laporan
                          </p>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${bucket.avgCoverage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Summary & Quick Action */}
            <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              {targetChartView === 'weekly' ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Target 100% tercapai pada <strong>{weeklyTargetStats.targetMetDaysCount} dari {weeklyTargetStats.elapsedDaysCount} hari kerja</strong>
                  </span>
                  <button
                    onClick={() => setTargetChartView('monthly')}
                    className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 underline text-[11px]"
                  >
                    <span>Buka Riwayat Bulanan</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    Kepatuhan bulanan: <strong>{monthlyTargetStats.monthlyComplianceRate}% hari kerja memenuhi target 100%</strong>
                  </span>
                  <button
                    onClick={() => {
                      setDateFilter('specific_month');
                      const tableElem = document.getElementById('report-history-table');
                      if (tableElem) {
                        tableElem.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 underline text-[11px]"
                  >
                    <span>Tampilkan {monthlyTargetStats.totalReports} Laporan di Tabel</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Matrix: Checklist Status of the 6 SCB Rooms */}
        <div className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Matriks Status Target 6 Ruangan Kamar Mandi SCB
              </h3>
              <p className="text-xs text-slate-500">
                Status inspeksi harian untuk 6 titik wajib Sekolah Cendekia BAZNAS ({isInspectingToday ? 'Hari Ini' : activeTargetDate})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                {activeRoomTargetStatus.reportedCount} dari {activeRoomTargetStatus.totalTarget} Terlaporkan
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeRoomTargetStatus.items.map((room) => (
              <div
                key={room.areaName}
                className={`p-3.5 rounded-2xl border transition-all ${
                  room.isReported
                    ? 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40'
                    : 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-200 hover:bg-rose-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">
                      {room.areaName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Titik Sanitasi Wajib SCB
                    </span>
                  </div>

                  {room.isReported ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Terpenuhi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black shrink-0 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      Belum Dilaporkan
                    </span>
                  )}
                </div>

                {room.isReported ? (
                  <div className="mt-3 pt-2.5 border-t border-emerald-100 text-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-600 truncate">
                        Petugas: <strong className="text-slate-800">{room.latestPetugas}</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Pukul {room.latestWaktu} WIB ({room.total}x inspeksi)
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                          room.latestKondisi === 'Bersih'
                            ? 'bg-emerald-100 text-emerald-800'
                            : room.latestKondisi === 'Ada Kerusakan'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {room.latestKondisi === 'Ada Kerusakan' ? 'Ada Kerusakan' : room.latestKondisi === 'Bersih' ? 'Bersih' : 'Perlu Cek'}
                      </span>
                      <button
                        onClick={() => setSelectedArea(room.areaName)}
                        className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold underline"
                      >
                        Filter Laporan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2.5 border-t border-rose-200 text-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-rose-800">
                        Belum Ada Laporan Masuk
                      </p>
                      <p className="text-[10px] text-rose-600">
                        Target checklist tertunda
                      </p>
                    </div>
                    <button
                      onClick={() => onAddNewReport(room.areaName)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-2xs transition-all flex items-center gap-1 shrink-0"
                      title={`Klik untuk mengisi laporan kebersihan untuk ${room.areaName}`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Laporkan</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EXECUTIVE INTELLIGENCE & SHIFT MONITORING (Makes reading dashboard status effortless) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Cleanliness Quality & Health Index */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Indeks Mutu Sanitasi
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cleanlinessRating.badgeClass}`}>
                {cleanlinessRating.label}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {stats.cleanPercentage}%
              </span>
              <span className="text-xs text-slate-500 font-medium">tingkat kebersihan hari ini</span>
            </div>

            {/* Stacked Quality Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-3 flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${stats.totalToday > 0 ? (stats.cleanCount / stats.totalToday) * 100 : 0}%` }}
                title={`Bersih: ${stats.cleanCount}`}
              />
              <div
                className="bg-amber-400 h-full transition-all duration-500"
                style={{ width: `${stats.totalToday > 0 ? (stats.reviewCount / stats.totalToday) * 100 : 0}%` }}
                title={`Perlu Cek: ${stats.reviewCount}`}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${stats.totalToday > 0 ? (stats.damageCount / stats.totalToday) * 100 : 0}%` }}
                title={`Kerusakan: ${stats.damageCount}`}
              />
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> {stats.cleanCount} Bersih
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> {stats.reviewCount} Cek Ulang
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> {stats.damageCount} Rusak
            </span>
          </div>
        </div>

        {/* Metric 2: Shift Monitoring & Inspection Frequency */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Siklus Shift Pembersihan
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Hari Ini</span>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Distribusi inspeksi berdasarkan jam kerja operasional petugas:
            </p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-center text-amber-500 mb-1">
                  <Sun className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-black text-slate-900">{shiftStats.pagi}</div>
                <div className="text-[10px] text-slate-500 font-medium">Pagi (06-11)</div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-center text-orange-500 mb-1">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-black text-slate-900">{shiftStats.siang}</div>
                <div className="text-[10px] text-slate-500 font-medium">Siang (11-15)</div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-center text-indigo-500 mb-1">
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-black text-slate-900">{shiftStats.sore}</div>
                <div className="text-[10px] text-slate-500 font-medium">Sore (15-21)</div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Total inspeksi shift:</span>
            <strong className="text-slate-800">{stats.totalToday} kali inspeksi</strong>
          </div>
        </div>

        {/* Metric 3: Duty Officers Workload & Presence */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                Aktivitas Petugas Hari Ini
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {officerStats.filter((o) => o.total > 0).length} Petugas Aktif
              </span>
            </div>

            <div className="space-y-2 mt-2">
              {officerStats.map((officer) => (
                <div
                  key={officer.name}
                  onClick={() => setSelectedOfficer(selectedOfficer === officer.name ? 'all' : officer.name)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedOfficer === officer.name
                      ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                      : 'border-slate-100 hover:bg-slate-50'
                  }`}
                  title={`Klik untuk filter laporan oleh ${officer.name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {officer.name.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-800 text-[11px] truncate">
                      {officer.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span className="font-bold text-slate-900 text-xs">
                      {officer.total} lap
                    </span>
                    {officer.lastTime !== '-' && (
                      <span className="text-[10px] text-slate-400">({officer.lastTime})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Klik nama petugas untuk memfilter laporan spesifik
          </p>
        </div>
      </div>

      {/* OPERATIONAL ATTENTION ALERT (Urgent Follow-Up Panel) */}
      {unresolvedIssuesList.length > 0 ? (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">
                    Perhatian Operasional: {unresolvedIssuesList.length} Temuan Butuh Tindak Lanjut
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[10px] uppercase">
                    Prioritas Tinggi
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                  Daftar laporan dengan status <em>Ada Kerusakan</em> atau <em>Perlu Pengecekan Ulang</em> yang belum mendapatkan tindak lanjut atau perbaikan tuntas oleh teknisi/petugas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setQuickTagFilter(quickTagFilter === 'unresolved' ? 'all' : 'unresolved')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                  quickTagFilter === 'unresolved'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white hover:bg-amber-50 text-amber-900 border border-amber-300'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{quickTagFilter === 'unresolved' ? 'Tampilkan Semua' : 'Fokuskan Masalah Saja'}</span>
              </button>
            </div>
          </div>

          {/* Quick list of urgent locations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 pt-3 border-t border-amber-200">
            {unresolvedIssuesList.slice(0, 3).map((issue) => (
              <div
                key={issue.id}
                onClick={() => handleOpenDetail(issue)}
                className="p-2.5 rounded-xl bg-white/90 border border-amber-200 text-xs cursor-pointer hover:bg-white transition-all flex items-center justify-between shadow-2xs"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-slate-900 truncate text-[11px]">{issue.area}</p>
                  <p className="text-[10px] text-slate-500 truncate">{issue.namaPetugas} • {issue.waktu} WIB</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  issue.kondisiAkhir === 'Ada Kerusakan' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {issue.kondisiAkhir === 'Ada Kerusakan' ? 'Kerusakan' : 'Perlu Cek'}
                </span>
              </div>
            ))}
            {unresolvedIssuesList.length > 3 && (
              <button
                onClick={() => setQuickTagFilter('unresolved')}
                className="p-2.5 rounded-xl bg-white/60 border border-dashed border-amber-300 text-xs font-bold text-amber-800 hover:bg-white flex items-center justify-center gap-1"
              >
                <span>+{unresolvedIssuesList.length - 3} temuan lainnya</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-950 text-sm">Semua Fasilitas Terpantau Aman & Siap Digunakan</p>
              <p className="text-emerald-700 text-xs">
                Tidak ada temuan kerusakan aktif yang tertunda. Sanitasi lingkungan berada dalam standar operasional SCB.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">
            100% Terkendali
          </span>
        </div>
      )}

      {/* QUICK 1-CLICK CATEGORY TABS & COLOR LEGEND */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-slate-500 mr-1 text-[11px] uppercase tracking-wider">
              Filter Cepat:
            </span>
            <button
              onClick={() => setQuickTagFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                quickTagFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({reports.length})
            </button>
            <button
              onClick={() => setQuickTagFilter('unresolved')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
                quickTagFilter === 'unresolved'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Butuh Tindak Lanjut ({unresolvedIssuesList.length})</span>
            </button>
            <button
              onClick={() => setQuickTagFilter('pending_approval')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
                quickTagFilter === 'pending_approval'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Menunggu Verifikasi ({verificationCounts.pending})</span>
            </button>
            <button
              onClick={() => setQuickTagFilter('clean')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
                quickTagFilter === 'clean'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Kondisi Bersih ({reports.filter((r) => r.kondisiAkhir === 'Bersih').length})</span>
            </button>
            <button
              onClick={() => setQuickTagFilter('damage')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
                quickTagFilter === 'damage'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Kerusakan ({reports.filter((r) => r.kondisiAkhir === 'Ada Kerusakan').length})</span>
            </button>
          </div>

          {/* Color Legend (Guides the reader) */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shrink-0 self-start lg:self-auto">
            <span className="font-semibold text-slate-600">Panduan Warna:</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Bersih
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Perlu Cek
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rusak
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Terverifikasi
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div id="report-history-table" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
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

          {/* Date range filter tabs + Month History Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => {
                  setDateFilter('month');
                  setSelectedMonth(todayStr.slice(0, 7));
                }}
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

            {/* Riwayat Bulan Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
              <CalendarRange className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Histori Bulan:</span>
              <select
                value={dateFilter === 'specific_month' ? selectedMonth : dateFilter === 'month' ? todayStr.slice(0, 7) : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedMonth(e.target.value);
                    setDateFilter('specific_month');
                  }
                }}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="" disabled>-- Pilih Bulan --</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthIndo(m)} {m === todayStr.slice(0, 7) ? '(Bulan Ini)' : ''}
                  </option>
                ))}
              </select>
            </div>
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

        {/* Active Month History Banner */}
        {(dateFilter === 'specific_month' || dateFilter === 'month') && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-emerald-950 block sm:inline">
                  Riwayat Laporan Bulan: {formatMonthIndo(dateFilter === 'month' ? todayStr.slice(0, 7) : selectedMonth)}
                </span>
                <span className="text-emerald-700 text-[11px] sm:ml-2">
                  (Ditemukan {filteredReports.length} laporan • {filteredReports.filter((r) => r.kondisiAkhir === 'Bersih').length} bersih • {filteredReports.filter((r) => r.kondisiAkhir !== 'Bersih').length} temuan kendala)
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                onClick={() => onOpenPrintModal(filteredReports)}
                className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300 transition-colors flex items-center gap-1 shadow-2xs"
                title="Cetak rekap dokumen laporan bulan ini"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cetak Rekap</span>
              </button>
              <button
                onClick={() => exportReportsToCsv(filteredReports)}
                className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300 transition-colors flex items-center gap-1 shadow-2xs"
                title="Download file CSV/Excel bulan ini"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => setDateFilter('today')}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Kembali ke Hari Ini
              </button>
            </div>
          </div>
        )}

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
            onClick={() => onAddNewReport()}
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
              className={`bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col border-l-4 ${
                report.kondisiAkhir === 'Bersih'
                  ? 'border-l-emerald-500'
                  : report.kondisiAkhir === 'Ada Kerusakan'
                  ? 'border-l-rose-500'
                  : 'border-l-amber-500'
              }`}
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
                <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 max-w-[70%]">
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
                  {report.kondisiAkhir !== 'Bersih' && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 ${
                        !isReportFollowedUp(report, reports)
                          ? 'bg-amber-600 text-white'
                          : 'bg-emerald-700 text-white'
                      }`}
                    >
                      {!isReportFollowedUp(report, reports) ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>Belum Follow-Up</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Selesai</span>
                        </>
                      )}
                    </span>
                  )}
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
                      <div className="flex flex-col gap-1 items-start">
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
                        {report.kondisiAkhir !== 'Bersih' && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                              !isReportFollowedUp(report, reports)
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {!isReportFollowedUp(report, reports) ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                <span>Belum Follow-Up</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Selesai</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
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
                    Status: {activeReportDetail.statusVerifikasi}
                  </span>
                  {activeReportDetail.kondisiAkhir !== 'Bersih' && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        !isReportFollowedUp(activeReportDetail, reports)
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      {!isReportFollowedUp(activeReportDetail, reports) ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                          <span>Belum Ada Tindak Lanjut</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Sudah Ditindaklanjuti</span>
                        </>
                      )}
                    </span>
                  )}
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

                {/* Verifier Identity Indicator - Direct Supervisor Authority */}
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                        Persetujuan Langsung Level Supervisor (Tanpa Verifikasi Email / Login)
                      </span>
                      <span>
                        <strong>{currentUser?.name || registeredSupervisors[0]?.name || 'SUPERVISOR SARPRAS SCB'}</strong> (Supervisor Sarpras SCB)
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-xs">
                    Wewenang Langsung
                  </span>
                </div>

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

      {/* IN-PLACE APPROVAL TOAST NOTIFICATION (NO POPUPS) */}
      {approvalToast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-emerald-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{approvalToast.message}</span>
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
