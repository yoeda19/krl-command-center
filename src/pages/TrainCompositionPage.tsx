import { useState, useEffect } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import { getAllEquipment, getMaintenanceSchedule } from '../services/supabaseService';

interface EquipmentItem {
  id: string;
  parent_id: string | null;
  level: number;
  name: string;
  model_no?: string | null;
}

interface ScheduleItem {
  nomor_rangkaian: string;
  dipo?: string;
}

export default function TrainCompositionPage() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterSeri, setFilterSeri] = useState<string>('Semua');
  const [filterPropulsi, setFilterPropulsi] = useState<string>('Semua');
  const [filterDipo, setFilterDipo] = useState<string>('Semua');
  const [selectedTrainId, setSelectedTrainId] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        const [eqData, schedData] = await Promise.all([
          getAllEquipment(),
          getMaintenanceSchedule()
        ]);
        setEquipment(eqData);
        setSchedules(schedData);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <PageWrapper fullWidth>
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <div className="w-16 h-16 animate-pulse">
            <img src="/logo.svg" alt="PRISMA Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-sm font-medium animate-pulse" style={{ color: 'var(--color-on-surface-variant)' }}>
            Memuat data...
          </span>
        </div>
      </PageWrapper>
    );
  }

  // Helper to parse Seri Kereta
  const getSeriKereta = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.includes('CLI125') || upper.includes('125CLI')) return 'CLI125';
    if (upper.includes('CLI225') || upper.includes('225CLI') || upper.includes('225-')) return 'CLI225';
    if (upper.includes('EA203') || upper.includes('203')) return 'EA203';
    if (upper.includes('KFW')) return 'KFW';
    if (upper.includes('METRO') || upper.includes('05TM') || upper.includes('6000TM') || upper.startsWith('05-') || upper.startsWith('6000')) return 'Metro';
    if (upper.includes('JR') || upper.startsWith('205') || upper.startsWith('103') || upper.startsWith('203')) return 'JR205';
    return null; // Not a trainset
  };

  // Helper to parse Propulsi
  const getPropulsi = (item: EquipmentItem) => {
    const raw = (item.model_no || '').toUpperCase();
    if (raw.includes('VVVF')) return 'VVVF';
    if (raw.includes('RHEO') || raw.includes('RHOE') || raw.includes('RHEOSTATIC') || raw.includes('RHEOSTATIK')) return 'Rheostatik';
    if (raw.includes('CHOPER') || raw.includes('CHOPPER')) return 'Chopper';
    
    const nameUpper = item.name.toUpperCase();
    if (nameUpper.includes('CLI125') || nameUpper.includes('125CLI') || nameUpper.includes('RHEO')) return 'Rheostatik';
    return 'VVVF'; // default
  };

  // Helper to get Dipo
  const getDipo = (trainName: string) => {
    // Try exact match
    let match = schedules.find(s => s.nomor_rangkaian === trainName);
    
    // Try substring match if no exact match (e.g. "JR205-10" matches parent "205JR10")
    if (!match) {
      match = schedules.find(s => {
        const sNorm = s.nomor_rangkaian.replace(/[-/]/g, '').toUpperCase();
        const tNorm = trainName.replace(/[-/]/g, '').toUpperCase();
        return sNorm.includes(tNorm) || tNorm.includes(sNorm);
      });
    }
    
    return match?.dipo || 'Depo Depok';
  };

  // Get Level 1 Trainsets mapped with metadata (filtering out non-KRL rows)
  const allTrainsets = equipment
    .filter(e => e.level === 1)
    .map(t => {
      const seri = getSeriKereta(t.name);
      if (!seri) return null;
      return {
        ...t,
        seri,
        propulsi: getPropulsi(t),
        dipo: getDipo(t.name),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  // Filter KRL Trainsets based on active filters
  const filteredTrainsets = allTrainsets.filter(t => {
    const matchSeri = filterSeri === 'Semua' || t.seri === filterSeri;
    const matchPropulsi = filterPropulsi === 'Semua' || t.propulsi === filterPropulsi;
    const matchDipo = filterDipo === 'Semua' || t.dipo === filterDipo;
    return matchSeri && matchPropulsi && matchDipo;
  });

  // Get active selected KRL Trainset
  const selectedTrain = filteredTrainsets.find(t => t.id === selectedTrainId);
  const coaches = selectedTrain 
    ? equipment.filter(e => e.level === 2 && e.parent_id === selectedTrain.id)
    : [];

  // Parse Coach types
  const getCoachType = (name: string) => {
    let type = 'T';
    if (name.includes('/')) {
      const parts = name.split('/');
      type = parts[parts.length - 1].trim().toUpperCase();
    } else if (name.includes('-')) {
      const parts = name.split('-');
      type = parts[parts.length - 1].trim().toUpperCase();
    } else {
      type = name.trim().toUpperCase();
    }
    return type;
  };

  const getCoachBadgeColor = (type: string) => {
    if (type.includes('TC')) return { bg: 'rgba(59,130,246,0.1)', text: 'text-blue-400', border: 'rgba(59,130,246,0.3)' };
    if (type.includes('M1')) return { bg: 'rgba(34,197,94,0.1)', text: 'text-green-400', border: 'rgba(34,197,94,0.3)' };
    if (type.includes('M2')) return { bg: 'rgba(6,182,212,0.1)', text: 'text-cyan-400', border: 'rgba(6,182,212,0.3)' };
    if (type.includes('T6')) return { bg: 'rgba(168,85,247,0.1)', text: 'text-purple-400', border: 'rgba(168,85,247,0.3)' };
    return { bg: 'rgba(245,158,11,0.1)', text: 'text-amber-400', border: 'rgba(245,158,11,0.3)' };
  };

  // Dynamically compute options based on actual KRL trainsets data
  const seriOptions = ['Semua', ...Array.from(new Set(allTrainsets.map(t => t.seri))).sort()];
  const propulsiOptions = ['Semua', ...Array.from(new Set(allTrainsets.map(t => t.propulsi))).sort()];
  const dipoOptions = ['Semua', ...Array.from(new Set(allTrainsets.map(t => t.dipo))).sort()];

  return (
    <PageWrapper fullWidth>
      <div className="h-4" />

      {/* Filter Row with KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        {/* KPI Card */}
        <div className="tactile-card rounded-lg p-4 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}>
          <span className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            Jumlah Rangkaian
          </span>
          <span className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
            {filteredTrainsets.length} <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Unit</span>
          </span>
        </div>

        {/* Filters */}
        <div className="tactile-card rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 col-span-3" style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              Seri Kereta
            </label>
            <select
              value={filterSeri}
              onChange={e => { setFilterSeri(e.target.value); setSelectedTrainId(''); }}
              className="w-full rounded px-3 py-2 text-xs border"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
            >
              {seriOptions.map(s => <option key={s} value={s}>{s === 'Semua' ? 'Semua Seri' : s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              Jenis Propulsi
            </label>
            <select
              value={filterPropulsi}
              onChange={e => { setFilterPropulsi(e.target.value); setSelectedTrainId(''); }}
              className="w-full rounded px-3 py-2 text-xs border"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
            >
              {propulsiOptions.map(p => <option key={p} value={p}>{p === 'Semua' ? 'Semua Propulsi' : p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              Lokasi Dipo
            </label>
            <select
              value={filterDipo}
              onChange={e => { setFilterDipo(e.target.value); setSelectedTrainId(''); }}
              className="w-full rounded px-3 py-2 text-xs border"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
            >
              {dipoOptions.map(d => <option key={d} value={d}>{d === 'Semua' ? 'Semua Dipo' : d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Filtered Trainset Cards */}
      {filteredTrainsets.length > 0 ? (
        <div className="max-h-[380px] overflow-y-auto pr-2 mb-6" style={{ scrollbarWidth: 'thin' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {filteredTrainsets.map(train => {
              const count = equipment.filter(e => e.level === 2 && e.parent_id === train.id).length;
              const isSelected = train.id === selectedTrainId;

              return (
                <button
                  key={train.id}
                  onClick={() => setSelectedTrainId(isSelected ? '' : train.id)}
                  className="tactile-card rounded-lg p-3 text-left transition-all duration-150 relative border"
                  style={{
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-steel-border)',
                    backgroundColor: isSelected ? 'rgba(37,99,235,0.04)' : 'var(--color-surface-container)',
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-black" style={{ color: 'var(--color-on-surface)' }}>{train.name}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                      {count} Kereta
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[8px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span>{train.seri}</span>
                    <span>{train.dipo}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg mb-6" style={{ borderColor: 'var(--color-steel-border)' }}>
          <p className="text-xs opacity-50">Tidak ada rangkaian KRL yang sesuai dengan filter.</p>
        </div>
      )}

      {/* Visual Formasi & Table */}
      {selectedTrain ? (
        <div className="tactile-card rounded-lg overflow-hidden border animate-fade-in" style={{ borderColor: 'var(--color-steel-border)' }}>
          <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                <rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 11h16"/>
                <path d="M12 3v8"/><path d="M8 19l-2 3"/><path d="M18 22l-2-3"/>
              </svg>
              <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                Formasi Rangkaian {selectedTrain.name}
              </h3>
            </div>
            <div className="flex gap-4 text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span>Seri: <strong>{selectedTrain.seri}</strong></span>
              <span>Propulsi: <strong>{selectedTrain.propulsi}</strong></span>
              <span>Dipo: <strong>{selectedTrain.dipo}</strong></span>
            </div>
          </div>
          
          <div className="p-5">
            {coaches.length === 0 ? (
              <p className="text-xs opacity-50">Tidak ada kereta terdaftar untuk rangkaian ini.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Visual Trainset Map */}
                <div className="flex flex-wrap gap-2 items-center p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
                  {coaches.map((c, idx) => {
                    const type = getCoachType(c.name);
                    const cfg = getCoachBadgeColor(type);
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col items-center justify-center p-3 rounded-lg border text-center font-mono select-none transition-all hover:scale-105"
                        style={{
                          minWidth: '70px',
                          backgroundColor: cfg.bg,
                          borderColor: cfg.border,
                        }}
                      >
                        <span className="text-[10px] font-bold text-slate-500 mb-1">#{idx + 1}</span>
                        <span className={`text-xs font-black uppercase ${cfg.text}`}>{type}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Detail Table */}
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <table className="w-full text-left border-collapse text-xs data-table">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>No.</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>Nama Unit Aset</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>Tipe Kereta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coaches.map((c, idx) => {
                        const type = getCoachType(c.name);
                        return (
                          <tr key={c.id} style={{ borderColor: 'var(--color-steel-border)' }}>
                            <td className="px-4 py-3 font-bold" style={{ color: 'var(--color-on-surface)' }}>{idx + 1}</td>
                            <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{c.name}</td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-xs uppercase" style={{ color: 'var(--color-primary)' }}>{type}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg" style={{ borderColor: 'var(--color-steel-border)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mb-3" style={{ color: 'var(--color-on-surface)' }}>
            <rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 11h16"/>
            <path d="M12 3v8"/><path d="M8 19l-2 3"/><path d="M18 22l-2-3"/>
          </svg>
          <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>
            Pilih salah satu kartu rangkaian KRL di atas untuk menampilkan detail susunan formasi kereta.
          </p>
        </div>
      )}
    </PageWrapper>
  );
}
