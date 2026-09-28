let localStream = null;
let currentAudioDeviceId = null;

export async function initLocalCamera(audioDeviceId = null) {
    try {
        currentAudioDeviceId = audioDeviceId;
        
        // Mapeia corretamente o ID do microfone externo (USB/Wireless) selecionado pelo utilizador
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

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (!isMobile) {
            console.log("A abrir microfone (nativo ou externo/USB):", audioDeviceId || "Padrão");
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        }

        // Telemóvel
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: audioConstraints });
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        } catch (videoErr) {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        }

    } catch (err) {
        console.error("Erro ao aceder ao microfone selecionado:", err);
        // Fallback de segurança absoluto caso o dispositivo específico falhe
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
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
        // IMPORTANTE: Para o navegador dar o nome real dos microfones USB/Wireless e permitir acesso,
        // o getUserMedia precisa de ter sido chamado pelo menos uma vez antes.
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        select.innerHTML = '<option value="">Microfone Padrão</option>';
        audioInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            // Se o label vier vazio (permissão restrita), dá um nome amigável
            option.text = device.label || `Microfone Externo / USB ${index + 1}`;
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
