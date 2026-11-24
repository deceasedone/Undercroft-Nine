// Fully synthesised soundscape (WebAudio).
// Buses: music (pad, arpeggio, plucks, pulse) and effects (rain, engine hum, combat and UI sounds).
export class Soundscape {
  constructor() { this.ctx = null; this.muted = false; this.nextNote = 2; this.intensity = 0; this.step = 0; this.nextStep = 0; this.vol = { music: 0.8, sfx: 0.7 }; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());
    const master = (this.master = ctx.createGain());
    master.gain.value = 0.9; master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.connect(master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(master);
    this.setVolumes(this.vol.music, this.vol.sfx);

    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(this.musicBus);
    this.echo = delay;

    const lp = (this.padLp = ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 4;
    const pg = ctx.createGain(); pg.gain.value = 0.24; lp.connect(pg); pg.connect(this.musicBus);
    for (const f of [55, 55.4, 82.41, 110.3, 164.6, 220.5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = f > 200 ? 0.08 : 0.22; o.connect(g); g.connect(lp); o.start();
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lg = ctx.createGain(); lg.gain.value = 200; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();

    this.arpLp = ctx.createBiquadFilter(); this.arpLp.type = 'lowpass'; this.arpLp.frequency.value = 900; this.arpLp.Q.value = 6;
    this.arpGain = ctx.createGain(); this.arpGain.gain.value = 0.9;
    this.arpLp.connect(this.arpGain); this.arpGain.connect(this.musicBus); this.arpGain.connect(this.echo);

    const buf = (this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate));
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const pink = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const p = pink.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < p.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
      // crossfade the loop seam
      const F = 2048; for (let i = 0; i < F; i++) { const k = i / F; p[i] = p[i] * k + p[p.length - F + i] * (1 - k); }
    }
    const rain = ctx.createBufferSource(); rain.buffer = pink; rain.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 350;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 2800; rlp.Q.value = 0.3;
    this.rainBus = ctx.createGain(); this.rainBus.gain.value = 1; this.rainBus.connect(this.sfxBus);
    const rg = ctx.createGain(); rg.gain.value = 0.034;
    const gust = ctx.createOscillator(); gust.frequency.value = 0.07;
    const gustAmt = ctx.createGain(); gustAmt.gain.value = 0.012; gust.connect(gustAmt); gustAmt.connect(rg.gain); gust.start();
    rain.connect(rhp); rhp.connect(rlp); rlp.connect(rg); rg.connect(this.rainBus); rain.start();
    this.nextDrop = 0; this.nextDrip = 2;

    const eo = (this.engOsc = ctx.createOscillator()); eo.type = 'sawtooth'; eo.frequency.value = 58;
    const ef = (this.engLp = ctx.createBiquadFilter()); ef.type = 'lowpass'; ef.frequency.value = 200;
    const eg = (this.engGain = ctx.createGain()); eg.gain.value = 0.018;
    eo.connect(ef); ef.connect(eg); eg.connect(this.sfxBus); eo.start();
    this.nextStep = ctx.currentTime + 0.5;
  }

  setVolumes(music, sfx) {
    this.vol = { music, sfx };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.muted ? 0 : music * 1.25, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : sfx, t, 0.05);
  }

  tone(freq, dur, type = 'sine', vol = 0.08, echo = false, when = 0, freqEnd = 0, bus = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus); if (echo) g.connect(this.echo);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, vol, freq, q = 1, type = 'bandpass', freqEnd = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  setIntensity(x) { this.intensity = x; }

  droplet() {
    const ctx = this.ctx, t = ctx.currentTime + Math.random() * 0.03;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 4200; f.Q.value = 6 + Math.random() * 8;
    const g = ctx.createGain(), v = 0.004 + Math.random() * 0.01, dur = 0.012 + Math.random() * 0.03;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    s.connect(f); f.connect(g);
    if (pan) { pan.pan.value = Math.random() * 2 - 1; g.connect(pan); pan.connect(this.rainBus); } else g.connect(this.rainBus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }

  drip() {
    const ctx = this.ctx, t = ctx.currentTime, f0 = 900 + Math.random() * 900;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.014, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(g);
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(this.rainBus); } else g.connect(this.rainBus);
    g.connect(this.echo);
    o.start(t); o.stop(t + 0.12);
  }

  update(dt, speed) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engOsc.frequency.setTargetAtTime(55 + speed * 2.2, t, 0.1);
    this.engLp.frequency.setTargetAtTime(180 + speed * 12, t, 0.1);
    this.engGain.gain.setTargetAtTime(0.016 + Math.min(0.026, speed * 0.0007), t, 0.1);
    this.arpLp.frequency.setTargetAtTime(700 + this.intensity * 2600, t, 0.3);
    this.padLp.Q.setTargetAtTime(4 + this.intensity * 6, t, 0.3);

    // schedule notes slightly ahead of time so the arpeggio stays in rhythm
    const STEP = 0.25 - this.intensity * 0.06;
    const BARS = [[220, 261.63, 329.63, 392, 329.63, 261.63, 196, 261.63], [174.61, 220, 261.63, 349.23, 261.63, 220, 164.81, 220],
      [261.63, 329.63, 392, 523.25, 392, 329.63, 246.94, 329.63], [196, 246.94, 293.66, 392, 293.66, 246.94, 196, 293.66]];
    while (this.nextStep < t + 0.1) {
      const bar = BARS[Math.floor(this.step / 8) % BARS.length], f = bar[this.step % 8];
      const when = this.nextStep - t;
      if (this.step % 8 !== 7 || Math.random() < 0.5) this.tone(f, 0.24, 'square', 0.045, false, Math.max(0, when), 0, this.arpLp);
      if (this.step % 4 === 0) this.tone(55, 0.3, 'sine', 0.12 + this.intensity * 0.12, false, Math.max(0, when), 40, this.musicBus);
      this.step++; this.nextStep += STEP;
    }
    this.nextDrop -= dt;
    while (this.nextDrop <= 0) { this.droplet(); this.nextDrop += 0.04 + Math.random() * 0.12; }
    this.nextDrip -= dt;
    if (this.nextDrip <= 0) { this.drip(); this.nextDrip = 1.5 + Math.random() * 4; }

    this.nextNote -= dt;
    if (this.nextNote <= 0) {
      const scale = [440, 523.25, 587.33, 659.25, 783.99, 880];
      this.tone(scale[Math.floor(Math.random() * scale.length)], 1.8, 'triangle', 0.06, true, 0, 0, this.musicBus);
      this.nextNote = 2 + Math.random() * 4;
    }
  }

  ping(strength) { this.tone(900 + strength * 700, 0.07, 'sine', 0.05); }
  jackIn() { [440, 660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, 'square', 0.035, true, i * 0.07)); }
  type() { this.tone(1800 + Math.random() * 400, 0.02, 'square', 0.008); }
  alarm() { for (let i = 0; i < 4; i++) this.tone(i % 2 ? 220 : 330, 0.22, 'sawtooth', 0.06, false, i * 0.2); }
  warn() { this.tone(180, 0.12, 'sawtooth', 0.04); }
  coreOpen() { [110, 220, 277.18, 329.63, 440, 659.25].forEach((f, i) => this.tone(f, 4, 'triangle', 0.06, true, i * 0.18)); }
  ending() { [220, 329.63, 440, 554.37, 659.25, 880].forEach((f, i) => this.tone(f, 6, 'sine', 0.06, true, i * 0.3)); }
  pickup(chain) {
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    this.tone(660 * Math.pow(2, steps[Math.min(chain - 1, steps.length - 1)] / 12), 0.12, 'triangle', 0.035);
  }
  charge() { this.tone(300, 0.5, 'sawtooth', 0.025, false, 0, 1200); }
  shoot(dist) { const v = Math.max(0.015, 0.06 - dist * 0.0015); this.tone(1400, 0.18, 'sawtooth', v, false, 0, 180); }
  hit() { this.noise(0.35, 0.25, 600, 0.8, 'lowpass', 120); this.tone(90, 0.4, 'square', 0.07, false, 0, 40); }
  bonk(s) { this.noise(0.12, Math.min(0.2, s * 0.012), 900, 1.5); this.tone(140, 0.12, 'triangle', Math.min(0.08, s * 0.005)); }
  dash() { this.noise(0.3, 0.12, 400, 1, 'bandpass', 3000); }
  nearMiss() { this.tone(1800, 0.08, 'sine', 0.03); this.tone(2400, 0.08, 'sine', 0.025, false, 0.06); }
  beacon() { [784, 1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.05, true, i * 0.09)); }
  power() { [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.3, 'square', 0.03, false, i * 0.05)); }
  repair() { [392, 523.25, 659.25].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.05, false, i * 0.08)); }
  emp() { this.tone(60, 1.2, 'sawtooth', 0.12, false, 0, 30); this.noise(1.0, 0.25, 3000, 0.7, 'bandpass', 200); }
  cloak() { this.tone(900, 0.6, 'sine', 0.05, true, 0, 300); }
  threat() { for (let i = 0; i < 6; i++) this.tone(i % 2 ? 392 : 523.25, 0.3, 'sawtooth', 0.05, false, i * 0.32); }
  bossBoom() { this.noise(2.2, 0.4, 300, 0.5, 'lowpass', 40); this.tone(70, 2, 'sawtooth', 0.12, false, 0, 25); }
  hullHit() { this.tone(70, 0.6, 'sawtooth', 0.09); }
  over() { [440, 370, 311, 262, 196].forEach((f, i) => this.tone(f, 0.9, 'sawtooth', 0.045, true, i * 0.22)); }

  toggleMute() {
    this.muted = !this.muted;
    this.setVolumes(this.vol.music, this.vol.sfx);
    return this.muted;
  }
}
