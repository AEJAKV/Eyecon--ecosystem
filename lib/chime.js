// The new-booking chime for the admin and front desk workspaces: two soft rising notes (E5 then B5), made in the
// browser with the Web Audio API, so there is no sound file to load. Browsers allow sound only after someone has
// clicked or typed on the page, so the audio is unlocked on the first interaction (unlockChime) and the chime is
// silent until then. Each browser keeps its own on/off choice (soundEnabled / setSoundEnabled), on by default.
let audio = null;
const KEY = 'eyecon-booking-sound';
function context() { if (!audio && typeof window !== 'undefined') { const A = window.AudioContext || window.webkitAudioContext; if (A) audio = new A(); } return audio; }
export function unlockChime() {
  if (typeof window === 'undefined') return () => {};
  const unlock = () => { try { context()?.resume(); } catch {} };
  window.addEventListener('pointerdown', unlock, { once: true }); window.addEventListener('keydown', unlock, { once: true });
  return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
}
function tone(ctx, frequency, at, length, volume) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = frequency;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(volume, at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + length + 0.05);
}
export function playChime() {
  try { const ctx = context(); if (!ctx || ctx.state !== 'running') return false; const t = ctx.currentTime + 0.02; tone(ctx, 659.25, t, 0.6, 0.25); tone(ctx, 987.77, t + 0.18, 0.9, 0.22); return true; } catch { return false; }
}
export function soundEnabled() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
export function setSoundEnabled(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} }
