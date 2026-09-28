let localStream = null;

export async function initLocalCamera() {
    try {
        // Tenta capturar vídeo e áudio simultaneamente (para notebooks/dispositivos com câmara)
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        return localStream;
    } catch (err) {
        console.warn("Câmera indisponível ou não autorizada. A tentar apenas áudio...", err);
        try {
            // Fallback limpo: Pede explicitamente APENAS o microfone (video: false)
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            return localStream;
        } catch (audioErr) {
            console.warn("Microfone também indisponível ou negado:", audioErr);
            localStream = new MediaStream();
            return localStream;
        }
    }
}

export function getLocalStream() {
    return localStream;
}

export function toggleAudioTrack() {
    const track = localStream ? localStream.getAudioTracks()[0] : null;
    if (track) {
        track.enabled = !track.enabled;
        return track.enabled;
    }
    return false;
}

export function toggleVideoTrack() {
    const track = localStream ? localStream.getVideoTracks()[0] : null;
    if (track) {
        track.enabled = !track.enabled;
        return track.enabled;
    }
    return false;
}

export function stopLocalCamera() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
}
