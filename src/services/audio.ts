/**
 * WebAudio-based sound pack. No audio assets — all tones are synthesised.
 */
type Sound = 'complete' | 'perfect' | 'levelup' | 'streak' | 'shield' | 'click' | 'undo';

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + dur);
}

function arpeggio(notes: number[], gap = 0.06, dur = 0.18) {
  notes.forEach((n, i) => setTimeout(() => tone(n, dur, 'triangle', 0.1), i * gap * 1000));
}

export function playSound(s: Sound) {
  switch (s) {
    case 'click':
      tone(880, 0.08, 'square', 0.06);
      break;
    case 'complete':
      arpeggio([523.25, 659.25, 783.99], 0.05, 0.14);
      break;
    case 'shield':
      tone(440, 0.12, 'sawtooth', 0.08);
      setTimeout(() => tone(554.37, 0.12, 'sawtooth', 0.08), 60);
      break;
    case 'streak':
      arpeggio([659.25, 783.99, 987.77, 1318.51], 0.05, 0.16);
      break;
    case 'levelup':
      arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.07, 0.22);
      break;
    case 'perfect':
      arpeggio([783.99, 987.77, 1174.66, 1567.98], 0.05, 0.2);
      break;
    case 'undo':
      tone(659.25, 0.1, 'sine', 0.07);
      break;
  }
}

export function setAudioEnabled(v: boolean) { enabled = v; }
export function isAudioEnabled() { return enabled; }
