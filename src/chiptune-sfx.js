// SUVA · 苏哇科技 · PixelCrystal (像素晶体)
// Zero-Dependency WebAudio 8-Bit + Glass Celesta Chiptune Synthesizer

const BPM = 120;
const STEP_SEC = 60 / BPM / 4; // 16th note = 0.125s

// MIDI note to Hz
function mtof(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 8-bar PRISMA PIXEL OPTICS progression: Am9 -> Fmaj7#11 -> Cmaj9 -> G6 / Em7
const ARP_BARS = [
  [69, 72, 76, 83, 79, 76, 72, 71, 69, 72, 76, 84, 83, 79, 76, 72], // Am9
  [69, 76, 79, 83, 84, 83, 79, 76, 72, 76, 79, 83, 76, 72, 71, 69], // Am9 var
  [65, 69, 72, 76, 83, 79, 76, 72, 65, 69, 72, 83, 84, 79, 76, 72], // Fmaj7#11
  [65, 72, 76, 79, 83, 86, 83, 79, 76, 72, 69, 72, 76, 79, 76, 72], // Fmaj7#11 prism
  [60, 67, 71, 74, 76, 79, 83, 79, 76, 74, 71, 67, 71, 74, 79, 76], // Cmaj9
  [60, 64, 67, 71, 74, 79, 84, 79, 76, 74, 71, 67, 64, 67, 71, 74], // Cmaj9 high
  [67, 71, 74, 76, 79, 83, 86, 83, 79, 76, 74, 71, 67, 71, 74, 79], // G6
  [64, 67, 71, 74, 78, 79, 83, 79, 78, 74, 71, 67, 64, 67, 71, 76], // Em9 turnaround
];

const BASS_BARS = [
  45, 45, 41, 41, 48, 48, 43, 40, // A2, A2, F2, F2, C3, C3, G2, E2
];

const CRYSTAL_CHIME_NOTES = [72, 74, 76, 79, 81, 83, 84, 86, 88, 91, 93, 95];

export class ChiptuneEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.delayNode = null;
    this.noiseBuffer = null;

    this.muted = false;
    this.bgmPlaying = false;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.lastTickMs = 0;
  }

  _ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.42;
      this.masterGain.connect(this.ctx.destination);

      // Subtle crystalline stereo echo bus
      this.delayNode = this.ctx.createDelay(0.6);
      this.delayNode.delayTime.value = STEP_SEC * 1.5; // dotted 16th shimmer
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 3600;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.24;
      const delayWet = this.ctx.createGain();
      delayWet.gain.value = 0.22;

      this.delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(this.delayNode);
      delayFilter.connect(delayWet);
      delayWet.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.48;
      this.bgmGain.connect(this.masterGain);
      this.bgmGain.connect(this.delayNode);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.72;
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.connect(this.delayNode);

      // Pre-generate 0.35s crisp white noise buffer for Riso press percussion & stamp slam
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 0.35);
      this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
      const ch = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock() {
    return Boolean(this._ensureContext());
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  startBgm() {
    const ctx = this._ensureContext();
    if (!ctx) return false;
    if (this.bgmPlaying) return true;
    this.muted = false;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.42, ctx.currentTime, 0.03);
    }
    this.bgmPlaying = true;
    this.stepIndex = 0;
    this.nextNoteTime = ctx.currentTime + 0.04;
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => this._scheduleLoop(), 40);
    return true;
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    return false;
  }

  toggleBgm() {
    if (this.bgmPlaying) {
      this.stopBgm();
      return false;
    }
    return this.startBgm();
  }

  _scheduleLoop() {
    if (!this.bgmPlaying || !this.ctx) return;
    const lookahead = 0.16;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this._scheduleStep(this.stepIndex, this.nextNoteTime);
      this.nextNoteTime += STEP_SEC;
      this.stepIndex = (this.stepIndex + 1) % 128; // 8 bars * 16 steps
    }
  }

  _scheduleStep(step, t) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;

    const bar = Math.floor(step / 16) % ARP_BARS.length;
    const sub = step % 16;
    const midi = ARP_BARS[bar][sub];
    const freq = mtof(midi);

    // 1. Glass Celesta Lead (Triangle + 3x crystalline overtone)
    const accent = sub % 4 === 0 ? 1.0 : 0.68;
    this._playCelestaVoice(freq, t, STEP_SEC * 1.45, 0.12 * accent, this.bgmGain);

    // 2. 8-Bit Chiptune Square Counter-Sparkle on rhythmic subdivisions
    if (sub % 2 === 0) {
      const sqOsc = ctx.createOscillator();
      const sqGain = ctx.createGain();
      sqOsc.type = 'square';
      sqOsc.frequency.setValueAtTime(freq * (sub === 12 ? 2 : 1), t);
      sqGain.gain.setValueAtTime(0.0001, t);
      sqGain.gain.linearRampToValueAtTime(0.026 * accent, t + 0.006);
      sqGain.gain.exponentialRampToValueAtTime(0.0001, t + STEP_SEC * 0.85);
      sqOsc.connect(sqGain);
      sqGain.connect(this.bgmGain);
      sqOsc.start(t);
      sqOsc.stop(t + STEP_SEC * 0.9);
    }

    // 3. Warm Triangle Bass on beats 1, 2.5, 3
    if (sub === 0 || sub === 6 || sub === 8 || sub === 14) {
      const bassMidi = BASS_BARS[bar] + (sub === 14 ? 7 : 0);
      const bOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.setValueAtTime(mtof(bassMidi), t);
      const dur = sub === 0 || sub === 8 ? STEP_SEC * 3.4 : STEP_SEC * 1.6;
      bGain.gain.setValueAtTime(0.0001, t);
      bGain.gain.linearRampToValueAtTime(0.14, t + 0.01);
      bGain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      bOsc.connect(bGain);
      bGain.connect(this.masterGain);
      bOsc.start(t);
      bOsc.stop(t + dur + 0.02);
    }

    // 4. Micro Risograph Press Hi-Hat Tick on off-beats
    if (sub % 4 === 2 && this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.024, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.035);
    }
  }

  _playCelestaVoice(freq, t, duration, peakGain, dest) {
    const ctx = this.ctx;
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);

    // Glass bell harmonic (2.998x slight detune for prism shimmer)
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.998, t);

    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.linearRampToValueAtTime(peakGain, t + 0.005);
    g1.gain.exponentialRampToValueAtTime(0.0002, t + duration);

    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(peakGain * 0.28, t + 0.003);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.45);

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(dest);
    g2.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration + 0.02);
    osc2.stop(t + duration * 0.5 + 0.02);
  }

  playClick() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(780, t);
    osc.frequency.setValueAtTime(1180, t + 0.018);
    g.gain.setValueAtTime(0.075, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playFaceTap(faceIndex = 0) {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const idx = Math.abs(Math.round(faceIndex)) % CRYSTAL_CHIME_NOTES.length;
    const freq = mtof(CRYSTAL_CHIME_NOTES[idx]);
    this._playCelestaVoice(freq, t, 0.28, 0.2, this.sfxGain);
  }

  playLaserSweep(norm = 0.5) {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const k = Math.max(0, Math.min(1, Number(norm) || 0.5));
    const startHz = 440 + k * 360;
    const endHz = 1120 + k * 640;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.exponentialRampToValueAtTime(endHz, t + 0.11);
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playStampSlam() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    // 1. Heavy Riso stamp impact thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(155, t);
    thud.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    thudGain.gain.setValueAtTime(0.34, t);
    thudGain.gain.exponentialRampToValueAtTime(0.0005, t + 0.15);
    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.16);

    // 2. Crisp paper ink burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.22, t);
      ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.09);
    }

    // 3. Crystalline verification chord
    const chord = [72, 76, 79, 83]; // Cmaj7
    chord.forEach((m, i) => {
      this._playCelestaVoice(mtof(m), t + 0.065 + i * 0.032, 0.42, 0.15, this.sfxGain);
    });
  }

  playForgeSuccess() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const fanfare = [72, 76, 79, 83, 84, 88]; // C5 E5 G5 B5 C6 E6
    fanfare.forEach((m, i) => {
      const noteTime = t + i * 0.065;
      const dur = i === fanfare.length - 1 ? 0.55 : 0.2;
      this._playCelestaVoice(mtof(m), noteTime, dur, 0.18, this.sfxGain);

      const sq = ctx.createOscillator();
      const g = ctx.createGain();
      sq.type = 'square';
      sq.frequency.setValueAtTime(mtof(m), noteTime);
      g.gain.setValueAtTime(0.045, noteTime);
      g.gain.exponentialRampToValueAtTime(0.0001, noteTime + dur * 0.75);
      sq.connect(g);
      g.connect(this.sfxGain);
      sq.start(noteTime);
      sq.stop(noteTime + dur * 0.8);
    });
  }

  playWrongBuzz() {
    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    [156, 147].forEach((hz) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hz, t);
      osc.frequency.linearRampToValueAtTime(hz * 0.74, t + 0.22);
      lp.type = 'lowpass';
      lp.frequency.value = 920;
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  playTypewriterTick(charIndex = 0) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastTickMs < 28) return;
    this.lastTickMs = now;

    const ctx = this._ensureContext();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1380 + (charIndex % 4) * 110, t);
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.026);
  }
}

export const sfx = new ChiptuneEngine();

export const unlockAudio = () => sfx.unlock();
export const toggleBgm = () => sfx.toggleBgm();
export const setMuted = (flag) => sfx.setMuted(flag);
export const isBgmPlaying = () => sfx.bgmPlaying;
export const playClick = () => sfx.playClick();
export const playFaceTap = (idx) => sfx.playFaceTap(idx);
export const playLaserSweep = (norm) => sfx.playLaserSweep(norm);
export const playStampSlam = () => sfx.playStampSlam();
export const playForgeSuccess = () => sfx.playForgeSuccess();
export const playWrongBuzz = () => sfx.playWrongBuzz();
export const playTypewriterTick = (idx) => sfx.playTypewriterTick(idx);
