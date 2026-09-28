// What changes as the last day runs out: the nameless crowd and its torches, the line of fire
// climbing the holy mountain, the storm with a face that sinks over it, and the wind in the
// streets. All of it is a function of the clock (and the wind the player raised), never chance.
import * as THREE from 'three';
import { extraAt, makeCrowd, type Extra } from '../../content/crowd.ts';
import { daySeed, seededRng } from '../../core/rng.ts';
import { amphora, bob, giveWay, lambert, makeFigure } from '../figures.ts';

const smooth = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

/** Progress of the day (0 at dawn, 1 at midnight) for a clock hour. */
const P = (hour: number) => (hour - 6) / 18;

export class Crowd {
  private people: { extra: Extra; figure: THREE.Group; torch: THREE.Object3D }[] = [];
  /** Two real lights carried at the head of the procession; the other torches only glow. */
  private lights = [new THREE.PointLight('#ffb25a', 0, 10, 1.3), new THREE.PointLight('#ffb25a', 0, 10, 1.3)];

  constructor(scene: THREE.Scene, patches: string[]) {
    const fire = new THREE.MeshBasicMaterial({ color: '#ffd68c' });
    const wood = lambert('#2a1a12');
    for (const extra of makeCrowd(patches)) {
      const figure = makeFigure(extra.color, extra.height);
      if (extra.role === 'water') {
        // A water jar carried on the head.
        const jar = amphora('#8f4a2a');
        jar.scale.setScalar(0.6);
        jar.position.y = extra.height * 0.93;
        figure.add(jar);
      }
      const torch = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 4), wood);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 5), fire);
      flame.position.y = 0.6;
      torch.add(stick, flame);
      torch.position.set(0.28, extra.height * 0.72, 0.1);
      torch.visible = false;
      figure.add(torch);
      scene.add(figure);
      this.people.push({ extra, figure, torch });
    }
    for (const l of this.lights) scene.add(l);
  }

  /** `stutter`: the visible person nearest (x, z) is shown at `minute` instead: the same steps, again. */
  /** Adds where every visible extra stands to `out`. */
  positions(out: { x: number; z: number }[]): void {
    for (const { figure } of this.people) if (figure.visible) out.push({ x: figure.position.x, z: figure.position.z });
  }

  /** `avoid`: the scribe, whom walkers step round. */
  update(minute: number, time: number, lit: number, stutter?: { x: number; z: number; minute: number }, avoid?: THREE.Vector3): void {
    let lightIndex = 0;
    let stuck: Extra | null = null;
    if (stutter) {
      let best = 30;
      for (const { extra } of this.people) {
        const s = extraAt(extra, minute);
        const d = Math.hypot(s.x - stutter.x, s.z - stutter.z);
        if (s.visible && d < best) {
          best = d;
          stuck = extra;
        }
      }
    }
    for (const { extra, figure, torch } of this.people) {
      const s = extraAt(extra, extra === stuck && stutter ? stutter.minute : minute);
      figure.visible = s.visible;
      if (!s.visible) continue;
      figure.position.set(s.x, 0, s.z);
      if (avoid && s.walking) giveWay(figure.position, avoid);
      figure.rotation.y = s.heading;
      bob(figure, time, s.walking ? 1 : 0);
      torch.visible = s.torch;
      if (s.torch) {
        const flame = torch.children[1]!;
        flame.scale.y = 0.8 + 0.35 * Math.abs(Math.sin(time * 9 + s.x));
        const light = this.lights[lightIndex];
        if (light) {
          light.position.set(s.x, 2.4, s.z);
          light.intensity = 14 * lit;
          lightIndex++;
        }
      }
    }
    for (let i = lightIndex; i < this.lights.length; i++) this.lights[i]!.intensity = 0;
  }
}

/** Torches climbing the mountain in a zigzag: the procession, seen from below. */
export class MountainLights {
  private flames: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, mountain: { x: number; z: number; radius: number; height: number }) {
    const fire = new THREE.MeshBasicMaterial({ color: '#ffe0a0' });
    const n = 36;
    for (let k = 0; k < n; k++) {
      const y = (k / n) * mountain.height * 0.92;
      const r = mountain.radius * (1 - y / mountain.height) + 0.6;
      const a = Math.PI / 2 + 0.38 * Math.sin(k * 0.8);
      const flame = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.55), fire);
      flame.position.set(mountain.x + Math.cos(a) * r, y + 0.6, mountain.z + Math.sin(a) * r);
      flame.visible = false;
      scene.add(flame);
      this.flames.push(flame);
    }
  }

  update(progress: number, time: number): void {
    this.flames.forEach((f, k) => {
      // The head of the line leaves the gate a little after nine and reaches the top near midnight.
      const lit = progress > P(21.2) + (k / this.flames.length) * (P(23.6) - P(21.2));
      f.visible = lit && Math.sin(time * 5 + k * 1.9) > -0.85;
    });
  }
}

/**
 * The storm that ends the age. It gathers high over the mountain in the morning and sinks all
 * day; in the afternoon its eyes begin to open under heavy brows, and near midnight it grins —
 * a mouth full of teeth, wider every minute, lit from inside by lightning. The eyes follow the
 * scribe. The Curator can patch the face out (`cloud_smooth`), not the storm.
 */
export class StormFace {
  readonly group = new THREE.Group();
  private eyes: { white: THREE.Mesh; pupil: THREE.Mesh; lid: THREE.Mesh }[] = [];
  private brows: THREE.Mesh[] = [];
  private mouth: THREE.Group | null = null;
  private flash = new THREE.PointLight('#fff2d0', 0, 90, 1);
  /** A low glow that reaches the billows and the face, not the city. */
  private glow = new THREE.PointLight('#ffd9a8', 0, 26, 1);

  constructor(scene: THREE.Scene, smoothFace: boolean) {
    this.buildCloud();
    this.flash.position.set(0, -2, 18);
    this.glow.position.set(0, 0, 20);
    this.group.add(this.flash, this.glow);
    scene.add(this.group);
    if (!smoothFace) this.buildFace();
  }

  /** Three layers of billows: a dark core, lighter rolls along the rims, torn wisps trailing under it. */
  private buildCloud(): void {
    const rand = seededRng(daySeed('eferon/cloud/v2'));
    const core = lambert('#261e1a');
    const mid = lambert('#3b2a22');
    const rim = lambert('#6b4a38');
    const puff = (r: number, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, 1);
      m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      this.group.add(m);
    };
    for (let i = 0; i < 14; i++) puff(5 + rand() * 4, core, (rand() - 0.5) * 36, (rand() - 0.5) * 8, -2 + rand() * 4);
    for (let i = 0; i < 16; i++) puff(3 + rand() * 2.5, mid, (rand() - 0.5) * 40, (rand() - 0.5) * 12, 2 + rand() * 3);
    // Rolls along the top and bottom edges catch what light there is.
    for (let i = 0; i < 12; i++) {
      const x = -19 + i * 3.4 + (rand() - 0.5) * 2;
      const top = 6 + Math.cos((x / 22) * Math.PI) * 3;
      puff(1.8 + rand() * 1.4, rim, x, top + rand() * 1.5, 4 + rand() * 2);
      puff(1.6 + rand() * 1.2, rim, x + 1.5, -6.5 - rand() * 1.5, 4 + rand() * 2.5);
    }
    // Wisps torn off underneath, hanging towards the city.
    for (let i = 0; i < 7; i++) puff(1.4, mid, (rand() - 0.5) * 30, -9 - rand() * 3, 3 + rand() * 2, 3 + rand() * 2, 0.45);
  }

  private buildFace(): void {
    const bone = new THREE.MeshBasicMaterial({ color: '#f5e9c8' });
    const black = new THREE.MeshBasicMaterial({ color: '#0d0b09' });
    const fold = lambert('#7a5440');
    for (const side of [-1, 1]) {
      const x = side * 4.6;
      const white = new THREE.Mesh(new THREE.SphereGeometry(1.9, 14, 10), bone);
      white.position.set(x, 1.6, 13.5);
      white.scale.set(1.25, 0.05, 0.6);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), black);
      pupil.position.set(x, 1.6, 14.5);
      // A heavy lid and a bag under each eye: folds of the cloud itself.
      const lid = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.45, 5, 14, Math.PI), fold);
      lid.position.set(x, 1.6, 13.9);
      lid.scale.set(1.05, 0.5, 0.6);
      const bag = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.35, 5, 12, Math.PI * 0.8), fold);
      bag.position.set(x, 0.7, 13.7);
      bag.rotation.z = Math.PI * 1.1;
      bag.scale.set(1, 0.45, 0.6);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.9, 1.2), fold);
      brow.position.set(x - side * 0.2, 4.1, 13.6);
      this.group.add(white, pupil, lid, bag, brow);
      this.eyes.push({ white, pupil, lid });
      this.brows.push(brow);
    }
    // A blunt nose between them.
    const nose = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), lambert('#4a3428'));
    nose.position.set(0, -0.2, 14.2);
    nose.scale.set(0.8, 1.2, 0.8);
    this.group.add(nose);
    this.mouth = grin();
    this.mouth.position.set(0, -2.6, 14);
    this.mouth.visible = false;
    this.group.add(this.mouth);
  }

  update(progress: number, player: THREE.Vector3, time = 0): void {
    // Over the mountain by day; in the last hours it drifts to hang over wherever the scribe is.
    const follow = smooth(progress, P(20), P(23));
    this.group.position.set(lerp(-6, player.x, follow * 0.85), lerp(60, 14.5, Math.pow(progress, 1.3)), lerp(-72, -46, progress * progress));
    const open = smooth(progress, P(15), P(23));
    const anger = smooth(progress, P(20), P(23.5));
    this.eyes.forEach(({ white, pupil, lid }, i) => {
      white.scale.y = lerp(0.05, 0.78, open);
      lid.scale.y = lerp(0.2, 0.55, open);
      pupil.visible = open > 0.2;
      // Look at the scribe: the pupils slide across the whites towards him.
      const dx = THREE.MathUtils.clamp((player.x - (this.group.position.x + white.position.x)) * 0.04, -0.8, 0.8);
      pupil.position.x = white.position.x + dx;
      pupil.position.y = white.position.y - 0.3 * open;
      pupil.scale.setScalar(Math.min(1, open * 1.3) * lerp(1, 0.7, anger));
      // The brows come down and in.
      const side = i === 0 ? -1 : 1;
      this.brows[i]!.rotation.z = side * lerp(0.05, 0.42, anger);
      this.brows[i]!.position.y = lerp(4.3, 3.5, anger);
    });
    if (this.mouth) {
      const grinning = smooth(progress, P(21.5), P(23.5));
      this.mouth.visible = grinning > 0.02;
      // Wider, then open: the jaw drops in the last half hour.
      this.mouth.scale.set(lerp(0.45, 1, grinning), lerp(0.35, 1, grinning) * lerp(1, 1.35, smooth(progress, P(23.3), 1)), 1);
    }
    // Lightning inside it in the last hours: rare, fixed by the clock, never random.
    const storm = smooth(progress, P(22), P(23.7));
    const bolt = Math.max(0, Math.sin(time * 1.7) * Math.sin(time * 4.3 + 1.2) - 0.72) * 3.6;
    // Between the bolts a low glow stays in it, so the billows and the brows never quite go out.
    this.glow.intensity = lerp(0, 160, smooth(progress, P(19), P(22)));
    this.flash.intensity = storm * bolt * 650;
  }
}

/** The grin: a dark crescent of mouth between pale lips, with a row of teeth above and below. */
function grin(): THREE.Group {
  const g = new THREE.Group();
  const W = 7.2;
  const upper = (t: number) => 0.95 * t * t - 0.5; // corners pulled up, like the moon's
  const lower = (t: number) => 0.45 - 4.1 * (1 - t * t);
  const curve = (f: (t: number) => number, from: number, to: number, n = 24) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = from + ((to - from) * i) / n;
      return new THREE.Vector2(W * t, f(t));
    });
  const shape = (pts: THREE.Vector2[]) => new THREE.ShapeGeometry(new THREE.Shape(pts));
  const flat = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

  // Lips first (slightly bigger), then the cavity inside them.
  const lipsPts = [...curve((t) => upper(t) + 0.35, -1.04, 1.04), ...curve((t) => lower(t) - 0.35, 1.04, -1.04)];
  g.add(new THREE.Mesh(shape(lipsPts), flat('#c9a27c')));
  const mouth = new THREE.Mesh(shape([...curve(upper, -1, 1), ...curve(lower, 1, -1)]), flat('#0d0b09'));
  mouth.position.z = 0.02;
  g.add(mouth);

  const bone = flat('#f5e9c8');
  const tooth = (t: number, width: number, top: number, length: number, down: boolean) => {
    const x = W * t;
    const d = down ? -1 : 1;
    const pts = [
      new THREE.Vector2(x - width / 2, top + d * -0.05),
      new THREE.Vector2(x + width / 2, top + d * -0.05),
      new THREE.Vector2(x + width * 0.34, top + d * length * 0.8),
      new THREE.Vector2(x, top + d * length),
      new THREE.Vector2(x - width * 0.34, top + d * length * 0.8),
    ];
    const m = new THREE.Mesh(shape(pts), bone);
    m.position.z = 0.04;
    g.add(m);
  };
  // Big square teeth in the middle, smaller towards the corners.
  for (let i = 0; i < 11; i++) {
    const t = -0.86 + (i / 10) * 1.72;
    const size = 1 - 0.55 * t * t;
    tooth(t, 1.05 * size, upper(t), 1.25 * size, true);
  }
  for (let i = 0; i < 10; i++) {
    const t = -0.8 + (i / 9) * 1.6;
    const size = 1 - 0.6 * t * t;
    tooth(t, 1 * size, lower(t), 1.05 * size, false);
  }
  return g;
}

/** Streaks of dust blown down the streets from the mountain. */
export class Dust {
  private mesh: THREE.InstancedMesh;
  private seeds: { x: number; z: number; y: number; speed: number }[] = [];
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const count = 80;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.1, 1.6), new THREE.MeshBasicMaterial({ color: '#efe4c8' }), count);
    this.mesh.count = 0;
    const rand = seededRng(daySeed('eferon/dust'));
    for (let i = 0; i < count; i++) this.seeds.push({ x: rand() * 40 - 20, z: rand() * 40 - 20, y: 0.15 + rand() * 1.6, speed: 7 + rand() * 6 });
    scene.add(this.mesh);
  }

  /** `gust` 0..1: how many streaks there are and how hard they blow. */
  update(time: number, gust: number, around: THREE.Vector3): void {
    const n = Math.floor(this.seeds.length * gust);
    this.mesh.count = n;
    const wrap = (v: number) => ((((v + 20) % 40) + 40) % 40) - 20;
    for (let i = 0; i < n; i++) {
      const s = this.seeds[i]!;
      const travel = time * s.speed * (0.6 + gust);
      this.dummy.position.set(around.x + wrap(s.x + travel * 0.3), s.y, around.z + wrap(s.z + travel));
      this.dummy.rotation.y = Math.atan2(0.3, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
