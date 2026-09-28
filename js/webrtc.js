import { sendSignal } from './signaling.js';
import { getLocalStream } from './cameraMic.js';
import { getScreenStream, getIsScreenSharing } from './screenShare.js';

let peerConnection = null;
let iceCandidateQueue = [];
let remoteDescProcessed = false;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};

export function getPeerConnection() {
    return peerConnection;
}

export function createPeerConnection(currentUser, onRemoteStreamCallback, onStatusUpdateCallback) {
    if (peerConnection) return peerConnection;

    remoteDescProcessed = false;
    iceCandidateQueue = [];

    peerConnection = new RTCPeerConnection(rtcConfig);

    const activeStream = getIsScreenSharing() ? getScreenStream() : getLocalStream();
    if (activeStream) {
        activeStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, activeStream);
        });
    }

    peerConnection.onnegotiationneeded = async () => {
        try {
            if (peerConnection.signalingState !== "stable") return;
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            sendSignal({ type: 'offer', sdp: offer, sender: currentUser });
        } catch (e) {
            console.error("Erro na renegociação WebRTC:", e);
        }
    };

    peerConnection.ontrack = event => {
        if (onRemoteStreamCallback && event.streams && event.streams[0]) {
            onRemoteStreamCallback(event.streams[0]);
        }
        if (onStatusUpdateCallback) {
            onStatusUpdateCallback();
        }
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendSignal({ type: 'candidate', candidate: event.candidate, sender: currentUser });
        }
    };

    return peerConnection;
}

export async function handleSignalingData(data, currentUser, onRemoteStreamCallback, onStatusUpdateCallback) {
    if (!peerConnection) {
        createPeerConnection(currentUser, onRemoteStreamCallback, onStatusUpdateCallback);
    }

    try {
        if (data.type === 'offer') {
            if (peerConnection.signalingState !== "stable") {
                await peerConnection.setLocalDescription({ type: "rollback" }).catch(() => {});
            }
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            remoteDescProcessed = true;

            while (iceCandidateQueue.length > 0) {
                const candidate = iceCandidateQueue.shift();
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            sendSignal({ type: 'answer', sdp: answer, sender: currentUser });

            if (onStatusUpdateCallback) onStatusUpdateCallback();

        } else if (data.type === 'answer') {
            if (peerConnection.signalingState === "have-local-offer") {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                remoteDescProcessed = true;

                while (iceCandidateQueue.length > 0) {
                    const candidate = iceCandidateQueue.shift();
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
                }

                if (onStatusUpdateCallback) onStatusUpdateCallback();
            }
        } else if (data.type === 'candidate') {
            if (data.candidate) {
                if (remoteDescProcessed && peerConnection.remoteDescription) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
                } else {
                    iceCandidateQueue.push(data.candidate);
                }
            }
        }
    } catch (e) {
        console.error("Erro no processamento de sinalização WebRTC:", e);
    }
}

export async function replaceVideoTrack(newTrack) {
    if (!peerConnection) return;
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
        await sender.replaceTrack(newTrack);
    } else if (newTrack) {
        const activeStream = getIsScreenSharing() ? getScreenStream() : getLocalStream();
        if (activeStream) {
            peerConnection.addTrack(newTrack, activeStream);
        }
    }
}

export function closePeerConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    iceCandidateQueue = [];
    remoteDescProcessed = false;
}
