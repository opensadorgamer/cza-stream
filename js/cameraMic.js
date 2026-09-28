let localStream = null;
let currentAudioDeviceId = null;

export async function initLocalCamera(audioDeviceId = null) {
    try {
        currentAudioDeviceId = audioDeviceId;
        
        const audioConstraints = audioDeviceId ? {
            deviceId: { exact: audioDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        };

        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }

        // Solicita vídeo (webcam) e áudio simultaneamente de forma robusta
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, 
                audio: audioConstraints 
            });
        } catch (videoErr) {
            console.warn("Não foi possível aceder à webcam, a tentar apenas áudio...", videoErr);
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: false, 
                audio: audioConstraints 
            });
        }

        if (localStream && localStream.getAudioTracks().length > 0) {
            localStream.getAudioTracks()[0].enabled = true;
        }

        return localStream;

    } catch (err) {
        console.error("Erro crítico ao inicializar dispositivos de mídia:", err);
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        } catch (e) {
            localStream = new MediaStream();
            return localStream;
        }
    }
}

export async function populateAudioDevices(selectElementId) {
    const select = document.getElementById(selectElementId);
    if (!select) return;

    try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        select.innerHTML = '<option value="">Microfone Padrão</option>';
        audioInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Microfone ${index + 1}`;
            select.appendChild(option);
        });

        if (currentAudioDeviceId) {
            select.value = currentAudioDeviceId;
        }
    } catch (e) {
        console.error("Erro ao listar dispositivos de áudio:", e);
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
