// Tiny WebAudio synth — no audio assets to ship.
export const sound = {
  ctx: null,
  muted: (() => { try { return localStorage.getItem('kk:muted') === '1'; } catch { return false; } })(),

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('kk:muted', m ? '1' : '0'); } catch { /* ignore */ }
  },

  tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  noise(dur, vol = 0.4) {
    const ctx = this.ensure();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  },

  play(name) {
    if (this.muted) return;
    try {
      switch (name) {
        case 'card': this.tone(520, 0.08, { type: 'triangle', vol: 0.08, slide: 200 }); break;
        case 'draw': this.tone(320, 0.12, { type: 'triangle', vol: 0.08, slide: 260 }); break;
        case 'turn': this.tone(660, 0.12, { vol: 0.12 }); this.tone(880, 0.18, { vol: 0.12, delay: 0.12 }); break;
        case 'nope': this.tone(240, 0.25, { type: 'square', vol: 0.07, slide: -120 }); break;
        case 'boom': this.noise(1.1, 0.55); this.tone(90, 0.8, { type: 'sawtooth', vol: 0.15, slide: -60 }); break;
        case 'defuse': [500, 750, 1000].forEach((f, i) => this.tone(f, 0.12, { vol: 0.1, delay: i * 0.1 })); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.12, delay: i * 0.13 })); break;
        case 'steal': this.tone(800, 0.08, { type: 'triangle', vol: 0.08, slide: -300 }); break;
        case 'error': this.tone(180, 0.15, { type: 'square', vol: 0.05 }); break;
        case 'chat': this.tone(1200, 0.06, { vol: 0.05 }); break;
        default: break;
      }
    } catch { /* audio unavailable */ }
  },
};
