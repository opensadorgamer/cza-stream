import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export let supabaseClient = null;

try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Erro ao inicializar Supabase:", e);
}
