// The scribe's body: a black-figure man in a knee-length chiton and a red cloak, jointed at the hips,
// knees, shoulders and elbows, so he can walk, run as the runners on the prize amphorae run (leaning
// in, arms pumping, the stride wide), jump, fall, roll, climb, hang, swim, sit and carry a pot over
// his head. The stride is driven by the distance covered, so the feet do not slide. Only the scribe
// has it; everyone else is the painters' robed silhouette (figures.ts).
import * as THREE from 'three';
import { lambert, PAINT } from '../figures.ts';

export type Pose = 'idle' | 'walk' | 'run' | 'air' | 'climb' | 'mantle' | 'swim' | 'sit' | 'roll' | 'land' | 'wade';

export interface BodyInput {
  pose: Pose;
  /** Horizontal speed, m/s. */
  speed: number;
  /** Vertical speed, m/s (in the air). */
  vy: number;
  /** Metres climbed or shimmied this frame (drives the climbing hands). */
  climbed: number;
  /** 0..1 through a mantle or a roll. */
  progress: number;
  carrying: boolean;
  /** Seconds since a throw began (Infinity: none). */
  throwing: number;
  dt: number;
  time: number;
}

const H = 1.7;
const HIP_Y = 0.88;
const THIGH = 0.42;
const SHIN = 0.42;
const UPPER = 0.28;
const FORE = 0.26;

/** A limb segment hanging down from its pivot. */
function limb(len: number, w: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, len, w);
  geo.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Eases a value toward a target, the same at any frame rate. */
const ease = (from: number, to: number, k: number) => from + (to - from) * k;

export class ScribeBody {
  /** The group the stage moves and turns: feet at its origin, facing +z. */
  readonly root = new THREE.Group();
  /** Turns the whole body over (a roll, lying out to swim) about its middle. */
  private tumble: THREE.Group;
  private hips: THREE.Group;
  private spine: THREE.Group;
  readonly head: THREE.Group;
  private shoulder: [THREE.Group, THREE.Group];
  private elbow: [THREE.Group, THREE.Group];
  private thigh: [THREE.Group, THREE.Group];
  private knee: [THREE.Group, THREE.Group];
  private cape: THREE.Group;
  /** The cloak's lower half, bending further than the upper: cloth, not a board. */
  private capeLow: THREE.Group;
  private phase = 0;
  private lastPose: Pose = 'idle';
  /** Feet that just came down while running: the stage raises dust there. */
  footfall = false;

  constructor(color: string) {
    const dark = new THREE.MeshLambertMaterial({ color, flatShading: true });
    this.tumble = pivot(this.root, 0, HIP_Y, 0);
    this.hips = pivot(this.tumble, 0, 0, 0);
    // The chiton's skirt, to the knee, flaring: it hangs from the hips and does not swing with the legs.
    const skirt = new THREE.Mesh(
      new THREE.LatheGeometry([[0.0, -0.4], [0.27, -0.4], [0.22, -0.1], [0.19, 0.08], [0.0, 0.1]].map(([x, y]) => new THREE.Vector2(x!, y!)), 7),
      dark,
    );
    skirt.castShadow = true;
    this.hips.add(skirt);
    this.spine = pivot(this.hips, 0, 0.04, 0);
    const torso = new THREE.Mesh(
      new THREE.LatheGeometry([[0.0, 0.0], [0.19, 0.0], [0.2, 0.25], [0.23, 0.45], [0.12, 0.55], [0.0, 0.58]].map(([x, y]) => new THREE.Vector2(x!, y!)), 7),
      dark,
    );
    torso.castShadow = true;
    this.spine.add(torso);
    this.head = pivot(this.spine, 0, 0.62, 0);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(H * 0.1, 0), dark);
    const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(H * 0.07, 0), dark);
    hair.position.set(0, 0.02, -H * 0.06);
    for (const m of [skull, hair]) m.castShadow = true;
    this.head.add(skull, hair);
    const sides = [-1, 1] as const;
    this.shoulder = sides.map((s) => pivot(this.spine, s * 0.23, 0.5, 0)) as [THREE.Group, THREE.Group];
    this.elbow = this.shoulder.map((sh) => {
      sh.add(limb(UPPER, 0.09, dark));
      const e = pivot(sh, 0, -UPPER, 0);
      e.add(limb(FORE, 0.08, dark));
      return e;
    }) as [THREE.Group, THREE.Group];
    this.thigh = sides.map((s) => pivot(this.hips, s * 0.09, -0.02, 0)) as [THREE.Group, THREE.Group];
    this.knee = this.thigh.map((t) => {
      t.add(limb(THIGH, 0.11, dark));
      const k = pivot(t, 0, -THIGH, 0);
      k.add(limb(SHIN, 0.09, dark));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), dark);
      foot.position.set(0, -SHIN + 0.02, 0.05);
      k.add(foot);
      return k;
    }) as [THREE.Group, THREE.Group];
    // The red cloak, pinned at the shoulders: it swings out behind him as he goes faster.
    this.cape = pivot(this.spine, 0, 0.52, -0.2);
    const half = H * 0.28;
    const upper = new THREE.BoxGeometry(H * 0.38, half, H * 0.05);
    upper.translate(0, -half / 2, 0);
    const lower = new THREE.BoxGeometry(H * 0.42, half, H * 0.05);
    lower.translate(0, -half / 2, 0);
    const top = new THREE.Mesh(upper, PAINT.red);
    this.cape.add(top);
    this.capeLow = pivot(this.cape, 0, -half, 0);
    const bottom = new THREE.Mesh(lower, PAINT.red);
    this.capeLow.add(bottom);
    for (const m of [top, bottom]) m.castShadow = true;
    // The wax tablets, under the left arm.
    const tablets = new THREE.Mesh(new THREE.BoxGeometry(H * 0.08, H * 0.24, H * 0.19), PAINT.bone);
    tablets.position.set(0.26, 0.22, 0.02);
    tablets.rotation.z = 0.12;
    this.spine.add(tablets);
    this.root.userData.bobPhase = 0;
  }

  /** Every mesh of the body, for the x-ray copies (which are added beside them, so they move with the joints). */
  meshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.ghost && !o.userData.worn) out.push(o);
    });
    return out;
  }

  update(b: BodyInput): void {
    const k = 1 - Math.exp(-b.dt * (b.pose === 'roll' || b.pose === 'mantle' ? 30 : 14));
    if (b.pose !== this.lastPose && (b.pose === 'climb' || this.lastPose === 'climb')) this.phase = 0;
    this.lastPose = b.pose;
    // Targets for every joint (radians; forward swings are negative about x, knees bend positive).
    let lean = 0.02;
    let hipDrop = 0;
    let bounce = 0;
    let tumble = 0;
    const th: [number, number] = [0, 0];
    const kn: [number, number] = [0.05, 0.05];
    const sh: [number, number] = [0.1, 0.1];
    const shZ: [number, number] = [0.08, -0.08];
    const el: [number, number] = [-0.15, -0.15];
    let capeLift = 0.1 + Math.min(1, b.speed / 9) * 0.65;
    let headTilt = 0;
    this.footfall = false;

    const stride = (len: number) => {
      const before = this.phase;
      this.phase += (b.speed * b.dt * Math.PI * 2) / len;
      // A foot comes down twice a stride.
      if (Math.floor(before / Math.PI) !== Math.floor(this.phase / Math.PI)) this.footfall = true;
    };

    switch (b.pose) {
      case 'idle': {
        const breath = Math.sin(b.time * 1.6);
        lean = 0.02 + breath * 0.01;
        sh[0] = 0.08 + breath * 0.02;
        sh[1] = 0.08 - breath * 0.02;
        break;
      }
      case 'walk':
      case 'wade': {
        stride(b.pose === 'wade' ? 1.1 : 1.45);
        const s = Math.sin(this.phase);
        const amp = b.pose === 'wade' ? 0.35 : 0.5;
        th[0] = -amp * s;
        th[1] = amp * s;
        kn[0] = 0.1 + 0.7 * Math.max(0, Math.sin(this.phase + 1.4));
        kn[1] = 0.1 + 0.7 * Math.max(0, Math.sin(this.phase + 1.4 + Math.PI));
        sh[0] = 0.4 * s;
        sh[1] = -0.4 * s;
        el[0] = el[1] = -0.25;
        lean = 0.06;
        bounce = 0.03 * Math.abs(Math.cos(this.phase));
        break;
      }
      case 'run': {
        // After the runners on the prize amphorae: leaning in, knees high, arms pumping bent at the elbow.
        stride(2.7);
        const s = Math.sin(this.phase);
        th[0] = -1.0 * s - 0.15;
        th[1] = 1.0 * s - 0.15;
        kn[0] = 0.2 + 1.7 * Math.max(0, Math.sin(this.phase + 1.2));
        kn[1] = 0.2 + 1.7 * Math.max(0, Math.sin(this.phase + 1.2 + Math.PI));
        sh[0] = 1.0 * s;
        sh[1] = -1.0 * s;
        el[0] = el[1] = -1.5;
        lean = 0.34;
        hipDrop = 0.05;
        bounce = 0.08 * Math.abs(Math.sin(this.phase));
        headTilt = -0.2;
        break;
      }
      case 'air': {
        if (b.vy > -3) {
          // Going up: knees tucked, arms flung up.
          th[0] = -1.0;
          th[1] = -0.3;
          kn[0] = 1.4;
          kn[1] = 0.8;
          sh[0] = -2.5;
          sh[1] = -2.1;
          el[0] = el[1] = -0.3;
          lean = 0.15;
        } else {
          // Falling: arms out for balance, legs reaching for the ground, the cloak blown up.
          th[0] = -0.4;
          th[1] = 0.25;
          kn[0] = 0.5;
          kn[1] = 0.3;
          sh[0] = sh[1] = -0.6;
          shZ[0] = 1.3;
          shZ[1] = -1.3;
          el[0] = el[1] = -0.2;
          lean = -0.05;
          capeLift = 1.5;
        }
        break;
      }
      case 'land': {
        // A deep crouch that soaks up the fall.
        th[0] = th[1] = -1.0;
        kn[0] = kn[1] = 1.9;
        sh[0] = sh[1] = -0.7;
        el[0] = el[1] = -0.3;
        lean = 0.55;
        hipDrop = 0.34;
        break;
      }
      case 'roll': {
        // Tucked tight, turning head over heels once.
        th[0] = th[1] = -1.6;
        kn[0] = kn[1] = 2.2;
        sh[0] = sh[1] = -1.2;
        el[0] = el[1] = -1.4;
        lean = 0.8;
        hipDrop = 0.35;
        tumble = b.progress * Math.PI * 2;
        break;
      }
      case 'climb': {
        // Hand over hand up the face, the feet pushing on the stones.
        this.phase += (b.climbed * Math.PI * 2) / 0.9;
        const s = Math.sin(this.phase);
        sh[0] = -2.75 + 0.45 * s;
        sh[1] = -2.75 - 0.45 * s;
        el[0] = -0.3 - 0.4 * Math.max(0, -s);
        el[1] = -0.3 - 0.4 * Math.max(0, s);
        th[0] = -0.7 - 0.4 * s;
        th[1] = -0.7 + 0.4 * s;
        kn[0] = 1.1 + 0.3 * s;
        kn[1] = 1.1 - 0.3 * s;
        lean = -0.08;
        headTilt = -0.4;
        capeLift = 0.05;
        break;
      }
      case 'mantle': {
        // Pulling up over the edge: arms high, then pressing down, one knee coming over.
        const p = b.progress;
        const up = p < 0.5;
        sh[0] = sh[1] = up ? -2.9 : ease(-2.9, -0.4, (p - 0.5) * 2);
        el[0] = el[1] = up ? -0.2 : -0.9;
        th[0] = up ? -0.5 : -1.3;
        th[1] = up ? -0.2 : 0.2;
        kn[0] = up ? 0.8 : 1.8;
        kn[1] = 0.5;
        lean = up ? -0.1 : 0.5;
        break;
      }
      case 'swim': {
        // Lying out on the water, a breaststroke: arms sweeping round, legs kicking.
        this.phase += b.dt * (b.speed > 0.3 ? 5 : 2);
        const s = Math.sin(this.phase);
        tumble = 1.25;
        hipDrop = -0.1;
        sh[0] = sh[1] = -2.2 + 0.8 * s;
        shZ[0] = 0.6 + 0.5 * Math.cos(this.phase);
        shZ[1] = -shZ[0];
        el[0] = el[1] = -0.4 - 0.3 * Math.max(0, s);
        th[0] = 0.2 + 0.35 * s;
        th[1] = 0.2 - 0.35 * s;
        kn[0] = kn[1] = 0.5 + 0.3 * Math.max(0, -s);
        headTilt = -1.0;
        // Lying along his back on the water.
        capeLift = -0.05;
        break;
      }
      case 'sit': {
        // Down on the ground, knees up, arms round them.
        th[0] = th[1] = -2.0;
        kn[0] = kn[1] = 2.3;
        sh[0] = sh[1] = -0.9;
        el[0] = el[1] = -0.9;
        lean = 0.25;
        hipDrop = 0.66;
        break;
      }
    }
    // A pot held up over the head with both hands; a throw brings the right arm over.
    if (b.carrying && b.pose !== 'climb' && b.pose !== 'mantle' && b.pose !== 'swim') {
      sh[0] = sh[1] = -2.95;
      el[0] = el[1] = -0.35;
      shZ[0] = 0.15;
      shZ[1] = -0.15;
    }
    if (b.throwing < 0.4) {
      const t = b.throwing / 0.4;
      sh[1] = t < 0.3 ? -3.0 : ease(-3.0, -0.5, (t - 0.3) / 0.7);
      el[1] = -0.2;
      lean = 0.2 + t * 0.2;
    }

    this.tumble.rotation.x = b.pose === 'roll' ? tumble : ease(this.tumble.rotation.x % (Math.PI * 2), tumble, k);
    this.tumble.position.y = ease(this.tumble.position.y, HIP_Y - hipDrop + bounce, k);
    this.spine.rotation.x = ease(this.spine.rotation.x, lean, k);
    this.head.rotation.x = ease(this.head.rotation.x, headTilt, k);
    for (const i of [0, 1] as const) {
      this.thigh[i].rotation.x = ease(this.thigh[i].rotation.x, th[i], k);
      this.knee[i].rotation.x = ease(this.knee[i].rotation.x, kn[i], k);
      this.shoulder[i].rotation.x = ease(this.shoulder[i].rotation.x, sh[i], k);
      this.shoulder[i].rotation.z = ease(this.shoulder[i].rotation.z, shZ[i], k);
      this.elbow[i].rotation.x = ease(this.elbow[i].rotation.x, el[i], k);
    }
    const flutter = Math.sin(b.time * 11) * 0.08 * Math.min(1, b.speed / 5);
    // Positive about x swings the hanging cloth backwards, out behind him; the lower half lifts more,
    // and ripples a beat behind the upper.
    this.cape.rotation.x = ease(this.cape.rotation.x, capeLift * 0.6 + flutter, k);
    const ripple = Math.sin(b.time * 11 - 1.2) * 0.18 * Math.min(1, b.speed / 5);
    this.capeLow.rotation.x = ease(this.capeLow.rotation.x, capeLift * 0.5 + ripple, k);
  }
}

interface Puff {
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  life: number;
}

const PUFF = new THREE.IcosahedronGeometry(0.09, 0);

/**
 * Dust kicked up by his feet: a couple of puffs at each running stride, a ring of them when he lands
 * hard. Pale specks that swell and shrink away (no outline, no depth), fixed in their spread by a
 * counter, not by chance: only the sea is random.
 */
export class Puffs {
  private scene: THREE.Scene;
  private items: Puff[] = [];
  private mat = new THREE.MeshBasicMaterial({ color: '#e8dcbc', depthWrite: false });
  private n = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(x: number, y: number, z: number, count: number): void {
    if (y < -0.1) return;
    for (let i = 0; i < count; i++) {
      const a = (this.n++ * 2.39996) % (Math.PI * 2);
      const mesh = this.items.length > 40 ? this.items.shift()!.mesh : new THREE.Mesh(PUFF, this.mat);
      mesh.userData.noOutline = true;
      mesh.position.set(x, y + 0.08, z);
      mesh.scale.setScalar(0.4);
      mesh.visible = true;
      if (!mesh.parent) this.scene.add(mesh);
      const v = count > 3 ? 1.6 : 0.6;
      this.items.push({ mesh, vx: Math.cos(a) * v, vz: Math.sin(a) * v, life: 0 });
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.mesh.visible) continue;
      p.life += dt;
      const t = p.life / 0.45;
      if (t >= 1) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.position.y += dt * 0.5;
      p.mesh.scale.setScalar(0.4 + Math.sin(t * Math.PI) * 1.1);
    }
  }
}
