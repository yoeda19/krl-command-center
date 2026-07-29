export interface ThresholdConfig {
  limitKritis: number;          // default: 2.0 bulan (GAP Alert High)
  limitWaspada: number;         // default: 3.0 bulan (GAP Alert Med)
  limitAman: number;            // default: 4.0 bulan (GAP Alert Low)
  safetyStockMonths: number;    // default: 1.0 bulan (Ambang Stok Fisik Kritis / SS)
  ropMonths: number;            // default: 2.0 bulan (Ambang Stok Fisik Waspada / ROP)
  safetyStockDays?: number;     // legacy fallback
  ropDays?: number;             // legacy fallback
  limitSlowMoving: number;      // default: 30 hari
  limitAtRisk: number;          // default: 90 hari
  limitDeadStock: number;       // default: 180 hari
  holdingCostPct: number;       // default: 10 %
  anomaliTolerancePct: number;  // default: 20 %
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  limitKritis: 2.0,
  limitWaspada: 3.0,
  limitAman: 4.0,
  safetyStockMonths: 1.0,
  ropMonths: 2.0,
  limitSlowMoving: 30,
  limitAtRisk: 90,
  limitDeadStock: 180,
  holdingCostPct: 10,
  anomaliTolerancePct: 20,
};

const STORAGE_KEY = 'prisma_threshold_overrides_v1';

export function getThresholdConfig(): ThresholdConfig {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLDS;
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(item);
    return {
      limitKritis: Number(parsed.limitKritis) || DEFAULT_THRESHOLDS.limitKritis,
      limitWaspada: Number(parsed.limitWaspada) || DEFAULT_THRESHOLDS.limitWaspada,
      limitAman: Number(parsed.limitAman) || DEFAULT_THRESHOLDS.limitAman,
      safetyStockMonths: Number(parsed.safetyStockMonths) || (parsed.safetyStockDays ? Math.round((parsed.safetyStockDays / 30) * 10) / 10 : DEFAULT_THRESHOLDS.safetyStockMonths),
      ropMonths: Number(parsed.ropMonths) || (parsed.ropDays ? Math.round((parsed.ropDays / 30) * 10) / 10 : DEFAULT_THRESHOLDS.ropMonths),
      limitSlowMoving: Number(parsed.limitSlowMoving) || DEFAULT_THRESHOLDS.limitSlowMoving,
      limitAtRisk: Number(parsed.limitAtRisk) || DEFAULT_THRESHOLDS.limitAtRisk,
      limitDeadStock: Number(parsed.limitDeadStock) || DEFAULT_THRESHOLDS.limitDeadStock,
      holdingCostPct: Number(parsed.holdingCostPct) ?? DEFAULT_THRESHOLDS.holdingCostPct,
      anomaliTolerancePct: Number(parsed.anomaliTolerancePct) || DEFAULT_THRESHOLDS.anomaliTolerancePct,
    };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function saveThresholdConfig(config: Partial<ThresholdConfig>): ThresholdConfig {
  const current = getThresholdConfig();
  const updated = { ...current, ...config };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Gagal menyimpan threshold lokal:', e);
    }
  }
  return updated;
}

export function resetThresholdConfig(): ThresholdConfig {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  return DEFAULT_THRESHOLDS;
}
