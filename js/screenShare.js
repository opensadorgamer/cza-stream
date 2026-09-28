let screenStream = null;
let isScreenSharing = false;

export async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true // Captura o som do jogo/sistema junto com a imagem
        });
        isScreenSharing = true;
        return screenStream;
    } catch (error) {
        console.error("Erro ao iniciar compartilhamento de tela:", error);
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
