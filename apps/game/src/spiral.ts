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
      const on = lum > (BAYER4[(y % 4) * 4 + (x % 4)] ?? 0);
      const i = (y * w + x) * 4;
      const v = on ? 232 : 13;
      img.data[i] = v;
      img.data[i + 1] = on ? 226 : 11;
      img.data[i + 2] = on ? 208 : 9;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
