// Placeholder for the stage renderer: a marble spiral drawn in 1-bit ordered dithering,
// the look the Three.js dither pass will reproduce in milestone 1.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const SCALE = 3; // screen pixels per dithered pixel

export function drawSpiral(canvas: HTMLCanvasElement, phase: number): void {
  const w = Math.ceil(window.innerWidth / SCALE);
  const h = Math.ceil(window.innerHeight / SCALE);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  spiralPixels(img, phase);
  ctx.putImageData(img, 0, 0);
}

/** Bone on lacquer, one bit per pixel. */
export const BONE = [232, 226, 208] as const;
export const LACQUER = [13, 11, 9] as const;

export function bayer(x: number, y: number): number {
  return BAYER4[(y % 4) * 4 + (x % 4)] ?? 0;
}

/** The spiral into an image of any size. */
export function spiralPixels(img: ImageData, phase: number): void {
  const { width: w, height: h } = img;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy) / maxR;
      const a = Math.atan2(dy, dx);
      // Five turns, one per age; brightness fades towards the empty centre and the edges.
      const band = 0.5 + 0.5 * Math.cos(a + r * Math.PI * 10 - phase);
      const lum = band * Math.sin(Math.min(r * 1.4, 1) * Math.PI) * 0.35;
      const c = lum > bayer(x, y) ? BONE : LACQUER;
      const i = (y * w + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
}
