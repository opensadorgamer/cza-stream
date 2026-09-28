let screenStream = null;
let isScreenSharing = false;

export async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                cursor: "always",
                width: { ideal: 1920, max: 3840 },
                height: { ideal: 1080, max: 2160 },
                frameRate: { ideal: 60, max: 60 }
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 2
            }
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
