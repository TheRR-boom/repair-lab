/**
 * Звук и вибрация без единого аудиофайла: короткие синтезированные сигналы
 * на WebAudio. Плюсы для мобилки — нулевой вес, мгновенный старт, нет
 * декодирования. Всё отключается в настройках (settings.sound / haptics).
 */

class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.haptics = true;
    this._noiseBuffer = null;
  }

  /** Вызывать на первом тач-событии: iOS не даёт звук до жеста. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = on ? 0.45 : 0;
  }

  setHaptics(on) {
    this.haptics = !!on;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  vibrate(pattern) {
    if (!this.haptics) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }

  /* -------------------------------------------------------------- */
  /*  Примитивы синтеза                                              */
  /* -------------------------------------------------------------- */

  tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', gain = 0.18, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise({ dur = 0.12, gain = 0.12, freq = 1800, q = 1, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    if (!this._noiseBuffer) {
      const len = this.ctx.sampleRate * 0.4;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuffer = buf;
    }
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* -------------------------------------------------------------- */
  /*  Игровые события                                                */
  /* -------------------------------------------------------------- */

  play(name) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;

    switch (name) {
      case 'tap':
        this.tone({ freq: 880, to: 720, dur: 0.05, type: 'triangle', gain: 0.08 });
        break;
      case 'screw':
        this.noise({ dur: 0.08, gain: 0.1, freq: 2400, q: 2 });
        this.tone({ freq: 320, to: 220, dur: 0.07, type: 'square', gain: 0.05 });
        break;
      case 'unscrew':
        this.tone({ freq: 260, to: 520, dur: 0.09, type: 'triangle', gain: 0.09 });
        this.noise({ dur: 0.05, gain: 0.05, freq: 3200 });
        break;
      case 'strip':
        this.noise({ dur: 0.25, gain: 0.18, freq: 900, q: 0.7 });
        this.tone({ freq: 180, to: 60, dur: 0.25, type: 'sawtooth', gain: 0.08 });
        break;
      case 'attach':
        this.tone({ freq: 520, to: 660, dur: 0.09, type: 'sine', gain: 0.1 });
        break;
      case 'tear':
        this.noise({ dur: 0.32, gain: 0.2, freq: 1600, q: 0.4 });
        this.tone({ freq: 300, to: 70, dur: 0.3, type: 'sawtooth', gain: 0.07 });
        break;
      case 'ok':
        this.tone({ freq: 660, dur: 0.09, type: 'sine', gain: 0.12 });
        this.tone({ freq: 990, dur: 0.12, type: 'sine', gain: 0.1, delay: 0.07 });
        break;
      case 'win':
        this.tone({ freq: 523, dur: 0.1, type: 'triangle', gain: 0.12 });
        this.tone({ freq: 659, dur: 0.1, type: 'triangle', gain: 0.12, delay: 0.09 });
        this.tone({ freq: 784, dur: 0.22, type: 'triangle', gain: 0.12, delay: 0.18 });
        break;
      case 'fail':
        this.tone({ freq: 220, to: 110, dur: 0.28, type: 'sawtooth', gain: 0.1 });
        break;
      case 'coin':
        this.tone({ freq: 1180, dur: 0.06, type: 'square', gain: 0.07 });
        this.tone({ freq: 1560, dur: 0.1, type: 'square', gain: 0.06, delay: 0.05 });
        break;
      case 'boot':
        this.tone({ freq: 180, to: 720, dur: 0.5, type: 'sine', gain: 0.12 });
        break;
      case 'warn':
        this.tone({ freq: 440, dur: 0.08, type: 'square', gain: 0.07 });
        this.tone({ freq: 440, dur: 0.08, type: 'square', gain: 0.07, delay: 0.12 });
        break;
      default:
        this.tone({ freq: 600, dur: 0.05, type: 'sine', gain: 0.06 });
    }
  }
}

export const audio = new AudioKit();