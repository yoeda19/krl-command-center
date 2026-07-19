import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMasterMaterials, getFleetMetrics } from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { supabase } = await import('../lib/supabaseClient');
      const { data, error } = await supabase
        .from('app_admins')
        .select('*')
        .eq('username', username.trim())
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.error('Database query error:', error);
        setErrorMsg('Gagal memverifikasi akun ke sistem. Silakan coba kembali.');
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg('Nama pengguna atau kata sandi salah.');
        setLoading(false);
        return;
      }

      const authData = { 
        email: data.email || 'admin@krl.co.id', 
        name: data.name || 'Admin', 
        role: 'Admin' 
      };

      useAppStore.getState().login(authData);
      onLogin?.();
      navigate('/critical-stock');
    } catch (err) {
      console.error('Login process error:', err);
      setErrorMsg('Terjadi kesalahan saat memproses log in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#ffffff' }}>
      {/* Left panel — PRISMA Branding (White background - hidden on mobile) */}
      <div 
        className="hidden lg:flex flex-1 flex flex-col justify-center p-8 lg:p-16 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('/Picture1.jpg')" }}
      >
        {/* Semi-transparent white overlay to ensure text readability */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] z-0" />

        {/* Subtle dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] z-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Center Content */}
        <div className="relative z-20 py-12 max-w-xl mx-auto text-center flex flex-col items-center">
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
        className="w-full lg:w-[480px] h-screen lg:min-h-screen flex-shrink-0 flex flex-col justify-center p-6 lg:p-12 relative"
        style={{ backgroundColor: '#c8102e' }}
      >
        {/* Center Form Container (No card wrapper) */}
        <div className="relative z-10 my-auto w-full max-w-[260px] mx-auto flex flex-col justify-center">
          {/* Logo KAI Commuter (Hanya Desktop di Atas Form - dengan Background Putih Siku) */}
          <div className="hidden lg:flex justify-center mb-8">
            <div className="bg-white px-4 py-2 rounded-none shadow-sm flex items-center justify-center">
              <img src="/kai-commuter.png" alt="KAI Commuter Logo" className="h-8 object-contain" />
            </div>
          </div>

          {/* Logo PRISMA & Teks (Hanya Mobile di Atas Form) */}
          <div className="flex flex-col items-center gap-1 lg:hidden mb-4">
            <img src="/logo.svg" alt="PRISMA Logo" className="h-12 w-12 object-contain" />
            <span className="text-xl font-black text-white tracking-widest">PRISMA</span>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {errorMsg && (
              <div className="p-3 rounded bg-red-950/60 border border-red-500 text-xs text-red-100 text-center font-bold">
                {errorMsg}
              </div>
            )}
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
              className="w-full max-w-[120px] mx-auto bg-white hover:bg-red-50 text-red-700 font-bold py-3 px-4 rounded-lg text-sm tracking-widest transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2"
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

          {/* Logo KAI Commuter dengan Background Putih (Hanya Mobile di Bawah Form) */}
          <div className="flex justify-center mt-12 lg:hidden">
            <div className="bg-white px-4 py-2 rounded-none shadow-sm flex items-center justify-center">
              <img src="/kai-commuter.png" alt="KAI Commuter Logo" className="h-7 object-contain" />
            </div>
          </div>
        </div>

        {/* Footer copyrights */}
        <p className="relative z-10 text-center text-[10px] text-red-200/60 mb-2 mt-4">
          PT Kereta Commuter Indonesia © 2026 Authorized
        </p>
      </div>
    </div>
  );
}
