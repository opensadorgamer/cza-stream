import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Exporta as duas opções para garantir que qualquer import funcione
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseClient = supabase;
