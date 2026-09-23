import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cfhxynulwqzpmwudblzf.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9noIxAet_tX3PdIavt-8YQ_bMUAFRnu'; // Asegúrate de pegar aquí la clave completa que copiaste

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});