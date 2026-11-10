import React, { useState } from 'react';
import { CleaningReport, User } from '../types';
import { Printer, X, CheckCircle2, FileDown, Loader2, FileText, Download, ExternalLink, Sparkles } from 'lucide-react';
import { getTodayDateString } from '../utils/storage';
import { generateReportsPdf } from '../utils/pdfExport';

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
  const [showExportPopup, setShowExportPopup] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const today = getTodayDateString();

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Native print call failed:', e);
    }
  };

  const handleExportPdf = () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // Generate crisp vector PDF table in milliseconds (no screenshot / html2canvas)
      const result = generateReportsPdf(reports, {
        currentUser,
        fileName: `Rekap_Kebersihan_SCB_${today}.pdf`,
      });

      // Save blob URL for preview / re-download
      setPdfBlobUrl(result.blobUrl);

      // Trigger instant clean file download
      result.download();

      setExportSuccess(true);
      setShowExportPopup(true);
    } catch (error) {
      console.error('PDF export failed:', error);
      handlePrint();
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDirectBlob = () => {
    const fileName = `Rekap_Kebersihan_SCB_${today}.pdf`;
    if (pdfBlobUrl) {
      const link = document.createElement('a');
      link.href = pdfBlobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportSuccess(true);
    } else {
      handleExportPdf();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col relative">
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
              onClick={handleExportPdf}
              disabled={isExporting}
              className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-sm transition-all ${
                isExporting
                  ? 'bg-emerald-400 cursor-not-allowed'
                  : exportSuccess
                  ? 'bg-emerald-700 ring-2 ring-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer'
              }`}
              title="Buka popup & unduh dokumen format PDF"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses PDF...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Popup PDF Siap!</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Export Format PDF</span>
                </>
              )}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Buka dialog cetak printer browser"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Cetak Printer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              title="Tutup Pratinjau"
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
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      report.kondisiAkhir === 'Bersih'
                        ? 'bg-emerald-100 text-emerald-800'
                        : report.kondisiAkhir === 'Ada Kerusakan'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {report.kondisiAkhir}
                    </span>
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

      {/* POPUP EKSPOR / CETAK DOKUMEN PDF (ALWAYS VISIBLE WHEN EXPORT IS TRIGGERED) */}
      {showExportPopup && (
        <div className="fixed inset-0 z-70 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:hidden animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Popup Ekspor Format Dokumen PDF
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sekolah Cendekia BAZNAS • Rekapitulasi Operasional
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportPopup(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Tutup Popup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Notification Banner */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950">
                  <p className="font-bold text-sm">
                    Dokumen Tabel PDF Berhasil Dibuat & Diunduh!
                  </p>
                  <p className="text-emerald-800 mt-1 leading-relaxed">
                    Dokumen resmi rekapitulasi kebersihan telah dibuat instan dalam <strong>Format Tabel Vektor A4 Landscape</strong> (bukan tangkapan layar/screenshot). Teks tabel tajam, jelas, dan berkas PDF otomatis tersimpan di folder unduhan Anda.
                  </p>
                </div>
              </div>

              {/* Document Meta Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500">Nama Dokumen</span>
                  <span className="font-bold text-slate-900 truncate max-w-[240px]">
                    Rekap_Kebersihan_SCB_{today}.pdf
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500">Format Lembar</span>
                  <span className="font-semibold text-emerald-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Tabel Vektor Resmi A4 Landscape
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500">Jumlah Laporan Terlampir</span>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    {reports.length} Ruangan / Data
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Tanggal Dokumen</span>
                  <span className="font-medium text-slate-800">{today}</span>
                </div>
              </div>

              {/* Interactive Action Buttons inside Popup */}
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={handleDownloadDirectBlob}
                  disabled={isExporting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File PDF Sekarang (.pdf)</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Buka Ulang Dialog Cetak / Simpan PDF Browser</span>
                </button>

                {pdfBlobUrl && (
                  <a
                    href={pdfBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 transition-all flex items-center justify-center gap-2 text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Lihat / Buka PDF di Tab Baru</span>
                  </a>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                Divisi Sarpras SCB • operasional.scb@gmail.com
              </span>
              <button
                onClick={() => setShowExportPopup(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Tutup Popup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
