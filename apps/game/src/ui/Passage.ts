// Going down into the Hall and coming back up. The last frame of the city stays on the screen
// while the dark closes in from the edges, one beam of light is left in the middle — the same
// beam the Hall is lit by — and the Hall comes up out of it. Coming back, the beam opens into
// daylight. The stage underneath has already changed; this only covers the seam.
import { h } from './dom.ts';

export type PassageKind = 'down' | 'up';

export class Passage {
  private canvas = h('canvas', { className: 'passage', hidden: true });
  private running = 0;

  constructor(parent: HTMLElement) {
    parent.append(this.canvas);
  }

  play(frame: HTMLCanvasElement | null, kind: PassageKind, reducedMotion: boolean): void {
    cancelAnimationFrame(this.running);
    const c = this.canvas;
    const w = frame?.width ?? Math.floor(window.innerWidth / 3);
    const hgt = frame?.height ?? Math.floor(window.innerHeight / 3);
    c.width = w;
    c.height = hgt;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    c.hidden = false;
    c.style.opacity = '1';
    const light = kind === 'down' ? '#e8e2d0' : '#f4ead0';
    // Close in, hold the beam, open out: seconds.
    const [close, hold, open] = reducedMotion ? [0.25, 0.2, 0.35] : [0.9, 0.9, 0.9];
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      ctx.fillStyle = '#0d0b09';
      ctx.fillRect(0, 0, w, hgt);
      if (t < close) {
        // The city, and the dark closing on it from the edges.
        const k = t / close;
        if (frame) ctx.drawImage(frame, 0, 0);
        const r = Math.hypot(w, hgt) * 0.6 * (1 - k);
        const g = ctx.createRadialGradient(w / 2, hgt / 2, r * 0.6, w / 2, hgt / 2, r + 1);
        g.addColorStop(0, 'rgba(13,11,9,0)');
        g.addColorStop(1, 'rgba(13,11,9,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, hgt);
        ctx.fillStyle = `rgba(13,11,9,${k * 0.6})`;
        ctx.fillRect(0, 0, w, hgt);
      } else if (t < close + hold) {
        // One beam in the dark: thin, then a little wider, as eyes get used to it.
        const k = (t - close) / hold;
        const bw = kind === 'down' ? 2 + k * w * 0.06 : 2 + k * k * w;
        const g = ctx.createLinearGradient(w / 2 - bw, 0, w / 2 + bw, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, light);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.fillStyle = g;
        ctx.fillRect(w / 2 - bw, 0, bw * 2, hgt);
        ctx.globalAlpha = 1;
        // Dither the beam into the palette's grain: every other pixel of its edges goes dark.
        for (let y = 0; y < hgt; y += 2) {
          ctx.fillStyle = '#0d0b09';
          ctx.fillRect(Math.floor(w / 2 - bw), y, 1, 1);
          ctx.fillRect(Math.floor(w / 2 + bw), y + 1, 1, 1);
        }
      } else {
        // The new place comes up through the dark.
        c.style.opacity = String(Math.max(0, 1 - (t - close - hold) / open));
        if (kind === 'up') {
          ctx.fillStyle = light;
          ctx.fillRect(0, 0, w, hgt);
        } else {
          const bw = 2 + w * 0.06;
          ctx.fillStyle = light;
          ctx.fillRect(w / 2 - bw / 2, 0, bw, hgt);
        }
      }
      if (t < close + hold + open) this.running = requestAnimationFrame(step);
      else c.hidden = true;
    };
    this.running = requestAnimationFrame(step);
  }
}
