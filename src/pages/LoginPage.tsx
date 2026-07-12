import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMasterMaterials, getFleetMetrics } from '../services/supabaseService';

interface LoginPageProps {
  onLogin?: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState({
    totalFleet: '101',
    materialCount: '8',
  });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        const [materials, fleet] = await Promise.all([
          getMasterMaterials(),
          getFleetMetrics().catch(() => null)
        ]);
        if (!active) return;
        if (materials && materials.length > 0) {
          setStats(prev => ({ ...prev, materialCount: String(materials.length) }));
        }
        if (fleet && fleet.total_fleet) {
          setStats(prev => ({ ...prev, totalFleet: String(fleet.total_fleet) }));
        }
      } catch (err) {
        console.error('Failed to load login stats:', err);
      }
    }
    loadStats();
    return () => {
      active = false;
    };
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('krl_auth', JSON.stringify({ 
        email: username || 'yuda.maulana@krl.co.id', 
        name: 'Yuda Maulana', 
        role: 'Admin' 
      }));
      onLogin?.();
      navigate('/critical-stock');
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#ffffff' }}>
      {/* Left panel — PRISMA Branding (White background) */}
      <div className="flex-1 flex flex-col justify-center p-8 lg:p-16 relative overflow-hidden bg-white">
        {/* Subtle dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Center Content */}
        <div className="relative z-10 py-12 max-w-xl mx-auto text-center flex flex-col items-center">
          <div className="flex flex-col items-center">
            <img src="/logo.svg" alt="PRISMA Logo" className="w-[120px] h-[120px] mb-6 object-contain" />
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
              PRISMA
            </h1>
            <p className="text-lg font-bold text-blue-600 mb-2 leading-snug">
              Procurement & Railway Inventory Smart Monitoring Application
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              (Aplikasi Monitoring Cerdas Pengadaan & Inventaris Perkeretaapian)
            </p>
          </div>
        </div>
      </div>      {/* Right panel — KAI Red background & Login form */}
      <div 
        className="w-full lg:w-[480px] flex-shrink-0 flex flex-col justify-center p-8 lg:p-12 relative"
        style={{ backgroundColor: '#c8102e' }}
      >
        {/* Center Form Container (No card wrapper) */}
        <div className="relative z-10 my-auto w-full max-w-[320px] mx-auto">
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-red-100 uppercase tracking-widest">
                Nama Pengguna / Email
              </label>
              <input
                type="text"
                required
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-red-800 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition-all placeholder-slate-400"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 relative">
              <label className="block text-[10px] font-bold text-red-100 uppercase tracking-widest">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-red-800 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition-all placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-red-50 text-red-700 font-bold py-3 px-4 rounded-lg text-sm tracking-widest transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
                  <span>MEMPROSES...</span>
                </>
              ) : (
                <span>LOG IN</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer copyrights */}
        <p className="relative z-10 text-center text-[10px] text-red-200/60 mb-2 mt-4">
          PT Kereta Commuter Indonesia © 2026 Authorized
        </p>
      </div>
    </div>
  );
}
