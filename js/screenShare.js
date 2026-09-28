let screenStream = null;
let isScreenSharing = false;

export async function startScreenShare() {
    try {
        const constraints = {
            video: {
                cursor: "always",
                displaySurface: "monitor",
                // 1080p nativo mantido, mas com 30 FPS estáveis para acabar com o efeito de "lag/teleporte"
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30, max: 30 },
                resizeMode: "none"
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            }
        };

        const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        
        screenStream = stream;
        isScreenSharing = true;

        screenStream.getVideoTracks()[0].onended = () => {
            console.log("Compartilhamento de tela encerrado pelo usuário.");
            stopScreenShare();
        };

        return screenStream;
    } catch (error) {
        console.error("Erro ao iniciar o compartilhamento de tela:", error);
        isScreenSharing = false;
        return null;
    }
}

export function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    isScreenSharing = false;
}

export function getScreenStream() {
    return screenStream;
}

export function getIsScreenSharing() {
    return isScreenSharing;
}

export function setIsScreenSharing(val) {
    isScreenSharing = val;
}
