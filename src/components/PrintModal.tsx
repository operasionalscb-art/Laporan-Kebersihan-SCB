import React from 'react';
import { CleaningReport, User } from '../types';
import { Printer, X, Building2, CheckCircle2 } from 'lucide-react';
import { getTodayDateString } from '../utils/storage';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: CleaningReport[];
  currentUser: User | null;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  reports,
  currentUser,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const today = getTodayDateString();

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Action Bar (Hidden in actual print) */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              Pratinjau Cetak Rekapitulasi Laporan Kebersihan
            </h3>
            <p className="text-xs text-slate-500">
              Format standar dokumen fisik arsip operasional Sekolah Cendekia BAZNAS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-8 sm:p-10 overflow-y-auto print:p-0 bg-white font-sans text-slate-900" id="print-area">
          {/* Letterhead (Kop Surat) */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center gap-4 text-center sm:text-left">
            <div className="w-16 h-16 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-2xl shrink-0 mx-auto sm:mx-0">
              SCB
            </div>
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide text-emerald-900">
                SEKOLAH CENDEKIA BAZNAS
              </h2>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                BADAN AMIL ZAKAT NASIONAL (BAZNAS) REPUBLIK INDONESIA
              </p>
              <p className="text-[11px] text-slate-500">
                Divisi Sarana, Prasarana & Kebersihan Lingkungan Kampus • Email: operasional.scb@gmail.com
              </p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center mb-6">
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-900 underline">
              REKAPITULASI LAPORAN KEBERSIHAN KAMAR MANDI & TEMPAT WUDHU
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Tanggal Cetak: {today} | Total Dokumen Terverifikasi: {reports.length} Laporan
            </p>
          </div>

          {/* Data Table */}
          <table className="w-full text-left text-xs border border-slate-300 border-collapse mb-8">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold text-[11px]">
                <th className="p-2 border-r border-slate-300 w-8 text-center">No</th>
                <th className="p-2 border-r border-slate-300">Waktu</th>
                <th className="p-2 border-r border-slate-300">Petugas</th>
                <th className="p-2 border-r border-slate-300">Area Kamar Mandi</th>
                <th className="p-2 border-r border-slate-300">Kondisi Akhir</th>
                <th className="p-2 border-r border-slate-300">Checklist Fasilitas</th>
                <th className="p-2 border-r border-slate-300">Keterangan / Kerusakan</th>
                <th className="p-2">Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reports.map((report, idx) => (
                <tr key={report.id} className="align-top">
                  <td className="p-2 border-r border-slate-300 text-center font-medium">{idx + 1}</td>
                  <td className="p-2 border-r border-slate-300 whitespace-nowrap">
                    <div>{report.waktu} WIB</div>
                    <div className="text-[10px] text-slate-500">{report.tanggal}</div>
                  </td>
                  <td className="p-2 border-r border-slate-300 font-semibold">{report.namaPetugas}</td>
                  <td className="p-2 border-r border-slate-300 font-medium">{report.area}</td>
                  <td className="p-2 border-r border-slate-300">
                    <span className="font-semibold">{report.kondisiAkhir}</span>
                  </td>
                  <td className="p-2 border-r border-slate-300 text-[11px]">
                    {report.checklist.join(', ')}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-[11px]">
                    {report.keteranganTambahan || '-'}
                  </td>
                  <td className="p-2 text-[11px] font-medium whitespace-nowrap">
                    {report.statusVerifikasi}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature Boxes */}
          <div className="grid grid-cols-3 gap-6 text-center text-xs mt-12 pt-4">
            <div>
              <p className="text-slate-600 mb-16">Petugas Kebersihan,</p>
              <p className="font-bold underline text-slate-900 uppercase">
                ( IDAY / KODIR / WAHYUDIN )
              </p>
              <p className="text-[10px] text-slate-500">Divisi Cleaning Service</p>
            </div>

            <div>
              <p className="text-slate-600 mb-16">Supervisor Kebersihan,</p>
              <p className="font-bold underline text-slate-900 uppercase">
                ( ..................................... )
              </p>
              <p className="text-[10px] text-slate-500">Supervisor Lapangan</p>
            </div>

            <div>
              <p className="text-slate-600 mb-16">Superadmin Operasional SCB,</p>
              <p className="font-bold underline text-slate-900 uppercase">
                ( OPERASIONAL SCB )
              </p>
              <p className="text-[10px] text-slate-500">operasional.scb@gmail.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
