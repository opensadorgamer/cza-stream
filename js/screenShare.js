let screenStream = null;
let isScreenSharing = false;

export function getScreenStream() {
    return screenStream;
}

export function setScreenStream(stream) {
    screenStream = stream;
}

export function getIsScreenSharing() {
    return isScreenSharing;
}

export function setIsScreenSharing(status) {
    isScreenSharing = status;
}

export async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        isScreenSharing = true;
        return screenStream;
    } catch (err) {
        console.error("Erro ao iniciar getDisplayMedia:", err);
        isScreenSharing = false;
        return null;
    }
}

export function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    isScreenSharing = false;
}
