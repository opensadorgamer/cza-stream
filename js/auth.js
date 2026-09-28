import { supabaseClient } from './supabaseClient.js';

let currentUser = null;

export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
    if (user) {
        localStorage.setItem('meet_chat_user', user);
    } else {
        localStorage.removeItem('meet_chat_user');
    }
}

export function checkSavedSession() {
    const saved = localStorage.getItem('meet_chat_user');
    if (saved) {
        currentUser = saved;
        return true;
    }
    return false;
}

export async function registerUser(username, password) {
    username = username.trim().toLowerCase();
    password = password.trim();

    if (!username || !password) {
        throw new Error('Preencha o nome de usuário e a senha.');
    }

    const { data: existing, error: searchError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('username', username);

    if (searchError) {
        throw new Error('Erro ao consultar banco de dados.');
    }

    if (existing && existing.length > 0) {
        throw new Error('Este nome de usuário já está em uso! Escolha outro.');
    }

    const { error: insertError } = await supabaseClient
        .from('profiles')
        .insert([{ username: username, password: password }]);

    if (insertError) {
        throw new Error('Erro ao registrar usuário.');
    }

    setCurrentUser(username);
    return username;
}

export async function loginUser(username, password) {
    username = username.trim().toLowerCase();
    password = password.trim();

    if (!username || !password) {
        throw new Error('Preencha o nome de usuário e a senha.');
    }

    const { data: userRecord, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !userRecord) {
        throw new Error('Usuário ou senha incorretos!');
    }

    setCurrentUser(username);
    return username;
}

export function logoutUser() {
    setCurrentUser(null);
}
