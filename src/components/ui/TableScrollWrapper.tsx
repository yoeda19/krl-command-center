import React, { useRef, useState, useEffect } from 'react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export default function TableScrollWrapper({ children, className = '', maxHeight }: TableScrollWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [children]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const amount = direction === 'left' ? -350 : 350;
    containerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/85 text-white shadow-xl backdrop-blur-md border border-slate-700/80 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          title="Geser Kanan/Kiri (Sebelumnya)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/85 text-white shadow-xl backdrop-blur-md border border-slate-700/80 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          title="Geser Kanan (Berikutnya)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Table Container */}
      <div
        ref={containerRef}
        className="overflow-x-auto w-full"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
