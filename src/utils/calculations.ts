import type { AlertStatus, StatusColors, AgingKategori, AgingParameter, MaterialCompatibilityRule, PropulsiType, JenisKereta } from '../types';

// ── Calculation Formulas (calculation_formulas.md) ────────

export function hitungCRActual(realisasiArr: (number | null)[]): number {
  const nonNull = realisasiArr.filter((v): v is number => v !== null && v !== undefined);
  if (nonNull.length === 0) return 0;
  return nonNull.reduce((sum, v) => sum + v, 0) / nonNull.length;
}

export function hitungPlanTerkoreksi(rencanaAwal: number, crActual: number): number {
  return Math.max(rencanaAwal, crActual);
}

export function hitungTExhaustion(stokSaatIni: number, planTerkoreksi: number): number {
  if (planTerkoreksi <= 0) return Infinity;
  return stokSaatIni / planTerkoreksi;
}

export function hitungTArrival(tanggalRencanaPengiriman: string): number {
  const today = new Date();
  const arrival = new Date(tanggalRencanaPengiriman);
  const diffMs = arrival.getTime() - today.getTime();
  const diffBulan = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(0, parseFloat(diffBulan.toFixed(1)));
}

export function hitungGapDefisit(tArrival: number, tExhaustion: number): number {
  return parseFloat((tArrival - tExhaustion).toFixed(1));
}

export function tentukanStatusAlert(gapDefisit: number): AlertStatus {
  if (gapDefisit <= -3) return 'KRITIS';
  if (gapDefisit < 0) return 'WASPADA';
  return 'AMAN';
}

export function hitungLeadTimeVariance(actualLT: number | null, planLT: number): number | null {
  if (actualLT === null || actualLT === undefined) return null;
  return actualLT - planLT;
}

export function hitungAkurasiQty(jumlahDiterima: number, jumlahDipesan: number): number {
  if (jumlahDipesan <= 0) return 0;
  return parseFloat(((jumlahDiterima / jumlahDipesan) * 100).toFixed(1));
}

export function formatRupiah(angka: number | null | undefined): string {
  if (angka === null || angka === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
}

export function formatTanggal(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function tentukanKategoriUsia(
  hariPengendapan: number,
  agingParams: AgingParameter[]
): AgingKategori {
  for (const param of agingParams) {
    if (hariPengendapan >= param.min_days && hariPengendapan <= param.max_days) {
      return param.category_name;
    }
  }
  return 'Dead Stock';
}

export interface ValidasiResult {
  valid: boolean;
  pesan: string | null;
}

export function validasiKompatibilitasMaterial(
  nomorMaterial: string,
  propulsi: PropulsiType,
  jenisKereta: JenisKereta,
  compatibilityMatrix: Record<string, MaterialCompatibilityRule>
): ValidasiResult {
  const rule = compatibilityMatrix[nomorMaterial];
  if (!rule) return { valid: true, pesan: null };

  if (!rule.propulsi.includes(propulsi)) {
    return {
      valid: false,
      pesan: `Gagal: Material ${nomorMaterial} hanya kompatibel untuk rangkaian jenis ${rule.propulsi.join(' / ')}.`,
    };
  }
  if (!rule.jenis_kereta.includes(jenisKereta)) {
    return {
      valid: false,
      pesan: `Gagal: Material ${nomorMaterial} hanya dapat dialokasikan pada gerbong ${rule.jenis_kereta.join(', ')}.`,
    };
  }
  return { valid: true, pesan: null };
}

export function getStatusColor(status: AlertStatus): StatusColors {
  switch (status) {
    case 'KRITIS':
      return { text: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500/30', glow: 'shadow-[0_0_10px_rgba(220,38,38,0.5)]' };
    case 'WASPADA':
      return { text: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500/30', glow: 'shadow-[0_0_10px_rgba(217,119,6,0.5)]' };
    case 'AMAN':
      return { text: 'text-green-600', bg: 'bg-green-600', border: 'border-green-600/30', glow: 'shadow-[0_0_10px_rgba(22,163,74,0.5)]' };
  }
}
