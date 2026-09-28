let localStream = null;
let currentAudioDeviceId = null;

export async function initLocalCamera(audioDeviceId = null) {
    try {
        currentAudioDeviceId = audioDeviceId;
        
        // Restrições limpas e diretas compatíveis com qualquer microfone de PC no navegador
        const audioConstraints = audioDeviceId ? { 
            deviceId: { exact: audioDeviceId }
        } : true;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (!isMobile) {
            console.log("Navegador em PC: a abrir stream de áudio limpo...");
            // No PC, pedimos estritamente apenas áudio puro sem filtros excessivos
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        }

        // Se for telemóvel, abre câmara e áudio
        console.log("Navegador em Telemóvel: a solicitar câmara e áudio...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: audioConstraints 
            });
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        } catch (videoErr) {
            console.warn("Telemóvel sem câmara, a abrir apenas áudio...", videoErr);
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            if (localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = true;
            }
            return localStream;
        }

    } catch (err) {
        console.error("Erro crítico ao aceder ao microfone no navegador:", err);
        localStream = new MediaStream();
        return localStream;
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
