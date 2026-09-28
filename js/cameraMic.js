let localStream = null;
let currentAudioDeviceId = null;

export async function initLocalCamera(audioDeviceId = null) {
    try {
        currentAudioDeviceId = audioDeviceId;
        const audioConstraints = audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true;

        // Tenta abrir APENAS áudio se soubermos que é um ambiente sem câmara ou por segurança,
        // mas vamos tentar com vídeo apenas se o utilizador quiser explicitamente ou se houver hardware válido.
        // Como o seu PC não tem webcam, vamos forçar explicitamente video: false para evitar qualquer NotReadableError.
        
        console.log("A inicializar áudio com restrições:", audioConstraints);
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
        return localStream;

    } catch (err) {
        console.warn("Falha ao abrir áudio com dispositivo específico, a tentar microfone padrão...", err);
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
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
