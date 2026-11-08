import React, { useState } from 'react';
import { 
  MasterRoom, 
  MasterChecklist, 
  FormSettings, 
  RoomSchedule, 
  User 
} from '../types';
import { 
  Building2, 
  CheckSquare, 
  CalendarDays, 
  Sliders, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  Clock, 
  Camera, 
  Layers, 
  Sparkles,
  Info,
  Calendar,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { getIndonesianDayName, getDayIndex } from '../utils/formStorage';

interface FormManagementProps {
  rooms: MasterRoom[];
  checklists: MasterChecklist[];
  formSettings: FormSettings;
  schedules: RoomSchedule[];
  officers: User[];
  allUsers: User[];
  currentUser: User | null;
  onSaveRooms: (rooms: MasterRoom[]) => void;
  onSaveChecklists: (checklists: MasterChecklist[]) => void;
  onSaveFormSettings: (settings: FormSettings) => void;
  onSaveSchedules: (schedules: RoomSchedule[]) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const FormManagement: React.FC<FormManagementProps> = ({
  rooms,
  checklists,
  formSettings,
  schedules,
  officers,
  currentUser,
  onSaveRooms,
  onSaveChecklists,
  onSaveFormSettings,
  onSaveSchedules,
  onShowToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'rooms' | 'checklists' | 'schedules' | 'settings'>('schedules');

  // Modal State for Master Room
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<MasterRoom | null>(null);
  const [roomFormData, setRoomFormData] = useState({
    name: '',
    code: '',
    zone: 'Zona Ibadah',
    isMandatoryDaily: true,
    isActive: true,
    description: '',
  });

  // Modal State for Master Checklist
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<MasterChecklist | null>(null);
  const [checklistFormData, setChecklistFormData] = useState({
    label: '',
    category: 'Kebersihan' as 'Fasilitas' | 'Kebersihan' | 'Kelengkapan' | 'Lainnya',
    isRequired: true,
    isActive: true,
    description: '',
  });

  // Settings local state
  const [localSettings, setLocalSettings] = useState<FormSettings>({ ...formSettings });

  // Today context for live preview
  const todayIndex = new Date().getDay();
  const todayName = getIndonesianDayName(todayIndex);

  // =====================
  // ROOM HANDLERS
  // =====================
  const handleOpenAddRoom = () => {
    setEditingRoom(null);
    setRoomFormData({
      name: '',
      code: `KM-0${rooms.length + 1}`,
      zone: 'Zona Ibadah',
      isMandatoryDaily: true,
      isActive: true,
      description: '',
    });
    setIsRoomModalOpen(true);
  };

  const handleOpenEditRoom = (room: MasterRoom) => {
    setEditingRoom(room);
    setRoomFormData({
      name: room.name,
      code: room.code || '',
      zone: room.zone || 'Zona Ibadah',
      isMandatoryDaily: room.isMandatoryDaily,
      isActive: room.isActive,
      description: room.description || '',
    });
    setIsRoomModalOpen(true);
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomFormData.name.trim()) {
      onShowToast('Nama ruangan wajib diisi', 'error');
      return;
    }

    const cleanName = roomFormData.name.trim().toUpperCase();

    if (editingRoom) {
      const updatedRooms = rooms.map((r) =>
        r.id === editingRoom.id
          ? {
              ...r,
              name: cleanName,
              code: roomFormData.code.trim().toUpperCase(),
              zone: roomFormData.zone,
              isMandatoryDaily: roomFormData.isMandatoryDaily,
              isActive: roomFormData.isActive,
              description: roomFormData.description.trim(),
            }
          : r
      );
      onSaveRooms(updatedRooms);

      // Also update roomName in schedules if renamed
      if (editingRoom.name !== cleanName) {
        const updatedSchedules = schedules.map((s) =>
          s.roomName === editingRoom.name ? { ...s, roomName: cleanName } : s
        );
        onSaveSchedules(updatedSchedules);
      }

      onShowToast(`Ruangan "${cleanName}" berhasil diperbarui!`, 'success');
    } else {
      // Check duplicate
      if (rooms.some((r) => r.name.toUpperCase() === cleanName)) {
        onShowToast(`Ruangan "${cleanName}" sudah terdaftar.`, 'error');
        return;
      }

      const newRoom: MasterRoom = {
        id: `room-${Date.now()}`,
        name: cleanName,
        code: roomFormData.code.trim().toUpperCase() || `KM-0${rooms.length + 1}`,
        zone: roomFormData.zone,
        isMandatoryDaily: roomFormData.isMandatoryDaily,
        isActive: roomFormData.isActive,
        orderIndex: rooms.length + 1,
        description: roomFormData.description.trim(),
      };
      onSaveRooms([...rooms, newRoom]);

      // Automatically create a default schedule entry for this new room with first available officer
      if (officers.length > 0) {
        const defaultOfficer = officers[rooms.length % officers.length];
        const newSchedule: RoomSchedule = {
          id: `sch-${Date.now()}`,
          roomId: newRoom.id,
          roomName: cleanName,
          officerId: defaultOfficer.id,
          officerName: defaultOfficer.name,
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          shift: 'Harian',
          isActive: true,
          notes: 'Jadwal otomatis ruangan baru',
        };
        onSaveSchedules([...schedules, newSchedule]);
      }

      onShowToast(`Ruangan baru "${cleanName}" berhasil ditambahkan!`, 'success');
    }

    setIsRoomModalOpen(false);
  };

  const handleDeleteRoom = (roomId: string, roomName: string) => {
    const updatedRooms = rooms.filter((r) => r.id !== roomId);
    onSaveRooms(updatedRooms);
    const updatedSchedules = schedules.filter((s) => s.roomName !== roomName);
    onSaveSchedules(updatedSchedules);
    onShowToast(`Ruangan "${roomName}" telah dihapus.`, 'info');
  };

  const handleToggleRoomActive = (roomId: string) => {
    const updated = rooms.map((r) => (r.id === roomId ? { ...r, isActive: !r.isActive } : r));
    onSaveRooms(updated);
    onShowToast('Status aktif ruangan diperbarui.', 'success');
  };

  // =====================
  // CHECKLIST HANDLERS
  // =====================
  const handleOpenAddChecklist = () => {
    setEditingChecklist(null);
    setChecklistFormData({
      label: '',
      category: 'Kebersihan',
      isRequired: true,
      isActive: true,
      description: '',
    });
    setIsChecklistModalOpen(true);
  };

  const handleOpenEditChecklist = (chk: MasterChecklist) => {
    setEditingChecklist(chk);
    setChecklistFormData({
      label: chk.label,
      category: chk.category,
      isRequired: chk.isRequired,
      isActive: chk.isActive,
      description: chk.description || '',
    });
    setIsChecklistModalOpen(true);
  };

  const handleSaveChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistFormData.label.trim()) {
      onShowToast('Label checklist wajib diisi', 'error');
      return;
    }

    const cleanLabel = checklistFormData.label.trim();

    if (editingChecklist) {
      const updated = checklists.map((c) =>
        c.id === editingChecklist.id
          ? {
              ...c,
              label: cleanLabel,
              category: checklistFormData.category,
              isRequired: checklistFormData.isRequired,
              isActive: checklistFormData.isActive,
              description: checklistFormData.description.trim(),
            }
          : c
      );
      onSaveChecklists(updated);
      onShowToast(`Item checklist "${cleanLabel}" berhasil diperbarui!`, 'success');
    } else {
      const newItem: MasterChecklist = {
        id: `chk-${Date.now()}`,
        label: cleanLabel,
        category: checklistFormData.category,
        isRequired: checklistFormData.isRequired,
        isActive: checklistFormData.isActive,
        orderIndex: checklists.length + 1,
        description: checklistFormData.description.trim(),
      };
      onSaveChecklists([...checklists, newItem]);
      onShowToast(`Item checklist baru "${cleanLabel}" berhasil ditambahkan!`, 'success');
    }

    setIsChecklistModalOpen(false);
  };

  const handleDeleteChecklist = (chkId: string, label: string) => {
    const updated = checklists.filter((c) => c.id !== chkId);
    onSaveChecklists(updated);
    onShowToast(`Item checklist "${label}" telah dihapus.`, 'info');
  };

  const handleToggleChecklistActive = (chkId: string) => {
    const updated = checklists.map((c) => (c.id === chkId ? { ...c, isActive: !c.isActive } : c));
    onSaveChecklists(updated);
    onShowToast('Status checklist diperbarui.', 'success');
  };

  // =====================
  // SCHEDULE HANDLERS
  // =====================
  const handleAssignOfficer = (roomName: string, officerId: string) => {
    const officer = officers.find((o) => o.id === officerId);
    if (!officer) return;

    const existingIdx = schedules.findIndex((s) => s.roomName === roomName);
    let updated: RoomSchedule[];

    if (existingIdx >= 0) {
      updated = [...schedules];
      updated[existingIdx] = {
        ...updated[existingIdx],
        officerId: officer.id,
        officerName: officer.name,
      };
    } else {
      const newSch: RoomSchedule = {
        id: `sch-${Date.now()}`,
        roomName,
        officerId: officer.id,
        officerName: officer.name,
        daysOfWeek: [1, 2, 3, 4, 5, 6],
        shift: 'Harian',
        isActive: true,
      };
      updated = [...schedules, newSch];
    }

    onSaveSchedules(updated);
    onShowToast(`Penugasan "${roomName}" dialihkan ke ${officer.name}.`, 'success');
  };

  const handleToggleDayForRoom = (roomName: string, dayNumber: number) => {
    const existing = schedules.find((s) => s.roomName === roomName);
    if (!existing) return;

    const currentDays = Array.isArray(existing.daysOfWeek) ? existing.daysOfWeek : [1, 2, 3, 4, 5, 6];
    let newDays: number[];
    if (currentDays.includes(dayNumber)) {
      newDays = currentDays.filter((d) => d !== dayNumber);
      if (newDays.length === 0) {
        onShowToast('Minimal 1 hari penugasan harus aktif.', 'error');
        return;
      }
    } else {
      newDays = [...currentDays, dayNumber].sort();
    }

    const updated = schedules.map((s) =>
      s.roomName === roomName ? { ...s, daysOfWeek: newDays } : s
    );
    onSaveSchedules(updated);
    onShowToast(`Jadwal hari untuk ${roomName} diperbarui.`, 'success');
  };

  const handleAutoDistribute = () => {
    if (officers.length === 0) {
      onShowToast('Belum ada petugas aktif yang terdaftar.', 'error');
      return;
    }

    const newSchedules: RoomSchedule[] = rooms.map((room, idx) => {
      const assignedOfficer = officers[idx % officers.length];
      return {
        id: `sch-${room.id}-${Date.now()}`,
        roomId: room.id,
        roomName: room.name,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.name,
        daysOfWeek: [1, 2, 3, 4, 5, 6], // Senin s/d Sabtu
        shift: 'Harian',
        isActive: true,
        notes: 'Dibagi otomatis sistem',
      };
    });

    onSaveSchedules(newSchedules);
    onShowToast(`Berhasil membagi rata ${rooms.length} ruangan ke ${officers.length} petugas!`, 'success');
  };

  // =====================
  // SETTINGS HANDLERS
  // =====================
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveFormSettings(localSettings);
    onShowToast('Pengaturan formulir berhasil disimpan!', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Otoritas Penuh Superadmin SCB</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Pengelolaan Form & Penugasan Ruangan Petugas
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Atur daftar ruangan sanitasi, poin checklist inspeksi, serta pembagian jadwal petugas. Sesuai kebijakan SCB, <strong>kegiatan pelaporan dibatasi hanya dapat diisi oleh petugas yang terjadwal</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl px-4 py-2.5 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Status Hari Ini</span>
              <strong className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                {todayName} ({todayIndex >= 1 && todayIndex <= 6 ? 'Hari Kerja' : 'Hari Libur'})
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab('schedules')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'schedules'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Jadwal Ruangan Petugas</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeSubTab === 'schedules' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            Kunci Akses
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('rooms')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'rooms'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Master Ruangan ({rooms.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('checklists')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'checklists'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Master Checklist ({checklists.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Pengaturan Form & SOP</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB 1: JADWAL RUANGAN PETUGAS (RULE ENFORCEMENT)     */}
      {/* ========================================================= */}
      {activeSubTab === 'schedules' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Policy Guidance Callout */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-950 text-xs flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950 text-sm">
                  Aturan Penugasan: Kegiatan Hanya Bisa Dilaporkan oleh Petugas Terjadwal
                </p>
                <p className="text-amber-800 leading-relaxed text-xs">
                  Setiap ruangan kamar mandi memiliki petugas penanggung jawab yang dijadwalkan pada hari kerja (Senin s/d Sabtu). Saat petugas membuka form laporan, sistem akan <strong>mengunci pilihan ruangan</strong> di luar jadwal mereka, sehingga data laporan terverifikasi akurat sesuai pembagian tugas.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoDistribute}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shrink-0 shadow-xs flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Bagi Rata Otomatis</span>
            </button>
          </div>

          {/* Officers Overview Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {officers.map((officer) => {
              const assignedRoomsCount = schedules.filter(
                (s) => s.officerId === officer.id || s.officerName.toLowerCase() === officer.name.toLowerCase()
              ).length;

              return (
                <div key={officer.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      {officer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{officer.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{officer.email}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {assignedRoomsCount} Ruangan
                  </span>
                </div>
              );
            })}
          </div>

          {/* Main Scheduling Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-600" />
                  Matriks Pembagian Ruangan & Jadwal Hari Kerja Petugas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan petugas penanggung jawab dan hari operasional untuk setiap ruangan sanitasi.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Total {rooms.length} Ruangan Aktif
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nama Ruangan Kamar Mandi</th>
                    <th className="py-3 px-4">Petugas Terjadwal</th>
                    <th className="py-3 px-4">Hari Penugasan (Senin - Sabtu)</th>
                    <th className="py-3 px-4">Hak Lapor Hari Ini ({todayName})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rooms.map((room) => {
                    const currentSchedule = schedules.find((s) => s.roomName === room.name);
                    const assignedOfficerName = currentSchedule?.officerName || 'Belum Ditugaskan';
                    const assignedDays = currentSchedule?.daysOfWeek || [1, 2, 3, 4, 5, 6];
                    const isAssignedToday = assignedDays.includes(todayIndex);

                    return (
                      <tr key={room.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{room.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-500">{room.zone || 'Area Umum'}</span>
                                {room.isMandatoryDaily && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded">
                                    Target Wajib
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={currentSchedule?.officerId || ''}
                            onChange={(e) => handleAssignOfficer(room.name, e.target.value)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 cursor-pointer"
                          >
                            <option value="" disabled>Pilih Petugas...</option>
                            {officers.map((off) => (
                              <option key={off.id} value={off.id}>
                                {off.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {[
                              { num: 1, label: 'Sen' },
                              { num: 2, label: 'Sel' },
                              { num: 3, label: 'Rab' },
                              { num: 4, label: 'Kam' },
                              { num: 5, label: 'Jum' },
                              { num: 6, label: 'Sab' },
                            ].map((day) => {
                              const isChecked = assignedDays.includes(day.num);
                              const isToday = todayIndex === day.num;

                              return (
                                <button
                                  key={day.num}
                                  type="button"
                                  onClick={() => handleToggleDayForRoom(room.name, day.num)}
                                  className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    isChecked
                                      ? isToday
                                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                  }`}
                                  title={`${day.label} (${isChecked ? 'Aktif' : 'Non-aktif'})`}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isAssignedToday ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{assignedOfficerName}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                              <span>Tidak dijadwalkan hari ini</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 2: MASTER RUANGAN                                 */}
      {/* ========================================================= */}
      {activeSubTab === 'rooms' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Daftar Ruangan Kamar Mandi & Titik Sanitasi SCB
              </h3>
              <p className="text-xs text-slate-500">
                Tambah atau sesuaikan area sanitasi yang dimonitor pada formulir dan target harian.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddRoom}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Ruangan Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {rooms.map((room) => {
              const schedule = schedules.find((s) => s.roomName === room.name);

              return (
                <div
                  key={room.id}
                  className={`p-4 rounded-2xl border transition-all bg-white relative flex flex-col justify-between ${
                    room.isActive ? 'border-slate-200 shadow-xs' : 'border-slate-200 bg-slate-50 opacity-70'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {room.code || 'KM'}
                        </span>
                        {room.isMandatoryDaily && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Target Wajib
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRoom(room)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Ruangan"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoom(room.id, room.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Ruangan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{room.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{room.description || room.zone || 'Area Kamar Mandi'}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Petugas Penanggung Jawab:</span>
                        <strong className="text-slate-700">{schedule?.officerName || 'Belum diatur'}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Zona:</span>
                        <span className="text-slate-600 font-medium">{room.zone || 'Zona Umum'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleRoomActive(room.id)}
                      className={`text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer ${
                        room.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${room.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{room.isActive ? 'Status Aktif' : 'Dinonaktifkan'}</span>
                    </button>
                    <span className="text-[10px] text-slate-400">Urutan: #{room.orderIndex || 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 3: MASTER CHECKLIST                               */}
      {/* ========================================================= */}
      {activeSubTab === 'checklists' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                Poin Checklist Inspeksi Kebersihan Form
              </h3>
              <p className="text-xs text-slate-500">
                Poin-poin penilaian yang harus diperiksa dan dicentang oleh petugas saat membuat laporan kebersihan.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddChecklist}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Item Checklist</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {checklists.map((chk, idx) => (
                <div
                  key={chk.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                    !chk.isActive ? 'opacity-60 bg-slate-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{chk.label}</h4>
                        <span
                          className={`text-[9px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                            chk.category === 'Kebersihan'
                              ? 'bg-emerald-100 text-emerald-800'
                              : chk.category === 'Fasilitas'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {chk.category}
                        </span>
                        {chk.isRequired && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-rose-50 text-rose-700 font-bold rounded border border-rose-200">
                            Wajib
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{chk.description || 'Pemeriksaan sanitasi rutin'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleChecklistActive(chk.id)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer ${
                        chk.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {chk.isActive ? 'Aktif' : 'Non-aktif'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditChecklist(chk)}
                      className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Edit Checklist"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteChecklist(chk.id, chk.label)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus Checklist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 4: PENGATURAN FORM & SOP                         */}
      {/* ========================================================= */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                Kebijakan Formulir & Standar Operasional Prosedur (SOP)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur validasi pengisian formulir, kewajiban upload bukti foto, dan pesan petunjuk bagi petugas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      Kewajiban Upload Bukti Foto
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Petugas harus melampirkan foto hasil pembersihan sebelum laporan dapat dikirimkan.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.requirePhoto}
                    onChange={(e) => setLocalSettings({ ...localSettings, requirePhoto: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer mt-1"
                  />
                </div>

                {localSettings.requirePhoto && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">Minimal Jumlah Foto:</span>
                    <select
                      value={localSettings.minPhotos}
                      onChange={(e) => setLocalSettings({ ...localSettings, minPhotos: Number(e.target.value) })}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                    >
                      <option value={1}>1 Foto Bukti</option>
                      <option value={2}>2 Foto Bukti</option>
                      <option value={3}>3 Foto Bukti</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      Jam Operasional Pelaporan
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Rentang waktu pengisian laporan harian santri & petugas.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <input
                    type="text"
                    value={localSettings.operatingHours}
                    onChange={(e) => setLocalSettings({ ...localSettings, operatingHours: e.target.value })}
                    placeholder="06:00 - 18:00"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Standar SCB: 06:00 - 18:00 WIB</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Pesan Panduan SOP Petugas (Ditampilkan di Atas Form):
              </label>
              <textarea
                rows={3}
                value={localSettings.guidelinesText}
                onChange={(e) => setLocalSettings({ ...localSettings, guidelinesText: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm leading-relaxed"
                placeholder="Petugas wajib memeriksa seluruh titik sanitasi dengan teliti..."
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Kebijakan Form</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT MASTER ROOM                             */}
      {/* ========================================================= */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                {editingRoom ? 'Edit Master Ruangan' : 'Tambah Ruangan Baru'}
              </h3>
              <button
                onClick={() => setIsRoomModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Ruangan Kamar Mandi:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: KM ASRAMA PUTRA LT 2"
                  value={roomFormData.name}
                  onChange={(e) => setRoomFormData({ ...roomFormData, name: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Ruangan:</label>
                  <input
                    type="text"
                    placeholder="KM-07"
                    value={roomFormData.code}
                    onChange={(e) => setRoomFormData({ ...roomFormData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Zona Gedung:</label>
                  <select
                    value={roomFormData.zone}
                    onChange={(e) => setRoomFormData({ ...roomFormData, zone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
                  >
                    <option value="Zona Ibadah">Zona Ibadah</option>
                    <option value="Zona Administrasi">Zona Administrasi</option>
                    <option value="Zona Asrama/Kelas">Zona Asrama/Kelas</option>
                    <option value="Zona Kesehatan">Zona Kesehatan</option>
                    <option value="Zona Olahraga">Zona Olahraga</option>
                    <option value="Zona Umum">Zona Umum</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Lokasi:</label>
                <input
                  type="text"
                  placeholder="Deskripsi lokasi detail ruangan"
                  value={roomFormData.description}
                  onChange={(e) => setRoomFormData({ ...roomFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roomFormData.isMandatoryDaily}
                    onChange={(e) => setRoomFormData({ ...roomFormData, isMandatoryDaily: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">Wajib Dilaporkan Harian (Target 100%)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roomFormData.isActive}
                    onChange={(e) => setRoomFormData({ ...roomFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-700">Ruangan Aktif untuk Pelaporan</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Simpan Ruangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT MASTER CHECKLIST                        */}
      {/* ========================================================= */}
      {isChecklistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                {editingChecklist ? 'Edit Poin Checklist' : 'Tambah Poin Checklist'}
              </h3>
              <button
                onClick={() => setIsChecklistModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChecklist} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Label Poin Checklist:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sabun Cuci Tangan Tersedia"
                  value={checklistFormData.label}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, label: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kategori:</label>
                <select
                  value={checklistFormData.category}
                  onChange={(e) =>
                    setChecklistFormData({
                      ...checklistFormData,
                      category: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="Kebersihan">Kebersihan</option>
                  <option value="Fasilitas">Fasilitas Utama</option>
                  <option value="Kelengkapan">Kelengkapan Alat</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Standar:</label>
                <input
                  type="text"
                  placeholder="Standar pemeriksaan item ini"
                  value={checklistFormData.description}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistFormData.isRequired}
                    onChange={(e) => setChecklistFormData({ ...checklistFormData, isRequired: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">Wajib Dicentang untuk Laporan Bersih</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistFormData.isActive}
                    onChange={(e) => setChecklistFormData({ ...checklistFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-700">Tampilkan di Formulir Pelaporan</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChecklistModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Simpan Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Mini check icon
const CheckCircle2Icon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
