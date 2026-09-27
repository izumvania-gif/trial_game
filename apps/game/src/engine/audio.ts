// All sound is synthesized with Web Audio — no files. Design (docs/concept.md §2):
// - the wind is the main sound, layered from calm to storm, and follows the clock and the gusts;
// - the world's music is an honest short loop (a lyre ostinato) that goes slightly false near midnight;
// - the sea is generative and never repeats (its swells are scheduled with seaRandom);
// - under the Desk there is only the hum of fans.
// With captions on, meaningful sounds are also written out: "[the wind rises]".
import { seaRandom } from '../core/rng.ts';
import type { Settings, SettingsStore } from '../core/settings.ts';
import { Ambient } from './ambient.ts';
import { noteAt, PIECES, type Piece } from './music.ts';

/** Seconds for a place's tune to fade out, and for the next to come in. */
const FADE_OUT = 3;
const FADE_IN = 2.5;

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
  storm: '[the Song of Storms on the lyre, and thunder]',
  lyre: '[the lyre]',
  align: '[the rings lock, and the hall rings with it]',
  freeze: '[the day sets into stone]',
  rooster: '[a rooster, far off]',
  dog: '[a dog barks across the roofs]',
  ticket: '[a soft chime: a new ticket]',
  descend: '[steps going down into the cold]',
  ascend: '[steps, and the city again]',
};

// The same lyre everywhere, a different piece for each place: see engine/music.ts.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  /** The recorded storm song (see `stormWaltz`), decoded once; null until it loads or if it never does. */
  private stormTrack: { buffer: AudioBuffer; start: number } | null = null;
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
  /** One playing piece: its own fader, its own clock. Several may sound while one fades into the next. */
  private voices = new Map<string, { gain: GainNode; timer: number; index: number; fadeOut: number }>();
  private detune = 0;
  private theme: string | null = null;
  /** Where each piece had got to: coming back to a place picks its tune up where it left off. */
  private positions = new Map<string, number>();
  private echo!: GainNode;
  private lastGusts = 0;
  private lastStage = '';
  private seaTimer = 0;
  /** Water dripping somewhere in the Hall, through its echo. */
  private dripTimer = 0;
  private ambient: Ambient | null = null;

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
    void this.loadStormTrack(ctx);

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

    this.ambient = new Ambient(ctx, this.noise, this.sfx, (id) => this.caption(id));
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
    const inWorld = s.stage === 'town' || s.stage === 'spiral' || s.stage === 'strikes' || s.stage === 'relief' || s.stage === 'board';
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
    if (theme !== this.theme) this.crossfade(theme);
    this.ambient?.update({ active: s.stage === 'town' && !s.raining, progress: s.progress, place: s.place, sea: s.sea });
    const inHall = s.stage === 'spiral' || s.stage === 'relief';
    if (inHall && !this.dripTimer) this.scheduleDrip();
    if (!inHall && this.dripTimer) {
      window.clearTimeout(this.dripTimer);
      this.dripTimer = 0;
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

  /**
   * The old piece keeps playing while it fades (a few seconds), the new one comes in from the
   * start of a bar and swells. Coming straight back to a fading piece just raises it again.
   */
  private crossfade(theme: string | null): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.theme = theme;
    for (const [name, v] of this.voices) {
      if (name === theme || v.fadeOut) continue;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, FADE_OUT / 3);
      v.fadeOut = window.setTimeout(() => {
        window.clearInterval(v.timer);
        v.gain.disconnect();
        this.positions.set(name, v.index);
        this.voices.delete(name);
      }, FADE_OUT * 1000 + 400);
    }
    if (!theme) return;
    const piece = PIECES[theme]!;
    let voice = this.voices.get(theme);
    if (voice) {
      window.clearTimeout(voice.fadeOut);
      voice.fadeOut = 0;
    } else {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(piece.echo ? this.echo : this.music);
      const saved = this.positions.get(theme) ?? 0;
      // Back to the start of a bar, so the tune does not come back in mid-phrase.
      const v = { gain, timer: 0, index: saved - (saved % piece.stepsPerBar), fadeOut: 0 };
      v.timer = window.setInterval(() => this.loopNote(piece, v), piece.step * 1000);
      this.voices.set(theme, v);
      voice = v;
    }
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setTargetAtTime(1, t, FADE_IN / 3);
  }

  private loopNote(piece: Piece, v: { gain: GainNode; index: number }): void {
    const note = noteAt(piece, v.index++);
    if (note.drum) this.drum(v.gain);
    if (note.bass !== null) this.pluck(note.bass - this.detune, piece.volume * 0.9, v.gain);
    if (note.melody !== null) this.pluck(note.melody - this.detune, piece.volume * (note.accent ? 1.35 : 1), v.gain);
  }

  /** A drop into a pool somewhere in the dark: a short falling blip, through the stone echo. */
  private scheduleDrip(): void {
    this.dripTimer = window.setTimeout(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = 1400 + Math.random() * 900;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(this.echo);
      o.start(t);
      o.stop(t + 0.15);
      this.scheduleDrip();
    }, 1800 + Math.random() * 4200);
  }

  /** A hand drum: a short thump of filtered noise. */
  private drum(bus: AudioNode): void {
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
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random());
    src.stop(t + 0.2);
  }

  /** Karplus–Strong pluck, cached per pitch. `semis` above A3 (220 Hz); `at` seconds from now. */
  pluck(semis: number, volume = 0.6, bus?: AudioNode, at = 0): void {
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
    src.start(this.ctx.currentTime + at);
  }

  /**
   * The only recorded sound in the game: the author's own arrangement of the Song of Storms
   * (Koji Kondo), played on a harp. Fetched once the audio is unlocked; if it cannot be fetched
   * or decoded, the synthesized waltz below plays instead. Leading silence is skipped, so the song
   * answers the last string at once.
   */
  private async loadStormTrack(ctx: AudioContext): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/song-of-storms.mp3`);
      if (!res.ok) return;
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      const data = buffer.getChannelData(0);
      let first = 0;
      while (first < data.length && Math.abs(data[first]!) < 0.01) first++;
      this.stormTrack = { buffer, start: Math.max(0, first / buffer.sampleRate - 0.02) };
    } catch {
      // No file, no decoder: the lyre plays its own waltz.
    }
  }

  /**
   * The storm waltz: an original tune for the lyre in D minor, in three, with an oom-pah-pah
   * under it — a nod to a certain song about storms, not a copy of it. Returns its length.
   */
  stormWaltz(): number {
    if (!this.ctx) return 0;
    if (this.stormTrack) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.stormTrack.buffer;
      const g = this.ctx.createGain();
      g.gain.value = 0.85;
      src.connect(g).connect(this.sfx);
      src.start(this.ctx.currentTime, this.stormTrack.start);
      this.caption('storm');
      return this.stormTrack.buffer.duration - this.stormTrack.start;
    }
    const step = STORM_WALTZ.step;
    STORM_WALTZ.bars.forEach(([chord, melody], bar) => {
      const [root, third, fifth] = STORM_CHORDS[chord]!;
      const t0 = bar * 6 * step;
      this.pluck(root - 12, 0.5, undefined, t0);
      for (const beat of [2, 4]) {
        this.pluck(third, 0.22, undefined, t0 + beat * step);
        this.pluck(fifth, 0.22, undefined, t0 + beat * step);
      }
      melody.forEach((n, i) => {
        if (n !== null) this.pluck(n, 0.62, undefined, t0 + i * step);
      });
    });
    const end = STORM_WALTZ.bars.length * 6 * step;
    // The last word: the whole chord, and the sky answering.
    for (const n of [-7, 5, 8, 12, 17]) this.pluck(n, 0.4, undefined, end);
    this.caption('storm');
    return end + 1.5;
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
        // The blow goes straight out; everything else drops away after it and comes back slowly.
        src.connect(f).connect(g).connect(id === 'strike' ? this.master : this.sfx);
        src.start(t, Math.random());
        src.stop(t + 4);
        if (id === 'strike') this.hush(2.4);
        break;
      }
      case 'crack': {
        // Something small breaking: a dry snap and a trickle of grit.
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 1800;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.02, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        src.connect(f).connect(g).connect(this.master);
        src.start(t, Math.random());
        src.stop(t + 0.8);
        break;
      }
      case 'descend':
      case 'ascend':
        // Footsteps on stone stairs: going down, each one has more echo and less of the street.
        for (let i = 0; i < 6; i++) {
          const at = t + i * 0.27;
          const k = id === 'descend' ? i / 5 : 1 - i / 5;
          const src = ctx.createBufferSource();
          src.buffer = this.noise;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 380 - k * 120;
          const dry = ctx.createGain();
          dry.gain.setValueAtTime(0.35 * (1 - k * 0.6), at);
          dry.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
          const wet = ctx.createGain();
          wet.gain.setValueAtTime(0.3 * k, at);
          wet.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
          src.connect(f);
          f.connect(dry).connect(this.sfx);
          f.connect(wet).connect(this.echo);
          src.start(at, Math.random());
          src.stop(at + 0.1);
        }
        break;
      case 'ticket':
        // The office chime: two soft sine notes, a little too clean.
        [880, 1320].forEach((fr, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const at = t + i * 0.12;
          o.frequency.value = fr;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.06, at + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
          o.connect(g).connect(this.sfx);
          o.start(at);
          o.stop(at + 0.55);
        });
        break;
      case 'key': {
        // A keystroke somewhere in the office.
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2500 + Math.random() * 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        src.connect(f).connect(g).connect(this.sfx);
        src.start(t, Math.random());
        src.stop(t + 0.04);
        break;
      }
      case 'grind': {
        // Marble turning on marble: low, rough, short.
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 180 + Math.random() * 60;
        f.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        src.connect(f).connect(g).connect(this.echo);
        src.start(t, Math.random());
        src.stop(t + 0.4);
        break;
      }
      case 'freeze': {
        // The whole day turning into stone: a long grind that sinks, and the spiral taking it.
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 2.5;
        f.frequency.setValueAtTime(420, t);
        f.frequency.exponentialRampToValueAtTime(90, t + 2.6);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.45, t + 0.3);
        g.gain.setValueAtTime(0.45, t + 1.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        src.connect(f).connect(g).connect(this.echo);
        src.start(t);
        src.stop(t + 3.1);
        window.setTimeout(() => this.pluck(-24, 0.6, this.echo), 2700);
        break;
      }
      case 'align':
        // A struck chord that the hall holds.
        [0, 7, 12, 15, 19].forEach((n, i) => window.setTimeout(() => this.pluck(n - 12, 0.5, this.echo), i * 60));
        break;
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

  /** The world goes quiet for a moment (music and sounds), then comes back. */
  private hush(seconds: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [bus, level] of [[this.music, this.settings.music * 0.5], [this.sfx, this.settings.sfx]] as const) {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(0, t + 0.15, 0.08);
      bus.gain.setTargetAtTime(level, t + seconds, seconds / 3);
    }
  }

  caption(id: string): void {
    if (this.settings.subtitles && CAPTIONS[id]) this.onCaption(CAPTIONS[id]!);
  }

  stop(): void {
    for (const v of this.voices.values()) {
      window.clearInterval(v.timer);
      window.clearTimeout(v.fadeOut);
    }
    window.clearTimeout(this.seaTimer);
    window.clearTimeout(this.dripTimer);
    this.ambient?.stop();
    void this.ctx?.close();
  }
}

/** Lyre strings: arrow keys → semitones above A3 (the Song of Return is down-left-up twice). */
export const LYRE_NOTES: Record<string, number> = { ArrowDown: 0, ArrowLeft: 3, ArrowUp: 7, ArrowRight: 10 };

/** Chords of the storm waltz: root, third, fifth, in semitones above A3. */
const STORM_CHORDS: Record<string, [number, number, number]> = {
  Dm: [5, 8, 12], Bb: [1, 5, 8], A: [0, 4, 7], Gm: [-2, 1, 5], F: [-4, 0, 3], C: [3, 7, 10],
};

/** Sixteen bars in three, one eighth per step: [chord, melody per eighth (semitones above A3, null = hold)]. */
export const STORM_WALTZ: { step: number; bars: [string, (number | null)[]][] } = {
  step: 0.16,
  bars: [
    ['Dm', [12, null, 12, 10, 8, null]],
    ['Dm', [7, 8, 10, 12, null, null]],
    ['Bb', [17, 15, 13, null, 12, null]],
    ['A', [10, 8, 7, null, 4, null]],
    ['Dm', [5, 8, 12, 17, null, null]],
    ['Gm', [17, 13, 10, 13, 17, 15]],
    ['A', [16, null, 12, 10, 7, null]],
    ['Dm', [5, null, null, null, null, null]],
    ['F', [15, null, 12, 8, 12, 15]],
    ['C', [19, null, 17, 15, null, 10]],
    ['Dm', [20, 19, 17, 12, 8, 5]],
    ['A', [7, 10, 16, 19, null, null]],
    ['Bb', [20, null, 17, 13, 17, 20]],
    ['Gm', [22, 20, 19, 17, null, 13]],
    ['A', [24, null, 19, 16, 12, null]],
    ['Dm', [17, null, null, null, null, null]],
  ],
};
