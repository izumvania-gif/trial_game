// The carvings of the registry, drawn: two panels for every past Leont — what he tried, and
// how it ended — so the player reads the story from pictures, not from a paragraph.
// The rings age inward, and so does the craft: the outer ring is painted like a black-figure
// vase, the second like a red-figure one, the third like a fresco on plaster, and the inner,
// oldest ring is only scratched into the stone. Every scene is built from the same few figures
// and things; the look comes from the style, and the pixels are snapped to its few colours.
import type { PastLeont } from '../content/leonts.ts';
import { daySeed, seededRng } from '../core/rng.ts';

type Role = 'ground' | 'body' | 'line' | 'red' | 'white' | 'water' | 'robe' | 'ochre';
type Mode = 'solid' | 'outline' | 'scratch';

interface Style {
  mode: Mode;
  colors: Record<Role, string>;
  /** Extra colours that only texture uses (plaster cracks, stone grain). */
  extra: string[];
}

const TERRACOTTA = '#c46a3c';
const LACQUER = '#17110d';
const ADDED_RED = '#8e2e1d';
const ADDED_WHITE = '#ecdfc3';

/** Ring 0 (the latest) … ring 3 (the oldest). */
const STYLES: Style[] = [
  // Black-figure: black silhouettes on the clay, details incised back to the clay, added red and white.
  { mode: 'solid', colors: { ground: TERRACOTTA, body: LACQUER, line: TERRACOTTA, red: ADDED_RED, white: ADDED_WHITE, water: LACQUER, robe: LACQUER, ochre: LACQUER }, extra: [] },
  // Red-figure: the figures are the clay left bare, the background painted black, details in black lines.
  { mode: 'solid', colors: { ground: LACQUER, body: TERRACOTTA, line: LACQUER, red: ADDED_RED, white: ADDED_WHITE, water: TERRACOTTA, robe: TERRACOTTA, ochre: TERRACOTTA }, extra: [] },
  // Fresco: flat earth colours on lime plaster, outlined in brown; the only blue is the sea.
  { mode: 'outline', colors: { ground: '#e6d4aa', body: '#a5472b', line: '#3b2517', red: '#b53b25', white: '#f6eedb', water: '#3d6c9e', robe: '#f6eedb', ochre: '#cf9f45' }, extra: ['#c9b58a'] },
  // Scratches: pale lines cut into grey stone, nothing filled.
  { mode: 'scratch', colors: { ground: '#8b8880', body: '#ebe7dc', line: '#ebe7dc', red: '#ebe7dc', white: '#ebe7dc', water: '#ebe7dc', robe: '#ebe7dc', ochre: '#ebe7dc' }, extra: ['#6f6c65'] },
];

/** Logical size of one panel; drawn at SCALE for a crisper picture. */
const PW = 160;
const PH = 100;
const GROUND = 88;
const GAP = 6;
const SCALE = 3;

interface Pt { x: number; y: number }

interface Fig {
  x: number;
  y?: number;
  h?: number;
  dir?: 1 | -1;
  /** Arm angles in degrees: 0 hangs down, 90 points forward, 180 straight up. */
  armF?: number;
  armB?: number;
  mouth?: boolean;
  eyes?: 'open' | 'shut' | 'x' | 'none';
  /** A smooth white oval instead of a face. */
  blank?: boolean;
  sit?: boolean;
  /** Tipped over, in radians (positive falls backwards). */
  fall?: number;
  /** Head thrown back (laughing). */
  back?: boolean;
  step?: number;
  robe?: Role;
  /** Drawn as a faint dotted outline: someone rubbed out. */
  ghost?: boolean;
}

class Painter {
  readonly g: CanvasRenderingContext2D;
  readonly s: Style;
  readonly rand: () => number;

  constructor(g: CanvasRenderingContext2D, s: Style, rand: () => number) {
    this.g = g;
    this.s = s;
    this.rand = rand;
  }

  c(role: Role): string {
    return this.s.colors[role];
  }

  get scratch(): boolean {
    return this.s.mode === 'scratch';
  }

  /** A filled shape: a scratched outline on stone, an outlined fill on plaster, a flat fill on a pot. */
  shape(path: (g: CanvasRenderingContext2D) => void, role: Role = 'body'): void {
    const g = this.g;
    g.beginPath();
    path(g);
    if (this.scratch) {
      g.strokeStyle = this.c('line');
      g.lineWidth = 0.9;
      g.stroke();
      return;
    }
    g.fillStyle = this.c(role);
    g.fill();
    if (this.s.mode === 'outline') {
      g.strokeStyle = this.c('line');
      g.lineWidth = 0.7;
      g.stroke();
    }
  }

  /** A line in a role's colour (limbs, sticks, ropes). */
  line(points: Pt[], role: Role = 'body', width = 1.4): void {
    const g = this.g;
    g.beginPath();
    points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.strokeStyle = this.scratch ? this.c('line') : this.c(role);
    g.lineWidth = this.scratch ? Math.min(width, 1) : width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }

  /** Inner detail: incised on the black-figure pot, painted on the others. */
  detail(points: Pt[], width = 0.6): void {
    this.line(points, 'line', width);
  }

  circle(x: number, y: number, r: number, role: Role = 'body'): void {
    this.shape((g) => g.arc(x, y, r, 0, Math.PI * 2), role);
  }

  rect(x: number, y: number, w: number, h: number, role: Role = 'body'): void {
    this.shape((g) => g.rect(x, y, w, h), role);
  }

  poly(points: Pt[], role: Role = 'body'): void {
    this.shape((g) => { points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); }, role);
  }

  // ─── People ───

  figure(f: Fig): { hand: Pt; back: Pt; head: Pt; r: number } {
    const g = this.g;
    const h = f.h ?? 44;
    const dir = f.dir ?? 1;
    const top = f.sit ? h * 0.24 : 0;
    const x0 = f.x;
    const y0 = f.y ?? GROUND;
    g.save();
    g.translate(x0, y0);
    if (f.fall) g.rotate(-f.fall * dir);
    if (f.ghost) g.setLineDash([1.2, 1.6]);
    const r = h * 0.1;
    const head = { x: dir * h * 0.02 - (f.back ? dir * h * 0.05 : 0), y: -h + r + top + (f.back ? h * 0.02 : 0) };
    const shoulder = { x: 0, y: -h * 0.76 + top };
    const hem = -h * 0.14 + top;
    const arm = (deg: number, side: number): Pt => {
      const a = (deg * Math.PI) / 180;
      return { x: shoulder.x + side * dir * Math.sin(a) * h * 0.36, y: shoulder.y + Math.cos(a) * h * 0.36 };
    };
    const hand = arm(f.armF ?? 20, 1);
    const back = arm(f.armB ?? 10, -1);
    const robe: Role = f.robe ?? (this.s.mode === 'outline' ? 'robe' : 'body');
    const limbs: Role = 'body';
    if (f.ghost) {
      // Only an outline where someone used to be.
      g.strokeStyle = this.s.mode === 'solid' ? this.c('body') : this.c('line');
      g.lineWidth = 1;
      g.beginPath();
      g.arc(head.x, head.y, r, 0, Math.PI * 2);
      g.moveTo(-h * 0.12, shoulder.y - 1);
      g.lineTo(h * 0.12, shoulder.y - 1);
      g.lineTo(h * 0.17, hem);
      g.lineTo(-h * 0.17, hem);
      g.closePath();
      g.stroke();
      g.restore();
      return { hand: { x: x0 + hand.x, y: y0 + hand.y }, back: { x: x0 + back.x, y: y0 + back.y }, head: { x: x0 + head.x, y: y0 + head.y }, r };
    }
    const w = h * 0.07;
    if (this.scratch) {
      // A stick man: the oldest ring does not know robes.
      this.line([{ x: 0, y: shoulder.y - 2 }, { x: 0, y: hem }], 'body', 1);
      this.line([shoulder, hand], 'body', 1);
      this.line([shoulder, back], 'body', 1);
    } else {
      this.line([shoulder, back], limbs, w);
      this.poly([{ x: -h * 0.12, y: shoulder.y - 1 }, { x: h * 0.12, y: shoulder.y - 1 }, { x: h * 0.17, y: hem }, { x: -h * 0.17, y: hem }], robe);
      // Folds of the robe.
      this.detail([{ x: dir * h * 0.03, y: shoulder.y + 3 }, { x: dir * h * 0.06, y: hem - 1 }]);
      this.detail([{ x: -dir * h * 0.05, y: shoulder.y + 5 }, { x: -dir * h * 0.08, y: hem - 1 }]);
    }
    // Legs: straight down when standing, bent forward when sitting.
    const stride = (f.step ?? 0.08) * h;
    if (f.sit) {
      const knee = { x: dir * h * 0.26, y: hem };
      this.line([{ x: dir * h * 0.04, y: hem }, knee, { x: knee.x + dir * 1, y: 0 }], limbs, w * (this.scratch ? 0.5 : 1));
      this.line([{ x: -dir * h * 0.02, y: hem }, { x: knee.x - dir * 3, y: hem + 1 }, { x: knee.x - dir * 2, y: 0 }], limbs, w * (this.scratch ? 0.5 : 1));
    } else {
      this.line([{ x: h * 0.05, y: hem }, { x: dir * stride, y: 0 }], limbs, w);
      this.line([{ x: -h * 0.05, y: hem }, { x: -dir * stride * 0.6, y: 0 }], limbs, w);
    }
    if (!this.scratch) this.line([shoulder, hand], limbs, w);
    // The head.
    if (f.blank) {
      this.shape((c) => c.ellipse(head.x, head.y, r * 0.9, r * 1.15, 0, 0, Math.PI * 2), 'white');
    } else {
      this.circle(head.x, head.y, r, 'body');
      const eye = { x: head.x + dir * r * 0.4, y: head.y - r * 0.15 };
      if (f.eyes === 'x') {
        this.line([{ x: eye.x - 1, y: eye.y - 1 }, { x: eye.x + 1, y: eye.y + 1 }], 'line', 0.6);
        this.line([{ x: eye.x - 1, y: eye.y + 1 }, { x: eye.x + 1, y: eye.y - 1 }], 'line', 0.6);
      } else if (f.eyes === 'shut') {
        this.detail([{ x: eye.x - 1, y: eye.y }, { x: eye.x + 1.2, y: eye.y }], 0.6);
      } else if (f.eyes !== 'none' && !this.scratch) {
        this.circle(eye.x, eye.y, 0.55, 'line');
      }
      if (f.mouth) {
        const m = { x: head.x + dir * r * 0.85, y: head.y + r * 0.45 };
        this.shape((c) => { c.moveTo(m.x, m.y - 1); c.lineTo(m.x - dir * 1.8, m.y); c.lineTo(m.x, m.y + 1); c.closePath(); }, 'line');
      }
      // A beard line on the pot styles, the way the painters mark a man.
      if (!this.scratch && this.s.mode !== 'outline') this.detail([{ x: head.x + dir * r * 0.2, y: head.y + r * 0.8 }, { x: head.x - dir * r * 0.5, y: head.y + r * 0.5 }], 0.5);
    }
    g.restore();
    const rot = (p: Pt): Pt => {
      if (!f.fall) return { x: x0 + p.x, y: y0 + p.y };
      const a = -f.fall * dir;
      return { x: x0 + p.x * Math.cos(a) - p.y * Math.sin(a), y: y0 + p.x * Math.sin(a) + p.y * Math.cos(a) };
    };
    return { hand: rot(hand), back: rot(back), head: rot(head), r };
  }

  crowd(x0: number, x1: number, n: number, opts: Partial<Fig> = {}): Pt[] {
    const heads: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n + (this.rand() - 0.5) * 3;
      const h = (opts.h ?? 30) * (0.9 + this.rand() * 0.2);
      heads.push(this.figure({ dir: 1, armF: 10 + this.rand() * 20, armB: 10, ...opts, x, h }).head);
    }
    return heads;
  }

  // ─── Things ───

  groundLine(): void {
    this.line([{ x: 2, y: GROUND + 0.8 }, { x: PW - 2, y: GROUND + 0.8 }], this.s.mode === 'solid' ? 'body' : 'line', 0.8);
  }

  flames(x: number, y: number, s: number, n = 3): void {
    for (let i = 0; i < n; i++) {
      const cx = x + (i - (n - 1) / 2) * s * 0.5;
      const hh = s * (0.9 + this.rand() * 0.6);
      this.shape((g) => {
        g.moveTo(cx - s * 0.25, y);
        g.quadraticCurveTo(cx - s * 0.3, y - hh * 0.5, cx + (this.rand() - 0.5) * s * 0.3, y - hh);
        g.quadraticCurveTo(cx + s * 0.3, y - hh * 0.5, cx + s * 0.25, y);
        g.closePath();
      }, 'red');
    }
  }

  tripod(x: number, y: number): void {
    this.line([{ x: x - 9, y }, { x: x - 3, y: y - 16 }], 'body', 1.3);
    this.line([{ x: x + 9, y }, { x: x + 3, y: y - 16 }], 'body', 1.3);
    this.line([{ x, y }, { x, y: y - 16 }], 'body', 1.3);
    this.shape((g) => { g.moveTo(x - 9, y - 16); g.lineTo(x + 9, y - 16); g.quadraticCurveTo(x, y - 8, x - 9, y - 16); }, 'body');
  }

  jug(p: Pt, tilt = 0.9): void {
    const g = this.g;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(tilt);
    this.shape((c) => { c.ellipse(0, 0, 3.2, 4.2, 0, 0, Math.PI * 2); }, 'body');
    this.rect(-1.2, -6.5, 2.4, 2.6, 'body');
    this.detail([{ x: -3, y: 0 }, { x: 3, y: 0 }], 0.5);
    g.restore();
  }

  drops(from: Pt, to: Pt, n = 5): void {
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      this.circle(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t + Math.sin(t * Math.PI) * -3, 0.9, 'water');
    }
  }

  water(level: number): void {
    // Waves across the whole panel, up to `level`.
    this.shape((g) => {
      g.moveTo(0, PH);
      g.lineTo(0, level);
      for (let x = 0; x <= PW; x += 8) g.quadraticCurveTo(x + 2, level - 3, x + 4, level), g.quadraticCurveTo(x + 6, level + 3, x + 8, level);
      g.lineTo(PW, PH);
      g.closePath();
    }, 'water');
    for (let row = level + 5; row < PH; row += 5) {
      const pts: Pt[] = [];
      for (let x = 2; x <= PW - 2; x += 4) pts.push({ x, y: row + (x % 8 < 4 ? -1 : 1) });
      this.line(pts, 'line', 0.5);
    }
  }

  rain(x: number, y: number, w: number, h: number): void {
    for (let i = 0; i < w / 4; i++) {
      const rx = x + i * 4 + (this.rand() - 0.5) * 2;
      const ry = y + this.rand() * h * 0.4;
      this.line([{ x: rx, y: ry }, { x: rx - 2, y: ry + h * 0.5 }], this.s.mode === 'outline' ? 'water' : 'white', 0.6);
    }
  }

  steps(x: number, w: number, n = 3, rise = 4): number {
    for (let i = 0; i < n; i++) this.rect(x + i * 5, GROUND - (i + 1) * rise, w - i * 10, rise, this.s.mode === 'outline' ? 'ochre' : 'body');
    if (this.s.mode === 'solid') for (let i = 0; i < n; i++) this.detail([{ x: x + i * 5, y: GROUND - i * rise - 0.4 }, { x: x + w - i * 5, y: GROUND - i * rise - 0.4 }], 0.5);
    return GROUND - n * rise;
  }

  basket(x: number): number {
    this.poly([{ x: x - 7, y: GROUND - 9 }, { x: x + 7, y: GROUND - 9 }, { x: x + 5, y: GROUND }, { x: x - 5, y: GROUND }], 'ochre');
    for (let i = -4; i <= 4; i += 3) this.detail([{ x: x + i, y: GROUND - 8 }, { x: x + i * 0.7, y: GROUND - 1 }], 0.5);
    return GROUND - 9;
  }

  gate(x: number, h = 34): void {
    this.rect(x - 9, GROUND - h, 3.5, h, this.s.mode === 'outline' ? 'ochre' : 'body');
    this.rect(x + 5.5, GROUND - h, 3.5, h, this.s.mode === 'outline' ? 'ochre' : 'body');
    this.rect(x - 11, GROUND - h - 3, 22, 3.5, this.s.mode === 'outline' ? 'ochre' : 'body');
  }

  /** Landscape: on the pots only its outline (a filled hill would swallow the figures, which share its colour). */
  land(path: (g: CanvasRenderingContext2D) => void): void {
    if (this.s.mode !== 'solid') return this.shape(path, this.s.mode === 'outline' ? 'ochre' : 'body');
    const g = this.g;
    g.beginPath();
    path(g);
    g.strokeStyle = this.c('body');
    g.lineWidth = 1.1;
    g.stroke();
  }

  hills(y: number, x0 = 0, x1 = PW): void {
    this.land((g) => {
      g.moveTo(x0, GROUND);
      g.lineTo(x0, y);
      for (let x = x0; x < x1; x += 20) g.quadraticCurveTo(x + 10, y - 10, x + 20, y);
      g.lineTo(x1, GROUND);
      g.closePath();
    });
  }

  mountain(x0: number, x1: number, peak: number): void {
    this.land((g) => { g.moveTo(x0, GROUND); g.lineTo((x0 + x1) / 2, peak); g.lineTo(x1, GROUND); });
  }

  slope(): void {
    this.land((g) => { g.moveTo(0, GROUND); g.lineTo(PW, 18); g.lineTo(PW, GROUND); });
  }

  altar(x: number): void {
    this.rect(x - 9, GROUND - 13, 18, 13, this.s.mode === 'outline' ? 'white' : 'body');
    this.rect(x - 11, GROUND - 15, 22, 3, this.s.mode === 'outline' ? 'white' : 'body');
    // Horns at the corners.
    this.line([{ x: x - 9, y: GROUND - 15 }, { x: x - 10, y: GROUND - 18 }], this.s.mode === 'outline' ? 'line' : 'body', 1.2);
    this.line([{ x: x + 9, y: GROUND - 15 }, { x: x + 10, y: GROUND - 18 }], this.s.mode === 'outline' ? 'line' : 'body', 1.2);
    this.detail([{ x: x - 7, y: GROUND - 8 }, { x: x + 7, y: GROUND - 8 }], 0.5);
  }

  bull(x: number, dir: 1 | -1, rope = false): Pt {
    const y = GROUND;
    this.shape((g) => g.ellipse(x, y - 16, 14, 7, 0, 0, Math.PI * 2), 'body');
    for (const lx of [-9, -5, 6, 10]) this.line([{ x: x + lx, y: y - 12 }, { x: x + lx + (lx % 2 ? 2 : -2), y }], 'body', 1.8);
    const hx = x + dir * 15;
    this.shape((g) => g.ellipse(hx, y - 19, 5, 4, dir * 0.4, 0, Math.PI * 2), 'body');
    this.line([{ x: hx, y: y - 22 }, { x: hx - dir * 2, y: y - 28 }, { x: hx + dir * 3, y: y - 29 }], this.s.mode === 'solid' ? 'white' : 'body', 1);
    this.line([{ x: x - dir * 14, y: y - 18 }, { x: x - dir * 19, y: y - 10 }], 'body', 0.9);
    this.detail([{ x: x - 6, y: y - 18 }, { x: x + 6, y: y - 18 }], 0.5);
    this.circle(hx + dir * 1.5, y - 20, 0.6, 'line');
    const horn = { x: hx - dir * 1, y: y - 25 };
    if (rope) this.line([horn, { x: horn.x - dir * 10, y: horn.y - 6 }, { x: horn.x - dir * 18, y: horn.y - 3 }], 'red', 0.8);
    return horn;
  }

  disk(x: number, y: number, r: number): void {
    this.circle(x, y, r, this.s.mode === 'outline' ? 'white' : 'body');
    const pts: Pt[] = [];
    for (let a = 0; a < Math.PI * 7; a += 0.3) {
      const rr = r * (1 - a / (Math.PI * 7.5));
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
    }
    this.detail(pts, 0.5);
  }

  lamp(x: number, lit: boolean): void {
    this.shape((g) => g.ellipse(x, GROUND - 2, 4, 2, 0, 0, Math.PI * 2), 'body');
    if (lit) this.flames(x + 3, GROUND - 3, 4, 1);
    else this.line([{ x: x + 3, y: GROUND - 4 }, { x: x + 4, y: GROUND - 9 }, { x: x + 2, y: GROUND - 13 }], 'line', 0.4);
  }

  tablets(p: Pt, n = 3): void {
    for (let i = 0; i < n; i++) this.rect(p.x - 4, p.y - 3 - i * 2.4, 8, 2.2, this.s.mode === 'outline' ? 'ochre' : 'white');
  }

  starTable(x: number, y: number, s: number, role: Role = 'white'): void {
    this.rect(x - s / 2, y - s / 2, s, s, role);
    for (let i = 1; i < 3; i++) {
      this.detail([{ x: x - s / 2 + (s * i) / 3, y: y - s / 2 }, { x: x - s / 2 + (s * i) / 3, y: y + s / 2 }], 0.4);
      this.detail([{ x: x - s / 2, y: y - s / 2 + (s * i) / 3 }, { x: x + s / 2, y: y - s / 2 + (s * i) / 3 }], 0.4);
    }
  }

  lyre(p: Pt): void {
    this.line([{ x: p.x - 3, y: p.y + 4 }, { x: p.x - 4, y: p.y - 6 }], 'white', 1);
    this.line([{ x: p.x + 3, y: p.y + 4 }, { x: p.x + 4, y: p.y - 6 }], 'white', 1);
    this.line([{ x: p.x - 5, y: p.y - 6 }, { x: p.x + 5, y: p.y - 6 }], 'white', 1);
    this.shape((g) => g.ellipse(p.x, p.y + 4, 4, 2.2, 0, 0, Math.PI * 2), 'white');
    for (const sx of [-1.5, 0, 1.5]) this.detail([{ x: p.x + sx, y: p.y - 6 }, { x: p.x + sx, y: p.y + 3 }], 0.3);
  }

  purse(p: Pt): void {
    this.shape((g) => { g.ellipse(p.x, p.y + 2, 3, 3.4, 0, 0, Math.PI * 2); }, 'red');
    this.line([{ x: p.x - 1.5, y: p.y - 1.5 }, { x: p.x + 1.5, y: p.y - 1.5 }], 'line', 0.5);
  }

  slab(x: number, broken: boolean): void {
    const role: Role = this.s.mode === 'outline' ? 'white' : 'body';
    if (!broken) {
      this.rect(x - 7, GROUND - 42, 14, 42, role);
      for (let y = GROUND - 38; y < GROUND - 4; y += 5) this.detail([{ x: x - 5, y }, { x: x + 5, y }], 0.4);
      return;
    }
    this.poly([{ x: x - 7, y: GROUND }, { x: x + 7, y: GROUND }, { x: x + 7, y: GROUND - 16 }, { x: x + 1, y: GROUND - 20 }, { x: x - 7, y: GROUND - 14 }], role);
    this.poly([{ x: x + 10, y: GROUND }, { x: x + 34, y: GROUND - 6 }, { x: x + 32, y: GROUND - 13 }, { x: x + 9, y: GROUND - 6 }], role);
    this.poly([{ x: x - 20, y: GROUND }, { x: x - 11, y: GROUND - 5 }, { x: x - 9, y: GROUND }], role);
  }

  hammer(p: Pt, up = true): void {
    const head = { x: p.x + 1, y: p.y + (up ? -8 : 8) };
    this.line([p, head], 'body', 1);
    this.rect(head.x - 3, head.y - 2, 6, 4, 'body');
  }

  knife(p: Pt, dir: 1 | -1): void {
    this.line([p, { x: p.x + dir * 7, y: p.y - 3 }], this.s.mode === 'solid' ? 'white' : 'line', 1);
  }

  calendarStone(x: number, y: number, r: number): void {
    this.circle(x, y, r, this.s.mode === 'outline' ? 'white' : 'body');
    this.shape((g) => g.arc(x, y, r * 0.55, 0, Math.PI * 2), this.s.mode === 'outline' ? 'ochre' : 'body');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.detail([{ x: x + Math.cos(a) * r * 0.62, y: y + Math.sin(a) * r * 0.62 }, { x: x + Math.cos(a) * r * 0.92, y: y + Math.sin(a) * r * 0.92 }], 0.5);
    }
    this.detail([{ x: x - r * 0.25, y: y - r * 0.1 }, { x: x + r * 0.25, y: y - r * 0.1 }, { x: x + r * 0.2, y: y + r * 0.2 }], 0.6);
  }

  building(x0: number, x1: number, h: number): void {
    const role: Role = this.s.mode === 'outline' ? 'white' : 'body';
    const w = x1 - x0;
    this.poly([{ x: x0 - 2, y: GROUND - h }, { x: (x0 + x1) / 2, y: GROUND - h - 9 }, { x: x1 + 2, y: GROUND - h }], role);
    this.rect(x0 - 2, GROUND - h, w + 4, 3, role);
    for (let i = 0; i <= 4; i++) this.rect(x0 + (w * i) / 4 - 1.2, GROUND - h + 3, 2.4, h - 3, role);
    this.rect(x0 - 3, GROUND - 2, w + 6, 2, role);
  }

  houses(n = 4): void {
    const role: Role = this.s.mode === 'outline' ? 'white' : 'body';
    for (let i = 0; i < n; i++) {
      const x = 10 + i * (PW - 20) / n;
      const w = (PW - 20) / n - 6;
      const h = 14 + (i % 2) * 6;
      this.rect(x, GROUND - h, w, h, role);
      this.poly([{ x: x - 2, y: GROUND - h }, { x: x + w / 2, y: GROUND - h - 6 }, { x: x + w + 2, y: GROUND - h }], this.s.mode === 'outline' ? 'red' : role);
      this.rect(x + w / 2 - 1.5, GROUND - 6, 3, 6, 'line');
    }
  }

  desk(x: number): Pt {
    const role: Role = this.s.mode === 'outline' ? 'ochre' : 'body';
    this.rect(x - 12, GROUND - 14, 24, 2.5, role);
    this.line([{ x: x - 10, y: GROUND - 12 }, { x: x - 10, y: GROUND }], role, 1.2);
    this.line([{ x: x + 10, y: GROUND - 12 }, { x: x + 10, y: GROUND }], role, 1.2);
    return { x, y: GROUND - 14 };
  }

  sun(x: number, y: number, r: number, rising = false): void {
    this.shape((g) => (rising ? g.arc(x, y, r, Math.PI, 0) : g.arc(x, y, r, 0, Math.PI * 2)), this.s.mode === 'outline' ? 'ochre' : 'white');
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      this.line([{ x: x + Math.cos(a) * (r + 2), y: y + Math.sin(a) * (r + 2) }, { x: x + Math.cos(a) * (r + 5), y: y + Math.sin(a) * (r + 5) }], this.s.mode === 'outline' ? 'ochre' : 'white', 0.6);
    }
  }

  crack(x: number): void {
    const pts: Pt[] = [];
    let cx = x;
    for (let y = 2; y <= PH - 2; y += 7) {
      pts.push({ x: cx, y });
      cx += (this.rand() - 0.5) * 12;
    }
    this.line(pts, this.s.mode === 'scratch' ? 'line' : 'ground', 2.6);
    this.line(pts, 'line', 0.6);
  }

  mark(x: number, y: number, r: number): void {
    this.shape((g) => g.arc(x, y, r, 0, Math.PI * 2), 'white');
    this.shape((g) => g.arc(x, y, r * 0.7, 0, Math.PI * 2), this.s.mode === 'scratch' ? 'line' : 'ground');
    this.line([{ x: x - r * 0.75, y: y + r * 0.75 }, { x: x + r * 0.75, y: y - r * 0.75 }], 'white', r * 0.3);
  }

  stones(target: Pt, n = 10): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 1.6 + Math.PI * 1.2 + (this.rand() - 0.5) * 0.3;
      const d = 16 + this.rand() * 12;
      const p = { x: target.x + Math.cos(a) * d, y: target.y + Math.sin(a) * d * 0.8 };
      this.circle(p.x, p.y, 1.6, this.s.mode === 'outline' ? 'line' : 'white');
      this.line([p, { x: p.x + Math.cos(a) * 5, y: p.y + Math.sin(a) * 4 }], this.s.mode === 'outline' ? 'line' : 'white', 0.5);
    }
  }

  notes(x: number, y: number): void {
    // Six notches: low, lower, high, low, lower, high.
    const h = [4, 7, 0, 4, 7, 0];
    h.forEach((dy, i) => this.line([{ x: x + i * 6, y: y + dy }, { x: x + i * 6, y: y + dy + 4 }], this.s.mode === 'outline' ? 'line' : 'white', 1.1));
  }

  coins(x: number): void {
    this.shape((g) => g.ellipse(x, GROUND - 2, 5, 2.2, 0, 0, Math.PI), 'body');
    for (const dx of [-2, 0, 2]) this.circle(x + dx, GROUND - 3, 0.9, this.s.mode === 'outline' ? 'ochre' : 'white');
  }
}

// ─── Scenes: what he tried ───

type Scene = (p: Painter) => void;

const ATTEMPT_SCENES: Record<string, Scene> = {
  quenched_fire: (p) => {
    p.tripod(110, GROUND);
    p.flames(110, GROUND - 17, 9);
    const s = p.figure({ x: 62, armF: 112, armB: 40 });
    p.jug(s.hand, 1.4);
    p.drops({ x: s.hand.x + 4, y: s.hand.y + 2 }, { x: 108, y: GROUND - 20 }, 6);
  },
  spoke_first: (p) => {
    const top = p.steps(46, 104);
    p.figure({ x: 76, y: top, armF: 165, mouth: true });
    p.figure({ x: 108, y: top, h: 52, dir: -1, armF: 165 });
    p.crowd(6, 40, 3, { h: 26, dir: 1 });
  },
  warned_city: (p) => {
    const top = p.basket(80);
    p.figure({ x: 80, y: top, armF: 160, armB: 160, mouth: true });
    p.crowd(6, 60, 3, { h: 26, mouth: true, dir: 1 });
    p.crowd(100, 156, 3, { h: 26, mouth: true, dir: -1 });
  },
  fled_city: (p) => {
    p.hills(58, 40, 160);
    p.gate(20);
    const s = p.figure({ x: 96, armF: 30, armB: 150, step: 0.16 });
    p.line([s.back, { x: s.back.x - 10, y: s.back.y - 4 }], 'body', 0.9);
    p.circle(s.back.x - 11, s.back.y - 3, 3.2, 'ochre');
  },
  killed_priest: (p) => {
    p.altar(128);
    p.figure({ x: 102, dir: -1, fall: 0.7, robe: 'white', armF: 150, armB: 120 });
    const s = p.figure({ x: 64, armF: 100, armB: 30 });
    p.knife(s.hand, 1);
  },
  moved_date: (p) => {
    p.calendarStone(108, 62, 22);
    const s = p.figure({ x: 62, armF: 100, armB: 60 });
    p.line([s.hand, { x: s.hand.x + 8, y: s.hand.y - 2 }], 'white', 0.9);
  },
  burned_stele: (p) => {
    p.slab(108, true);
    const s = p.figure({ x: 70, armF: 165, armB: 150 });
    p.hammer(s.hand, true);
  },
  wrote_other_line: (p) => {
    p.mountain(96, 158, 30);
    p.figure({ x: 127, y: 38, h: 16, dir: -1, armF: 110, robe: 'white' });
    const d = p.desk(52);
    p.tablets({ x: d.x + 4, y: d.y }, 1);
    p.lamp(30, true);
    p.figure({ x: 40, sit: true, armF: 80, h: 40 });
  },
  refused_sacrifice: (p) => {
    p.altar(24);
    p.bull(128, -1);
    p.figure({ x: 76, armF: 92, armB: 92, mouth: true });
  },
  carried_tablets: (p) => {
    p.building(14, 64, 34);
    p.flames(26, GROUND - 42, 9);
    p.flames(52, GROUND - 42, 10);
    const s = p.figure({ x: 108, armF: 70, armB: 70, step: 0.14 });
    p.tablets({ x: s.hand.x + 2, y: s.hand.y + 1 }, 4);
  },
  sang_early: (p) => {
    const s = p.figure({ x: 70, armF: 70, armB: 30, mouth: true });
    p.lyre({ x: s.hand.x + 2, y: s.hand.y - 2 });
    p.notes(88, 14);
  },
  took_the_offer: (p) => {
    p.figure({ x: 66, armF: 80 });
    p.figure({ x: 94, dir: -1, armF: 80, blank: true, robe: 'ochre' });
  },
  hid_in_hall: (p) => {
    p.disk(80, 48, 36);
    p.figure({ x: 130, sit: true, h: 30, dir: -1, armF: 40, armB: 20, eyes: 'shut' });
    p.lamp(144, false);
  },
  bribed_priest: (p) => {
    const s = p.figure({ x: 64, armF: 88 });
    p.purse({ x: s.hand.x + 3, y: s.hand.y - 1 });
    p.figure({ x: 98, dir: -1, robe: 'white', armF: 70 });
  },
  burned_tables: (p) => {
    p.tripod(110, GROUND);
    p.flames(110, GROUND - 17, 10);
    p.starTable(112, GROUND - 32, 8, 'white');
    const s = p.figure({ x: 66, armF: 95 });
    p.starTable(s.hand.x + 5, s.hand.y, 8, 'white');
  },
  blinded_himself: (p) => {
    const s = p.figure({ x: 76, armF: 158, armB: 150 });
    p.line([{ x: s.head.x + 2, y: s.head.y + 2 }, { x: s.head.x + 2.5, y: s.head.y + 12 }], 'red', 0.9);
    p.line([{ x: s.head.x - 1, y: s.head.y + 2 }, { x: s.head.x - 1, y: s.head.y + 11 }], 'red', 0.9);
    p.starTable(118, GROUND - 2, 10, p.s.mode === 'outline' ? 'white' : 'body');
  },
  freed_bull: (p) => {
    p.slope();
    const s = p.figure({ x: 142, y: 28, h: 26, dir: -1, armF: 100 });
    const horn = p.bull(46, -1);
    p.line([s.hand, { x: 110, y: 50 }, { x: horn.x + 18, y: horn.y - 4 }], 'red', 0.8);
    p.line([horn, { x: horn.x + 8, y: horn.y - 6 }], 'red', 0.8);
  },
  taught_children: (p) => {
    p.steps(4, 40, 1, 7);
    const s = p.figure({ x: 26, y: GROUND - 7, sit: true, armF: 120, h: 38 });
    p.line([s.hand, { x: s.hand.x + 10, y: GROUND }], 'white', 0.8);
    p.line([{ x: 52, y: GROUND - 1 }, { x: 150, y: GROUND - 1 }], 'white', 0.9);
    for (let i = 0; i < 5; i++) p.figure({ x: 62 + i * 19, h: 20, dir: -1, sit: true, armF: 30 });
  },
};

// ─── Scenes: how it ended ───

const FATE_SCENES: Record<string, Scene> = {
  flood: (p) => {
    p.crowd(10, 150, 6, { h: 34, armF: 160, armB: 150 });
    p.water(62);
  },
  fire: (p) => {
    p.houses(4);
    for (let i = 0; i < 7; i++) {
      const x = 10 + i * 23;
      p.shape((g) => { g.moveTo(x - 10, 0); g.quadraticCurveTo(x - 4, 30 + (i % 3) * 8, x + 2, 44 + (i % 2) * 8); g.quadraticCurveTo(x + 6, 24, x + 12, 0); g.closePath(); }, 'red');
    }
  },
  earthquake: (p) => {
    p.houses(4);
    p.figure({ x: 62, armF: 140, armB: 150, mouth: true });
    p.crack(80);
  },
  judged_possessed: (p) => {
    const woman = p.figure({ x: 30, armF: 150, robe: p.s.mode === 'outline' ? 'red' : 'body' });
    p.line([woman.hand, { x: woman.hand.x + 2, y: woman.hand.y - 4 }], 'body', 0.6);
    p.line([woman.hand, { x: woman.hand.x + 4, y: woman.hand.y - 3 }], 'body', 0.6);
    p.figure({ x: 96, dir: -1, armF: 100, armB: 60 });
    p.figure({ x: 84, armF: 60, armB: 60, mouth: true, eyes: 'open' });
    p.figure({ x: 72, dir: 1, armF: 100, armB: 60 });
  },
  stoned: (p) => {
    p.mountain(40, 160, 20);
    const s = p.figure({ x: 90, armF: 170, armB: 165, fall: 0.25 });
    p.stones({ x: s.head.x, y: s.head.y + 8 }, 12);
  },
  laughed_at: (p) => {
    p.crowd(8, 152, 6, { h: 34, back: true, mouth: true, armF: 70, armB: 40 });
    p.rain(112, 2, 44, 24);
  },
  walked_back: (p) => {
    p.hills(62, 0, 160);
    p.gate(128);
    const s = p.figure({ x: 104, armF: 30, armB: 150, step: 0.16 });
    for (let i = 0; i < 6; i++) p.circle(s.hand.x - 20 - i * 4, GROUND - 2 - (i % 2), 0.8, 'white');
  },
  made_singer: (p) => {
    const top = p.steps(30, 90, 2, 5);
    const s = p.figure({ x: 66, y: top, sit: true, h: 40, armF: 70, eyes: 'shut', mouth: true });
    p.lyre({ x: s.hand.x + 3, y: s.hand.y - 2 });
    p.coins(96);
  },
  woke_again: (p) => {
    p.sun(30, GROUND - 1, 14, true);
    const d = p.desk(104);
    p.tablets({ x: d.x + 3, y: d.y }, 2);
    p.figure({ x: 90, sit: true, h: 40, armF: 150, armB: 40 });
  },
  vanished: (p) => {
    p.figure({ x: 34, h: 30, armF: 10 });
    p.mark(96, 56, 14);
  },
  forgotten: (p) => {
    const d = p.desk(60);
    p.tablets({ x: d.x, y: d.y }, 2);
    p.figure({ x: 48, sit: true, h: 40, ghost: true });
    p.figure({ x: 128, dir: -1, h: 34, step: 0.14, armF: 40 });
  },
};

/** The border of a panel, in each craft's manner. */
function frame(p: Painter): void {
  const g = p.g;
  if (p.s.mode === 'scratch') {
    // Stone: a few stray scratches and grain.
    for (let i = 0; i < 90; i++) {
      g.fillStyle = p.s.extra[0]!;
      g.fillRect(p.rand() * PW, p.rand() * PH, 1, 1);
    }
    return;
  }
  if (p.s.mode === 'outline') {
    // Plaster bands, and hairline cracks.
    g.fillStyle = p.c('water');
    g.fillRect(0, 0, PW, 3);
    g.fillStyle = p.c('red');
    g.fillRect(0, PH - 4, PW, 4);
    g.strokeStyle = p.s.extra[0]!;
    g.lineWidth = 0.4;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      let x = p.rand() * PW;
      let y = p.rand() * PH;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) g.lineTo((x += (p.rand() - 0.5) * 16), (y += (p.rand() - 0.2) * 10));
      g.stroke();
    }
    return;
  }
  // The pots: a meander band under the scene, a key pattern at the lip.
  const band = p.s.colors.body === LACQUER ? LACQUER : TERRACOTTA;
  g.fillStyle = band;
  g.fillRect(0, GROUND + 3, PW, PH - GROUND - 3);
  g.strokeStyle = p.s.colors.ground;
  g.lineWidth = 0.7;
  g.beginPath();
  for (let x = 2; x < PW - 6; x += 8) {
    const y = GROUND + 5;
    g.moveTo(x, y + 5);
    g.lineTo(x, y);
    g.lineTo(x + 6, y);
    g.lineTo(x + 6, y + 4);
    g.lineTo(x + 2, y + 4);
    g.lineTo(x + 2, y + 2);
    g.lineTo(x + 4, y + 2);
  }
  g.stroke();
  g.fillStyle = band;
  g.fillRect(0, 0, PW, 2);
}

/** Snap every pixel to the style's colours, so no painted edge turns into a new colour. */
function quantize(g: CanvasRenderingContext2D, w: number, h: number, colors: string[]): void {
  const pal = colors.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < pal.length; k++) {
      const c = pal[k]!;
      const dd = (d[i]! - c[0]) ** 2 + (d[i + 1]! - c[1]) ** 2 + (d[i + 2]! - c[2]) ** 2;
      if (dd < bestD) { bestD = dd; best = k; }
    }
    const c = pal[best]!;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

/** The ring's craft, for the card's caption. */
export const CRAFTS = ['black-figure, the latest hand', 'red-figure', 'fresco on plaster', 'scratched into the stone, the oldest'];

/** Both panels of a past Leont's carving: what he tried, then how it ended. */
export function carvingCanvas(leont: PastLeont): HTMLCanvasElement {
  const style = STYLES[Math.min(leont.ring, STYLES.length - 1)]!;
  const canvas = document.createElement('canvas');
  const W = PW * 2 + GAP;
  canvas.width = W * SCALE;
  canvas.height = PH * SCALE;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const rand = seededRng(daySeed(`eferon/carving/${leont.id}`));
  g.fillStyle = style.mode === 'solid' ? LACQUER : style.colors.ground;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const scenes = [ATTEMPT_SCENES[leont.attempt], FATE_SCENES[leont.fate]];
  scenes.forEach((scene, i) => {
    g.save();
    g.scale(SCALE, SCALE);
    g.translate(i * (PW + GAP), 0);
    g.beginPath();
    g.rect(0, 0, PW, PH);
    g.clip();
    g.fillStyle = style.colors.ground;
    g.fillRect(0, 0, PW, PH);
    const p = new Painter(g, style, rand);
    frame(p);
    if (style.mode !== 'solid') p.groundLine();
    scene?.(p);
    if (style.mode === 'solid') p.groundLine();
    g.restore();
  });
  // Between the panels: the clay (or the stone) left plain.
  quantize(g, canvas.width, canvas.height, [...new Set([...Object.values(style.colors), ...style.extra, LACQUER])]);
  return canvas;
}
