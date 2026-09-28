import { sendSignal } from './signaling.js';
import { getLocalStream } from './cameraMic.js';
import { getScreenStream, getIsScreenSharing } from './screenShare.js';

let peers = {};
let iceCandidateQueues = {};
let currentUserGlobal = null;

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

    // Criação explícita de transceivers dedicados para evitar conflitos de canais
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });
    // Transceiver dedicado secundário para o áudio da tela (evita que o microfone seja sobrescrito)
    pc.addTransceiver('audio', { direction: 'sendrecv' });

    // Associa imediatamente o stream local ativo (câmara e microfone)
    const localStream = getLocalStream();
    if (localStream && localStream.getTracks().length > 0) {
        const senders = pc.getSenders();
        localStream.getTracks().forEach(track => {
            if (track.kind === 'audio') {
                const audioSender = senders.find(s => s.track === null && s.sender?.track?.kind === 'audio') || senders.filter(s => s.track?.kind === 'audio')[0];
                if (audioSender && !audioSender.track) {
                    audioSender.replaceTrack(track);
                } else {
                    pc.addTrack(track, localStream);
                }
            } else if (track.kind === 'video') {
                const videoSender = senders.find(s => s.track === null && s.sender?.track?.kind === 'video') || senders.filter(s => s.track?.kind === 'video')[0];
                if (videoSender && !videoSender.track) {
                    videoSender.replaceTrack(track);
                } else {
                    pc.addTrack(track, localStream);
                }
            }
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
            sendSignal({ type: 'answer', sdp: answer, sender: currentUser, target: remoteUser });

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
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
                } else {
                    if (!iceCandidateQueues[remoteUser]) iceCandidateQueues[remoteUser] = [];
                    iceCandidateQueues[remoteUser].push(data.candidate);
                }
            }
        }
    } catch (e) {
        console.warn(`Sinalização gerida para ${remoteUser}:`, e);
    }
}

export async function replaceVideoTrackOnAll(newVideoTrack, newAudioTrack = null) {
    const localStream = getLocalStream();
    const localMicTrack = localStream ? localStream.getAudioTracks()[0] : null;

    for (const remoteUser of Object.keys(peers)) {
        const pc = peers[remoteUser];
        const senders = pc.getSenders();
        
        // Garante que o primeiro canal de áudio mantém SEMPRE o microfone ativo e intacto
        const audioSenders = senders.filter(s => s.track && s.track.kind === 'audio' || s.dtmf);
        const primaryAudioSender = senders.find(s => s.track?.kind === 'audio') || audioSenders[0];
        
        if (primaryAudioSender && localMicTrack) {
            await primaryAudioSender.replaceTrack(localMicTrack);
        } else if (localMicTrack) {
            pc.addTrack(localMicTrack, localStream);
        }

        // Gere o vídeo (câmara ou tela)
        const videoSender = senders.find(s => s.track && s.track.kind === 'video') || senders.find(s => s.dtmf === null && s.track?.kind === 'video');
        if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
        } else {
            pc.addTrack(newVideoTrack, getScreenStream() || localStream);
        }

        // Gere o áudio secundário da tela (jogo/sistema) no segundo canal dedicado
        const allAudioSenders = senders.filter(s => s.track?.kind === 'audio' || s.dtmf === null);
        if (newAudioTrack) {
            if (allAudioSenders.length > 1) {
                await allAudioSenders[1].replaceTrack(newAudioTrack);
            } else {
                pc.addTrack(newAudioTrack, getScreenStream());
            }
        } else {
            // Se fechou a tela, limpa o segundo canal de áudio com segurança
            if (allAudioSenders.length > 1 && allAudioSenders[1].track) {
                await allAudioSenders[1].replaceTrack(null);
            }
        }

        // Renegociação SDP segura para propagar as alterações a ambos os pares
        try {
            if (pc.signalingState === "stable") {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: offer, sender: currentUserGlobal, target: remoteUser });
            }
        } catch (e) {
            console.error(`Erro ao renegociar faixa com ${remoteUser}:`, e);
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
