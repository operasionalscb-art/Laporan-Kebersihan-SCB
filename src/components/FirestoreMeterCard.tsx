import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  HardDrive,
  Radio,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { CleaningReport } from '../types';
import {
  CATEGORY_LABELS,
  FirestoreMeterCategory,
  FirestoreMeterStats,
  SPARK_DAILY_DELETES_LIMIT,
  SPARK_DAILY_READS_LIMIT,
  SPARK_DAILY_WRITES_LIMIT,
  SPARK_STORAGE_BYTES_LIMIT,
  estimateFirestoreFootprint,
  getFirestoreMeterStats,
  resetFirestoreMeterToday,
  subscribeFirestoreMeter,
} from '../services/firestoreMeter';

interface FirestoreMeterCardProps {
  reports: CleaningReport[];
  usersCount: number;
  isFirestoreQuotaLimited?: boolean;
  isUploadingBatchPhotos?: boolean;
  onArchivePhotosToDrive?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getBarColorClass(percent: number): string {
  if (percent >= 80) return 'bg-rose-500';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export const FirestoreMeterCard: React.FC<FirestoreMeterCardProps> = ({
  reports,
  usersCount,
  isFirestoreQuotaLimited = false,
  isUploadingBatchPhotos = false,
  onArchivePhotosToDrive,
}) => {
  const [stats, setStats] = useState<FirestoreMeterStats>(() => getFirestoreMeterStats());

  useEffect(() => {
    return subscribeFirestoreMeter(setStats);
  }, []);

  const footprint = useMemo(
    () => estimateFirestoreFootprint(reports, usersCount),
    [reports, usersCount]
  );

  const readsPct = Math.min(100, (stats.reads / SPARK_DAILY_READS_LIMIT) * 100);
  const writesPct = Math.min(100, (stats.writes / SPARK_DAILY_WRITES_LIMIT) * 100);
  const deletesPct = Math.min(100, (stats.deletes / SPARK_DAILY_DELETES_LIMIT) * 100);
  const storagePct = Math.min(
    100,
    (footprint.totalEstimatedBytes / SPARK_STORAGE_BYTES_LIMIT) * 100
  );

  const sortedCategories = useMemo(() => {
    const entries = (Object.keys(stats.breakdown) as FirestoreMeterCategory[]).map((key) => {
      const item = stats.breakdown[key];
      const totalOps = item.reads + item.writes + item.deletes;
      return {
        key,
        label: CATEGORY_LABELS[key],
        ...item,
        totalOps,
      };
    });
    entries.sort((a, b) => b.totalOps - a.totalOps || b.cacheHits - a.cacheHits);
    return entries;
  }, [stats]);

  const maxCategoryOps = Math.max(1, ...sortedCategories.map((c) => c.totalOps));
  const topConsumer = sortedCategories[0];

  const totalAttempts = stats.reads + stats.cacheHits;
  const cacheSavingsPct =
    totalAttempts > 0 ? Math.round((stats.cacheHits / totalAttempts) * 100) : 0;

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">
                Meteran Kuota &amp; Penyimpanan Firestore
              </h3>
              {isFirestoreQuotaLimited ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  Limit Kuota Harian Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Status Normal (Spark Free Tier)
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"
                title={
                  stats.activeListeners.length > 0
                    ? `Listener aktif: ${stats.activeListeners.join(', ')}`
                    : 'Tidak ada listener realtime aktif saat ini'
                }
              >
                <Radio className="w-3 h-3 text-blue-600" />
                {stats.activeListeners.length} Listener Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantauan real-time pemakaian operasi Firestore hari ini ({stats.date}) serta estimasi ukuran dokumen database.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => resetFirestoreMeterToday()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Reset penghitung aktivitas hari ini di browser ini"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Meteran</span>
          </button>
          <a
            href="https://console.firebase.google.com/project/gen-lang-client-0457083120/firestore/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-200 transition-colors"
          >
            <span>Firebase Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 4 Quota Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Reads Meter */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              Baca (Reads / Hari)
            </span>
            <span className="font-bold text-slate-800 tabular-nums">
              {readsPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-extrabold text-slate-900 tabular-nums">
              {stats.reads.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              / {SPARK_DAILY_READS_LIMIT.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColorClass(readsPct)}`}
              style={{ width: `${Math.max(readsPct > 0 ? 2 : 0, readsPct)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Hemat dari Cache:</span>
            <span className="font-bold text-emerald-700 tabular-nums">
              {stats.cacheHits.toLocaleString('id-ID')} ({cacheSavingsPct}%)
            </span>
          </div>
        </div>

        {/* Writes Meter */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              Tulis (Writes / Hari)
            </span>
            <span className="font-bold text-slate-800 tabular-nums">
              {writesPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-extrabold text-slate-900 tabular-nums">
              {stats.writes.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              / {SPARK_DAILY_WRITES_LIMIT.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColorClass(writesPct)}`}
              style={{ width: `${Math.max(writesPct > 0 ? 2 : 0, writesPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Laporan baru dgn foto = 2 writes (ringkasan + foto).
          </p>
        </div>

        {/* Deletes Meter */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              Hapus (Deletes / Hari)
            </span>
            <span className="font-bold text-slate-800 tabular-nums">
              {deletesPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-extrabold text-slate-900 tabular-nums">
              {stats.deletes.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              / {SPARK_DAILY_DELETES_LIMIT.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColorClass(deletesPct)}`}
              style={{ width: `${Math.max(deletesPct > 0 ? 2 : 0, deletesPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Termasuk pembersihan foto sementara setelah masuk GDrive.
          </p>
        </div>

        {/* Storage Footprint Meter */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-purple-600" />
              Kapasitas DB (Est.)
            </span>
            <span className="font-bold text-slate-800 tabular-nums">
              {storagePct.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-extrabold text-slate-900 tabular-nums">
              {formatBytes(footprint.totalEstimatedBytes)}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              / 1.00 GB
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColorClass(storagePct)}`}
              style={{ width: `${Math.max(storagePct > 0 ? 2 : 0, storagePct)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Foto antre di Cloud:</span>
            <span
              className={`font-bold tabular-nums ${
                footprint.pendingPhotoReportsCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {formatBytes(footprint.pendingPhotosBytes)} ({footprint.pendingPhotoReportsCount} lap.)
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown & Biggest Quota Driver Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Operation Breakdown by Collection */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rincian Konsumsi per Koleksi (Hari Ini)
            </h4>
            {topConsumer && topConsumer.totalOps > 0 && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                Terbanyak: {topConsumer.key}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {sortedCategories.map((cat) => {
              const barPct = cat.totalOps > 0 ? Math.max(4, (cat.totalOps / maxCategoryOps) * 100) : 0;
              return (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-semibold text-slate-700 truncate">{cat.label}</span>
                    <span className="text-[11px] text-slate-600 tabular-nums shrink-0">
                      <strong className="text-blue-700">{cat.reads}R</strong> •{' '}
                      <strong className="text-emerald-700">{cat.writes}W</strong> •{' '}
                      <strong className="text-rose-700">{cat.deletes}D</strong>
                      {cat.cacheHits > 0 && (
                        <span className="text-slate-400"> ({cat.cacheHits} cache)</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-700 rounded-full transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Biggest Quota Drivers & Actionable Advice */}
        <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Penyumbang Quota Firestore Terbesar
              </h4>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <div className="p-2.5 bg-white rounded-lg border border-amber-200/70">
                <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                  <span>1. Foto Base64 Sementara (report_photos)</span>
                  <span className="text-[11px] font-bold text-amber-700 tabular-nums">
                    {formatBytes(footprint.pendingPhotosBytes)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Menyumbang ~95% kapasitas DB &amp; 1 write/read ekstra per laporan. Saat ini ada{' '}
                  <strong>{footprint.pendingPhotoReportsCount} laporan</strong> menunggu arsip ke Drive dan{' '}
                  <strong className="text-emerald-700">{footprint.archivedDriveReportsCount} laporan</strong> sudah ringan di Drive.
                </p>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-amber-200/70">
                <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                  <span>2. Live Listener &amp; Riwayat Laporan (reports)</span>
                  <span className="text-[11px] font-bold text-blue-700 tabular-nums">
                    {stats.breakdown.reports.reads} reads hari ini
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Setiap perangkat staf aktif membaca ulang jendela 7 hari + riwayat bulanan/arsip ketika cache kedaluwarsa atau listener aktif ({stats.activeListeners.length} listener terbuka).
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">
              *Menghitung aktivitas browser ini secara real-time; total semua pengguna tersedia di Firebase Console.
            </p>
            {footprint.pendingPhotoReportsCount > 0 && onArchivePhotosToDrive && (
              <button
                type="button"
                disabled={isUploadingBatchPhotos}
                onClick={onArchivePhotosToDrive}
                className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                {isUploadingBatchPhotos
                  ? 'Mengarsipkan...'
                  : `Pindahkan ${footprint.pendingPhotoReportsCount} Foto ke Drive`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
