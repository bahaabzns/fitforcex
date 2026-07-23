// Tiny sound effects synthesized in-browser via the Web Audio API — no audio
// asset files to source/ship. Kept to short, cheap, one-shot chimes; nothing
// here is meant to loop or layer.

let sharedContext = null;

function getContext() {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedContext) sharedContext = new Ctor();
    return sharedContext;
}

function playTone(ctx, frequency, startTime, duration) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    // Quick fade in/out so each note is a soft chime, not a click.
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

/**
 * A short ascending three-note success chime — for moments like finishing a
 * workout. Silently no-ops if the Web Audio API is unavailable or the
 * browser's autoplay policy blocks it (never worth surfacing an error for).
 */
export function playSuccessChime() {
    try {
        const ctx = getContext();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume();
        const now = ctx.currentTime;
        // C5, E5, G5 — a bright major-triad arpeggio.
        playTone(ctx, 523.25, now, 0.35);
        playTone(ctx, 659.25, now + 0.12, 0.35);
        playTone(ctx, 783.99, now + 0.24, 0.5);
    } catch {
        // Best-effort only.
    }
}
