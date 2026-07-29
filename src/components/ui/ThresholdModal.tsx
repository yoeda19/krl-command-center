import React, { useState, useEffect } from 'react';
import { getThresholdConfig, saveThresholdConfig, resetThresholdConfig } from '../../utils/thresholdSettings';
import type { ThresholdConfig } from '../../utils/thresholdSettings';

interface ThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (newConfig: ThresholdConfig) => void;
  title?: string;
  allowedFields?: (keyof ThresholdConfig)[];
}

export default function ThresholdModal({
  isOpen,
  onClose,
  onSave,
  title = 'Ambang Batas',
  allowedFields
}: ThresholdModalProps) {
  const [config, setConfig] = useState<ThresholdConfig>(getThresholdConfig());

  useEffect(() => {
    if (isOpen) {
      setConfig(getThresholdConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated = saveThresholdConfig(config);
    onSave?.(updated);
    onClose();
  };

  const handleReset = () => {
    const def = resetThresholdConfig();
    setConfig(def);
    onSave?.(def);
    onClose();
  };

  const isFieldVisible = (field: keyof ThresholdConfig) => {
    if (!allowedFields || allowedFields.length === 0) return true;
    return allowedFields.includes(field);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md rounded-xl p-5 shadow-2xl border flex flex-col gap-4 transition-colors"
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderColor: 'var(--color-border, #e2e8f0)',
          color: 'var(--color-on-surface, #0f172a)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          
          {/* SEKSI 1: AMBANG WAKTU GAP (NOTULEN RAPAT 06 JULI 2026) */}
          {(isFieldVisible('limitKritis') || isFieldVisible('limitWaspada') || isFieldVisible('limitAman')) && (
            <div className="flex flex-col gap-2.5 p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                ⏱️ Ambang Waktu Gap Pengadaan
              </span>

              {isFieldVisible('limitKritis') && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Alert High (Bulan)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={config.limitKritis}
                    onChange={e => setConfig({ ...config, limitKritis: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                  />
                </div>
              )}

              {isFieldVisible('limitWaspada') && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Alert Med (Bulan)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={config.limitWaspada}
                    onChange={e => setConfig({ ...config, limitWaspada: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                  />
                </div>
              )}

              {isFieldVisible('limitAman') && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Alert Low (Bulan)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={config.limitAman ?? 4.0}
                    onChange={e => setConfig({ ...config, limitAman: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                  />
                  <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    * Gap ≤ {config.limitKritis} bln ➔ Alert High | = {config.limitWaspada} bln ➔ Alert Med | ≥ {config.limitAman ?? 4.0} bln ➔ Alert Low.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SEKSI 2: AMBANG STOK FISIK GUDANG (SAFETY STOCK & ROP) */}
          {(isFieldVisible('safetyStockMonths') || isFieldVisible('ropMonths') || isFieldVisible('safetyStockDays') || isFieldVisible('ropDays')) && (
            <div className="flex flex-col gap-2.5 p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40">
              <span className="text-xs font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                📦 Ambang Stok Fisik Gudang (Safety Stock & ROP)
              </span>

              {(isFieldVisible('safetyStockMonths') || isFieldVisible('safetyStockDays')) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Batas Kritis / Safety Stock (Bulan)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={config.safetyStockMonths ?? 1.0}
                    onChange={e => setConfig({ ...config, safetyStockMonths: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 border-slate-300 dark:border-slate-700"
                  />
                </div>
              )}

              {(isFieldVisible('ropMonths') || isFieldVisible('ropDays')) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Batas Waspada / Re-Order Point (Bulan)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={config.ropMonths ?? 2.0}
                    onChange={e => setConfig({ ...config, ropMonths: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 border-slate-300 dark:border-slate-700"
                  />
                  <p className="text-[10.5px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                    * Stok Fisik ≤ {config.safetyStockMonths ?? 1.0} bln ➔ Kritis | ≤ {config.ropMonths ?? 2.0} bln ➔ Waspada | &gt; {config.ropMonths ?? 2.0} bln ➔ Aman.
                  </p>
                </div>
              )}
            </div>
          )}

          {isFieldVisible('limitSlowMoving') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Batas Pergerakan Lambat / Slow-Moving (Hari)
              </label>
              <input
                type="number"
                min="1"
                value={config.limitSlowMoving}
                onChange={e => setConfig({ ...config, limitSlowMoving: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
            </div>
          )}

          {isFieldVisible('limitAtRisk') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Batas Risiko Tinggi / At Risk (Hari)
              </label>
              <input
                type="number"
                min="1"
                value={config.limitAtRisk}
                onChange={e => setConfig({ ...config, limitAtRisk: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
            </div>
          )}

          {isFieldVisible('limitDeadStock') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Batas Stok Mati / Dead Stock (Hari)
              </label>
              <input
                type="number"
                min="1"
                value={config.limitDeadStock}
                onChange={e => setConfig({ ...config, limitDeadStock: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
            </div>
          )}

          {isFieldVisible('holdingCostPct') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Biaya Simpan / Holding Cost Rate (% p.a.)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={config.holdingCostPct}
                onChange={e => setConfig({ ...config, holdingCostPct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
            </div>
          )}

          {isFieldVisible('anomaliTolerancePct') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Toleransi Lonjakan Anomali (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={config.anomaliTolerancePct}
                onChange={e => setConfig({ ...config, anomaliTolerancePct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Reset Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
