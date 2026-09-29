// Things the scribe can pick up, carry over his head, put down or throw: amphorae by the doors,
// baskets in the market, stones on the beach. A thrown amphora breaks; whatever falls in the sea sinks.
// Nothing here outlives the day: at midnight the stage is rebuilt and every pot is whole again.
import * as THREE from 'three';
import { seededRng } from '../../core/rng.ts';
import { lambert } from '../figures.ts';

export type CarryKind = 'amphora' | 'basket' | 'stone';

export interface Carryable {
  obj: THREE.Object3D;
  kind: CarryKind;
  /** In the air after a throw. */
  vel: THREE.Vector3 | null;
  gone: boolean;
}

const NAMES: Record<CarryKind, string> = { amphora: 'the amphora', basket: 'the basket', stone: 'a stone' };
/** Where the sea closes over what falls in. */
const SEA_LEVEL = -0.2;
const GRAVITY = 20;

interface Shard {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rest: boolean;
}

export interface CarryWorld {
  /** The surface under (x, z) no higher than y (ground, a roof, a step). */
  floorAt(x: number, z: number, y: number): number;
  /** Something in the way at (x, z) for a thing at height y. */
  blocked(x: number, z: number, y: number): boolean;
  /** A thing hit the ground: 'shatter' (it broke), 'splash' (into the sea), 'thud'. */
  landed(item: Carryable, how: 'shatter' | 'splash' | 'thud', x: number, z: number): void;
}

export class Carry {
  items: Carryable[] = [];
  held: Carryable | null = null;
  private shards: Shard[] = [];
  private scene: THREE.Scene;
  private world: CarryWorld;
  private broken = 0;

  constructor(scene: THREE.Scene, world: CarryWorld) {
    this.scene = scene;
    this.world = world;
  }

  add(obj: THREE.Object3D, kind: CarryKind): void {
    this.items.push({ obj, kind, vel: null, gone: false });
  }

  name(item: Carryable): string {
    return NAMES[item.kind];
  }

  /** The nearest thing lying within reach of someone standing at (x, y, z). */
  nearest(x: number, y: number, z: number, reach = 1.1): { item: Carryable; d: number } | null {
    let best: { item: Carryable; d: number } | null = null;
    for (const item of this.items) {
      if (item.gone || item.vel || item === this.held) continue;
      const o = item.obj.position;
      if (Math.abs(o.y - y) > 1.2) continue;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < reach && (!best || d < best.d)) best = { item, d };
    }
    return best;
  }

  pick(item: Carryable): void {
    this.held = item;
    item.obj.rotation.set(0, 0, 0);
  }

  /** Set it down in front of him. */
  drop(from: THREE.Vector3, facing: number): void {
    const item = this.held;
    if (!item) return;
    this.held = null;
    let x = from.x + Math.sin(facing) * 0.7;
    let z = from.z + Math.cos(facing) * 0.7;
    if (this.world.blocked(x, z, from.y)) {
      x = from.x;
      z = from.z;
    }
    const y = this.world.floorAt(x, z, from.y + 0.3);
    if (y < SEA_LEVEL) {
      item.obj.position.set(x, SEA_LEVEL, z);
      item.vel = new THREE.Vector3(0, -1, 0);
      return;
    }
    item.obj.position.set(x, y, z);
  }

  /** Throw it the way he faces: further when running. */
  throw(from: THREE.Vector3, facing: number, running: boolean): void {
    const item = this.held;
    if (!item) return;
    this.held = null;
    const v = running ? 9.5 : 7;
    item.vel = new THREE.Vector3(Math.sin(facing) * v, 4.2, Math.cos(facing) * v);
    item.obj.position.set(from.x + Math.sin(facing) * 0.4, from.y + 1.9, from.z + Math.cos(facing) * 0.4);
  }

  update(dt: number, carrier: THREE.Object3D): void {
    if (this.held) {
      const p = carrier.position;
      this.held.obj.position.set(p.x, p.y + 1.85, p.z);
      this.held.obj.rotation.y = carrier.rotation.y;
    }
    for (const item of this.items) {
      if (!item.vel || item.gone) continue;
      const o = item.obj.position;
      item.vel.y -= GRAVITY * dt;
      const nx = o.x + item.vel.x * dt;
      const nz = o.z + item.vel.z * dt;
      // A wall stops it: it drops where it hit.
      if (this.world.blocked(nx, nz, o.y)) {
        item.vel.x = item.vel.z = 0;
        if (item.kind === 'amphora') {
          this.land(item, o.x, o.y, o.z);
          continue;
        }
      } else {
        o.x = nx;
        o.z = nz;
      }
      o.y += item.vel.y * dt;
      item.obj.rotation.x += dt * 6;
      const floor = this.world.floorAt(o.x, o.z, o.y + 0.5);
      if (floor < SEA_LEVEL && o.y < SEA_LEVEL) {
        // Into the sea: it goes under and is not seen again today.
        if (item.vel.y < -0.5 || item.vel.x || item.vel.z) this.world.landed(item, 'splash', o.x, o.z);
        item.gone = true;
        item.obj.visible = false;
        continue;
      }
      if (o.y <= floor) this.land(item, o.x, floor, o.z);
    }
    for (const s of this.shards) {
      if (s.rest) continue;
      s.vel.y -= GRAVITY * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += dt * 9;
      const floor = this.world.floorAt(s.mesh.position.x, s.mesh.position.z, s.mesh.position.y + 0.3);
      if (s.mesh.position.y <= floor) {
        s.mesh.position.y = floor + 0.03;
        s.rest = true;
      }
    }
  }

  private land(item: Carryable, x: number, y: number, z: number): void {
    item.vel = null;
    item.obj.rotation.x = 0;
    if (item.kind === 'amphora') {
      this.shatter(item, x, y, z);
      this.world.landed(item, 'shatter', x, z);
      return;
    }
    item.obj.position.set(x, y, z);
    // A basket lands on its side.
    if (item.kind === 'basket') item.obj.rotation.z = Math.PI / 2;
    this.world.landed(item, 'thud', x, z);
  }

  /** The pot bursts into a few sherds that stay where they fall, for the rest of the day. */
  private shatter(item: Carryable, x: number, y: number, z: number): void {
    item.gone = true;
    item.obj.visible = false;
    const rand = seededRng(++this.broken * 7919 + Math.round(x * 13 + z * 31));
    const mat = lambert('#8f4a2a');
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.12 + rand() * 0.14, 0.04, 0.1 + rand() * 0.1), mat);
      s.position.set(x, y + 0.3, z);
      const a = rand() * Math.PI * 2;
      const v = 1.5 + rand() * 2.5;
      this.scene.add(s);
      this.shards.push({ mesh: s, vel: new THREE.Vector3(Math.cos(a) * v, 2 + rand() * 2, Math.sin(a) * v), rest: false });
    }
  }
}

/** A beach stone to carry and throw. */
export function stone(size: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), lambert('#e4d6b4'));
  m.castShadow = true;
  return m;
}
