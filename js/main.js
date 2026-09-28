import { checkSavedSession, registerUser, loginUser, logoutUser, getCurrentUser, setCurrentUser } from './auth.js';
import { getCurrentRoom, setCurrentRoom, generateRandomRoomCode } from './rooms.js';
import { initLocalCamera, getLocalStream, toggleAudioTrack, toggleVideoTrack, stopLocalCamera, populateAudioDevices } from './cameraMic.js';
import { startScreenShare, stopScreenShare, getScreenStream, getIsScreenSharing } from './screenShare.js';
import { initSignalingChannels, cleanupSignalingChannels, sendUserJoinedSignal, sendUserPresenceSignal, sendChatMessageSignal } from './signaling.js';
import { createPeerConnectionForUser, handleSignalingData, replaceVideoTrackOnAll, closeAllPeers } from './webrtc.js';
import { appendChatMessage, appendSystemMessage } from './chat.js';
import { showScreen, showAuthError, showLobbyError, toggleFullscreen, updateOnlineMembersList, resetOnlineMembers } from './interface.js';
import { monitorAudioLevel } from './audioIndicator.js';

let localAudioMonitor = null;
const remoteAudioMonitors = {};

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

    const micSelect = document.getElementById('mic-select');
    if (micSelect) {
        micSelect.addEventListener('change', async (e) => {
            const deviceId = e.target.value;
            await initLocalCamera(deviceId);
            const stream = getLocalStream();
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                await replaceVideoTrackOnAll(videoTrack);
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

    const stream = await initLocalCamera();
    await populateAudioDevices('mic-select');

    // Sincroniza o botão do microfone para garantir que ele comece ativo e sem estar vermelho
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
        localVideo.play().catch(() => {});
        
        if (stream.getVideoTracks().length > 0) {
            document.getElementById('local-placeholder').style.display = 'none';
        } else {
            document.getElementById('local-placeholder').style.display = 'flex';
        }
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

function renderRemoteVideo(remoteUser, remoteStream) {
    let videoBox = document.getElementById(`remote-box-${remoteUser}`);
    
    if (!videoBox) {
        const grid = document.getElementById('videos-grid');
        videoBox = document.createElement('div');
        videoBox.id = `remote-box-${remoteUser}`;
        videoBox.className = "video-box relative bg-[#111827] rounded-3xl overflow-hidden border border-gray-800 aspect-video flex items-center justify-center shadow-2xl";
        videoBox.innerHTML = `
            <video id="remote-video-${remoteUser}" autoplay playsinline class="w-full h-full object-cover"></video>
            <div class="absolute bottom-3 left-3 bg-[#0b0f19]/80 backdrop-blur-md border border-gray-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-200 flex items-center gap-2 z-10">
                <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>${remoteUser}</span>
            </div>
            <button class="fullscreen-btn absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-xl text-xs backdrop-blur-md transition cursor-pointer border border-gray-700/50 z-10">
                <i class="fa-solid fa-expand"></i>
            </button>
        `;
        grid.appendChild(videoBox);
        
        videoBox.querySelector('.fullscreen-btn').addEventListener('click', () => {
            toggleFullscreen(videoBox);
        });
    }

    const remoteVideo = document.getElementById(`remote-video-${remoteUser}`);
    if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.muted = false;
        remoteVideo.play().catch(() => {});
        
        if (remoteAudioMonitors[remoteUser]) remoteAudioMonitors[remoteUser].stop();
        remoteAudioMonitors[remoteUser] = monitorAudioLevel(remoteStream, videoBox, false);

        // Adiciona controle deslizante de volume individual para este usuário (se já não existir)
        let volumeControl = videoBox.querySelector('.volume-slider-container');
        if (!volumeControl) {
            volumeControl = document.createElement('div');
            volumeControl.className = 'volume-slider-container absolute top-3 left-3 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-gray-700/50 px-2.5 py-1.5 rounded-xl text-xs text-white flex items-center gap-2 z-10 transition';
            volumeControl.innerHTML = `
                <i class="fa-solid fa-volume-high text-[10px]"></i>
                <input type="range" min="0" max="1" step="0.05" value="1" class="w-16 cursor-pointer accent-indigo-500">
            `;
            videoBox.appendChild(volumeControl);

            const slider = volumeControl.querySelector('input');
            slider.addEventListener('input', (e) => {
                remoteVideo.volume = e.target.value;
            });
        }
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
