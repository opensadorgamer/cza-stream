import { sendSignal } from './signaling.js';
import { getLocalStream } from './cameraMic.js';
import { getScreenStream, getIsScreenSharing } from './screenShare.js';

let peers = {}; // Ex: { 'ari2': RTCPeerConnection, 'ari3': RTCPeerConnection }
let iceCandidateQueues = {};
let currentUserGlobal = null; // Armazena o utilizador atual para uso interno nas renegociações

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
    ]
};

export function getPeers() {
    return peers;
}

export function createPeerConnectionForUser(remoteUser, currentUser, onRemoteStreamCallback) {
    if (peers[remoteUser]) return peers[remoteUser];

    currentUserGlobal = currentUser;
    const pc = new RTCPeerConnection(rtcConfig);
    peers[remoteUser] = pc;
    iceCandidateQueues[remoteUser] = [];

    // Adiciona as faixas locais ativas (Áudio e Vídeo/Tela)
    const activeStream = getIsScreenSharing() ? getScreenStream() : getLocalStream();
    if (activeStream) {
        activeStream.getTracks().forEach(track => {
            pc.addTrack(track, activeStream);
        });
    }

    pc.onicecandidate = event => {
        if (event.candidate) {
            sendSignal({
                type: 'candidate',
                candidate: event.candidate,
                sender: currentUser,
                target: remoteUser
            });
        }
    };

    pc.ontrack = event => {
        if (onRemoteStreamCallback && event.streams && event.streams[0]) {
            onRemoteStreamCallback(remoteUser, event.streams[0]);
        }
    };

    return pc;
}

export async function handleSignalingData(data, currentUser, onRemoteStreamCallback) {
    currentUserGlobal = currentUser;
    const remoteUser = data.sender;
    if (!remoteUser || remoteUser === currentUser) return;

    let pc = peers[remoteUser];
    if (!pc) {
        pc = createPeerConnectionForUser(remoteUser, currentUser, onRemoteStreamCallback);
    }

    try {
        if (data.type === 'offer') {
            if (pc.signalingState !== "stable") {
                await pc.setLocalDescription({ type: "rollback" }).catch(() => {});
            }
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

            while (iceCandidateQueues[remoteUser] && iceCandidateQueues[remoteUser].length > 0) {
                const candidate = iceCandidateQueues[remoteUser].shift();
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({
                type: 'answer',
                sdp: answer,
                sender: currentUser,
                target: remoteUser
            });

        } else if (data.type === 'answer') {
            if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

                while (iceCandidateQueues[remoteUser] && iceCandidateQueues[remoteUser].length > 0) {
                    const candidate = iceCandidateQueues[remoteUser].shift();
                    await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
                }
            }
        } else if (data.type === 'candidate') {
            if (data.candidate) {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
                } else {
                    if (!iceCandidateQueues[remoteUser]) iceCandidateQueues[remoteUser] = [];
                    iceCandidateQueues[remoteUser].push(data.candidate);
                }
            }
        }
    } catch (e) {
        console.error(`Erro de sinalização com ${remoteUser}:`, e);
    }
}

// CORREÇÃO ROBUSTA: Substitui o vídeo ou adiciona a faixa e força renegociação automática se necessário
export async function replaceVideoTrackOnAll(newTrack) {
    const activeStream = getIsScreenSharing() ? getScreenStream() : getLocalStream();
    
    for (const remoteUser of Object.keys(peers)) {
        const pc = peers[remoteUser];
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');

        if (videoSender) {
            // Se já existe um remetente de vídeo, apenas substitui a faixa em tempo real
            await videoSender.replaceTrack(newTrack);
        } else if (newTrack && activeStream) {
            // Se não existe (ex: PC sem webcam a iniciar partilha de tela), adiciona a faixa e renegocia
            activeStream.getTracks().forEach(track => {
                // Evita adicionar faixas duplicadas que já existam
                if (!senders.some(s => s.track === track)) {
                    pc.addTrack(track, activeStream);
                }
            });

            // Dispara nova oferta (renegociação) para que o outro peer receba a nova faixa de vídeo
            try {
                if (pc.signalingState === "stable") {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    sendSignal({
                        type: 'offer',
                        sdp: offer,
                        sender: currentUserGlobal,
                        target: remoteUser
                    });
                }
            } catch (e) {
                console.error(`Erro ao renegociar faixa de vídeo com ${remoteUser}:`, e);
            }
        }
    }
}

export function closeAllPeers() {
    Object.keys(peers).forEach(remoteUser => {
        if (peers[remoteUser]) {
            peers[remoteUser].close();
            delete peers[remoteUser];
        }
    });
    peers = {};
    iceCandidateQueues = {};
}
