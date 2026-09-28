import { supabaseClient } from './supabaseClient.js';

let signalChannel = null;
let chatChannel = null;

export function initSignalingChannels(room, currentUser, callbacks) {
    chatChannel = supabaseClient.channel('chat_' + room);
    chatChannel.on('broadcast', { event: 'msg' }, payload => {
        if (callbacks.onChatMessage) {
            callbacks.onChatMessage(payload.payload.sender, payload.payload.text);
        }
    }).subscribe();

    signalChannel = supabaseClient.channel('signal_' + room, {
        config: { broadcast: { self: false } }
    });

    signalChannel
        .on('broadcast', { event: 'webrtc-signal' }, async payload => {
            if (callbacks.onSignalData) {
                await callbacks.onSignalData(payload.payload);
            }
        })
        .on('broadcast', { event: 'user-joined' }, async payload => {
            const remoteName = payload.payload.sender;
            if (callbacks.onUserJoined) {
                await callbacks.onUserJoined(remoteName);
            }
        })
        .on('broadcast', { event: 'user-presence' }, payload => {
            if (callbacks.onUserPresence) {
                callbacks.onUserPresence(payload.payload.sender);
            }
        })
        .subscribe(status => {
            if (status === 'SUBSCRIBED' && callbacks.onSubscribed) {
                callbacks.onSubscribed();
            }
        });

    return { signalChannel, chatChannel };
}

export function sendSignal(data) {
    if (signalChannel) {
        signalChannel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: data
        });
    }
}

export function sendUserJoinedSignal(sender) {
    if (signalChannel) {
        signalChannel.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: { sender }
        });
    }
}

export function sendUserPresenceSignal(sender) {
    if (signalChannel) {
        signalChannel.send({
            type: 'broadcast',
            event: 'user-presence',
            payload: { sender }
        });
    }
}

export function sendChatMessageSignal(sender, text) {
    if (chatChannel) {
        chatChannel.send({
            type: 'broadcast',
            event: 'msg',
            payload: { sender, text }
        });
    }
}

export function cleanupSignalingChannels() {
    if (supabaseClient) {
        if (chatChannel) supabaseClient.removeChannel(chatChannel);
        if (signalChannel) supabaseClient.removeChannel(signalChannel);
    }
    chatChannel = null;
    signalChannel = null;
}
