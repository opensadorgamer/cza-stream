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

    // Otimização para alta qualidade de áudio e vídeo com múltiplos fluxos simultâneos
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });

    const activeStream = getIsScreenSharing() ? getScreenStream() : getLocalStream();
    if (activeStream && activeStream.getTracks().length > 0) {
        const senders = pc.getSenders();
        activeStream.getTracks().forEach(track => {
            const sender = senders.find(s => s.track && s.track.kind === track.kind);
            if (sender) {
                sender.replaceTrack(track);
            } else {
                pc.addTrack(track, activeStream);
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
        
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
        if (audioSender && localMicTrack) {
            await audioSender.replaceTrack(localMicTrack);
        }

        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
        } else {
            pc.addTrack(newVideoTrack, getScreenStream() || localStream);
        }

        if (newAudioTrack) {
            const allAudioSenders = senders.filter(s => s.track && s.track.kind === 'audio');
            if (allAudioSenders.length > 1) {
                await allAudioSenders[1].replaceTrack(newAudioTrack);
            } else {
                pc.addTrack(newAudioTrack, getScreenStream());
            }
        }

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
