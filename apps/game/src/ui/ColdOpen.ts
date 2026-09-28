// The cold open, before the prologue: twenty-odd seconds without a word of instruction.
// A day, carved into stone, sinks into the spiral; the grey of dawn; the wax tablet on the desk,
// and a line writing itself in a hand that leans. One question. Then the house.
// Drawn small and dithered to the vase palette, like the rest of Eferon; skippable at any moment.
import { bayer, spiralPixels } from '../spiral.ts';
import { h } from './dom.ts';

const W = 320;
const H = 180;
const LINE = "Don't look at the sky. Look into the stone.";
/** Seconds: sink, dawn, tablet, writing, question, fade. */
const T = { sink: 7, dawn: 9.5, tablet: 11, write: 17, ask: 19, end: 23 };

const PALETTE: [number, number, number][] = [[13, 11, 9], [110, 42, 28], [181, 83, 42], [232, 226, 208]];

export class ColdOpen {
  private root = h('section', { className: 'cold-open', hidden: true });
  private canvas = h('canvas', { className: 'cold-open-view' });
  private words = h('p', { className: 'cold-open-hand' });
  private ask = h('p', { className: 'cold-open-ask' }, 'Who wrote this?');
  private skipBtn = h('button', { type: 'button', className: 'ghost cold-open-skip' }, 'Skip');
  private done: (() => void) | null = null;
  private frame = 0;
  private spiral = new ImageData(W, H);
  private img = new ImageData(W, H);

  constructor(parent: HTMLElement) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.root.append(this.canvas, this.words, this.ask, this.skipBtn);
    parent.append(this.root);
    this.skipBtn.addEventListener('click', () => this.finish());
    // While it plays it has every key: nothing behind it moves (the house's first lines wait under it).
    const swallow = (e: KeyboardEvent) => {
      if (this.root.hidden) return;
      e.stopPropagation();
      if (e.code === 'Tab') return;
      e.preventDefault();
      if (e.type === 'keydown' && (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter')) this.finish();
    };
    window.addEventListener('keydown', swallow, true);
    window.addEventListener('keyup', swallow, true);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  /** `reduced`: no spinning spiral; it opens on the still dawn and the tablet. */
  play(onDone: () => void, onThunder: () => void, reduced = false): void {
    this.done = onDone;
    this.root.hidden = false;
    this.words.textContent = '';
    this.ask.classList.remove('on');
    const start = performance.now() - (reduced ? T.dawn * 1000 : 0);
    let thundered = false;
    const step = () => {
      if (this.root.hidden) return;
      const t = (performance.now() - start) / 1000;
      if (!thundered && t > 0.8) {
        thundered = true;
        onThunder();
      }
      this.draw(t);
      if (t >= T.end) return this.finish();
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private finish(): void {
    if (this.root.hidden) return;
    cancelAnimationFrame(this.frame);
    this.root.hidden = true;
    const cb = this.done;
    this.done = null;
    cb?.();
  }

  /** One frame: a luminance picture per moment, then the dither into the four tones. */
  private draw(t: number): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const lum = new Float32Array(W * H);
    const tone = new Uint8Array(W * H); // 0: lacquer/bone ramp, 1: warm (terracotta/red) ramp
    const ease = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
    if (t < T.dawn) {
      // The spiral turning, and the carved day, a pale square, shrinking into its heart.
      spiralPixels(this.spiral, t * 0.35);
      const fadeIn = ease(0, 1.5);
      const out = ease(T.sink, T.dawn);
      const k = ease(0.8, T.sink);
      const size = 120 * (1 - k) ** 1.6 + 2;
      const ang = k * 5;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          let v = this.spiral.data[i * 4]! / 255;
          const dx = x - W / 2;
          const dy = y - H / 2;
          const rx = dx * Math.cos(ang) + dy * Math.sin(ang);
          const ry = -dx * Math.sin(ang) + dy * Math.cos(ang);
          if (Math.abs(rx) < size && Math.abs(ry) < size * 0.62) {
            // The day: a warm field with the ghost of a city in it.
            v = 0.55 + 0.25 * Math.sin(rx * 0.3) * Math.cos(ry * 0.25);
            tone[i] = 1;
          }
          lum[i] = v * fadeIn * (1 - out);
        }
      }
    } else {
      // Dawn on the desk: grey light from the left, the tablet in the middle.
      const light = ease(T.dawn, T.tablet);
      const out = ease(T.end - 1.2, T.end);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          let v = (0.08 + 0.3 * (1 - x / W)) * light;
          const inTablet = x > 60 && x < 260 && y > 38 && y < 142;
          if (inTablet) {
            const frame = x < 66 || x > 254 || y < 44 || y > 136;
            v = frame ? 0.3 * light : (0.62 + 0.06 * Math.sin(y * 0.9)) * light;
            tone[i] = 1;
            // Yesterday's lines, in your own upright hand; below them the wax is smoothed, darker, fresh.
            if (!frame && y > 52 && y < 88 && (y - 52) % 9 < 2 && x > 76 && x < 244 - ((y * 7) % 40)) v = 0.12;
            if (!frame && y > 96) v = (0.3 + 0.04 * Math.sin(x * 0.7)) * light;
          }
          lum[i] = v * (1 - out);
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const v = Math.min(1, Math.max(0, lum[i]!));
        const warm = tone[i] === 1;
        // Warm areas dither between lacquer, added red and terracotta; the rest between lacquer and bone.
        const ramp = warm ? [0, 1, 2] : [0, 3];
        const f = v * (ramp.length - 1);
        const lo = Math.floor(f);
        const pick = ramp[Math.min(ramp.length - 1, f - lo > bayer(x, y) ? lo + 1 : lo)]!;
        const c = PALETTE[pick]!;
        this.img.data[i * 4] = c[0];
        this.img.data[i * 4 + 1] = c[1];
        this.img.data[i * 4 + 2] = c[2];
        this.img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(this.img, 0, 0);
    // The line writes itself, letter by letter, in the hand that leans.
    const letters = Math.floor(ease(T.tablet + 0.8, T.write) * LINE.length);
    this.words.textContent = LINE.slice(0, letters);
    this.words.classList.toggle('on', t > T.tablet && t < T.end - 1);
    this.ask.classList.toggle('on', t > T.ask && t < T.end - 0.6);
  }
}
