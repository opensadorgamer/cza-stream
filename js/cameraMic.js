let localStream = null;
let currentAudioDeviceId = null;

export async function initLocalCamera(audioDeviceId = null) {
    try {
        currentAudioDeviceId = audioDeviceId;
        
        // CORREÇÃO CRUCIAL: No desktop, para microfones USB/Wireless, o ID precisa 
        // de ser passado explicitamente no formato { exact: id } se houver um ID selecionado.
        let audioConstraints = true;
        
        if (audioDeviceId && audioDeviceId !== "") {
            audioConstraints = {
                deviceId: { exact: audioDeviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            console.log("A abrir microfone externo/específico com ID:", audioDeviceId);
        } else {
            audioConstraints = {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            console.log("A abrir microfone padrão do desktop...");
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (!isMobile) {
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
        console.error("Erro ao aceder ao microfone selecionado, a tentar padrão simples:", err);
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
        // Garante permissão ativa para listar os rótulos reais dos dispositivos USB/Wireless
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
