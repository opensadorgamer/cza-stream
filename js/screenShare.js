let screenStream = null;
let isScreenSharing = false;

export async function startScreenShare() {
    try {
        const constraints = {
            video: {
                cursor: "always",
                displaySurface: "monitor",
                // Qualidade máxima ideal: 1080p a 60 FPS para imagem perfeita e fluida em jogos
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 60, max: 60 },
                resizeMode: "none" // Mantém a resolução nativa sem cortes automáticos feios
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            }
        };

        const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        
        screenStream.getVideoTracks()[0].onended = () => {
            console.log("Compartilhamento de tela encerrado pelo usuário.");
        };

        return screenStream;
    } catch (error) {
        console.error("Erro ao iniciar o compartilhamento de tela:", error);
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
