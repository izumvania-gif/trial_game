// The small things that make a street a street: washing on lines, smoke from the ovens, baskets,
// nets drying on the beach, statues, the fountain on the agora. Placed from the day seed, moved
// only by the clock and the wind.
import * as THREE from 'three';
import { daySeed, seededRng } from '../../core/rng.ts';
import { distanceToStreets, type Point } from '../../core/streets.ts';
import { lambert, makeFigure } from '../figures.ts';
import type { Box } from './city.ts';

function hits(boxes: Box[], x: number, z: number, r: number): boolean {
  return boxes.some((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ);
}

/** A free spot near `near`: off the paving by between `streetMin` and `streetMax`, clear of walls. */
function findSpot(rand: () => number, boxes: Box[], near: Point, radius: number, streetMin: number, streetMax: number, clearance: number): Point | null {
  for (let i = 0; i < 300; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * radius;
    const x = near.x + Math.cos(a) * r;
    const z = near.z + Math.sin(a) * r;
    const d = distanceToStreets(x, z);
    if (d < streetMin || d > streetMax || hits(boxes, x, z, clearance)) continue;
    return { x, z };
  }
  return null;
}

export class StreetLife {
  private smoke: { puffs: THREE.Mesh[]; x: number; y: number; z: number; seed: number }[] = [];
  private cloths: THREE.Mesh[] = [];
  private drops: THREE.Mesh[] = [];
  private fountain: Point | null = null;
  private scene: THREE.Scene;
  private boxes: Box[];
  private rand = seededRng(daySeed('eferon/props/v1'));
  /** The market baskets: the scribe can carry them off (see carry.ts). */
  baskets: THREE.Group[] = [];

  constructor(scene: THREE.Scene, boxes: Box[]) {
    this.scene = scene;
    this.boxes = boxes;
  }

  /** After the houses and walls stand: everything else finds room between them. */
  build(): void {
    this.buildFountain();
    this.buildStatues();
    this.buildLaundry();
    this.buildBaskets();
    this.buildNets();
  }

  private collide(x: number, z: number, r: number): void {
    this.boxes.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
  }

  /** A chimney on a roof; the town calls this while it builds the houses. */
  chimney(x: number, y: number, z: number): void {
    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1, 0.45), lambert('#cdb892'));
    stack.position.set(x, y + 0.3, z);
    stack.castShadow = true;
    this.scene.add(stack);
    const mat = lambert('#d6cab4');
    const puffs = Array.from({ length: 5 }, () => {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mat);
      this.scene.add(p);
      return p;
    });
    this.smoke.push({ puffs, x, y: y + 0.85, z, seed: this.smoke.length * 0.37 });
  }

  private buildFountain(): void {
    const spot = findSpot(this.rand, this.boxes, { x: 8, z: 1.5 }, 5, 2.2, 4, 1.8);
    if (!spot) return;
    this.fountain = spot;
    const stone = lambert('#ece2c8');
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.65, 0.55, 18), stone);
    basin.position.set(spot.x, 0.27, spot.z);
    basin.castShadow = basin.receiveShadow = true;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.05, 18), lambert('#8fb1b8'));
    water.position.set(spot.x, 0.52, spot.z);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.5, 8), stone);
    column.position.set(spot.x, 1.1, spot.z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.22, 0.3, 12), stone);
    bowl.position.set(spot.x, 1.9, spot.z);
    bowl.castShadow = true;
    this.scene.add(basin, water, column, bowl);
    const dropMat = new THREE.MeshBasicMaterial({ color: '#eef3f0' });
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), dropMat);
      this.scene.add(d);
      this.drops.push(d);
    }
    this.collide(spot.x, spot.z, 1.6);
  }

  private buildStatues(): void {
    const marble = '#efe6cf';
    for (const near of [{ x: 3, z: -6 }, { x: 11, z: 6 }, { x: -7, z: 10 }]) {
      const spot = findSpot(this.rand, this.boxes, near, 4, 1.8, 3.4, 0.9);
      if (!spot) continue;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 1.1), lambert('#d9ccb0'));
      base.position.set(spot.x, 0.5, spot.z);
      base.castShadow = base.receiveShadow = true;
      const figure = makeFigure(marble, 2.1);
      figure.position.set(spot.x, 1, spot.z);
      figure.rotation.y = Math.atan2(-spot.x, -spot.z) + (this.rand() - 0.5);
      // A raised arm: an orator, or a god, or a benefactor nobody remembers.
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), lambert(marble));
      arm.position.set(0.32, 1.95, 0.05);
      arm.rotation.z = -0.5;
      figure.add(arm);
      this.scene.add(base, figure);
      this.collide(spot.x, spot.z, 0.6);
    }
  }

  private buildLaundry(): void {
    const pole = lambert('#3a2418');
    const colors = ['#efe6cf', '#b5532a', '#e6d7b8', '#6e2a1c'];
    for (const near of [{ x: -9, z: -1 }, { x: -12, z: 8 }, { x: 13, z: -7 }, { x: 2, z: 12 }, { x: -18, z: -9 }, { x: 16, z: 1 }]) {
      const spot = findSpot(this.rand, this.boxes, near, 5, 1.5, 2.6, 1.9);
      if (!spot) continue;
      const turn = this.rand() * Math.PI;
      const group = new THREE.Group();
      for (const s of [-1.6, 1.6]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.3, 4), pole);
        p.position.set(s, 1.15, 0);
        group.add(p);
      }
      const rope = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.03), pole);
      rope.position.y = 2.2;
      group.add(rope);
      const n = 3 + Math.floor(this.rand() * 2);
      for (let i = 0; i < n; i++) {
        const w = 0.45 + this.rand() * 0.35;
        const h = 0.55 + this.rand() * 0.45;
        const geo = new THREE.BoxGeometry(w, h, 0.03);
        geo.translate(0, -h / 2, 0); // hangs from the rope
        const cloth = new THREE.Mesh(geo, lambert(colors[Math.floor(this.rand() * colors.length)]!));
        cloth.position.set(-1.2 + (i * 2.4) / Math.max(1, n - 1), 2.18, 0);
        cloth.castShadow = true;
        group.add(cloth);
        this.cloths.push(cloth);
      }
      group.position.set(spot.x, 0, spot.z);
      group.rotation.y = turn;
      this.scene.add(group);
    }
  }

  private buildBaskets(): void {
    const wicker = lambert('#a0703f');
    const goods = ['#e8dcc0', '#6e2a1c', '#3a4a2a', '#b5532a'];
    for (const [near, count] of [[{ x: 5, z: 6.2 }, 5], [{ x: -6, z: 15.5 }, 4], [{ x: 8, z: 3.5 }, 3]] as const) {
      for (let i = 0; i < count; i++) {
        const spot = findSpot(this.rand, this.boxes, near, 2.4, 1.2, 3, 0.35);
        if (!spot) continue;
        // One group, so the scribe can pick up the basket with what is in it.
        const group = new THREE.Group();
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.34, 8), wicker);
        basket.position.y = 0.17;
        basket.castShadow = true;
        const fill = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), lambert(goods[Math.floor(this.rand() * goods.length)]!));
        fill.position.y = 0.36;
        fill.scale.y = 0.5;
        group.add(basket, fill);
        group.position.set(spot.x, 0, spot.z);
        this.scene.add(group);
        this.baskets.push(group);
      }
    }
  }

  /** Nets hung to dry on frames along the beach, west of the mole. */
  private buildNets(): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const c = canvas.getContext('2d')!;
    c.strokeStyle = '#2a1a12';
    c.lineWidth = 2;
    for (let i = 0; i <= 32; i += 8) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 32);
      c.moveTo(0, i);
      c.lineTo(32, i);
      c.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.magFilter = THREE.NearestFilter;
    // Cut out, not blended: the holes are simply not drawn, so the dither never sees them.
    const net = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    const pole = lambert('#3a2418');
    for (const x of [-11.5, -15, -18.5]) {
      const group = new THREE.Group();
      for (const s of [-1.5, 1.5]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 4), pole);
        p.position.set(s, 1.1, 0);
        group.add(p);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.07, 0.07), pole);
      bar.position.y = 2.15;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.5), net);
      mesh.position.set(0, 1.35, 0.02);
      mesh.rotation.x = 0.12;
      group.add(bar, mesh);
      group.position.set(x, 0, 21.3);
      group.rotation.y = 0.1 * (x + 15);
      this.scene.add(group);
      this.cloths.push(mesh);
    }
  }

  update(time: number, wind: number): void {
    for (const s of this.smoke) {
      s.puffs.forEach((p, i) => {
        // Each puff rises, grows and drifts downwind, then starts again at the chimney.
        const t = (time * 0.22 + i / s.puffs.length + s.seed) % 1;
        p.position.set(s.x + t * (0.8 + wind * 2.5) + Math.sin(time * 1.3 + i) * 0.12, s.y + t * 3.2, s.z + t * (0.3 + wind * 1.5));
        p.scale.setScalar(0.6 + t * 1.6);
        p.visible = t < 0.94;
      });
    }
    this.cloths.forEach((c, i) => {
      c.rotation.x = Math.sin(time * (1.6 + wind * 3) + i * 1.3) * (0.08 + wind * 0.45);
    });
    if (this.fountain) {
      this.drops.forEach((d, i) => {
        const a = (i / this.drops.length) * Math.PI * 2;
        const t = (time * 0.9 + (i % 3) / 3) % 1;
        const r = 0.55 + t * 0.55;
        d.position.set(this.fountain!.x + Math.cos(a) * r, 2.0 + t * 0.35 - t * t * 1.8, this.fountain!.z + Math.sin(a) * r);
      });
    }
  }
}

