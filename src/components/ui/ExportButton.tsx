import * as XLSX from 'xlsx';
import type { ExportColumn } from '../../types';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename?: string;
  columns?: ExportColumn[];
}

export default function ExportButton({ data, filename = 'laporan', columns }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) { alert('Tidak ada data untuk diekspor.'); return; }

    const exportData = columns
      ? data.map(row => Object.fromEntries(columns.map(col => [col.header, row[col.key] ?? ''])))
      : data;

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const colWidths = Object.keys(exportData[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...exportData.map(r => String(r[key] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <button onClick={handleExport} className="skeuomorphic-btn px-4 py-2 rounded flex items-center gap-2 text-[11px] tracking-wider">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export Excel
    </button>
  );
}
