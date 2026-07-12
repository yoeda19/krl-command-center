import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Peringatan: URL atau Anon Key Supabase belum diatur di berkas .env. Aplikasi akan berjalan menggunakan data lokal.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
