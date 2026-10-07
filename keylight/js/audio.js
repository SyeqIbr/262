"use strict";
/* Piano audio: recorded grand-piano samples (piano-samples.js), with an
   oscillator synth as the fallback when the samples aren't available. */
const synth = {
  ctx: null, voices: [],
  ensure() {
    if (this.ctx) { if (this.ctx.state !== "running") this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC({ latencyHint: "interactive" });
    this.bus = ctx.createGain();
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.25;
    const verb = ctx.createConvolver(); verb.buffer = this.impulse(2.8);
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    this.bus.connect(master); this.bus.connect(verb); verb.connect(wet); wet.connect(master);
    master.connect(comp); comp.connect(ctx.destination);
    this.out = comp;
    const N = 14, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    const amps = [0, 1, 0.42, 0.26, 0.14, 0.11, 0.06, 0.05, 0.03, 0.025, 0.015, 0.012, 0.008, 0.006, 0.004];
    for (let i = 1; i <= N; i++) im[i] = amps[i] || 0;
    this.wave = ctx.createPeriodicWave(re, im);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.ready = this.loadSamples();
    return ctx;
  },
  // Decode the embedded MP3 samples once. Resolves even if decoding fails (synth takes over).
  async loadSamples() {
    const src = window.KEYLIGHT_PIANO;
    if (!src) return false;
    const entries = await Promise.all(Object.entries(src).map(async ([midi, b64]) => {
      try {
        const bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const buf = await new Promise((res, rej) => this.ctx.decodeAudioData(bytes.buffer, res, rej));
        return [+midi, buf];
      } catch (e) { return null; }
    }));
    const ok = entries.filter(Boolean);
    if (ok.length < 10) return false;
    this.samples = new Map(ok);
    this.sampleKeys = ok.map(e => e[0]).sort((a, b) => a - b);
    return true;
  },
  nearestSample(p) {
    let best = this.sampleKeys[0];
    for (const k of this.sampleKeys) if (Math.abs(k - p) < Math.abs(best - p)) best = k;
    return best;
  },
  play(pitch, vel, when, end) {
    if (!this.samples) return this.playSynth(pitch, vel, when, end);
    const ctx = this.ctx;
    when = Math.max(when, ctx.currentTime);
    end = Math.max(end, when + 0.08);
    for (const v of this.voices) if (v.p === pitch && v.end > when) this.cut(v, when, 0.05);
    if (this.voices.length > 140) this.cut(this.voices[0], ctx.currentTime, 0.03);

    const base = this.nearestSample(pitch), buf = this.samples.get(base);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = Math.pow(2, (pitch - base) / 12);
    // softer notes are darker, like real hammers
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = 0.3;
    flt.frequency.value = 900 + Math.pow(vel, 1.8) * 17000;
    const g = ctx.createGain();
    const gp = g.gain, level = 0.75 * Math.pow(0.12 + vel * 0.88, 1.7);
    gp.setValueAtTime(level, when);
    gp.setTargetAtTime(0, end, pitch > 88 ? 0.25 : 0.1); // dampers above ~E6 don't stop the string
    src.connect(flt); flt.connect(g);
    let tail = g;
    if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-0.45, Math.min(0.45, (pitch - 64) / 70)); g.connect(pan); tail = pan; }
    tail.connect(this.bus);
    const stopAt = Math.min(end + 1.5, when + buf.duration / src.playbackRate.value);
    src.start(when); src.stop(Math.max(stopAt, when + 0.1));
    const v = { p: pitch, g: gp, o: [src], end, when };
    src.onended = () => { const i = this.voices.indexOf(v); if (i >= 0) this.voices.splice(i, 1); try { tail.disconnect(); } catch (e) {} };
    this.voices.push(v);
  },
  impulse(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.55 - t * 0.4);
        d[i] = i < ctx.sampleRate * 0.012 ? 0 : lp * Math.pow(1 - t, 3.2);
      }
    }
    return buf;
  },
  recStream() {
    if (!this.recDest) { this.recDest = this.ctx.createMediaStreamDestination(); this.out.connect(this.recDest); }
    return this.recDest.stream;
  },
  playSynth(pitch, vel, when, end) {
    const ctx = this.ctx;
    when = Math.max(when, ctx.currentTime);
    end = Math.max(end, when + 0.05);
    // a re-struck key cuts off its previous ring
    for (const v of this.voices) if (v.p === pitch && v.end > when) this.cut(v, when, 0.03);
    if (this.voices.length > 120) this.cut(this.voices[0], ctx.currentTime, 0.02);

    const f = 440 * Math.pow(2, (pitch - 69) / 12);
    const g = ctx.createGain(); g.gain.value = 0;
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = 0.5;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o2g = ctx.createGain();
    o1.setPeriodicWave(this.wave); o2.setPeriodicWave(this.wave);
    o1.frequency.value = o2.frequency.value = f;
    o2.detune.value = 3 + Math.max(0, (pitch - 60) * 0.05); o2g.gain.value = 0.55;
    o1.connect(flt); o2.connect(o2g); o2g.connect(flt); flt.connect(g);
    let tail = g;
    if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-0.5, Math.min(0.5, (pitch - 64) / 70)); g.connect(pan); tail = pan; }
    tail.connect(this.bus);

    const loudness = Math.pow(0.15 + vel * 0.85, 1.6) * (pitch < 48 ? 1.15 : 1) * (pitch > 84 ? 0.8 : 1);
    const peak = 0.11 * loudness;
    const tau = Math.max(0.3, Math.min(4.5, 3.4 * Math.pow(f / 110, -0.55)));
    const gp = g.gain;
    gp.setValueAtTime(0, when);
    gp.linearRampToValueAtTime(peak, when + 0.004);
    gp.setTargetAtTime(peak * 0.42, when + 0.005, 0.14);
    if (end > when + 0.45) gp.setTargetAtTime(0, when + 0.45, tau);
    gp.setTargetAtTime(0, end, 0.08);
    const bright = Math.min(17000, f * (3 + vel * 10) + 600);
    flt.frequency.setValueAtTime(bright, when);
    flt.frequency.setTargetAtTime(Math.min(bright, f * 1.6 + 350), when + 0.01, 0.3 + tau * 0.15);

    // felt hammer thump
    const nz = ctx.createBufferSource(); nz.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = Math.min(f * 3, 8000); bp.Q.value = 0.9;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.045 * vel * vel, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    nz.connect(bp); bp.connect(ng); ng.connect(this.bus);
    nz.start(when); nz.stop(when + 0.06);

    const stopAt = end + 0.7;
    o1.start(when); o2.start(when); o1.stop(stopAt); o2.stop(stopAt);
    const v = { p: pitch, g: gp, o: [o1, o2], end, when };
    o1.onended = () => { const i = this.voices.indexOf(v); if (i >= 0) this.voices.splice(i, 1); try { tail.disconnect(); } catch (e) {} };
    this.voices.push(v);
  },
  cut(v, at, tc) {
    if (v.cut) return;
    v.cut = true; v.end = at;
    v.g.cancelScheduledValues(at);
    if (at <= this.ctx.currentTime + 0.001 && v.when <= at) v.g.setValueAtTime(v.g.value, at);
    v.g.setTargetAtTime(0, at, tc);
    for (const o of v.o) { try { o.stop(at + tc * 8); } catch (e) {} }
  },
  stopAll() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const v of this.voices.slice()) this.cut(v, t, 0.04); }
};

