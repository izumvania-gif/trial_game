// Speaker portraits in the black-figure manner: a profile bust inside a tondo, the way the
// painters filled the inside of a drinking cup. Figures are black gloss with incised lines
// showing the clay, women's skin is added white, wreaths and hems are added red.
// Each portrait is drawn with paths at 4× and reduced by majority vote to a 72-pixel grid, then
// mapped to the palette of the stage it is shown in — nothing here is an image file.
import type { Mood } from '../content/moods.ts';
import { RESIDENTS } from '../content/residents.ts';

export const PORTRAIT_SIZE = 72;
const SUPER = 4;
const UNIT = (PORTRAIT_SIZE * SUPER) / 100;

/** Logical tones. The theme decides which palette color (or 50% dither of two) each becomes. */
const BG = 1, FIG = 2, CUT = 3, WHITE = 4, RED = 5, INK = 6;
type Tone = typeof BG | typeof FIG | typeof CUT | typeof WHITE | typeof RED | typeof INK;
type Pt = [number, number];
/** One color, a 50% dither of two, or a sparse (1 in 4) dither of the second over the first. */
type Paint = string | [string, string] | [string, string, 'sparse'];

export type PortraitTheme = 'vase' | 'marble';

/**
 * Light comes from in front of the face and above (upper right). What the light does to each tone:
 * `shade` on the side away from it, `cast` where the bust's own shadow falls on the ground of the
 * cup, `rim` along the lit edge of the profile. A tone missing here is not changed by the light —
 * black gloss stays black in shadow, which is how the painters did it too.
 */
interface Lighting {
  shade: Partial<Record<Tone, Paint>>;
  cast: Partial<Record<Tone, Paint>>;
  rim: Partial<Record<Tone, Paint>>;
}

const LIGHTING: Record<PortraitTheme, Lighting> = {
  vase: {
    shade: { [BG]: ['#b5532a', '#6e2a1c', 'sparse'], [WHITE]: ['#e8e2d0', '#c8683a', 'sparse'], [RED]: ['#6e2a1c', '#0d0b09'] },
    cast: { [BG]: ['#b5532a', '#6e2a1c'] },
    rim: { [FIG]: ['#0d0b09', '#c8683a', 'sparse'] },
  },
  marble: {
    shade: { [FIG]: ['#e8e2d0', '#0d0b09', 'sparse'], [WHITE]: ['#e8e2d0', '#0d0b09', 'sparse'], [RED]: ['#e8e2d0', '#0d0b09'] },
    cast: {},
    rim: {},
  },
};

const THEMES: Record<PortraitTheme, Record<Tone, Paint>> = {
  vase: { [BG]: '#b5532a', [FIG]: '#0d0b09', [CUT]: '#c8683a', [WHITE]: '#e8e2d0', [RED]: '#6e2a1c', [INK]: '#0d0b09' },
  // The Hall: a marble relief, bone on shadow.
  marble: { [BG]: '#0d0b09', [FIG]: '#e8e2d0', [CUT]: '#0d0b09', [WHITE]: '#e8e2d0', [RED]: ['#e8e2d0', '#0d0b09'], [INK]: '#0d0b09' },
};

interface Face {
  /** 0..1 longer nose. */ nose: number;
  /** -1..1 nose tip lower. */ hook: number;
  /** -1..1 chin forward. */ chin: number;
  /** 0..1 heavy jaw, double chin. */ jaw: number;
}

interface Spec {
  skin: 'fig' | 'white';
  face?: Partial<Face>;
  hair?: 'short' | 'curls' | 'long' | 'bun' | 'bald' | 'wild' | 'crop';
  hairTone?: Tone;
  beard?: 'short' | 'pointed' | 'long' | 'wild';
  beardTone?: Tone;
  crown?: 'laurel' | 'oak' | 'fillet' | 'seaweed';
  crownTone?: Tone;
  cover?: 'veil' | 'helmet' | 'hood' | 'petasos';
  eye?: 'open' | 'closed';
  /** Dark glasses, at any hour. */
  shades?: boolean;
  /** Turned to face the viewer: on a cup where everyone else is in profile, only one is. */
  frontal?: boolean;
  /** Mouth drawn open even at rest (the demagogue, the herald). */
  speaking?: boolean;
  smooth?: boolean;
  age?: number;
  garment?: 'chiton' | 'himation' | 'armour' | 'shirt';
  prop?: 'lyre' | 'trident' | 'mask' | 'kerykeion' | 'stylus' | 'wheat' | 'net' | 'coins' | 'knife' | 'spear';
  crowd?: boolean;
  /** Set per line, not per person. */
  mood?: Mood;
}

const SPECS: Record<string, Spec> = {
  leont: { skin: 'fig', hair: 'curls', beard: 'short', garment: 'chiton', prop: 'stylus', face: { nose: 0.35 } },
  aristion: { skin: 'fig', hair: 'bald', hairTone: WHITE, beard: 'long', beardTone: WHITE, crown: 'laurel', age: 1, garment: 'himation', face: { nose: 0.6, hook: 0.6, chin: -0.2 } },
  kora: { skin: 'white', cover: 'veil', garment: 'chiton', prop: 'wheat', face: { nose: 0.3, chin: 0.1 } },
  cleon: { skin: 'fig', hair: 'curls', beard: 'pointed', crown: 'fillet', speaking: true, garment: 'himation', face: { nose: 0.5, chin: 0.3 } },
  eion: { skin: 'fig', hair: 'long', beard: 'long', crown: 'fillet', crownTone: WHITE, eye: 'closed', prop: 'lyre', age: 0.6, garment: 'chiton', face: { nose: 0.4, hook: 0.3 } },
  lysimachus: { skin: 'fig', hair: 'short', beard: 'short', garment: 'himation', prop: 'coins', face: { nose: 0.7, hook: 1, jaw: 1, chin: -0.3 } },
  hierocles: { skin: 'fig', hair: 'long', beard: 'pointed', crown: 'oak', age: 0.4, garment: 'himation', prop: 'knife', face: { nose: 0.5, chin: 0.2 } },
  glaucus: { skin: 'fig', hair: 'wild', beard: 'wild', crown: 'seaweed', age: 0.7, prop: 'trident', face: { nose: 0.45, hook: 0.4 } },
  maskseller: { skin: 'fig', cover: 'hood', beard: 'short', prop: 'mask', face: { nose: 0.8, hook: 0.8, chin: -0.4 } },
  xenos: { skin: 'fig', cover: 'hood', smooth: true },
  talia: { skin: 'white', hair: 'bun', crown: 'fillet', prop: 'net', garment: 'chiton', face: { nose: 0.1, chin: -0.2 } },
  guard: { skin: 'fig', cover: 'helmet', beard: 'short', garment: 'armour', prop: 'spear', face: { nose: 0.4 } },
  crier: { skin: 'fig', cover: 'petasos', beard: 'short', speaking: true, prop: 'kerykeion', garment: 'chiton', face: { nose: 0.4, chin: 0.2 } },
  woman: { skin: 'white', hair: 'long', crown: 'fillet', garment: 'chiton', face: { nose: 0.2 } },
  boy: { skin: 'fig', hair: 'short', garment: 'chiton', face: { nose: 0, chin: -0.3 } },
  crowd: { skin: 'fig', crowd: true },
  // Upstairs, come down: a cropped head, dark glasses at night, a work shirt over a dark T-shirt.
  curator: { skin: 'fig', hair: 'crop', shades: true, garment: 'shirt', frontal: true },
};

export interface PortraitInfo {
  id: string;
  name: string;
  epithet: string;
}

const EXTRA: Record<string, [string, string]> = {
  leont: ['Leont', 'scribe of Eferon'],
  guard: ['Guard', 'at the bronze door'],
  crier: ['Crier', 'herald of the agora'],
  crowd: ['Eferon', 'ten thousand voices'],
  woman: ['A woman in the crowd', 'carved in the stone'],
  boy: ['A boy', 'carved in the stone'],
  curator: ['Curator P-7', 'body: none'],
};

const ALIASES: Record<string, string> = {
  'priest of zeus': 'hierocles',
  'the priest': 'hierocles',
  'the mask seller': 'maskseller',
  'a woman in the crowd': 'woman',
  'a boy': 'boy',
  eferon: 'crowd',
};

/** Who a `#speaker:` tag names, with the nameplate text; null when nobody we can draw. */
export function portraitFor(speaker: string | null): PortraitInfo | null {
  if (!speaker) return null;
  const key = speaker.trim().toLowerCase();
  const id = ALIASES[key] ?? key.replace(/[^a-z]/g, '');
  const resident = RESIDENTS.find((r) => r.id === id);
  if (resident) return { id, name: resident.name, epithet: resident.epithet };
  const extra = EXTRA[id];
  if (extra && SPECS[id]) return { id, name: extra[0], epithet: extra[1] };
  return null;
}

export const PORTRAIT_IDS = Object.keys(SPECS);

/** Painted facing the viewer rather than in profile. */
export function facesViewer(id: string): boolean {
  return !!SPECS[id]?.frontal;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Portraits are cached and shared; put a copy in the DOM. */
export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/** A 72×72 canvas; `open` draws the mouth open (the talking frame), `mood` sets the face. Cached. */
export function portrait(id: string, theme: PortraitTheme, open = false, mood: Mood = 'neutral'): HTMLCanvasElement {
  const key = `${id}/${theme}/${open}/${mood}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = render({ ...(SPECS[id] ?? SPECS.crowd!), mood }, theme, open);
    cache.set(key, canvas);
  }
  return canvas;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function render(spec: Spec, theme: PortraitTheme, open: boolean): HTMLCanvasElement {
  const big = document.createElement('canvas');
  big.width = big.height = PORTRAIT_SIZE * SUPER;
  const ctx = big.getContext('2d')!;
  ctx.scale(UNIT, UNIT);
  const d = new Draw(ctx);
  d.disc(50, 50, 42, BG);
  ctx.save();
  ctx.beginPath();
  ctx.arc(50, 50, 41.5, 0, Math.PI * 2);
  ctx.clip();
  if (spec.crowd) drawCrowd(d);
  else if (spec.frontal) drawFrontal(d, spec, open);
  else drawBust(d, spec, open);
  ctx.restore();
  drawFrame(d);
  return reduce(big, spec.crowd ? null : lightMask(spec, open), THEMES[theme], LIGHTING[theme]);
}

class Draw {
  readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private style(t: Tone): string {
    return `rgb(${t * 36},0,0)`;
  }

  fill(t: Tone, path: (ctx: CanvasRenderingContext2D) => void): void {
    this.ctx.beginPath();
    path(this.ctx);
    this.ctx.fillStyle = this.style(t);
    this.ctx.fill();
  }

  shape(t: Tone, pts: Pt[]): void {
    this.fill(t, (c) => spline(c, pts, true));
  }

  line(t: Tone, width: number, pts: Pt[], smooth = true): void {
    const c = this.ctx;
    c.beginPath();
    if (smooth) spline(c, pts, false);
    else {
      c.moveTo(...pts[0]!);
      for (const p of pts.slice(1)) c.lineTo(...p);
    }
    c.strokeStyle = this.style(t);
    // Nothing thinner than about one output pixel survives the reduction.
    c.lineWidth = Math.max(1.1, width * 1.45);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }

  disc(x: number, y: number, r: number, t: Tone): void {
    this.fill(t, (c) => c.arc(x, y, r, 0, Math.PI * 2));
  }

  ring(x: number, y: number, r: number, t: Tone, width: number): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = this.style(t);
    c.lineWidth = width;
    c.stroke();
  }

  ellipse(x: number, y: number, rx: number, ry: number, rot: number, t: Tone): void {
    this.fill(t, (c) => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2));
  }
}

/** Catmull-Rom through the points, as cubic béziers. */
function spline(c: CanvasRenderingContext2D, pts: Pt[], closed: boolean): void {
  const n = pts.length;
  const P = (i: number): Pt => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  c.moveTo(...pts[0]!);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    c.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
  if (closed) c.closePath();
}

/** Thin incisions and added colors must survive the vote against the large fills around them. */
const WEIGHT: Record<number, number> = { [CUT]: 3, [INK]: 3, [RED]: 2, [WHITE]: 1.6 };

/**
 * Where the light falls, drawn on its own canvas: red = in shade, green = the cast shadow,
 * blue = the lit rim. Channels add up, so a pixel can be in shade and in the cast shadow.
 */
function lightMask(s: Spec, open: boolean): HTMLCanvasElement {
  const f: Face = { nose: 0.4, hook: 0, chin: 0, jaw: 0, ...s.face };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PORTRAIT_SIZE * SUPER;
  const c = canvas.getContext('2d')!;
  c.scale(UNIT, UNIT);
  c.globalCompositeOperation = 'lighter';
  c.beginPath();
  c.arc(50, 50, 41.5, 0, Math.PI * 2);
  c.clip();
  // Everything outside a wide circle around the light is in shade; so is the throat under the jaw.
  c.fillStyle = '#ff0000';
  c.beginPath();
  c.rect(0, 0, 100, 100);
  c.arc(92, 4, 74, 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.beginPath();
  spline(c, s.frontal ? [[44, 68], [56, 68], [55.4, 76], [44.6, 76]] : [[56, 71], [63, 71.5], [60, 78], [57, 82], [52, 79], [50, 73]], true);
  c.fill();
  // The bust's shadow on the ground of the cup, thrown down and back, away from the light.
  c.fillStyle = '#00ff00';
  c.save();
  c.translate(-4.2, 3.2);
  c.beginPath();
  spline(c, s.frontal ? FRONT_BUST : bustOutline(f, open), true);
  c.fill();
  c.restore();
  // The lit edge: the top of the head and the whole profile, forehead to chin.
  c.strokeStyle = '#0000ff';
  c.lineWidth = 2.4;
  c.lineJoin = 'round';
  c.beginPath();
  spline(c, s.frontal ? FRONT_HEAD.slice(6, 14) : [[42, 19], [52, 16.5], ...faceProfile(f, open).slice(0, 13)], false);
  c.stroke();
  return canvas;
}

function paintAt(paint: Paint, x: number, y: number): string {
  if (typeof paint === 'string') return paint;
  if (paint.length === 3) return (x & 1) === 0 && (y & 1) === 0 ? paint[1] : paint[0];
  return paint[(x + y) & 1]!;
}

/** Majority vote per 4×4 block, ignoring antialiased edge pixels; then tones to palette colors, lit. */
function reduce(big: HTMLCanvasElement, light: HTMLCanvasElement | null, paints: Record<Tone, Paint>, lighting: Lighting): HTMLCanvasElement {
  const lit = light?.getContext('2d')!.getImageData(0, 0, light.width, light.height).data ?? null;
  const src = big.getContext('2d')!.getImageData(0, 0, big.width, big.height).data;
  const out = document.createElement('canvas');
  out.width = out.height = PORTRAIT_SIZE;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(PORTRAIT_SIZE, PORTRAIT_SIZE);
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const counts = new Array<number>(8);
  for (let y = 0; y < PORTRAIT_SIZE; y++) {
    for (let x = 0; x < PORTRAIT_SIZE; x++) {
      counts.fill(0);
      for (let sy = 0; sy < SUPER; sy++) {
        for (let sx = 0; sx < SUPER; sx++) {
          const i = ((y * SUPER + sy) * big.width + x * SUPER + sx) * 4;
          if (src[i + 3]! < 250) {
            counts[0]!++;
            continue;
          }
          const r = src[i]!;
          if (src[i + 1] === 0 && src[i + 2] === 0 && r % 36 === 0 && r / 36 >= 1 && r / 36 <= 6) counts[r / 36]!++;
        }
      }
      let best = 0;
      let bestScore = 0;
      for (let t = 0; t <= 6; t++) {
        const score = counts[t]! * (WEIGHT[t] ?? 1);
        if (score > bestScore) {
          best = t;
          bestScore = score;
        }
      }
      if (best === 0) continue;
      const tone = best as Tone;
      let paint = paints[tone];
      if (lit) {
        const li = ((y * SUPER + 2) * big.width + x * SUPER + 2) * 4;
        if (lit[li]! > 128) paint = lighting.shade[tone] ?? paint;
        if (lit[li + 1]! > 128) paint = lighting.cast[tone] ?? paint;
        if (lit[li + 2]! > 128) paint = lighting.rim[tone] ?? paint;
      }
      const hex = paintAt(paint, x, y);
      const [r, g, b] = rgb(hex);
      const o = (y * PORTRAIT_SIZE + x) * 4;
      img.data[o] = r!;
      img.data[o + 1] = g!;
      img.data[o + 2] = b!;
      img.data[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function drawFrame(d: Draw): void {
  // The rim of the cup: a clay band with a row of black tongues, between two black lines.
  d.ring(50, 50, 46.2, BG, 6.2);
  d.ring(50, 50, 42.6, FIG, 1.3);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    d.ellipse(50 + Math.cos(a) * 46.4, 50 + Math.sin(a) * 46.4, 2.1, 1.05, a, FIG);
  }
  d.ring(50, 50, 49.2, FIG, 1.1);
}

// ─── The bust ────────────────────────────────────────────────────────────────

function faceProfile(f: Face, open: boolean): Pt[] {
  const drop = open ? 1.6 : 0;
  return [
    [60, 18.5],
    [65, 28],
    [67.2, 35.5],
    [66.4, 39.5],
    [72 + 5 * f.nose, 48.5 + 2 * f.hook],
    [68.8, 51.8],
    [68.4, 54.2],
    [70, 56.4],
    [67.6, 58.4],
    [69.4, 60 + drop],
    [67, 62.4 + drop],
    [68.6 + 2.6 * f.chin, 66 + drop],
    [66 + 2 * f.chin, 69.6 + drop + 2 * f.jaw],
    [57.5, 71 + 2.6 * f.jaw],
  ];
}

/** Head, neck and shoulders as one outline. */
function bustOutline(f: Face, open: boolean): Pt[] {
  return [[2, 104], [8, 88], [19, 79], [33, 73.5], [35, 64], [29, 54], [27, 41], [32, 27], [42, 19], [52, 16.5], ...faceProfile(f, open), [59.5, 76], [61, 81], [71, 85], [85, 90], [98, 104]];
}

function drawBust(d: Draw, s: Spec, open: boolean): void {
  const f: Face = { nose: 0.4, hook: 0, chin: 0, jaw: 0, ...s.face };
  const talking = open || !!s.speaking;
  const skin: Tone = s.skin === 'white' ? WHITE : FIG;
  const cut: Tone = skin === WHITE ? INK : CUT;

  // Behind the head: long hair, the veil, the hood.
  if (s.hair === 'long' || s.hair === 'wild') drawHairBack(d, s);
  if (s.cover === 'hood') d.shape(FIG, [[68, 26], [62, 12], [46, 5], [28, 11], [17, 28], [13, 52], [11, 76], [6, 104], [36, 104], [37, 84], [41, 66], [46, 50], [52, 38], [62, 32]]);

  // Garment and shoulders, then the head and neck in one silhouette.
  const body = bustOutline(f, open);
  if (s.smooth) {
    // Xenos: a smooth white oval where a face should be.
    d.shape(FIG, body);
    d.shape(WHITE, [[58, 19], [66, 29], [70.5, 42], [71, 53], [68.5, 63], [63, 69.5], [55, 70], [52, 58], [52, 40], [54, 27]]);
    d.line(INK, 0.9, [[60, 40.5], [66, 40]]);
  } else {
    d.shape(skin, body);
  }
  // Clothes over the shoulders: the neck stays skin.
  drawGarment(d, s, skin);
  if (s.cover === 'veil') d.shape(FIG, [[62, 21], [56, 12], [42, 8], [27, 16], [18, 34], [15, 56], [12, 80], [8, 100], [34, 104], [36, 84], [40, 70], [46, 56], [50, 40], [55, 30]]);

  if (!s.smooth) {
    if (s.hair && s.hair !== 'long' && s.hair !== 'wild') drawHairCap(d, s, skin);
    if (s.hair === 'long' || s.hair === 'wild') drawHairCap(d, s, skin);
    drawFace(d, s, f, skin, cut, talking);
    if (s.beard) drawBeard(d, s, f, open);
    if (talking && s.beard) drawMouth(d, cut, true, s);
  }
  if (s.cover === 'veil') {
    d.line(RED, 1.4, [[61, 21], [55, 29.6], [49.6, 40], [45.6, 55], [39.6, 70], [36, 84], [34, 100]]);
    d.line(CUT, 0.6, [[40, 20], [28, 44], [24, 90]]);
    d.line(CUT, 0.6, [[48, 16], [36, 44], [29, 80]]);
  }
  if (s.cover === 'hood') {
    d.line(CUT, 0.7, [[60, 12], [44, 7], [28, 14], [19, 32]]);
    d.line(CUT, 0.7, [[35, 30], [25, 60], [21, 100]]);
    d.line(CUT, 0.7, [[42, 38], [33, 70], [31, 100]]);
    // The face in the hood's shadow.
    d.shape(FIG, [[68, 26], [62, 13], [52, 12], [58, 24], [63, 32]]);
  }
  if (s.cover === 'helmet') drawHelmet(d, f);
  if (s.cover === 'petasos') {
    d.ellipse(44, 20, 12, 7, 0, FIG);
    d.ellipse(44, 24, 27, 4.2, -0.12, FIG);
    d.line(CUT, 0.7, [[20, 26.5], [44, 22], [69, 20.4]]);
  }
  if (s.crown) drawCrown(d, s);
  if (s.prop) drawProp(d, s.prop);
}

function drawFace(d: Draw, s: Spec, f: Face, skin: Tone, cut: Tone, talking: boolean): void {
  const mood = s.mood ?? 'neutral';
  // The archaic eye: frontal, almond-shaped, in a face seen from the side.
  if (s.eye === 'closed') {
    d.line(cut, 1, [[57, 39.5], [61, 41], [65, 39.6]]);
    d.line(cut, 0.6, [[58, 42.5], [61, 43.4], [63.5, 42.6]]);
  } else if (s.shades) {
    drawShades(d);
  } else if (s.cover !== 'helmet') {
    const e = EYES[mood];
    d.fill(skin === WHITE ? WHITE : CUT, (c) => {
      c.moveTo(56.8, 39.3);
      c.quadraticCurveTo(61, e.upper - 0.8, 65.4, 38.6);
      c.quadraticCurveTo(61, e.lower + 0.8, 56.8, 39.3);
    });
    d.line(cut, 0.7, [[56.8, 39.3], [61, e.upper], [65.4, 38.6]]);
    d.line(cut, 0.7, [[56.8, 39.3], [61, e.lower], [65.4, 38.6]]);
    d.disc(62, e.pupilY, e.pupil, skin === WHITE ? INK : FIG);
    if (mood === 'sorrow') {
      // A tear, painted the way the vase painters did hair and beards: a few strokes, no gloss.
      d.fill(skin === WHITE ? INK : WHITE, (c) => c.ellipse(61.2, 44.4, 0.9, 1.4, 0, 0, Math.PI * 2));
    }
  }
  d.line(cut, 1.05, BROWS[mood]);
  if (mood === 'anger') d.line(cut, 0.6, [[66.4, 36.6], [65, 38.2]]);
  if (mood === 'joy') d.line(cut, 0.55, [[63.8, 54.4], [64.6, 56.8]]);
  // Ear.
  if (!s.cover && s.hair !== 'long' && s.hair !== 'wild') {
    d.line(cut, 0.9, [[49, 41], [46, 42.5], [45.4, 47], [47.4, 51], [49.6, 51]]);
    d.line(cut, 0.6, [[48, 45], [47.2, 47.4], [48.4, 49]]);
  }
  // Nostril and the line of the cheek.
  d.line(cut, 0.6, [[67.2, 50.6], [68.6, 51.4]]);
  if (s.age) {
    d.line(cut, 0.55, [[64, 47.5], [63.4, 52], [65, 57]]);
    d.line(cut, 0.5, [[55, 38], [52.6, 39.6]]);
    d.line(cut, 0.5, [[58, 27], [63, 26.4]]);
    if (s.age > 0.6) d.line(cut, 0.5, [[57.4, 30], [63.6, 29.6]]);
  }
  if (f.jaw > 0.5) d.line(cut, 0.7, [[58, 71.2], [63, 72.4], [66.6, 71.4]]);
  // Neckline of the throat.
  d.line(cut, 0.5, [[58.6, 75], [57.4, 79]]);
  if (!s.beard) drawMouth(d, cut, talking, s);
}

/** Brows: the front end (by the nose) is what tells the mood in a profile. */
const BROWS: Record<Mood, Pt[]> = {
  neutral: [[56.5, 34.6], [61, 33.2], [65.6, 34.8]],
  joy: [[56.5, 34.2], [61, 32.6], [65.6, 34]],
  anger: [[56.5, 33.2], [61, 33.8], [65.8, 36.6]],
  sorrow: [[56.5, 35.8], [61, 34.4], [65.6, 32.4]],
  fear: [[56.5, 33], [61, 31], [65.6, 32.6]],
  wonder: [[56.5, 33.8], [61, 31.8], [65.6, 33.2]],
};

/** Eyelids (the curves' control heights) and the pupil. */
const EYES: Record<Mood, { upper: number; lower: number; pupil: number; pupilY: number }> = {
  neutral: { upper: 36.4, lower: 41.6, pupil: 1.35, pupilY: 38.8 },
  joy: { upper: 36.8, lower: 39.6, pupil: 1.2, pupilY: 38.6 },
  anger: { upper: 37.8, lower: 41, pupil: 1.3, pupilY: 39.2 },
  sorrow: { upper: 37.8, lower: 41.8, pupil: 1.3, pupilY: 39.8 },
  fear: { upper: 34.8, lower: 43, pupil: 1, pupilY: 38.6 },
  wonder: { upper: 35.4, lower: 42, pupil: 1.2, pupilY: 38.6 },
};

function drawMouth(d: Draw, cut: Tone, open: boolean, s: Spec): void {
  const mood = s.mood ?? 'neutral';
  const hole: Tone = s.skin === 'white' ? INK : CUT;
  if (open) {
    // Wider for a shout, rounder for fear, corners up for a laugh.
    const shape: Pt[] = mood === 'anger' ? [[70, 57.4], [64.8, 58.6], [69.6, 61.8]]
      : mood === 'fear' || mood === 'wonder' ? [[69.8, 57.6], [66.6, 58.2], [66.4, 60.6], [69.4, 61.2]]
        : mood === 'joy' ? [[69.8, 57.8], [64.6, 57.4], [69.2, 60.8]]
          : [[69.6, 57.8], [65.2, 58.8], [69.2, 60.8]];
    d.fill(hole, (c) => {
      c.moveTo(...shape[0]!);
      for (const p of shape.slice(1)) c.lineTo(...p);
      c.closePath();
    });
    return;
  }
  switch (mood) {
    case 'joy': d.line(cut, 0.8, [[69.4, 58.2], [67, 58.9], [65, 57.4]]); break;
    case 'anger': d.line(cut, 0.9, [[69.4, 58.4], [66.8, 58.6], [65.2, 60]]); break;
    case 'sorrow': d.line(cut, 0.8, [[69.4, 58.4], [67.2, 58.9], [65.4, 60.2]]); break;
    case 'fear': d.fill(hole, (c) => c.ellipse(68.4, 59.2, 1.3, 1.2, 0, 0, Math.PI * 2)); break;
    case 'wonder': d.fill(hole, (c) => c.ellipse(68.8, 59, 1, 0.8, 0, 0, Math.PI * 2)); break;
    default: d.line(cut, 0.8, [[69.4, 58.3], [65.6, 58.8]]);
  }
}

function drawHairCap(d: Draw, s: Spec, skin: Tone): void {
  const tone = s.hairTone ?? FIG;
  const cut: Tone = tone === FIG ? CUT : INK;
  switch (s.hair) {
    case 'bald':
      d.shape(tone, [[34, 40], [30.6, 44], [30, 51], [33, 58], [36, 57], [34.4, 50], [35.4, 43]]);
      return;
    case 'crop':
      // Cut close: a thin cap that stops short of the temple, and a few short strokes.
      d.shape(tone, [[59.6, 21], [52, 15.8], [40, 16.2], [30.4, 23], [27, 34], [28, 45], [31.4, 49], [34, 44.6], [33.6, 36], [38, 27], [47, 21], [56, 22.8]]);
      for (let i = 0; i < 6; i++) d.line(cut, 0.5, [[54 - i * 4.4, 18.4 + i * 1.2], [52 - i * 4.6, 21.6 + i * 1.6]]);
      if (skin === tone) d.line(cut, 0.8, [[59.6, 21], [56, 22.8], [47, 21], [38, 27], [33.6, 36], [34, 44.6], [31.4, 49]]);
      return;
    case 'bun':
      d.shape(FIG, [[60, 21], [52, 15.4], [40, 16], [30, 23], [26.4, 36], [28, 48], [34, 56], [39, 52], [41, 44], [47, 37], [54, 31], [59, 26]]);
      d.disc(26, 30, 7.8, FIG);
      d.line(CUT, 0.6, [[22, 26], [26, 30], [30, 34]]);
      d.line(CUT, 0.6, [[24, 36], [28, 28]]);
      break;
    default:
      d.shape(tone, [[60.4, 20.6], [52, 15], [40, 15.6], [29.4, 23], [25.6, 36], [27, 50], [33, 60], [38.4, 55], [40, 46], [46, 38.6], [53, 31], [58.4, 25.4]]);
      if (s.hair === 'curls') {
        // A fringe of curls along the forehead and the temple: incised rings.
        for (const [x, y] of [[58.4, 22.6], [55.4, 26.2], [52, 29.6], [48.4, 33], [44.6, 36.6], [41.4, 40.6], [39.6, 45.4]] as Pt[]) d.ring(x, y, 1.5, cut, 0.6);
      }
      for (let i = 0; i < 5; i++) d.line(cut, 0.55, [[50 - i * 3.6, 18 + i * 1.5], [44 - i * 3.4, 30 + i * 2], [40 - i * 2, 44 + i * 2.6]]);
  }
  if (skin === tone) d.line(cut, 0.8, [[60.4, 20.6], [58.4, 25.4], [53, 31], [46, 38.6], [40, 46], [38.4, 55], [33, 60]]);
}

function drawHairBack(d: Draw, s: Spec): void {
  const wild = s.hair === 'wild';
  const pts: Pt[] = wild
    ? [[60, 19], [48, 12], [34, 14], [22, 24], [16, 40], [14, 54], [10, 62], [16, 66], [14, 78], [20, 82], [22, 90], [30, 86], [34, 78], [38, 62], [42, 48], [50, 36], [58, 26]]
    : [[60, 19], [48, 13.6], [34, 16], [24, 26], [20, 42], [20, 60], [22, 76], [28, 84], [35, 78], [37, 64], [40, 50], [47, 38], [56, 28]];
  d.shape(s.hairTone ?? FIG, pts);
  const cut: Tone = (s.hairTone ?? FIG) === FIG ? CUT : INK;
  for (let i = 0; i < 4; i++) {
    const x = 24 + i * 3.4;
    d.line(cut, 0.55, wild ? [[x + 6, 30], [x - 2, 48], [x + 2, 60], [x - 3, 76]] : [[x + 5, 32], [x + 1, 50], [x + 2, 66], [x + 1, 78]]);
  }
}

function drawBeard(d: Draw, s: Spec, f: Face, open: boolean): void {
  const tone = s.beardTone ?? FIG;
  const cut: Tone = tone === FIG ? CUT : INK;
  const o = open ? 1.6 : 0;
  const jaw = 2 * f.jaw;
  let pts: Pt[];
  if (s.beard === 'short') pts = [[48, 54], [55, 60 + o], [66.6, 61 + o], [69.4, 64 + o], [69, 69.6 + o + jaw], [62, 72.6 + jaw], [54, 71], [48, 64]];
  else if (s.beard === 'pointed') pts = [[48, 54], [55, 60 + o], [66.6, 61 + o], [69.6, 65 + o], [70.6, 71 + o], [70.4, 78 + o], [65, 76], [58, 72.6], [50, 66]];
  else if (s.beard === 'wild') pts = [[46, 52], [55, 60 + o], [66.6, 61 + o], [71, 66 + o], [73, 76], [70, 82], [74, 88], [64, 86], [60, 90], [56, 80], [50, 72], [45, 62]];
  else pts = [[47, 53], [55, 60 + o], [66.6, 61 + o], [70.4, 65 + o], [71.6, 74], [70.6, 86], [66, 90], [60, 84], [55, 76], [48, 64]];
  d.shape(tone, pts);
  // Moustache over the lip.
  d.shape(tone, [[67.8, 55], [70.2, 56.8], [67, 58.2], [61, 57.4], [60, 55]]);
  for (let i = 0; i < 5; i++) {
    const x = 52 + i * 3.6;
    d.line(cut, 0.55, [[x, 60 + i * 0.3], [x + 2, 66], [x + 2.4 + (s.beard === 'short' ? 0 : 2), s.beard === 'short' ? 70 : 78]]);
  }
  drawMouth(d, tone === FIG ? CUT : INK, open || !!s.speaking, s);
}

function drawGarment(d: Draw, s: Spec, skin: Tone): void {
  const cut: Tone = CUT;
  switch (s.garment) {
    case 'chiton':
      d.shape(FIG, [[2, 104], [8, 89], [20, 81], [34, 78], [46, 82], [58, 83.4], [72, 86], [86, 91], [98, 104]]);
      d.line(skin === FIG ? CUT : WHITE, 0.8, [[34, 78], [46, 82], [58, 83.4], [66, 84]]);
      for (let i = 0; i < 6; i++) d.line(cut, 0.55, [[26 + i * 9, 86 + (i % 2)], [25 + i * 9.4, 104]]);
      break;
    case 'himation':
      d.shape(FIG, [[2, 104], [8, 88], [19, 80], [33, 76], [46, 80], [60, 82.6], [72, 86], [86, 91], [98, 104]]);
      d.line(RED, 3.2, [[18, 82], [40, 90], [62, 100], [70, 106]]);
      d.line(cut, 0.6, [[16, 86], [38, 95], [54, 104]]);
      d.line(cut, 0.6, [[30, 80], [52, 88], [76, 100]]);
      d.line(cut, 0.6, [[48, 82], [70, 90], [88, 100]]);
      break;
    case 'shirt':
      // A work shirt, open at the neck over a dark T-shirt: collar points, a placket, one pocket.
      d.shape(FIG, [[2, 104], [8, 88], [19, 80], [33, 76], [46, 80], [60, 82], [72, 86], [86, 91], [98, 104]]);
      d.line(CUT, 0.8, [[33, 76], [40, 86], [47, 82.6]]);
      d.line(CUT, 0.8, [[60, 82], [63.4, 90], [71, 86.4]]);
      d.line(CUT, 0.7, [[47, 82.6], [53, 88], [60, 82]]);
      d.line(CUT, 0.6, [[53, 88], [53.6, 104]]);
      for (const y of [93, 99]) d.disc(55.2, y, 0.8, CUT);
      d.line(CUT, 0.6, [[62, 95], [74, 96], [73.4, 104]], false);
      d.line(RED, 1.4, [[65, 96.8], [68.6, 97]]);
      d.line(CUT, 0.55, [[18, 86], [22, 104]]);
      break;
    case 'armour':
      d.shape(FIG, [[2, 104], [8, 88], [20, 79], [34, 76], [48, 79], [62, 80], [74, 85], [88, 91], [98, 104]]);
      d.line(CUT, 0.8, [[34, 77], [48, 80], [62, 81], [74, 86]]);
      d.line(CUT, 0.7, [[46, 88], [56, 92], [66, 90]]);
      d.line(CUT, 0.7, [[56, 92], [57, 104]]);
      d.line(RED, 2, [[10, 94], [30, 90]]);
      break;
    default:
      break;
  }
}

/** Dark glasses in profile: one lens over the eye, a glint of the lamp, the arm back to the ear. */
function drawShades(d: Draw): void {
  const lens: Pt[] = [[55.4, 37.2], [61, 36.4], [66.8, 36.8], [66.4, 41.2], [62.6, 43.8], [57.4, 43.2]];
  // On a black figure a dark lens has to be cut out of it: the clay shows through like a mirror.
  d.shape(CUT, lens);
  d.line(FIG, 0.8, [...lens, lens[0]!], false);
  d.line(WHITE, 0.7, [[62.4, 38.4], [64.6, 40.8]]);
  d.line(CUT, 0.8, [[55.4, 38.4], [51, 40.2], [47.8, 41.6]]);
  d.line(CUT, 0.6, [[66.8, 37.4], [67.6, 38.6]]);
}

// ─── Facing out of the cup ───────────────────────────────────────────────────

/** The head seen from the front, from the left jaw over the top to the chin. */
const FRONT_HEAD: Pt[] = [[45.5, 69.5], [40, 64], [35.5, 55], [33.2, 45], [32.5, 34], [34, 23], [40, 15.5], [50, 13], [60, 15.5], [66, 23], [67.5, 34], [66.8, 45], [64.5, 55], [60, 64], [54.5, 69.5], [50, 70.5]];
const FRONT_BUST: Pt[] = [[2, 104], [6, 90], [16, 82], [32, 77], [42, 76], [43, 66], ...FRONT_HEAD.slice(1, 14), [57, 66], [58, 76], [68, 77], [84, 82], [94, 90], [98, 104]];

/** Brows over the glasses, the viewer's left one; the other is its mirror. */
const FRONT_BROWS: Record<Mood, Pt[]> = {
  neutral: [[37.6, 33], [42.6, 32], [47.6, 33]],
  joy: [[37.6, 32.6], [42.6, 31.2], [47.6, 32.4]],
  anger: [[37.6, 31.8], [42.6, 32.4], [47.8, 34.6]],
  sorrow: [[37.6, 34], [42.6, 33], [47.8, 31.6]],
  fear: [[37.6, 31.6], [42.6, 30.2], [47.6, 31.2]],
  wonder: [[37.6, 32], [42.6, 30.4], [47.6, 31.6]],
};

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [100 - x, y]);

/** The Curator: the only face on the cup that turns round and looks back at you. */
function drawFrontal(d: Draw, s: Spec, open: boolean): void {
  const mood = s.mood ?? 'neutral';
  d.shape(FIG, FRONT_BUST);
  // Ears, and the cropped hair with its line along the forehead.
  for (const x of [32.4, 67.6]) {
    d.ellipse(x, 44, 2.6, 5.2, 0, FIG);
    d.line(CUT, 0.55, [[x + (x < 50 ? 0.6 : -0.6), 41], [x + (x < 50 ? -0.8 : 0.8), 44], [x + (x < 50 ? 0.4 : -0.4), 47.4]]);
  }
  d.line(CUT, 0.8, [[33.6, 30], [37, 24], [43, 20.5], [50, 19.6], [57, 20.5], [63, 24], [66.4, 30]]);
  for (let i = 0; i < 7; i++) d.line(CUT, 0.5, [[38 + i * 4, 17.6 + Math.abs(3 - i) * 0.9], [38.6 + i * 4, 20.4 + Math.abs(3 - i) * 0.7]]);
  // A work shirt open over a dark T-shirt: both collar points, the placket, a pocket.
  d.line(CUT, 0.8, [[42, 76], [36, 86], [46, 84.4], [50, 90]]);
  d.line(CUT, 0.8, mirror([[42, 76], [36, 86], [46, 84.4], [50, 90]]));
  d.line(CUT, 0.6, [[44, 79.6], [50, 82.6], [56, 79.6]]);
  d.line(CUT, 0.6, [[50, 90], [50, 104]]);
  for (const y of [95, 101]) d.disc(51.6, y, 0.8, CUT);
  d.line(CUT, 0.6, [[58.6, 93], [69, 93], [69, 104]], false);
  d.line(RED, 1.4, [[60.6, 95], [63.8, 95]]);
  // Dark glasses: two lenses of bare clay, a glint of the lamp in each, the arms back to the ears.
  for (const cx of [43, 57]) {
    d.ellipse(cx, 39.4, 5.6, 3.9, 0, CUT);
    d.line(WHITE, 0.6, [[cx + 1.4, 37.6], [cx + 3, 39.4]]);
  }
  d.line(CUT, 0.8, [[48.4, 38.2], [50, 37.6], [51.6, 38.2]]);
  d.line(CUT, 0.7, [[37.4, 38.4], [33.6, 39.6]]);
  d.line(CUT, 0.7, [[62.6, 38.4], [66.4, 39.6]]);
  d.line(CUT, 1, FRONT_BROWS[mood]);
  d.line(CUT, 1, mirror(FRONT_BROWS[mood]));
  // The nose from the front, the folds beside it, the chin.
  d.line(CUT, 0.6, [[50.6, 42], [49.6, 48.6], [47.8, 51.2], [50, 52.4], [52.2, 51.2]]);
  d.line(CUT, 0.5, [[45.4, 51.4], [44.6, 56]]);
  d.line(CUT, 0.5, mirror([[45.4, 51.4], [44.6, 56]]));
  d.line(CUT, 0.5, [[47, 65.4], [50, 66.4], [53, 65.4]]);
  const talking = open || !!s.speaking;
  if (talking) {
    d.fill(CUT, (c) => c.ellipse(50, 59, mood === 'joy' ? 3.8 : 3, mood === 'fear' || mood === 'wonder' ? 2.2 : 1.6, 0, 0, Math.PI * 2));
    return;
  }
  switch (mood) {
    case 'joy': d.line(CUT, 0.8, [[45.4, 57.6], [50, 59.6], [54.6, 57.6]]); break;
    case 'anger': d.line(CUT, 0.9, [[45.6, 59.6], [50, 58.2], [54.4, 59.6]]); break;
    case 'sorrow': d.line(CUT, 0.8, [[45.6, 60], [50, 58.6], [54.4, 60]]); break;
    case 'fear': d.fill(CUT, (c) => c.ellipse(50, 59, 1.8, 1.6, 0, 0, Math.PI * 2)); break;
    case 'wonder': d.fill(CUT, (c) => c.ellipse(50, 59, 1.3, 1.1, 0, 0, Math.PI * 2)); break;
    default: d.line(CUT, 0.8, [[46, 58.6], [54, 58.6]]);
  }
}

function drawHelmet(d: Draw, f: Face): void {
  // A Corinthian helmet: nose guard, cheek pieces, a slit for the eyes, a tall crest.
  d.shape(FIG, [[58, 11], [46, 3], [30, 3], [16, 11], [8, 26], [12, 34], [19, 22], [30, 12], [46, 10], [56, 16]]);
  for (let i = 0; i < 7; i++) d.line(CUT, 0.6, [[18 + i * 5.4, 6 + Math.abs(3 - i) * 0.6], [22 + i * 4.4, 14]]);
  d.shape(FIG, [[62, 18], [67.6, 30], [68.6, 38], [66.4, 40.2], [71, 50 + 2 * f.hook], [67.4, 52], [66, 60], [60, 63], [52, 64], [40, 62], [30, 56], [26, 44], [28, 28], [36, 18], [48, 13]]);
  // The eye in the opening.
  d.shape(CUT, [[56, 37.6], [61, 35.8], [66, 38], [61, 41]]);
  d.disc(62, 38.6, 1.3, FIG);
  d.line(CUT, 0.8, [[58, 16], [64, 26], [66.4, 34]]);
  d.line(CUT, 0.7, [[40, 60], [36, 46], [38, 32], [48, 20]]);
  d.line(CUT, 0.7, [[66, 44], [62, 50], [60, 60]]);
}

function drawCrown(d: Draw, s: Spec): void {
  const tone = s.crownTone ?? (s.crown === 'seaweed' ? RED : s.crown === 'fillet' ? RED : RED);
  if (s.crown === 'fillet') {
    d.line(tone, 1.8, [[59, 22], [48, 17.6], [36, 20], [28.6, 28.6]]);
    d.line(tone, 1, [[28.6, 28.6], [24, 33], [22, 40]]);
    return;
  }
  if (s.crown === 'seaweed') {
    for (let i = 0; i < 5; i++) d.line(tone, 1, [[48 - i * 5, 16 + i * 2], [44 - i * 6, 30 + i * 3], [46 - i * 5, 44 + i * 4], [42 - i * 6, 58 + i * 3]]);
    return;
  }
  // Laurel or oak: leaves along the curve of the head.
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = -1.95 + (i / (n - 1)) * 1.5;
    const x = 45 + Math.cos(a) * 21.5;
    const y = 38 + Math.sin(a) * 21.5;
    const w = s.crown === 'oak' ? 2.8 : 3.4;
    d.ellipse(x - 2, y - 1.6, w, 1.3, a + 0.7, tone);
    d.ellipse(x + 1.8, y + 1.2, w, 1.3, a - 0.7, tone);
  }
}

function drawProp(d: Draw, prop: NonNullable<Spec['prop']>): void {
  switch (prop) {
    case 'lyre':
      d.line(FIG, 1.5, [[75, 76], [72, 64], [74, 54], [71, 48]]);
      d.line(FIG, 1.5, [[87, 76], [89, 64], [86, 54], [89, 48]]);
      d.line(FIG, 1.5, [[71, 53], [89.6, 52]], false);
      for (let i = 0; i < 3; i++) d.line(WHITE, 0.5, [[77 + i * 4, 53], [77.6 + i * 3.6, 78]], false);
      d.ellipse(81, 80, 8.4, 5.6, 0, FIG);
      d.line(CUT, 0.6, [[74.4, 80], [81, 77], [87.6, 80]]);
      return;
    case 'trident':
      d.line(FIG, 1.8, [[84, 104], [84, 32]], false);
      d.line(FIG, 1.6, [[77, 40], [78, 34], [84, 36], [90, 34], [91, 40]]);
      for (const x of [77, 84, 91]) d.shape(FIG, [[x - 1.6, 34], [x, 27], [x + 1.6, 34]]);
      return;
    case 'mask':
      d.ellipse(80, 70, 9, 11, 0, WHITE);
      d.ellipse(76.4, 66.6, 2.2, 1.5, 0, INK);
      d.ellipse(83.6, 66.6, 2.2, 1.5, 0, INK);
      d.line(INK, 0.8, [[73.6, 63], [76.4, 62], [79, 63.6]]);
      d.line(INK, 0.8, [[81, 63.6], [83.6, 62], [86.4, 63]]);
      d.ellipse(80, 76, 3.2, 2, 0, INK);
      d.line(INK, 0.7, [[80, 68], [79.4, 71.4], [80.6, 72]]);
      return;
    case 'kerykeion':
      d.line(FIG, 1.4, [[82, 104], [82, 40]], false);
      d.ring(82, 34, 4.2, FIG, 1.4);
      d.line(FIG, 1.1, [[78, 46], [86, 50], [78, 56], [86, 60]]);
      return;
    case 'stylus':
      d.line(WHITE, 1.1, [[53, 23], [41, 43]], false);
      d.shape(WHITE, [[70, 72], [88, 67], [90.4, 80], [72.4, 85]]);
      d.line(INK, 0.6, [[73.4, 75], [87, 71.4]], false);
      d.line(INK, 0.6, [[74.2, 79], [87.8, 75.4]], false);
      return;
    case 'wheat':
      d.line(RED, 1, [[80, 104], [81, 72], [84, 54]]);
      for (let i = 0; i < 6; i++) {
        d.ellipse(81 + i * 0.6 - 1.8, 56 + i * 3, 2.2, 1, 0.7, WHITE);
        d.ellipse(84 + i * 0.6 + 0.4, 55 + i * 3, 2.2, 1, -0.7, WHITE);
      }
      return;
    case 'net':
      for (let i = 0; i < 4; i++) {
        d.line(FIG, 0.7, [[70 + i * 5, 62], [78 + i * 5, 88]], false);
        d.line(FIG, 0.7, [[92 - i * 5, 62], [84 - i * 5, 88]], false);
      }
      d.line(FIG, 1.3, [[68, 62], [92, 62]], false);
      return;
    case 'coins':
      for (let i = 0; i < 4; i++) {
        d.ellipse(80, 82 - i * 3, 6.4, 2, 0, WHITE);
        d.line(INK, 0.5, [[74, 82.6 - i * 3], [86, 82.6 - i * 3]], false);
      }
      d.ellipse(84, 64, 3, 3, 0, WHITE);
      d.ring(84, 64, 1.5, INK, 0.6);
      return;
    case 'knife':
      d.shape(WHITE, [[76, 86], [92, 60], [94, 62], [80, 88]]);
      d.line(FIG, 2.2, [[74, 90], [79, 86]], false);
      return;
    case 'spear':
      d.line(FIG, 1.4, [[86, 104], [86, 26]], false);
      d.shape(FIG, [[83.4, 30], [86, 16], [88.6, 30]]);
      return;
  }
}

/** Eferon itself: rows of heads, black and white, all turned the same way. */
function drawCrowd(d: Draw): void {
  const c = d.ctx;
  const heads: [number, number, number, boolean][] = [
    [14, 30, 0.34, false], [34, 26, 0.34, true], [54, 28, 0.34, false], [72, 32, 0.34, false],
    [6, 52, 0.4, true], [28, 50, 0.4, false], [50, 48, 0.4, false], [70, 52, 0.4, true],
    [16, 72, 0.46, false], [42, 70, 0.46, true], [66, 74, 0.46, false],
  ];
  for (const [x, y, s, white] of heads) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    const skin: Tone = white ? WHITE : FIG;
    d.shape(skin, [[2, 104], [8, 88], [19, 79], [33, 73.5], [35, 64], [29, 54], [27, 41], [32, 27], [42, 19], [52, 16.5], ...faceProfile({ nose: 0.4, hook: 0, chin: 0, jaw: 0 }, true), [59.5, 76], [61, 81], [71, 85], [85, 90], [98, 104]]);
    d.shape(FIG, [[60.4, 20.6], [52, 15], [40, 15.6], [29.4, 23], [25.6, 36], [27, 50], [33, 60], [38.4, 55], [40, 46], [46, 38.6], [53, 31], [58.4, 25.4]]);
    d.disc(62, 38.8, 2.4, white ? INK : CUT);
    d.fill(white ? INK : CUT, (cc) => {
      cc.moveTo(69.6, 57.8);
      cc.lineTo(64, 59);
      cc.lineTo(69.2, 61.4);
      cc.closePath();
    });
    c.restore();
  }
}
