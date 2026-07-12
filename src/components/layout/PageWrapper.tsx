
import type { ReactNode } from 'react';

interface PageWrapperProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export default function PageWrapper({ children, fullWidth = false }: PageWrapperProps) {
  return (
    <div className="flex-1 overflow-y-auto pt-16 page-enter" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className={`${fullWidth ? 'w-full px-6' : 'max-w-[1600px] mx-auto p-6'} space-y-5`}>
        {children}
      </div>
    </div>
  );
}
