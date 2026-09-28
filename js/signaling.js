import { supabase } from './supabaseClient.js';

let channel = null;

export function initSignalingChannels(roomCode, currentUser, callbacks) {
    if (channel) {
        supabase.removeChannel(channel);
    }

    channel = supabase.channel(`room-${roomCode}`, {
        config: { broadcast: { self: false } }
    });

    channel
        .on('broadcast', { event: 'webrtc-signal' }, payload => {
            const data = payload.payload;
            // Só processa se o sinal for destinado a mim ou for broadcast geral
            if (!data.target || data.target === currentUser) {
                if (callbacks.onSignalData) callbacks.onSignalData(data);
            }
        })
        .on('broadcast', { event: 'chat-message' }, payload => {
            const data = payload.payload;
            if (callbacks.onChatMessage) callbacks.onChatMessage(data.sender, data.text);
        })
        .on('broadcast', { event: 'user-joined' }, payload => {
            const data = payload.payload;
            if (data.sender !== currentUser && callbacks.onUserJoined) {
                callbacks.onUserJoined(data.sender);
            }
        })
        .on('broadcast', { event: 'user-presence' }, payload => {
            const data = payload.payload;
            if (data.sender !== currentUser && callbacks.onUserPresence) {
                callbacks.onUserPresence(data.sender);
            }
        })
        .subscribe(status => {
            if (status === 'SUBSCRIBED') {
                if (callbacks.onSubscribed) callbacks.onSubscribed();
            }
        });
}

export function sendSignal(signalData) {
    if (!channel) return;
    channel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: signalData
    });
}

export function sendUserJoinedSignal(currentUser) {
    if (!channel) return;
    channel.send({
        type: 'broadcast',
        event: 'user-joined',
        payload: { sender: currentUser }
    });
}

export function sendUserPresenceSignal(currentUser) {
    if (!channel) return;
    channel.send({
        type: 'broadcast',
        event: 'user-presence',
        payload: { sender: currentUser }
    });
}

export function sendChatMessageSignal(currentUser, text) {
    if (!channel) return;
    channel.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: { sender: currentUser, text: text }
    });
}

export function cleanupSignalingChannels() {
    if (channel) {
        supabase.removeChannel(channel);
        channel = null;
    }
}
