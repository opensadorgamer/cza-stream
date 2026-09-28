import { checkSavedSession, registerUser, loginUser, logoutUser, getCurrentUser, setCurrentUser } from './auth.js';
import { getCurrentRoom, setCurrentRoom, generateRandomRoomCode } from './rooms.js';
import { initLocalCamera, getLocalStream, toggleAudioTrack, toggleVideoTrack, stopLocalCamera } from './cameraMic.js';
import { startScreenShare, stopScreenShare, getScreenStream, getIsScreenSharing, setIsScreenSharing } from './screenShare.js';
import { initSignalingChannels, cleanupSignalingChannels, sendUserJoinedSignal, sendUserPresenceSignal, sendChatMessageSignal } from './signaling.js';
import { createPeerConnection, handleSignalingData, replaceVideoTrack, closePeerConnection, getPeerConnection } from './webrtc.js';
import { appendChatMessage, appendSystemMessage } from './chat.js';
import { showScreen, showAuthError, showLobbyError, toggleFullscreen, updateOnlineMembersList, resetOnlineMembers } from './interface.js';
import { monitorAudioLevel } from './audioIndicator.js';

let localAudioMonitor = null;
let remoteAudioMonitor = null;

window.addEventListener('DOMContentLoaded', () => {
    if (checkSavedSession()) {
        showScreen('lobby-screen');
        const loggedEl = document.getElementById('logged-user-name');
        if (loggedEl) loggedEl.innerText = getCurrentUser();
    } else {
        showScreen('auth-screen');
    }

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = document.getElementById('auth-username').value;
            const password = document.getElementById('auth-password').value;
            try {
                await loginUser(username, password);
                showScreen('lobby-screen');
                document.getElementById('logged-user-name').innerText = getCurrentUser();
            } catch (e) {
                showAuthError(e.message);
            }
        });
    }

    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const username = document.getElementById('auth-username').value;
            const password = document.getElementById('auth-password').value;
            try {
                await registerUser(username, password);
                showScreen('lobby-screen');
                document.getElementById('logged-user-name').innerText = getCurrentUser();
            } catch (e) {
                showAuthError(e.message);
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logoutUser();
            showScreen('auth-screen');
        });
    }

    const genRoomBtn = document.getElementById('generate-room-btn');
    if (genRoomBtn) {
        genRoomBtn.addEventListener('click', () => {
            document.getElementById('room-input').value = generateRandomRoomCode();
        });
    }

    const joinRoomBtn = document.getElementById('join-room-btn');
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', async () => {
            const room = document.getElementById('room-input').value.trim();
            if (!room) {
                showLobbyError('Digite o nome ou código da sala!');
                return;
            }
            setCurrentRoom(room);
            await enterCallScreen(room);
        });
    }

    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            const enabled = toggleAudioTrack();
            micBtn.classList.toggle('bg-rose-600', !enabled);
            micBtn.innerHTML = enabled ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>';
        });
    }

    const camBtn = document.getElementById('cam-btn');
    if (camBtn) {
        camBtn.addEventListener('click', () => {
            const enabled = toggleVideoTrack();
            camBtn.classList.toggle('bg-rose-600', !enabled);
            camBtn.innerHTML = enabled ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>';
        });
    }

    const screenBtn = document.getElementById('screen-btn');
    if (screenBtn) {
        screenBtn.addEventListener('click', async () => {
            await handleScreenShareToggle();
        });
    }

    const leaveCallHandler = () => {
        leaveCall();
    };

    const leaveCallBtn = document.getElementById('leave-call-btn');
    if (leaveCallBtn) leaveCallBtn.addEventListener('click', leaveCallHandler);

    const leaveCallSidebarBtn = document.getElementById('leave-call-sidebar-btn');
    if (leaveCallSidebarBtn) leaveCallSidebarBtn.addEventListener('click', leaveCallHandler);

    document.querySelectorAll('.fullscreen-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const box = e.currentTarget.closest('.video-box');
            toggleFullscreen(box);
        });
    });

    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (!text) return;

            const currentUser = getCurrentUser();
            appendChatMessage(document.getElementById('chat-messages'), 'Você', text, true);
            sendChatMessageSignal(currentUser, text);
            input.value = '';
        });
    }
});

async function enterCallScreen(room) {
    const currentUser = getCurrentUser();
    showScreen('call-screen');

    document.getElementById('display-room').innerText = room;
    document.getElementById('sidebar-room-name').innerText = room;
    document.getElementById('display-username').innerText = currentUser;
    document.getElementById('sidebar-username').innerText = currentUser;
    document.getElementById('local-label').innerText = `Você (${currentUser})`;

    resetOnlineMembers(currentUser);
    updateOnlineMembersList(currentUser, true);

    // 1. PRIMEIRO: Inicializa a câmera/microfone e aguarda o stream estar pronto
    const stream = await initLocalCamera();
    const localVideo = document.getElementById('local-video');
    
    if (stream && (stream.getVideoTracks().length > 0 || stream.getAudioTracks().length > 0)) {
        localVideo.srcObject = stream;
        localVideo.muted = true; // Silencia o próprio microfone para evitar eco local
        localVideo.play().catch(() => {});
        
        if (stream.getVideoTracks().length > 0) {
            document.getElementById('local-placeholder').style.display = 'none';
        } else {
            document.getElementById('local-placeholder').style.display = 'flex';
        }
    } else {
        document.getElementById('local-placeholder').style.display = 'flex';
    }

    // Monitora áudio local
    const localBox = localVideo.closest('.video-box');
    if (localAudioMonitor) localAudioMonitor.stop();
    localAudioMonitor = monitorAudioLevel(stream, localBox, true);

    // 2. SEGUNDO: Só inicializa a sinalização WebRTC após o stream local estar garantido
    initSignalingChannels(room, currentUser, {
        onChatMessage: (sender, text) => {
            appendChatMessage(document.getElementById('chat-messages'), sender, text, false);
        },
        onSignalData: async (data) => {
            await handleSignalingData(data, currentUser, (remoteStream) => {
                document.getElementById('remote-status').style.display = 'none';
                const remoteVideo = document.getElementById('remote-video');
                remoteVideo.srcObject = remoteStream;
                remoteVideo.muted = false; // Garante reprodução de áudio remoto
                remoteVideo.play().catch(() => {});

                // Monitora áudio remoto
                const remoteBox = remoteVideo.closest('.video-box');
                if (remoteAudioMonitor) remoteAudioMonitor.stop();
                remoteAudioMonitor = monitorAudioLevel(remoteStream, remoteBox, false);
            }, () => {
                document.getElementById('remote-status').style.display = 'none';
            });
        },
        onUserJoined: async (remoteName) => {
            appendSystemMessage(document.getElementById('chat-messages'), remoteName + ' entrou na sala.');
            document.getElementById('remote-label').innerText = remoteName;
            document.getElementById('remote-status-text').innerText = 'Conectando túnel P2P...';

            updateOnlineMembersList(remoteName, true);
            sendUserPresenceSignal(currentUser);

            const pc = createPeerConnection(currentUser, (remoteStream) => {
                document.getElementById('remote-status').style.display = 'none';
                const remoteVideo = document.getElementById('remote-video');
                remoteVideo.srcObject = remoteStream;
                remoteVideo.muted = false;
                remoteVideo.play().catch(() => {});

                const remoteBox = remoteVideo.closest('.video-box');
                if (remoteAudioMonitor) remoteAudioMonitor.stop();
                remoteAudioMonitor = monitorAudioLevel(remoteStream, remoteBox, false);
            }, () => {
                document.getElementById('remote-status').style.display = 'none';
            });

            try {
                if (pc.signalingState === "stable") {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    import('./signaling.js').then(mod => {
                        mod.sendSignal({ type: 'offer', sdp: offer, sender: currentUser });
                    });
                }
            } catch (e) {
                console.error("Erro ao criar oferta WebRTC inicial:", e);
            }
        },
        onUserPresence: (remoteName) => {
            document.getElementById('remote-label').innerText = remoteName;
            updateOnlineMembersList(remoteName, true);
        },
        onSubscribed: () => {
            appendSystemMessage(document.getElementById('chat-messages'), 'Você entrou na sala com sucesso.');
            sendUserJoinedSignal(currentUser);
        }
    });
}

async function handleScreenShareToggle() {
    const btn = document.getElementById('screen-btn');
    const isSharing = getIsScreenSharing();

    if (!isSharing) {
        const screenStream = await startScreenShare();
        if (!screenStream) return;
        const screenTrack = screenStream.getVideoTracks()[0];

        btn.classList.add('bg-indigo-600');
        await replaceVideoTrack(screenTrack);

        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = screenStream;
        localVideo.play().catch(() => {});
        document.getElementById('local-placeholder').style.display = 'none';
        appendSystemMessage(document.getElementById('chat-messages'), 'Você iniciou a transmissão de tela.');

        screenTrack.onended = async () => {
            await stopScreenShareAction();
        };
    } else {
        await stopScreenShareAction();
    }
}

async function stopScreenShareAction() {
    stopScreenShare();
    const btn = document.getElementById('screen-btn');
    if (btn) btn.classList.remove('bg-indigo-600');

    const localStream = getLocalStream();
    const videoTrack = localStream ? localStream.getVideoTracks()[0] : null;

    if (videoTrack) {
        await replaceVideoTrack(videoTrack);
    }

    const localVideo = document.getElementById('local-video');
    if (videoTrack && videoTrack.enabled) {
        localVideo.srcObject = localStream;
        localVideo.play().catch(() => {});
        document.getElementById('local-placeholder').style.display = 'none';
    } else {
        localVideo.srcObject = null;
        document.getElementById('local-placeholder').style.display = 'flex';
    }
    appendSystemMessage(document.getElementById('chat-messages'), 'Você encerrou a transmissão de tela.');
}

function leaveCall() {
    if (localAudioMonitor) localAudioMonitor.stop();
    if (remoteAudioMonitor) remoteAudioMonitor.stop();
    stopLocalCamera();
    stopScreenShare();
    closePeerConnection();
    cleanupSignalingChannels();
    window.location.reload();
}
