// Between cycles: the scene has frozen into a relief on the spiral. The last frame of the day
// stops, turns to one-bit marble, and is carried down into the spiral with all the others;
// then the log. The global CYCLE RUN (every reset of every player) is shown here; "Wake" is
// the player initiating the next reset.
import { BONE, LACQUER, bayer, spiralPixels } from '../spiral.ts';
import { h } from './dom.ts';

const HOLD = 0.5;
const CARVE = 0.8;
const STILL = 0.5;
const SINK = 2.4;

export class ResetScreen {
  private root = h('div', { className: 'reset', hidden: true });

  constructor(parent: HTMLElement) {
    parent.append(this.root);
  }

  /**
   * The last frame freezes, becomes a relief and sinks into the spiral. Resolves when the
   * spiral has it. Without a frame (a stage with no 3D view) there is nothing to carve.
   */
  freeze(frame: HTMLCanvasElement | null, reducedMotion: boolean, onSink?: () => void, onRelief?: (url: string) => void): Promise<void> {
    if (!frame) return Promise.resolve();
    const w = frame.width;
    const hgt = frame.height;
    const src = frame.getContext('2d')!.getImageData(0, 0, w, hgt);
    const relief = carve(src);
    const canvas = h('canvas', { className: 'reset-freeze' });
    canvas.width = w;
    canvas.height = hgt;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const reliefCanvas = document.createElement('canvas');
    reliefCanvas.width = w;
    reliefCanvas.height = hgt;
    reliefCanvas.getContext('2d')!.putImageData(relief, 0, 0);
    // The day's relief, small enough to keep: it becomes the player's own carving in the registry.
    if (onRelief) {
      const thumb = document.createElement('canvas');
      thumb.width = 96;
      thumb.height = Math.max(1, Math.round((96 * hgt) / w));
      const tc = thumb.getContext('2d')!;
      tc.imageSmoothingEnabled = false;
      tc.drawImage(reliefCanvas, 0, 0, thumb.width, thumb.height);
      onRelief(thumb.toDataURL('image/png'));
    }
    const spiral = ctx.createImageData(w, hgt);
    const mixed = ctx.createImageData(w, hgt);
    this.root.replaceChildren(canvas);
    this.root.hidden = false;

    return new Promise((resolve) => {
      const start = performance.now();
      let sank = false;
      const total = HOLD + CARVE + STILL + (reducedMotion ? 0.3 : SINK);
      const step = (now: number) => {
        const t = (now - start) / 1000;
        if (t < HOLD) {
          // The day stops where it is.
          ctx.putImageData(src, 0, 0);
        } else if (t < HOLD + CARVE) {
          // Stone takes it pixel by pixel, in the dither's own order.
          const k = (t - HOLD) / CARVE;
          for (let y = 0; y < hgt; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const from = bayer(x, y) < k ? relief.data : src.data;
              mixed.data[i] = from[i]!;
              mixed.data[i + 1] = from[i + 1]!;
              mixed.data[i + 2] = from[i + 2]!;
              mixed.data[i + 3] = 255;
            }
          }
          ctx.putImageData(mixed, 0, 0);
        } else if (t < HOLD + CARVE + STILL || reducedMotion) {
          ctx.putImageData(relief, 0, 0);
        } else {
          if (!sank) {
            sank = true;
            onSink?.();
          }
          // The relief shrinks, turns, and settles into the spiral as one more of its carvings.
          const k = Math.min(1, (t - HOLD - CARVE - STILL) / SINK);
          const ease = 1 - Math.pow(1 - k, 3);
          spiralPixels(spiral, t * 0.6);
          ctx.putImageData(spiral, 0, 0);
          const diag = Math.hypot(w, hgt) / 2;
          const radius = diag * (1 - ease * 0.93);
          ctx.save();
          ctx.translate(w / 2, hgt / 2);
          ctx.rotate(ease * Math.PI * 1.5);
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.clip();
          const scale = radius / diag;
          ctx.drawImage(reliefCanvas, (-w / 2) * scale, (-hgt / 2) * scale, w * scale, hgt * scale);
          ctx.restore();
          // A rim of bone around the disc, like the edge of a ring of the spiral.
          ctx.strokeStyle = `rgb(${BONE.join(',')})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(w / 2, hgt / 2, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (t < total) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** Without onWake: waiting for the server. With it: ready. */
  show(cycleRun: number | null, onWake?: () => void, quiet = 'The rain has stopped. It is morning, and it is the same morning.', carved?: string): void {
    const run = cycleRun === null ? '····' : String(cycleRun);
    const wake = h('button', { type: 'button', disabled: !onWake }, 'Wake');
    wake.addEventListener('click', () => {
      this.root.hidden = true;
      onWake?.();
    }, { once: true });
    const said = h('div', { id: 'reset-said' },
      h('p', { className: 'log' }, 'RESET COMPLETED SUCCESSFULLY'),
      h('p', { className: 'log' }, `LOG: CYCLE RUN #${run}`),
      ...(carved ? [h('p', { className: 'log reset-carved' }, 'CARVED ON THE SPIRAL'), h('p', { className: 'reset-day' }, carved)] : []),
      h('p', { className: 'reset-quiet' }, quiet));
    // Focus goes to Wake; a screen reader reads the log with it.
    wake.setAttribute('aria-describedby', 'reset-said');
    this.root.replaceChildren(said, wake);
    this.root.hidden = false;
    if (onWake) wake.focus();
  }
}

/**
 * One-bit marble: the frame's light, raised where it is brighter than its lower-right
 * neighbour and cut where it is darker, so every edge reads as carved; then dithered.
 */
function carve(src: ImageData): ImageData {
  const { width: w, height: h } = src;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (src.data[i * 4]! * 0.299 + src.data[i * 4 + 1]! * 0.587 + src.data[i * 4 + 2]! * 0.114) / 255;
  }
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = lum[i]!;
      const n = lum[Math.min(h - 1, y + 1) * w + Math.min(w - 1, x + 1)]!;
      const v = (l - 0.2) * 1.5 + (l - n) * 2.4;
      const c = v > bayer(x, y) ? BONE : LACQUER;
      out.data[i * 4] = c[0];
      out.data[i * 4 + 1] = c[1];
      out.data[i * 4 + 2] = c[2];
      out.data[i * 4 + 3] = 255;
    }
  }
  return out;
}
