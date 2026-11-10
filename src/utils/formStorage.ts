import { MasterRoom, MasterChecklist, FormSettings, RoomSchedule } from '../types';
import { getTodayDateString } from './storage';

const STORAGE_MASTER_ROOMS_KEY = 'scb_master_rooms_v1';
const STORAGE_MASTER_CHECKLISTS_KEY = 'scb_master_checklists_v1';
const STORAGE_FORM_SETTINGS_KEY = 'scb_form_settings_v1';
const STORAGE_ROOM_SCHEDULES_KEY = 'scb_room_schedules_v1';

export const DEFAULT_MASTER_ROOMS: MasterRoom[] = [
  {
    id: 'room-1',
    name: 'KM MASJID PUTRA',
    code: 'KM-01',
    zone: 'Zona Ibadah',
    isMandatoryDaily: true,
    isActive: true,
    orderIndex: 1,
    description: 'Kamar mandi dan toilet masjid santri putra',
  },
  {
    id: 'room-2',
    name: 'KM KANTOR UTAMA',
    code: 'KM-02',
    zone: 'Zona Administrasi',
    isMandatoryDaily: true,
    isActive: true,
    orderIndex: 2,
    description: 'Kamar mandi staf pengajar dan pimpinan',
  },
  {
    id: 'room-3',
    name: 'KM KELAS PUTRA',
    code: 'KM-03',
    zone: 'Zona Asrama/Kelas',
    isMandatoryDaily: true,
    isActive: true,
    orderIndex: 3,
    description: 'Kamar mandi area gedung kelas santri putra',
  },
  {
    id: 'room-4',
    name: 'T WUDHU KLINIK',
    code: 'KM-04',
    zone: 'Zona Kesehatan',
    isMandatoryDaily: true,
    isActive: true,
    orderIndex: 4,
    description: 'Tempat wudhu dan sanitasi klinik kesehatan',
  },
  {
    id: 'room-5',
    name: 'KM KELAS PUTRI',
    code: 'KM-05',
    zone: 'Zona Asrama/Kelas',
    isMandatoryDaily: true,
    isActive: true,
    orderIndex: 5,
    description: 'Kamar mandi area gedung kelas santri putri',
  },
  {
    id: 'room-6',
    name: 'KM UKS',
    code: 'KM-06',
    zone: 'Zona Kesehatan',
    isMandatoryDaily: true,
    isActive: true,
    orderIndex: 6,
    description: 'Kamar mandi ruang unit kesehatan sekolah',
  },
];

export const DEFAULT_MASTER_CHECKLISTS: MasterChecklist[] = [
  {
    id: 'chk-1',
    label: 'Kloset Bersih',
    category: 'Kebersihan',
    isRequired: true,
    isActive: true,
    orderIndex: 1,
    description: 'Kloset disikat bersih bebas noda dan bau',
  },
  {
    id: 'chk-2',
    label: 'Kran Ada',
    category: 'Kelengkapan',
    isRequired: true,
    isActive: true,
    orderIndex: 2,
    description: 'Kran air terpasang dan berfungsi mengalir baik',
  },
  {
    id: 'chk-3',
    label: 'Ember Ada',
    category: 'Kelengkapan',
    isRequired: true,
    isActive: true,
    orderIndex: 3,
    description: 'Ember penampung air tersedia dalam kondisi utuh',
  },
  {
    id: 'chk-4',
    label: 'Air ada',
    category: 'Fasilitas',
    isRequired: true,
    isActive: true,
    orderIndex: 4,
    description: 'Pasokan air mengalir lancar dan jernih',
  },
  {
    id: 'chk-5',
    label: 'Gayung Ada',
    category: 'Kelengkapan',
    isRequired: true,
    isActive: true,
    orderIndex: 5,
    description: 'Gayung mandi tersedia dan bersih',
  },
  {
    id: 'chk-6',
    label: 'Lantai Kering & Bersih',
    category: 'Kebersihan',
    isRequired: false,
    isActive: true,
    orderIndex: 6,
    description: 'Lantai disikat, tidak licin, bebas lumut',
  },
  {
    id: 'chk-7',
    label: 'Tempat Sampah Bersih',
    category: 'Kebersihan',
    isRequired: false,
    isActive: true,
    orderIndex: 7,
    description: 'Tempat sampah kosong dan terlapisi plastik',
  },
];

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  requirePhoto: true,
  minPhotos: 1,
  allowOtherRoom: true,
  allowCustomChecklist: true,
  guidelinesText:
    'Petugas wajib memeriksa seluruh titik sanitasi dengan teliti. Laporkan kendala kran bocor, kloset mampet, atau kekurangan air segera.',
  operatingHours: '06:00 - 18:00',
  updatedAt: '2026-01-01',
};

// Senin s/d Sabtu = [1, 2, 3, 4, 5, 6]
export const DEFAULT_ROOM_SCHEDULES: RoomSchedule[] = [
  {
    id: 'sch-1',
    roomName: 'KM MASJID PUTRA',
    officerId: 'user-officer-1',
    officerName: 'IDAY M YUSUF',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    shift: 'Harian',
    isActive: true,
    notes: 'Jadwal rutin harian Senin s/d Sabtu',
  },
  {
    id: 'sch-2',
    roomName: 'KM KELAS PUTRA',
    officerId: 'user-officer-1',
    officerName: 'IDAY M YUSUF',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    shift: 'Harian',
    isActive: true,
    notes: 'Jadwal rutin harian Senin s/d Sabtu',
  },
  {
    id: 'sch-3',
    roomName: 'KM KANTOR UTAMA',
    officerId: 'user-officer-2',
    officerName: 'ABDUL KODIR',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    shift: 'Harian',
    isActive: true,
    notes: 'Jadwal rutin harian Senin s/d Sabtu',
  },
  {
    id: 'sch-4',
    roomName: 'T WUDHU KLINIK',
    officerId: 'user-officer-2',
    officerName: 'ABDUL KODIR',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    shift: 'Harian',
    isActive: true,
    notes: 'Jadwal rutin harian Senin s/d Sabtu',
  },
  {
    id: 'sch-5',
    roomName: 'KM KELAS PUTRI',
    officerId: 'user-officer-3',
    officerName: 'WAHYUDIN',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    shift: 'Harian',
    isActive: true,
    notes: 'Jadwal rutin harian Senin s/d Sabtu',
  },
  {
    id: 'sch-6',
    roomName: 'KM UKS',
    officerId: 'user-officer-3',
    officerName: 'WAHYUDIN',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    shift: 'Harian',
    isActive: true,
    notes: 'Jadwal rutin harian Senin s/d Sabtu',
  },
];

// =======================
// MASTER ROOMS PERSISTENCE
// =======================

export function getMasterRooms(): MasterRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_MASTER_ROOMS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_MASTER_ROOMS_KEY, JSON.stringify(DEFAULT_MASTER_ROOMS));
      return DEFAULT_MASTER_ROOMS;
    }
    const parsed: MasterRoom[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_MASTER_ROOMS_KEY, JSON.stringify(DEFAULT_MASTER_ROOMS));
      return DEFAULT_MASTER_ROOMS;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to get master rooms', e);
    return DEFAULT_MASTER_ROOMS;
  }
}

export function saveMasterRooms(rooms: MasterRoom[]): void {
  try {
    localStorage.setItem(STORAGE_MASTER_ROOMS_KEY, JSON.stringify(rooms));
  } catch (e) {
    console.warn('Failed to save master rooms', e);
  }
}

export function addMasterRoom(room: Omit<MasterRoom, 'id'>): MasterRoom {
  const rooms = getMasterRooms();
  const newRoom: MasterRoom = {
    ...room,
    id: `room-${Date.now()}`,
    createdAt: getTodayDateString(),
  };
  rooms.push(newRoom);
  saveMasterRooms(rooms);
  return newRoom;
}

export function updateMasterRoom(id: string, updates: Partial<MasterRoom>): MasterRoom | null {
  const rooms = getMasterRooms();
  const idx = rooms.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rooms[idx] = { ...rooms[idx], ...updates };
  saveMasterRooms(rooms);
  return rooms[idx];
}

export function deleteMasterRoom(id: string): boolean {
  const rooms = getMasterRooms();
  const filtered = rooms.filter((r) => r.id !== id);
  if (filtered.length === rooms.length) return false;
  saveMasterRooms(filtered);
  return true;
}

// ============================
// MASTER CHECKLIST PERSISTENCE
// ============================

export function getMasterChecklists(): MasterChecklist[] {
  try {
    const raw = localStorage.getItem(STORAGE_MASTER_CHECKLISTS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_MASTER_CHECKLISTS_KEY, JSON.stringify(DEFAULT_MASTER_CHECKLISTS));
      return DEFAULT_MASTER_CHECKLISTS;
    }
    const parsed: MasterChecklist[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_MASTER_CHECKLISTS_KEY, JSON.stringify(DEFAULT_MASTER_CHECKLISTS));
      return DEFAULT_MASTER_CHECKLISTS;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to get master checklists', e);
    return DEFAULT_MASTER_CHECKLISTS;
  }
}

export function saveMasterChecklists(items: MasterChecklist[]): void {
  try {
    localStorage.setItem(STORAGE_MASTER_CHECKLISTS_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save master checklists', e);
  }
}

export function addMasterChecklist(item: Omit<MasterChecklist, 'id'>): MasterChecklist {
  const items = getMasterChecklists();
  const newItem: MasterChecklist = {
    ...item,
    id: `chk-${Date.now()}`,
  };
  items.push(newItem);
  saveMasterChecklists(items);
  return newItem;
}

export function updateMasterChecklist(id: string, updates: Partial<MasterChecklist>): MasterChecklist | null {
  const items = getMasterChecklists();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  saveMasterChecklists(items);
  return items[idx];
}

export function deleteMasterChecklist(id: string): boolean {
  const items = getMasterChecklists();
  const filtered = items.filter((i) => i.id !== id);
  if (filtered.length === items.length) return false;
  saveMasterChecklists(items);
  return true;
}

// ========================
// FORM SETTINGS
// ========================

export function getFormSettings(): FormSettings {
  try {
    const raw = localStorage.getItem(STORAGE_FORM_SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_FORM_SETTINGS_KEY, JSON.stringify(DEFAULT_FORM_SETTINGS));
      return DEFAULT_FORM_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FORM_SETTINGS, ...parsed };
  } catch (e) {
    return DEFAULT_FORM_SETTINGS;
  }
}

export function saveFormSettings(settings: FormSettings): void {
  try {
    localStorage.setItem(STORAGE_FORM_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save form settings', e);
  }
}

// ========================
// ROOM SCHEDULES & ACCESS CONTROL
// ========================

export function getRoomSchedules(): RoomSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_ROOM_SCHEDULES_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_ROOM_SCHEDULES_KEY, JSON.stringify(DEFAULT_ROOM_SCHEDULES));
      return DEFAULT_ROOM_SCHEDULES;
    }
    const parsed: RoomSchedule[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_ROOM_SCHEDULES_KEY, JSON.stringify(DEFAULT_ROOM_SCHEDULES));
      return DEFAULT_ROOM_SCHEDULES;
    }
    return parsed;
  } catch (e) {
    return DEFAULT_ROOM_SCHEDULES;
  }
}

export function saveRoomSchedules(schedules: RoomSchedule[]): void {
  try {
    localStorage.setItem(STORAGE_ROOM_SCHEDULES_KEY, JSON.stringify(schedules));
  } catch (e) {
    console.warn('Failed to save room schedules', e);
  }
}

export function updateRoomSchedule(id: string, updates: Partial<RoomSchedule>): RoomSchedule | null {
  const schedules = getRoomSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  schedules[idx] = { ...schedules[idx], ...updates, updatedAt: getTodayDateString() };
  saveRoomSchedules(schedules);
  return schedules[idx];
}

export function setRoomScheduleForRoom(
  roomName: string,
  officerId: string,
  officerName: string,
  daysOfWeek: number[] = [1, 2, 3, 4, 5, 6]
): RoomSchedule {
  const schedules = getRoomSchedules();
  const cleanRoom = roomName.trim().toUpperCase();
  const existing = schedules.find((s) => s.roomName && s.roomName.trim().toUpperCase() === cleanRoom);
  const otherSchedules = schedules.filter((s) => !s.roomName || s.roomName.trim().toUpperCase() !== cleanRoom);

  const newSch: RoomSchedule = {
    id: existing?.id || `sch-${Date.now()}`,
    roomName: roomName.trim(),
    officerId,
    officerName,
    daysOfWeek,
    shift: existing?.shift || 'Harian',
    isActive: true,
    updatedAt: getTodayDateString(),
  };

  const updated = [...otherSchedules, newSch];
  saveRoomSchedules(updated);
  return newSch;
}

/**
 * Returns the day index of the given date (1=Monday ... 6=Saturday, 0=Sunday)
 */
export function getDayIndex(dateStr?: string): number {
  if (!dateStr) {
    return new Date().getDay();
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay();
}

export function getIndonesianDayName(dayIndex: number): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dayIndex] || 'Hari Ini';
}

/**
 * Gets the scheduled officer for a specific room on a specific day/date
 */
export function getScheduledOfficerForRoom(
  roomName: string,
  dateStr?: string,
  customSchedules?: RoomSchedule[]
): RoomSchedule | undefined {
  const schedules = customSchedules && customSchedules.length > 0 ? customSchedules : getRoomSchedules();
  const targetDay = getDayIndex(dateStr);
  const cleanRoom = (roomName || '').trim().toUpperCase();

  return schedules.find(
    (s) =>
      s &&
      s.isActive !== false &&
      s.roomName &&
      typeof s.roomName === 'string' &&
      s.roomName.trim().toUpperCase() === cleanRoom &&
      Array.isArray(s.daysOfWeek) &&
      s.daysOfWeek.includes(targetDay)
  );
}

/**
 * Checks if a specific officer is permitted to report a room today.
 * Rule: Kegiatan hanya bisa dilaporkan oleh petugas terjadwal!
 */
export function isOfficerAllowedToReportRoom(
  officerId: string,
  officerName: string,
  roomName: string,
  dateStr?: string,
  userRole?: string,
  customSchedules?: RoomSchedule[]
): { allowed: boolean; reason?: string; scheduledOfficer?: string } {
  // Superadmin and supervisor have full override authority for inspections/monitoring
  if (userRole === 'superadmin' || userRole === 'supervisor') {
    return { allowed: true };
  }

  const cleanRoom = (roomName || '').trim().toUpperCase();
  const targetDay = getDayIndex(dateStr);
  const dayName = getIndonesianDayName(targetDay);

  // If selecting 'Other', check if form settings allow other rooms
  if (cleanRoom === 'OTHER') {
    return { allowed: true };
  }

  const schedule = getScheduledOfficerForRoom(roomName, dateStr, customSchedules);

  if (!schedule) {
    // If room is not scheduled to anyone today, allowed as fallback
    return { allowed: true };
  }

  const isMatched =
    (schedule.officerId && schedule.officerId === officerId) ||
    (schedule.officerName && schedule.officerName.trim().toLowerCase() === (officerName || '').trim().toLowerCase());

  if (isMatched) {
    return { allowed: true, scheduledOfficer: schedule.officerName };
  }

  return {
    allowed: false,
    scheduledOfficer: schedule.officerName,
    reason: `Ruangan "${roomName}" hari ini (${dayName}) ditugaskan kepada ${schedule.officerName}. Anda hanya dapat mengisi laporan untuk ruangan tugas Anda.`,
  };
}

/**
 * Returns all room names assigned to an officer for today / specific date
 */
export function getOfficerScheduledRooms(
  officerId: string,
  officerName: string,
  dateStr?: string,
  customSchedules?: RoomSchedule[]
): string[] {
  const schedules = customSchedules && customSchedules.length > 0 ? customSchedules : getRoomSchedules();
  const targetDay = getDayIndex(dateStr);
  const cleanOfficerName = (officerName || '').trim().toLowerCase();

  return schedules
    .filter(
      (s) =>
        s &&
        s.isActive !== false &&
        Array.isArray(s.daysOfWeek) &&
        s.daysOfWeek.includes(targetDay) &&
        (s.officerId === officerId || (s.officerName && s.officerName.trim().toLowerCase() === cleanOfficerName))
    )
    .map((s) => s.roomName)
    .filter(Boolean);
}
