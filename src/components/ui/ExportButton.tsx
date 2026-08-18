import * as XLSX from 'xlsx-js-style';
import type { ExportColumn } from '../../types';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename?: string;
  columns?: ExportColumn[];
}

export default function ExportButton({ data, filename = 'laporan', columns }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const exportData = columns
      ? data.map(row => Object.fromEntries(columns.map(col => [col.header, row[col.key] ?? ''])))
      : data;

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();

    // Beri gaya warna pada header kolom dan baris data
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);

      // 1. Gaya Header (Warna Navy Blue, teks putih tebal, rata tengah)
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[address]) {
          ws[address].s = {
            fill: {
              fgColor: { rgb: '1E3A8A' } // Deep Navy Blue
            },
            font: {
              name: 'Calibri',
              sz: 11,
              bold: true,
              color: { rgb: 'FFFFFF' } // Teks Putih
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center',
              wrapText: true
            },
            border: {
              top: { style: 'thin', color: { rgb: 'CBD5E1' } },
              bottom: { style: 'medium', color: { rgb: '0F172A' } },
              left: { style: 'thin', color: { rgb: 'CBD5E1' } },
              right: { style: 'thin', color: { rgb: 'CBD5E1' } }
            }
          };
        }
      }

      // 2. Gaya Baris Data (Zebra line halus & border rapi)
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const isEven = R % 2 === 0;
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (ws[address]) {
            ws[address].s = {
              fill: {
                fgColor: { rgb: isEven ? 'F8FAFC' : 'FFFFFF' }
              },
              font: {
                name: 'Calibri',
                sz: 10,
                color: { rgb: '1E293B' }
              },
              alignment: {
                vertical: 'center'
              },
              border: {
                top: { style: 'thin', color: { rgb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                right: { style: 'thin', color: { rgb: 'E2E8F0' } }
              }
            };
          }
        }
      }

      // Tinggi baris (Header: 26pt, Data: 20pt)
      const rowHeights = [{ hpt: 26 }];
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        rowHeights.push({ hpt: 20 });
      }
      ws['!rows'] = rowHeights;
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const colWidths = Object.keys(exportData[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...exportData.map(r => String(r[key] ?? '').length)) + 4,
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <button 
      onClick={handleExport} 
      className="skeuomorphic-btn px-2 py-1 lg:px-4 lg:py-2 rounded flex items-center gap-1 lg:gap-2 text-[9px] lg:text-[11px] tracking-wider font-bold"
    >
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="w-3 h-3 lg:w-[13px] lg:h-[13px]"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span className="hidden sm:inline">Export Excel</span>
      <span className="inline sm:hidden">Excel</span>
    </button>
  );
}

