import { useCallback } from 'react';

/**
 * Custom Hook tạo hiệu ứng âm thanh phản xạ đúng/sai sử dụng trực tiếp Web Audio API
 * Không yêu cầu tải bất kỳ file mp3 bên ngoài nào.
 */
export const useSoundEffects = () => {
  const playSound = useCallback((freqs: number[], type: OscillatorType = 'sine', duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      let startTime = ctx.currentTime;

      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);

        startTime += duration * 0.8;
      });
    } catch {
      // Bỏ qua lỗi nếu trình duyệt chặn audio policy
    }
  }, []);

  // Âm thanh chúc mừng / làm đúng (Ding-ding vui tươi)
  const playCorrectSound = useCallback(() => {
    playSound([587.33, 880], 'sine', 0.12); // D5 -> A5
  }, [playSound]);

  // Âm thanh báo sai / ghép nhầm (Buzz nhẹ)
  const playWrongSound = useCallback(() => {
    playSound([220, 164.81], 'sawtooth', 0.15); // A3 -> E3
  }, [playSound]);

  // Âm thanh hoàn thành phiên học (Fanfare nhẹ)
  const playVictorySound = useCallback(() => {
    playSound([523.25, 659.25, 783.99, 1046.5], 'triangle', 0.15); // C5 -> E5 -> G5 -> C6
  }, [playSound]);

  return {
    playCorrectSound,
    playWrongSound,
    playVictorySound,
  };
};
