import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Alias de compatibilidade para evitar erros de importação nomeada em outros módulos (auth.js, etc.)
export const supabaseClient = supabase;

// Função para buscar ou criar o perfil do usuário no Supabase
export async function fetchUserProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.warn("Perfil não encontrado ou erro ao buscar:", error.message);
        return null;
    }
    return data;
}

export async function updateUserProfile(userId, updates) {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (error) {
        console.error("Erro ao atualizar perfil:", error.message);
        return false;
    }
    return true;
}
