/**
 * Audio sound notification utility using Web Audio API.
 * Synthesizes loud, crisp, attention-grabbing chimes and metallic order bells.
 */

let audioCtx: AudioContext | null = null;
let unlockAttempted = false;

function setupAudioUnlock() {
  if (typeof window === "undefined" || unlockAttempted) return;
  unlockAttempted = true;
  const unlock = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  setupAudioUnlock();
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play synthesized attention-grabbing notification sounds.
 * - 'new_order': Loud metallic double counter-bell (ding-ding! ding-ding!) for Kitchen/Chef.
 * - 'food_ready': Bright ascending 3-note pickup chime for Staff.
 */
export function playNotificationSound(type: "new_order" | "food_ready"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === "new_order") {
      // Metallic Kitchen Order Bell ring (Double Ding-Ding)
      const pulses = [
        { time: 0.00, freq: 1046.50, overtone: 2093.00 }, // C6
        { time: 0.14, freq: 1318.51, overtone: 2637.00 }, // E6
        { time: 0.38, freq: 1046.50, overtone: 2093.00 }, // C6
        { time: 0.52, freq: 1567.98, overtone: 3135.96 }, // G6
      ];

      pulses.forEach(({ time, freq, overtone }) => {
        const start = now + time;

        // Primary bell tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.38);

        // High metallic overtone
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(overtone, start);

        gain2.gain.setValueAtTime(0.01, start);
        gain2.gain.exponentialRampToValueAtTime(0.2, start + 0.008);
        gain2.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(start);
        osc2.stop(start + 0.22);
      });
    } else if (type === "food_ready") {
      // Bright 3-note ascending pickup chime for Staff
      const notes = [
        { time: 0.00, freq: 783.99, type: "sine" as OscillatorType },  // G5
        { time: 0.12, freq: 1046.50, type: "sine" as OscillatorType }, // C6
        { time: 0.24, freq: 1318.51, type: "sine" as OscillatorType }, // E6
        { time: 0.24, freq: 1567.98, type: "triangle" as OscillatorType }, // High shimmer G6
      ];

      notes.forEach(({ time, freq, type: oscType }) => {
        const start = now + time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.exponentialRampToValueAtTime(0.45, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.48);
      });
    }
  } catch (err) {
    console.warn("Could not play notification sound:", err);
  }
}
