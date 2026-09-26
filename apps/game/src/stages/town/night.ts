// What changes as the last day runs out: the nameless crowd and its torches, the line of fire
// climbing the holy mountain, the storm with a face that sinks over it, and the wind in the
// streets. All of it is a function of the clock (and the wind the player raised), never chance.
import * as THREE from 'three';
import { extraAt, makeCrowd, type Extra } from '../../content/crowd.ts';
import { daySeed, seededRng } from '../../core/rng.ts';
import { amphora, bob, lambert, makeFigure } from '../figures.ts';

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

  update(minute: number, time: number, lit: number): void {
    let lightIndex = 0;
    for (const { extra, figure, torch } of this.people) {
      const s = extraAt(extra, minute);
      figure.visible = s.visible;
      if (!s.visible) continue;
      figure.position.set(s.x, 0, s.z);
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
 * day; in the afternoon its eyes begin to open, and near midnight it grins. The eyes follow
 * the scribe. The Curator can patch the face out (`cloud_smooth`), not the storm.
 */
export class StormFace {
  readonly group = new THREE.Group();
  private eyes: { white: THREE.Mesh; pupil: THREE.Mesh }[] = [];
  private mouth: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, smoothFace: boolean) {
    const dark = lambert('#2a2320');
    const rand = seededRng(daySeed('eferon/cloud'));
    for (let i = 0; i < 16; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + rand() * 5, 0), dark);
      puff.position.set((rand() - 0.5) * 34, (rand() - 0.5) * 7, (rand() - 0.5) * 9);
      this.group.add(puff);
    }
    scene.add(this.group);
    if (smoothFace) return;
    const bone = new THREE.MeshBasicMaterial({ color: '#f5e9c8' });
    const black = new THREE.MeshBasicMaterial({ color: '#0d0b09' });
    for (const x of [-4.2, 4.2]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), bone);
      white.position.set(x, 1.4, 13.5);
      white.scale.set(1.3, 0.05, 0.6);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), black);
      pupil.position.set(x, 1.4, 14.4);
      this.group.add(white, pupil);
      this.eyes.push({ white, pupil });
    }
    // A thin grin of light under the eyes.
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.32, 5, 18, Math.PI * 0.8), bone);
    this.mouth.rotation.z = Math.PI * 1.1;
    this.mouth.position.set(0, -1.4, 13.8);
    this.mouth.visible = false;
    this.group.add(this.mouth);
  }

  update(progress: number, player: THREE.Vector3): void {
    // Over the mountain by day; in the last hours it drifts to hang over wherever the scribe is.
    const follow = smooth(progress, P(20), P(23));
    this.group.position.set(lerp(-6, player.x, follow * 0.85), lerp(60, 14.5, Math.pow(progress, 1.3)), lerp(-72, -46, progress * progress));
    const open = smooth(progress, P(15), P(23));
    for (const { white, pupil } of this.eyes) {
      white.scale.y = lerp(0.05, 0.75, open);
      pupil.visible = open > 0.2;
      // Look at the scribe: the pupils slide across the whites towards him.
      const dx = THREE.MathUtils.clamp((player.x - (this.group.position.x + white.position.x)) * 0.04, -0.8, 0.8);
      pupil.position.x = white.position.x + dx;
      pupil.position.y = white.position.y - 0.25 * open;
      pupil.scale.setScalar(Math.min(1, open * 1.3));
    }
    if (this.mouth) {
      const grin = smooth(progress, P(21.5), P(23.5));
      this.mouth.visible = grin > 0.02;
      this.mouth.scale.set(0.4 + 0.6 * grin, 0.4 + 0.6 * grin, 1);
    }
  }
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
