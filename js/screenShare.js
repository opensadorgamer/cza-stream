let screenStream = null;
let isScreenSharing = false;

export async function startScreenShare() {
    try {
        const constraints = {
            video: {
                cursor: "always",
                displaySurface: "monitor",
                // Força resoluções e taxa de quadros estáveis para evitar engasgos na transmissão
                width: { max: 1920, ideal: 1280 },
                height: { max: 1080, ideal: 720 },
                frameRate: { max: 30, ideal: 30 },
                // Prioriza movimento fluido em vez de imagem estática (ótimo para jogos)
                resizeMode: "crop-and-scale"
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            }
        };

        const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        
        // Garante que se o usuário clicar no botão nativo de parar compartilhamento, o stream encerre limpo
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
