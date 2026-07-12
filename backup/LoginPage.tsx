import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LoginPageProps {
  onLogin?: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('krl_auth', JSON.stringify({ email: 'yuda.maulana@krl.co.id', name: 'Yuda Maulana', role: 'Admin' }));
      onLogin?.();
      navigate('/critical-stock');
    }, 1200);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10 relative overflow-hidden"
        style={{ backgroundColor: '#1a1f2e', borderRight: '1px solid #2d3448' }}
      >
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Top */}
        <div className="relative z-10">
          {/* KRL Logo mark — SVG vector train track symbol */}
          <div className="flex items-center gap-3 mb-12">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#2563eb"/>
              {/* Rail track lines */}
              <rect x="10" y="8" width="3" height="20" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="23" y="8" width="3" height="20" rx="1.5" fill="white" opacity="0.9"/>
              {/* Crossties */}
              <rect x="9" y="11" width="18" height="2.5" rx="1.25" fill="white" opacity="0.5"/>
              <rect x="9" y="17" width="18" height="2.5" rx="1.25" fill="white" opacity="0.5"/>
              <rect x="9" y="23" width="18" height="2.5" rx="1.25" fill="white" opacity="0.5"/>
            </svg>
            <div>
              <p className="text-white font-black text-sm tracking-wide">KRL COMMAND</p>
              <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: '#60a5fa' }}>Center</p>
            </div>
          </div>

          <h1 className="text-3xl font-black leading-tight text-white mb-4">
            Sistem Pengadaan<br/>Suku Cadang KRL
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
            Platform manajemen material dan monitoring kondisi armada KRL Commuter Indonesia secara terpadu dan real-time.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { label: 'Armada Aktif', value: '101', unit: 'rangkaian' },
            { label: 'Material Dipantau', value: '2.4k', unit: 'jenis suku cadang' },
            { label: 'Tingkat Ketersediaan', value: '94%', unit: 'rata-rata stok' },
            { label: 'Depo Terintegrasi', value: '5', unit: 'lokasi gudang' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-[10px] font-bold tracking-wide uppercase mt-0.5" style={{ color: '#94a3b8' }}>{s.label}</p>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-[10px]" style={{ color: '#475569' }}>
          © 2026 KAI Commuter Indonesia
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#2563eb"/>
              <rect x="10" y="8" width="3" height="20" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="23" y="8" width="3" height="20" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="9" y="11" width="18" height="2.5" rx="1.25" fill="white" opacity="0.5"/>
              <rect x="9" y="17" width="18" height="2.5" rx="1.25" fill="white" opacity="0.5"/>
              <rect x="9" y="23" width="18" height="2.5" rx="1.25" fill="white" opacity="0.5"/>
            </svg>
            <span className="font-black text-base" style={{ color: '#1a1f2e' }}>KRL Command Center</span>
          </div>

          <h2 className="text-2xl font-black mb-1" style={{ color: '#1a1f2e' }}>Masuk ke Sistem</h2>
          <p className="text-sm mb-8" style={{ color: '#6b7280' }}>
            Gunakan akun resmi KAI Commuter Indonesia
          </p>

          {/* Info */}
          <div className="rounded-lg p-4 mb-6 flex items-start gap-3" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <p className="text-[11px] leading-relaxed" style={{ color: '#1d4ed8' }}>
              Akses terbatas untuk personel <strong>@krl.co.id</strong> yang berwenang. Seluruh aktivitas tercatat dalam log audit sistem.
            </p>
          </div>

          {/* Google Btn */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-lg font-semibold text-sm transition-all"
            style={{
              backgroundColor: loading ? '#f3f4f6' : '#1a1f2e',
              color: loading ? '#9ca3af' : '#ffffff',
              border: '1px solid',
              borderColor: loading ? '#e5e7eb' : '#1a1f2e',
              boxShadow: loading ? 'none' : '0 2px 8px rgba(26,31,46,0.18)',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Memverifikasi Akses...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Masuk dengan Akun Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ backgroundColor: '#e5e7eb' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#9ca3af' }}>atau</span>
            <div className="flex-1 h-px" style={{ backgroundColor: '#e5e7eb' }} />
          </div>

          {/* SSO Alt */}
          <button
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}
            onClick={handleLogin}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Masuk via SSO Perusahaan
          </button>

          <p className="text-center text-[10px] mt-8" style={{ color: '#d1d5db' }}>
            v1.0.0 — KAI Commuter Indonesia © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
