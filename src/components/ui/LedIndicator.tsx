import type { AlertStatus } from '../../types';

interface LedIndicatorProps {
  status: any;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<string, number> = { sm: 8, md: 12, lg: 16 };

export default function LedIndicator({ status, animate = false, size = 'md' }: LedIndicatorProps) {
  const px = sizeMap[size] ?? 12;
  
  const cls = status === 'KRITIS' || status === 'FAST MOVING' ? 'led-red'
    : status === 'WASPADA' ? 'led-amber'
    : status === 'AMAN' ? 'led-green'
    : status === 'SLOW MOVING' ? 'led-blue'
    : 'led-gray';

  return (
    <span
      className={`led-indicator ${cls} ${animate && (status === 'KRITIS' || status === 'FAST MOVING') ? 'animate-led-pulse' : ''} inline-block`}
      style={{ width: px, height: px }}
    />
  );
}
