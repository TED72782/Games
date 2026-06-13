// ============================================================
// FORGE MOTORS — Procedural engine / wind / tire audio
// Built on raw WebAudio oscillators so no asset files needed.
// ============================================================

const PROFILES = {
  i4: { idle: 62, span: 195, subGain: 0.35, type: 'sawtooth' },
  v6: { idle: 52, span: 175, subGain: 0.55, type: 'sawtooth' },
  v8: { idle: 38, span: 130, subGain: 0.85, type: 'sawtooth' },
  v12: { idle: 68, span: 250, subGain: 0.45, type: 'sawtooth' },
  ev: { idle: 90, span: 1300, subGain: 0.0, type: 'sine' },
};

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.profile = PROFILES.v8;
  }

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(ctx.destination);

    // engine voice: main osc + sub-octave osc → lowpass
    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.sub = ctx.createOscillator();
    this.sub.type = 'square';
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0.5;
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 900;
    this.osc.connect(this.engineGain);
    this.sub.connect(this.subGain).connect(this.engineGain);
    this.engineGain.connect(this.lowpass).connect(this.master);
    this.osc.start();
    this.sub.start();

    // shared noise buffer for wind + skid
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.windSrc = ctx.createBufferSource();
    this.windSrc.buffer = buf;
    this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.windSrc.start();

    this.skidSrc = ctx.createBufferSource();
    this.skidSrc.buffer = buf;
    this.skidSrc.loop = true;
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'highpass';
    this.skidFilter.frequency.value = 1800;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    this.skidSrc.connect(this.skidFilter).connect(this.skidGain).connect(this.master);
    this.skidSrc.start();
  }

  setProfile(name) {
    this.profile = PROFILES[name] || PROFILES.v8;
    if (this.osc) {
      this.osc.type = this.profile.type;
      this.sub.type = this.profile.type === 'sine' ? 'triangle' : 'square';
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
    return this.muted;
  }

  update(rpm01, throttle, speedKmh, sliding) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const p = this.profile;
    const t = this.ctx.currentTime;
    const freq = p.idle + rpm01 * p.span;
    this.osc.frequency.setTargetAtTime(freq, t, 0.04);
    this.sub.frequency.setTargetAtTime(freq / 2, t, 0.04);
    this.subGain.gain.setTargetAtTime(p.subGain, t, 0.1);
    const vol = 0.10 + throttle * 0.20 + rpm01 * 0.08;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.06);
    this.lowpass.frequency.setTargetAtTime(600 + rpm01 * 2600 + throttle * 800, t, 0.08);

    this.windGain.gain.setTargetAtTime(Math.min(0.30, (speedKmh / 260) * 0.34), t, 0.15);
    this.skidGain.gain.setTargetAtTime(sliding && speedKmh > 15 ? 0.22 : 0, t, 0.05);
  }

  idle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.2);
    this.windGain.gain.setTargetAtTime(0, t, 0.2);
    this.skidGain.gain.setTargetAtTime(0, t, 0.1);
  }
}
