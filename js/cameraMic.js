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

        // Verifica se o navegador suporta enumeração de dispositivos para detetar câmara
        let hasVideoInput = false;
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            hasVideoInput = devices.some(device => device.kind === 'videoinput');
        }

        // Se NÃO tiver câmara (como o seu PC), abre estritamente apenas áudio
        if (!hasVideoInput) {
            console.log("PC sem câmara detetado. A solicitar apenas áudio...");
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            return localStream;
        }

        // Se TIVER câmara (como o telemóvel), tenta abrir vídeo e áudio normalmente
        console.log("Dispositivo com câmara detetado. A solicitar vídeo e áudio...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
                audio: audioConstraints 
            });
            return localStream;
        } catch (videoErr) {
            console.warn("Falha ao abrir câmara, a tentar fallback apenas para áudio...", videoErr);
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            return localStream;
        }

    } catch (err) {
        console.warn("Erro ao aceder aos dispositivos de mídia, a tentar padrão...", err);
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            return localStream;
        } catch (audioErr) {
            console.error("Erro crítico: Mídia indisponível ou negada:", audioErr);
            localStream = new MediaStream();
            return localStream;
        }
    }
}

export async function populateAudioDevices(selectElementId) {
    const select = document.getElementById(selectElementId);
    if (!select) return;

    try {
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
        console.error("Erro ao listar microfones:", e);
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
