import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CleaningReport, User } from '../types';
import { getTodayDateString } from './storage';

export interface PdfExportOptions {
  fileName?: string;
  documentTitle?: string;
  periodeLabel?: string;
  currentUser?: User | null;
}

export interface PdfExportResult {
  doc: jsPDF;
  blob: Blob;
  blobUrl: string;
  fileName: string;
  download: () => void;
}

/**
 * Generates an ultra-fast, crisp, vector-based PDF table document
 * without raster screenshots or html2canvas lag.
 */
export function generateReportsPdf(
  reports: CleaningReport[],
  options?: PdfExportOptions
): PdfExportResult {
  const today = getTodayDateString();
  const fileName = options?.fileName || `Rekap_Kebersihan_SCB_${today}.pdf`;

  // Create A4 Landscape PDF for optimal table readability
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 14;

  // 1. Kop Surat Resmi SCB / BAZNAS
  // Logo placeholder text / icon box
  doc.setFillColor(6, 95, 70); // Emerald 800
  doc.roundedRect(marginX, 12, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SCB', marginX + 6, 19.5, { align: 'center' });

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(6, 95, 70);
  doc.text('SEKOLAH CENDEKIA BAZNAS (SCB)', marginX + 16, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('BADAN AMIL ZAKAT NASIONAL (BAZNAS) REPUBLIK INDONESIA', marginX + 16, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Divisi Sarana, Prasarana & Kebersihan Kampus | Email: operasional.scb@gmail.com', marginX + 16, 24.5);

  // Decorative Double Lines
  doc.setDrawColor(6, 95, 70);
  doc.setLineWidth(0.7);
  doc.line(marginX, 27, pageWidth - marginX, 27);
  doc.setLineWidth(0.2);
  doc.line(marginX, 28, pageWidth - marginX, 28);

  // 2. Document Title
  const docTitle = options?.documentTitle || 'REKAPITULASI LAPORAN MONITORING SANITASI & KEBERSIHAN';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(docTitle, pageWidth / 2, 35, { align: 'center' });

  const periodeText = options?.periodeLabel
    ? `Periode: ${options.periodeLabel} | Total: ${reports.length} Laporan | Tanggal Cetak: ${today}`
    : `Tanggal Cetak: ${today} | Total Data Terverifikasi: ${reports.length} Laporan`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(periodeText, pageWidth / 2, 40, { align: 'center' });

  // 3. Prepare Table Body
  const tableRows = reports.map((rep, idx) => {
    const timeStr = rep.waktu ? `${rep.waktu} WIB` : '-';
    const dateStr = rep.tanggal || today;
    const dateTime = `${timeStr}\n${dateStr}`;
    const checklistStr = Array.isArray(rep.checklist) && rep.checklist.length > 0
      ? rep.checklist.join(', ')
      : '-';
    const notesStr = rep.keteranganTambahan ? rep.keteranganTambahan.trim() : '-';
    const statusStr = rep.statusVerifikasi || 'Menunggu';

    return [
      String(idx + 1),
      dateTime,
      rep.area || '-',
      rep.namaPetugas || '-',
      rep.kondisiAkhir || '-',
      checklistStr,
      notesStr,
      statusStr,
    ];
  });

  // 4. Generate Vector AutoTable
  autoTable(doc, {
    startY: 44,
    head: [[
      'No',
      'Waktu & Tgl',
      'Area / Ruangan',
      'Petugas',
      'Kondisi Akhir',
      'Checklist Fasilitas',
      'Temuan & Keterangan',
      'Verifikasi',
    ]],
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [6, 95, 70], // Emerald 800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      valign: 'top',
      cellPadding: 2,
      lineColor: [226, 232, 240], // Slate 200
      lineWidth: 0.15,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 44, fontStyle: 'bold' },
      3: { cellWidth: 32 },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 62 },
      6: { cellWidth: 43 },
      7: { cellWidth: 24, halign: 'center' },
    },
    margin: { left: marginX, right: marginX, top: 20, bottom: 18 },
    didParseCell: (data) => {
      // Style column 4 (Kondisi Akhir) with distinct colors
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw);
        if (val === 'Bersih') {
          data.cell.styles.textColor = [16, 149, 106]; // Emerald 600
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Ada Kerusakan') {
          data.cell.styles.textColor = [225, 29, 72]; // Rose 600
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Perlu Pengecekan Ulang') {
          data.cell.styles.textColor = [217, 119, 6]; // Amber 600
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Style column 7 (Status Verifikasi)
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw);
        if (val === 'Disetujui') {
          data.cell.styles.textColor = [16, 149, 106];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Perlu Perbaikan') {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
    didDrawPage: (data) => {
      // Footer page numbers & document watermark note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      const footerText = `Dokumen Resmi SIM-BERSIH Sekolah Cendekia BAZNAS • Dicetak: ${today} • Halaman ${data.pageNumber}`;
      doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });
    },
  });

  // 5. Signature Section (Tanda Tangan)
  const finalY = (doc as any).lastAutoTable?.finalY || 44;
  let signY = finalY + 12;

  // If signature block doesn't fit on current page, add new page
  if (signY + 32 > pageHeight - 15) {
    doc.addPage();
    signY = 25;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Petugas Kebersihan,', marginX + 35, signY, { align: 'center' });
  doc.text('Supervisor Lapangan,', pageWidth / 2, signY, { align: 'center' });
  doc.text('Superadmin Operasional SCB,', pageWidth - marginX - 35, signY, { align: 'center' });

  // Underlined name lines
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('( TIM CLEANING SERVICE )', marginX + 35, signY + 20, { align: 'center' });
  doc.text('( SUPERVISOR SARPRAS )', pageWidth / 2, signY + 20, { align: 'center' });
  doc.text('( OPERASIONAL SCB )', pageWidth - marginX - 35, signY + 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Divisi Sanitasi Kampus', marginX + 35, signY + 24, { align: 'center' });
  doc.text('Supervisor Sarana Prasarana', pageWidth / 2, signY + 24, { align: 'center' });
  doc.text('operasional.scb@gmail.com', pageWidth - marginX - 35, signY + 24, { align: 'center' });

  // Output as Blob and BlobUrl
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  const download = () => {
    doc.save(fileName);
  };

  return {
    doc,
    blob,
    blobUrl,
    fileName,
    download,
  };
}

/**
 * Convenience helper to immediately generate and download the PDF.
 */
export function downloadReportsPdf(
  reports: CleaningReport[],
  options?: PdfExportOptions
): PdfExportResult {
  const result = generateReportsPdf(reports, options);
  result.download();
  return result;
}
