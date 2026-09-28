export function monitorAudioLevel(stream, labelElementOrBox, isLocal = false) {
    if (!stream || stream.getAudioTracks().length === 0) return null;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animationId = null;

        const checkAudio = () => {
            if (!audioCtx || audioCtx.state === 'closed') return;
            analyser.getByteFrequencyData(dataArray);
            
            // Calcula a média do volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            // Se o volume passar de um limite (ex: 12), consideramos que a pessoa está falando
            if (labelElementOrBox) {
                if (average > 12) {
                    labelElementOrBox.classList.add('ring-4', 'ring-emerald-500', 'shadow-lg', 'shadow-emerald-500/50');
                } else {
                    labelElementOrBox.classList.remove('ring-4', 'ring-emerald-500', 'shadow-lg', 'shadow-emerald-500/50');
                }
            }

            animationId = requestAnimationFrame(checkAudio);
        };

        checkAudio();

        return {
            stop: () => {
                if (animationId) cancelAnimationFrame(animationId);
                if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
            }
        };
    } catch (e) {
        console.error("Erro ao iniciar monitoramento de áudio:", e);
        return null;
    }
}
