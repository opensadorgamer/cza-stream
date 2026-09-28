let screenStream = null;
let isScreenSharing = false;

export async function startScreenShare() {
    try {
        const constraints = {
            video: {
                cursor: "always",
                displaySurface: "monitor",
                // Força resolução nítida em Full HD com taxa de quadros fluida para jogos
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 60, max: 60 },
                resizeMode: "none" // Evita reescalonamento automático que borra a imagem
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            }
        };

        // Captura o fluxo de tela do sistema/jogo
        const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        
        screenStream = stream;
        isScreenSharing = true;

        // Trata o encerramento nativo da partilha de tela (botão de parar do navegador)
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
