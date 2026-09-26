// All sound is synthesized with Web Audio — no files. Design (docs/concept.md §2):
// - the wind is the main sound, layered from calm to storm, and follows the clock and the gusts;
// - the world's music is an honest short loop (a lyre ostinato) that goes slightly false near midnight;
// - the sea is generative and never repeats (its swells are scheduled with seaRandom);
// - under the Desk there is only the hum of fans.
// With captions on, meaningful sounds are also written out: "[the wind rises]".
import { seaRandom } from '../core/rng.ts';
import type { Settings, SettingsStore } from '../core/settings.ts';
import { noteAt, PIECES } from './music.ts';

export interface AudioState {
  stage: string;
  /** 0..1 through the day. */
  progress: number;
  /** 0..1, the observers' wind. */
  wind: number;
  raining: boolean;
  /** 0..1: how close the sea is (town: by the player's position; sea stage: 1). */
  sea: number;
  /** Which part of the town the scribe is in, for the music: 'agora', 'port' or 'streets'. */
  place?: string;
}

const CAPTIONS: Record<string, string> = {
  fact: '[a stylus scratches on wax]',
  shard: '[a small bright chime, like something found]',
  strike: '[marble cracks]',
  thunder: '[thunder over the mountain]',
  seam: '[a hum under the stone]',
  dejavu: '[the words, before he says them]',
  gust: '[the wind rises]',
  sea: '[the sea, never the same]',
  desk: '[fans humming]',
  rain: '[rain]',
  lyre: '[the lyre]',
};

// The same lyre everywhere, a different piece for each place: see engine/music.ts.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private seaGain!: GainNode;
  private seaSwell!: GainNode;
  private rainGain!: GainNode;
  private humGain!: GainNode;
  private settings: Settings;
  private onCaption: (text: string) => void;
  private plucks = new Map<number, AudioBuffer>();
  private loopTimer = 0;
  private loopIndex = 0;
  private detune = 0;
  private theme: string | null = null;
  /** Where each piece had got to: coming back to a place picks its tune up where it left off. */
  private positions = new Map<string, number>();
  private echo!: GainNode;
  private lastGusts = 0;
  private lastStage = '';
  private seaTimer = 0;

  constructor(settings: SettingsStore, onCaption: (text: string) => void) {
    this.settings = settings.value;
    this.onCaption = onCaption;
    settings.subscribe((s) => {
      this.settings = s;
      this.applyVolumes();
    });
  }

  /** Browsers only allow audio after a user gesture: call from the Wake click. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.applyVolumes();

    // Two seconds of white noise, reused by every noise-based layer.
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Wind: band-passed noise whose filter wanders slowly.
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.loopNoise().connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoDepth.gain.value = 180;
    lfo.connect(lfoDepth).connect(this.windFilter.frequency);
    lfo.start();

    // Sea: low-passed noise with irregular swells.
    const seaFilter = ctx.createBiquadFilter();
    seaFilter.type = 'lowpass';
    seaFilter.frequency.value = 520;
    this.seaSwell = ctx.createGain();
    this.seaSwell.gain.value = 0.2;
    this.seaGain = ctx.createGain();
    this.seaGain.gain.value = 0;
    this.loopNoise().connect(seaFilter).connect(this.seaSwell).connect(this.seaGain).connect(this.sfx);
    this.scheduleSwell();

    // Rain: bright noise, on only at midnight.
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 2500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.loopNoise().connect(rainFilter).connect(this.rainGain).connect(this.sfx);

    // The Desk: mains hum and a fan.
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    for (const [f, g] of [[50, 0.5], [100, 0.25]] as const) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = f;
      og.gain.value = g;
      o.connect(og).connect(this.humGain);
      o.start();
    }
    const fan = ctx.createBiquadFilter();
    fan.type = 'lowpass';
    fan.frequency.value = 900;
    const fanGain = ctx.createGain();
    fanGain.gain.value = 0.6;
    this.loopNoise().connect(fan).connect(fanGain).connect(this.humGain);
    this.humGain.connect(this.sfx);

    // The Hall's echo: a long delay feeding back through a dark filter.
    this.echo = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 1600;
    this.echo.connect(this.music);
    this.echo.connect(delay);
    delay.connect(dark).connect(feedback).connect(delay);
    dark.connect(this.music);
  }

  private loopNoise(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    // Different offsets so layers do not phase against each other.
    src.start(0, Math.random() * 2);
    return src;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.settings.music * 0.5, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
  }

  /** The sea's swells: a new wave of random height and length whenever the last one has passed. */
  private scheduleSwell(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rise = 1.5 + seaRandom() * 3;
    const fall = 2 + seaRandom() * 4;
    const peak = 0.35 + seaRandom() * 0.65;
    const g = this.seaSwell.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(peak, t + rise);
    g.linearRampToValueAtTime(0.12 + seaRandom() * 0.15, t + rise + fall);
    this.seaTimer = window.setTimeout(() => this.scheduleSwell(), (rise + fall) * 1000 * (0.7 + seaRandom() * 0.5));
  }

  /** Called every frame with the state of the world. */
  update(s: AudioState): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const inWorld = s.stage === 'town' || s.stage === 'spiral' || s.stage === 'strikes' || s.stage === 'relief';
    const outside = s.stage === 'town' || s.stage === 'sea';
    // Wind: calm at dawn, rising towards midnight, stronger with every gust of attention.
    const windLevel = outside ? 0.05 + s.progress * 0.25 + s.wind * 0.35 : inWorld ? 0.04 : 0;
    this.windGain.gain.setTargetAtTime(windLevel * 0.6, t, 0.8);
    this.windFilter.frequency.setTargetAtTime(350 + s.wind * 500 + s.progress * 300, t, 1.5);
    this.seaGain.gain.setTargetAtTime(s.sea * 0.5, t, 0.8);
    this.rainGain.gain.setTargetAtTime(s.raining ? 0.25 : 0, t, 0.5);
    this.humGain.gain.setTargetAtTime(s.stage === 'desk' ? 0.05 : 0, t, 0.3);

    // Music: each place has its tune; near midnight all of them drift out of tune.
    const theme = s.raining ? null
      : s.stage === 'town' ? (s.place === 'agora' || s.place === 'port' ? s.place : 'streets')
        : s.stage === 'spiral' || s.stage === 'relief' ? 'hall' : null;
    if (theme !== this.theme) {
      if (this.theme) this.positions.set(this.theme, this.loopIndex);
      this.theme = theme;
      // Back to the start of a bar, so the tune does not come back in mid-phrase.
      const piece = theme ? PIECES[theme] : undefined;
      const saved = theme ? this.positions.get(theme) ?? 0 : 0;
      this.loopIndex = piece ? saved - (saved % piece.stepsPerBar) : 0;
      window.clearInterval(this.loopTimer);
      if (theme) this.loopTimer = window.setInterval(() => this.loopNote(), PIECES[theme]!.step * 1000);
    }
    this.detune = Math.max(0, s.progress - 0.75) * 1.6; // up to ~0.4 semitone flat

    const gusts = Math.min(3, Math.floor(s.wind * 3 + 1e-9));
    if (gusts > this.lastGusts) this.caption('gust');
    this.lastGusts = gusts;
    if (s.stage !== this.lastStage) {
      if (s.stage === 'sea') this.caption('sea');
      if (s.stage === 'desk') this.caption('desk');
      this.lastStage = s.stage;
    }
  }

  private loopNote(): void {
    const piece = this.theme ? PIECES[this.theme] : undefined;
    if (!piece) return;
    const note = noteAt(piece, this.loopIndex++);
    const bus = piece.echo ? this.echo : this.music;
    if (note.drum) this.drum();
    if (note.bass !== null) this.pluck(note.bass - this.detune, piece.volume * 0.9, bus);
    if (note.melody !== null) this.pluck(note.melody - this.detune, piece.volume * (note.accent ? 1.35 : 1), bus);
  }

  /** A hand drum: a short thump of filtered noise. */
  private drum(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random());
    src.stop(t + 0.2);
  }

  /** Karplus–Strong pluck, cached per pitch. `semis` above A3 (220 Hz). */
  pluck(semis: number, volume = 0.6, bus?: GainNode): void {
    if (!this.ctx) return;
    const key = Math.round(semis * 100);
    let buf = this.plucks.get(key);
    if (!buf) {
      const rate = this.ctx.sampleRate;
      const freq = 220 * Math.pow(2, semis / 12);
      const period = Math.max(2, Math.round(rate / freq));
      const len = Math.floor(rate * 1.6);
      buf = this.ctx.createBuffer(1, len, rate);
      const out = buf.getChannelData(0);
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
      for (let i = 0; i < len; i++) {
        const j = i % period;
        const next = ring[(j + 1) % period]!;
        out[i] = ring[j]!;
        ring[j] = 0.996 * 0.5 * (ring[j]! + next);
      }
      this.plucks.set(key, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(bus ?? this.sfx);
    src.start();
  }

  /** One-shot sounds by name. */
  play(id: string): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (id) {
      case 'fact':
        this.pluck(12, 0.25);
        break;
      case 'shard':
        // Four rising notes: the sound of finding something.
        [0, 4, 7, 12].forEach((s, i) => window.setTimeout(() => this.pluck(12 + s, 0.4), i * 110));
        break;
      case 'dejavu':
        this.pluck(19, 0.35);
        this.pluck(24, 0.2);
        break;
      case 'lyre':
        break;
      case 'strike':
      case 'thunder': {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(id === 'strike' ? 1800 : 600, t);
        f.frequency.exponentialRampToValueAtTime(80, t + (id === 'strike' ? 0.6 : 3));
        const g = ctx.createGain();
        g.gain.setValueAtTime(id === 'strike' ? 0.9 : 0.7, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (id === 'strike' ? 0.8 : 3.5));
        src.connect(f).connect(g).connect(this.sfx);
        src.start(t, Math.random());
        src.stop(t + 4);
        break;
      }
      case 'seam': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(60, t);
        o.frequency.linearRampToValueAtTime(58, t + 1.2);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.08, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        o.connect(g).connect(this.sfx);
        o.start(t);
        o.stop(t + 1.3);
        break;
      }
    }
    this.caption(id);
  }

  caption(id: string): void {
    if (this.settings.subtitles && CAPTIONS[id]) this.onCaption(CAPTIONS[id]!);
  }

  stop(): void {
    window.clearInterval(this.loopTimer);
    window.clearTimeout(this.seaTimer);
    void this.ctx?.close();
  }
}

/** Lyre strings: arrow keys → semitones above A3 (the Song of Return is down-left-up twice). */
export const LYRE_NOTES: Record<string, number> = { ArrowDown: 0, ArrowLeft: 3, ArrowUp: 7, ArrowRight: 10 };
