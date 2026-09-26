// The town by the hour, synthesized: birds and a far rooster at dawn, cicadas through the heat
// of the day, murmur in the agora, gulls over the port, dogs and the tavern in the evening,
// crickets after dark, and then nothing but the wind in the last hours. Which sound comes next
// is chance, like the drips in the Hall: only the world has to be deterministic, not its noise.

export interface AmbientState {
  /** In the town and not raining: otherwise all of this is silent. */
  active: boolean;
  /** 0..1 through the day. */
  progress: number;
  place?: string;
  /** 0..1, how close the sea is. */
  sea: number;
}

/** A bell over part of the day: 0 outside [a, d], 1 between b and c. */
function bell(p: number, a: number, b: number, c: number, d: number): number {
  if (p <= a || p >= d) return 0;
  if (p < b) return (p - a) / (b - a);
  if (p <= c) return 1;
  return (d - p) / (d - c);
}

export class Ambient {
  private ctx: AudioContext;
  private noise: AudioBuffer;
  private bus: GainNode;
  private cicadas: GainNode;
  private murmur: GainNode;
  private murmurSwell: GainNode;
  private timer = 0;
  private state: AmbientState = { active: false, progress: 0, sea: 0 };
  private onCaption: (id: string) => void;

  constructor(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, onCaption: (id: string) => void) {
    this.ctx = ctx;
    this.noise = noise;
    this.onCaption = onCaption;
    this.bus = ctx.createGain();
    this.bus.connect(out);

    // Cicadas: a narrow band of noise, chopped fast by a square wave.
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 5200;
    band.Q.value = 6;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 42;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(chop.gain);
    lfo.start();
    // …and swelling in slow waves, as a tree full of them does.
    const swell = ctx.createGain();
    swell.gain.value = 0.6;
    const slow = ctx.createOscillator();
    slow.frequency.value = 0.13;
    const slowDepth = ctx.createGain();
    slowDepth.gain.value = 0.4;
    slow.connect(slowDepth).connect(swell.gain);
    slow.start();
    this.cicadas = ctx.createGain();
    this.cicadas.gain.value = 0;
    this.loop().connect(band).connect(chop).connect(swell).connect(this.cicadas).connect(this.bus);

    // Voices far off: low, soft band of noise that rises and falls like talk.
    const talk = ctx.createBiquadFilter();
    talk.type = 'bandpass';
    talk.frequency.value = 480;
    talk.Q.value = 1.2;
    this.murmurSwell = ctx.createGain();
    this.murmurSwell.gain.value = 0.5;
    this.murmur = ctx.createGain();
    this.murmur.gain.value = 0;
    this.loop().connect(talk).connect(this.murmurSwell).connect(this.murmur).connect(this.bus);
  }

  private loop(): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(0, Math.random() * 2);
    return src;
  }

  update(s: AmbientState): void {
    this.state = s;
    const t = this.ctx.currentTime;
    const p = s.progress;
    const on = s.active ? 1 : 0;
    // The heat of the day: from mid-morning to late afternoon, quieter by the sea.
    this.cicadas.gain.setTargetAtTime(on * bell(p, 0.15, 0.3, 0.55, 0.7) * 0.05 * (1 - s.sea * 0.6), t, 1.5);
    // Talk: the agora by day, the tavern and doorways in the evening; nobody after the procession.
    const talk = s.place === 'agora' ? bell(p, 0.08, 0.2, 0.6, 0.7) : bell(p, 0.1, 0.25, 0.75, 0.84) * 0.45;
    this.murmur.gain.setTargetAtTime(on * talk * 0.09, t, 1.2);
    this.murmurSwell.gain.setTargetAtTime(0.35 + Math.random() * 0.65, t, 0.4);
    if (s.active && !this.timer) this.schedule();
    if (!s.active && this.timer) {
      window.clearTimeout(this.timer);
      this.timer = 0;
    }
  }

  /** The next small sound of the hour, a few seconds from now. */
  private schedule(): void {
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (!this.state.active) return;
      this.next();
      this.schedule();
    }, 1500 + Math.random() * 3500);
  }

  private next(): void {
    const { progress: p, sea, place } = this.state;
    const r = Math.random();
    const port = place === 'port' || sea > 0.4;
    if (port && p < 0.8 && r < 0.35) return this.gull();
    // Dawn: birds everywhere, a rooster now and then.
    if (p < 0.2) {
      if (r < 0.12 && p < 0.12) return this.rooster();
      if (r < 0.8) return this.birds();
      return;
    }
    // The day: birds thin out in the heat.
    if (p < 0.62) {
      if (r < 0.3) this.birds();
      return;
    }
    // Evening: dogs answering each other across the roofs, the first crickets.
    if (p < 0.84) {
      if (r < 0.18) return this.dog();
      if (r < 0.6 && p > 0.7) return this.crickets();
      return;
    }
    // After the procession, only crickets, fewer and fewer; the last hour has nothing.
    if (p < 0.93 && r < 0.3) this.crickets();
  }

  private env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  /** A few quick falling-rising chirps. */
  private birds(): void {
    const t0 = this.ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2800 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.05);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.05);
      this.env(g, t, 0.025, 0.008, 0.02, 0.04);
      o.connect(g).connect(this.bus);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  /** Far off, over the walls. */
  private rooster(): void {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 2;
    const g = this.ctx.createGain();
    const fr = o.frequency;
    fr.setValueAtTime(420, t);
    fr.linearRampToValueAtTime(700, t + 0.12);
    fr.linearRampToValueAtTime(820, t + 0.3);
    fr.setValueAtTime(800, t + 0.7);
    fr.linearRampToValueAtTime(520, t + 1.05);
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 9;
    const vibDepth = this.ctx.createGain();
    vibDepth.gain.value = 18;
    vib.connect(vibDepth).connect(fr);
    this.env(g, t, 0.03, 0.06, 0.8, 0.25);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    vib.start(t);
    o.stop(t + 1.2);
    vib.stop(t + 1.2);
    this.onCaption('rooster');
  }

  /** Kee-ow. */
  private gull(): void {
    const t0 = this.ctx.currentTime;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.32;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(1100, t);
      o.frequency.linearRampToValueAtTime(1750, t + 0.07);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.26);
      this.env(g, t, 0.035, 0.03, 0.08, 0.15);
      o.connect(g).connect(this.bus);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  /** Two or three barks from somewhere across the roofs. */
  private dog(): void {
    const t0 = this.ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 2);
    const pitch = 240 + Math.random() * 120;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.28 + Math.random() * 0.12);
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(pitch * 1.3, t);
      o.frequency.exponentialRampToValueAtTime(pitch, t + 0.1);
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1100;
      const g = this.ctx.createGain();
      this.env(g, t, 0.05, 0.01, 0.05, 0.08);
      o.connect(f);
      noise.connect(f);
      f.connect(g).connect(this.bus);
      o.start(t);
      noise.start(t, Math.random());
      o.stop(t + 0.16);
      noise.stop(t + 0.16);
    }
    this.onCaption('dog');
  }

  private crickets(): void {
    const t0 = this.ctx.currentTime;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) {
      for (let i = 0; i < 3; i++) {
        const t = t0 + k * 0.45 + i * 0.05;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.frequency.value = 4300 + Math.random() * 200;
        this.env(g, t, 0.018, 0.004, 0.02, 0.015);
        o.connect(g).connect(this.bus);
        o.start(t);
        o.stop(t + 0.05);
      }
    }
  }

  stop(): void {
    window.clearTimeout(this.timer);
  }
}
