interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  trendIcon?: string;
  borderColor?: string;
  ledStatus?: 'red' | 'amber' | 'green';
  sparkData?: number[];
}

export default function KpiCard({
  label, value, unit, trend, trendValue, trendIcon, borderColor, ledStatus, sparkData
}: KpiCardProps) {
  const borderStyle = borderColor ? { borderLeft: `4px solid ${borderColor}` } : {};

  return (
    <div className="tactile-card rounded-lg p-5 flex flex-col relative overflow-hidden group" style={borderStyle}>
      {/* Glow */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: borderColor ? `${borderColor}25` : 'transparent' }}
      />
      {/* LED dot */}
      {ledStatus && (
        <div
          className={`absolute top-4 right-4 led-indicator led-${ledStatus} ${ledStatus === 'red' ? 'animate-led-pulse' : ''}`}
          style={{ width: 10, height: 10 }}
        />
      )}
      {/* Label */}
      <span className="text-[10px] font-black tracking-widest uppercase mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
        {label}
      </span>
      {/* Value */}
      <div className="flex items-end gap-2 mt-auto">
        <span
          className="text-5xl font-black leading-tight"
          style={{ color: 'var(--color-on-surface)', letterSpacing: '-0.02em' }}
        >
          {value}
        </span>
        {unit && <span className="text-xl mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{unit}</span>}
      </div>
      {/* Trend */}
      {trendValue && (
        <div
          className="flex items-center gap-1 mt-2 text-[11px] px-2 py-0.5 rounded w-fit border"
          style={{
            backgroundColor: 'var(--color-surface-container-high)',
            borderColor: 'var(--color-steel-border)',
            color: trend === 'up' ? 'var(--color-led-green)' : trend === 'down' ? 'var(--color-led-red)' : 'var(--color-on-surface-variant)',
          }}
        >
          {trend === 'up' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          ) : trend === 'down' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
          <span className="font-bold">{trendValue}</span>
        </div>
      )}
      {/* Sparkline */}
      {sparkData && (
        <div className="h-8 mt-3 w-full flex items-end gap-0.5">
          {sparkData.map((v, i) => {
            const max = Math.max(...sparkData);
            const pct = max > 0 ? (v / max) * 100 : 0;
            const isLast = i === sparkData.length - 1;
            return (
              <div
                key={i}
                className="flex-1 rounded-t transition-all"
                style={{
                  height: `${Math.max(10, pct)}%`,
                  backgroundColor: isLast
                    ? (borderColor ?? 'var(--color-secondary)')
                    : (borderColor ? `${borderColor}40` : 'var(--color-on-surface-variant)'),
                  opacity: isLast ? 1 : 0.4,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
