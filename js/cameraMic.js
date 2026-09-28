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

        // Deteta se é um dispositivo móvel (telemóvel/tablet)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (!isMobile) {
            console.log("Computador detetado: a abrir estritamente apenas o microfone...");
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        }

        // Se for telemóvel, tenta abrir com câmara e microfone
        console.log("Telemóvel detetado: a solicitar câmara e microfone...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
                audio: audioConstraints 
            });
            return localStream;
        } catch (videoErr) {
            console.warn("Telemóvel sem câmara ou com erro de vídeo, a abrir apenas áudio...", videoErr);
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            return localStream;
        }

    } catch (err) {
        console.warn("Erro ao aceder ao microfone, a tentar fallback universal...", err);
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        } catch (audioErr) {
            console.error("Erro crítico: Microfone indisponível ou negado:", audioErr);
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
