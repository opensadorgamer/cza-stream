import { checkSavedSession, registerUser, loginUser, logoutUser, getCurrentUser, setCurrentUser } from './auth.js';
import { getCurrentRoom, setCurrentRoom, generateRandomRoomCode } from './rooms.js';
import { initLocalCamera, getLocalStream, toggleAudioTrack, toggleVideoTrack, stopLocalCamera, populateAudioDevices } from './cameraMic.js';
import { startScreenShare, stopScreenShare, getScreenStream, getIsScreenSharing } from './screenShare.js';
import { initSignalingChannels, cleanupSignalingChannels, sendUserJoinedSignal, sendUserPresenceSignal, sendChatMessageSignal } from './signaling.js';
import { createPeerConnectionForUser, handleSignalingData, replaceVideoTrackOnAll, closeAllPeers } from './webrtc.js';
import { appendChatMessage, appendSystemMessage } from './chat.js';
import { showScreen, showAuthError, showLobbyError, toggleFullscreen, updateOnlineMembersList, resetOnlineMembers } from './interface.js';
import { monitorAudioLevel } from './audioIndicator.js';
import { fetchUserProfile } from './supabaseClient.js';

let localAudioMonitor = null;
const remoteAudioMonitors = {};

window.addEventListener('DOMContentLoaded', async () => {
    if (checkSavedSession()) {
        showScreen('lobby-screen');
        const username = getCurrentUser();
        const loggedEl = document.getElementById('logged-user-name');
        if (loggedEl) loggedEl.innerText = username;
    } else {
        showScreen('auth-screen');
    }

    // Configuração dos botões de autenticação, sala e controlos
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

    const micSelect = document.getElementById('mic-select');
    if (micSelect) {
        micSelect.addEventListener('change', async (e) => {
            const deviceId = e.target.value;
            const stream = await initLocalCamera(deviceId);
            if (stream && stream.getAudioTracks().length > 0) {
                const newAudioTrack = stream.getAudioTracks()[0];
                newAudioTrack.enabled = true;

                import('./webrtc.js').then(async (webrtcMod) => {
                    const peers = webrtcMod.getPeers();
                    for (const remoteUser of Object.keys(peers)) {
                        const pc = peers[remoteUser];
                        const senders = pc.getSenders();
                        const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                        if (audioSender) {
                            await audioSender.replaceTrack(newAudioTrack);
                        } else {
                            pc.addTrack(newAudioTrack, stream);
                        }
                    }
                });
                appendSystemMessage(document.getElementById('chat-messages'), 'Microfone alterado e sincronizado com sucesso.');
            }
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

    const leaveCallHandler = () => { leaveCall(); };
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

    const stream = await initLocalCamera();
    await populateAudioDevices('mic-select');

    const micBtn = document.getElementById('mic-btn');
    if (micBtn && stream && stream.getAudioTracks().length > 0) {
        stream.getAudioTracks()[0].enabled = true;
        micBtn.classList.remove('bg-rose-600');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }

    const localVideo = document.getElementById('local-video');
    if (stream && (stream.getVideoTracks().length > 0 || stream.getAudioTracks().length > 0)) {
        localVideo.srcObject = stream;
        localVideo.muted = true;
        localVideo.volume = 0;
        localVideo.play().catch(() => {});
        document.getElementById('local-placeholder').style.display = stream.getVideoTracks().length > 0 ? 'none' : 'flex';
    } else {
        document.getElementById('local-placeholder').style.display = 'flex';
    }

    const localBox = localVideo.closest('.video-box');
    if (localAudioMonitor) localAudioMonitor.stop();
    localAudioMonitor = monitorAudioLevel(stream, localBox, true);

    window.handleRemoteStreamGlobal = (remoteUser, remoteStream) => {
        renderRemoteVideo(remoteUser, remoteStream);
    };

    initSignalingChannels(room, currentUser, {
        onChatMessage: (sender, text) => {
            appendChatMessage(document.getElementById('chat-messages'), sender, text, false);
        },
        onSignalData: async (data) => {
            await handleSignalingData(data, currentUser, window.handleRemoteStreamGlobal);
        },
        onUserJoined: async (remoteName) => {
            if (remoteName === currentUser) return;
            appendSystemMessage(document.getElementById('chat-messages'), remoteName + ' entrou na sala.');
            updateOnlineMembersList(remoteName, true);
            sendUserPresenceSignal(currentUser);

            const pc = createPeerConnectionForUser(remoteName, currentUser, window.handleRemoteStreamGlobal);
            try {
                if (pc.signalingState === "stable") {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    import('./signaling.js').then(mod => {
                        mod.sendSignal({ type: 'offer', sdp: offer, sender: currentUser, target: remoteName });
                    });
                }
            } catch (e) {
                console.error(`Erro ao criar oferta para ${remoteName}:`, e);
            }
        },
        onUserPresence: (remoteName) => {
            updateOnlineMembersList(remoteName, true);
        },
        onSubscribed: () => {
            appendSystemMessage(document.getElementById('chat-messages'), 'Você entrou na sala com sucesso.');
            sendUserJoinedSignal(currentUser);
        }
    });
}

// Renderização dos utilizadores remotos com controles de volume independentes para Voz e Tela
function renderRemoteVideo(remoteUser, remoteStream) {
    let videoBox = document.getElementById(`remote-box-${remoteUser}`);
    
    if (!videoBox) {
        const grid = document.getElementById('videos-grid');
        videoBox = document.createElement('div');
        videoBox.id = `remote-box-${remoteUser}`;
        videoBox.className = "video-box relative bg-gray-900/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-800/80 aspect-video flex items-center justify-center shadow-2xl transition-all duration-300";
        videoBox.innerHTML = `
            <video id="remote-video-${remoteUser}" autoplay playsinline class="w-full h-full object-cover"></video>
            <audio id="remote-screen-audio-${remoteUser}" autoplay playsinline></audio>

            <div class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md border border-gray-700/50 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-200 flex items-center gap-2 z-10">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>${remoteUser}</span>
            </div>

            <button class="fullscreen-btn absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-xl text-xs backdrop-blur-md transition cursor-pointer border border-gray-700/50 z-10">
                <i class="fa-solid fa-expand"></i>
            </button>

            <!-- Painel de volumes separados por voz e tela -->
            <div class="absolute top-3 left-3 flex flex-col gap-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md border border-gray-700/50 p-2 rounded-xl text-[11px] text-white z-10 transition shadow-lg">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-microphone text-indigo-400 w-3"></i>
                    <span class="text-gray-300 w-8">Voz:</span>
                    <input type="range" id="vol-mic-${remoteUser}" min="0" max="1" step="0.05" value="1" class="w-20 cursor-pointer accent-indigo-500">
                </div>
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-desktop text-emerald-400 w-3"></i>
                    <span class="text-gray-300 w-8">Tela:</span>
                    <input type="range" id="vol-screen-${remoteUser}" min="0" max="1" step="0.05" value="1" class="w-20 cursor-pointer accent-emerald-500">
                </div>
            </div>
        `;
        grid.appendChild(videoBox);
        
        videoBox.querySelector('.fullscreen-btn').addEventListener('click', () => {
            toggleFullscreen(videoBox);
        });

        const micSlider = document.getElementById(`vol-mic-${remoteUser}`);
        const screenSlider = document.getElementById(`vol-screen-${remoteUser}`);
        const remoteVideo = document.getElementById(`remote-video-${remoteUser}`);
        const remoteScreenAudio = document.getElementById(`remote-screen-audio-${remoteUser}`);

        micSlider.addEventListener('input', (e) => {
            if (remoteVideo) remoteVideo.volume = e.target.value;
        });

        screenSlider.addEventListener('input', (e) => {
            if (remoteScreenAudio) remoteScreenAudio.volume = e.target.value;
        });
    }

    const remoteVideo = document.getElementById(`remote-video-${remoteUser}`);
    const remoteScreenAudio = document.getElementById(`remote-screen-audio-${remoteUser}`);

    if (remoteVideo && remoteScreenAudio) {
        const audioTracks = remoteStream.getAudioTracks();
        const videoTracks = remoteStream.getVideoTracks();

        if (videoTracks.length > 0) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.muted = false;
            remoteVideo.play().catch(() => {});
        }

        if (audioTracks.length > 1) {
            const screenAudioStream = new MediaStream([audioTracks[1]]);
            remoteScreenAudio.srcObject = screenAudioStream;
            remoteScreenAudio.muted = false;
            remoteScreenAudio.play().catch(() => {});
        } else if (audioTracks.length === 1) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.muted = false;
            remoteVideo.play().catch(() => {});
        }
        
        if (remoteAudioMonitors[remoteUser]) remoteAudioMonitors[remoteUser].stop();
        remoteAudioMonitors[remoteUser] = monitorAudioLevel(remoteStream, videoBox, false);
    }
}

async function handleScreenShareToggle() {
    const btn = document.getElementById('screen-btn');
    const isSharing = getIsScreenSharing();

    if (!isSharing) {
        const screenStream = await startScreenShare();
        if (!screenStream) return;
        const screenTrack = screenStream.getVideoTracks()[0];

        btn.classList.add('bg-indigo-600');
        await replaceVideoTrackOnAll(screenTrack);

        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = screenStream;
        localVideo.muted = true;
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
        await replaceVideoTrackOnAll(videoTrack);
    }

    const localVideo = document.getElementById('local-video');
    if (videoTrack && videoTrack.enabled) {
        localVideo.srcObject = localStream;
        localVideo.muted = true;
        localVideo.volume = 0;
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
    Object.keys(remoteAudioMonitors).forEach(user => {
        if (remoteAudioMonitors[user]) remoteAudioMonitors[user].stop();
    });
    stopLocalCamera();
    stopScreenShare();
    closeAllPeers();
    cleanupSignalingChannels();
    window.location.reload();
}
