// Four-legged things: the farm's mule and goats, and the stray dog of the road of the dead, who can
// be fed and will then follow the scribe for the rest of the day. Fed on three days, he is waiting
// inside the west gate in the morning: dogs remember, even here.
import * as THREE from 'three';
import { lambert } from '../figures.ts';

/** A black-figure animal: a body, four legs, a head on a neck, a tail. Legs swing when it walks. */
export function quadruped(len: number, height: number, color: string, horns = false): THREE.Group {
  const g = new THREE.Group();
  const mat = lambert(color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len * 0.26, height * 0.36, len), mat);
  body.position.y = height * 0.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(len * 0.2, height * 0.26, len * 0.32), mat);
  head.position.set(0, height * 1.02, len * 0.62);
  head.rotation.x = 0.35;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len * 0.3), mat);
  tail.position.set(0, height * 0.8, -len * 0.6);
  tail.rotation.x = -0.6;
  tail.name = 'tail';
  g.add(body, head, tail);
  for (const [dx, dz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, height * 0.55, 0.07), mat);
    leg.geometry.translate(0, -height * 0.275, 0);
    leg.position.set(dx * len * 0.1, height * 0.55, dz * len * 0.38);
    leg.name = 'leg';
    g.add(leg);
  }
  if (horns) {
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), lambert('#e8e2d0'));
      h.position.set(s * 0.06, height * 1.2, len * 0.55);
      h.rotation.x = -0.7;
      g.add(h);
    }
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** Legs swinging as it walks (0: standing), the tail going. */
export function trot(g: THREE.Group, time: number, speed: number, wag = 0): void {
  let i = 0;
  for (const c of g.children) {
    if (c.name === 'leg') {
      // Diagonal pairs step together: front left with back right.
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      c.rotation.x = Math.sin(time * 12 + phase) * 0.5 * speed;
      i++;
    }
    if (c.name === 'tail') c.rotation.y = Math.sin(time * 14) * wag;
  }
}

export type DogState = 'lying' | 'going' | 'eating' | 'following' | 'waiting';

export class Dog {
  fig = quadruped(0.75, 0.55, '#17110d');
  state: DogState;
  /** Fed today: he follows. */
  fed = false;
  private food: THREE.Object3D | null = null;
  private eatLeft = 0;

  constructor(scene: THREE.Scene, at: { x: number; z: number }, remembers: boolean) {
    this.fig.position.set(at.x, 0, at.z);
    this.state = remembers ? 'waiting' : 'lying';
    this.lie(!remembers);
    scene.add(this.fig);
  }

  /** Lying down: lower, legs tucked. */
  private lie(down: boolean): void {
    this.fig.scale.y = down ? 0.55 : 1;
  }

  /** Food put down (or thrown) near him: he gets up and goes to it. */
  offer(food: THREE.Object3D): boolean {
    if (this.fed || this.state === 'going' || this.state === 'eating') return false;
    const d = Math.hypot(food.position.x - this.fig.position.x, food.position.z - this.fig.position.z);
    if (d > 6) return false;
    this.food = food;
    this.state = 'going';
    this.lie(false);
    return true;
  }

  /** One step; returns 'ate' the moment the food is gone, 'follow' when he first falls in behind the scribe. */
  update(dt: number, time: number, scribe: THREE.Vector3, ground: (x: number, z: number) => number, blocked: (x: number, z: number) => boolean): 'ate' | 'follow' | null {
    const p = this.fig.position;
    let speed = 0;
    let event: 'ate' | 'follow' | null = null;
    const go = (x: number, z: number, max: number, stop: number): number => {
      const dx = x - p.x;
      const dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d <= stop) return d;
      const step = Math.min(d - stop, max * dt);
      const nx = p.x + (dx / d) * step;
      const nz = p.z + (dz / d) * step;
      if (!blocked(nx, p.z)) p.x = nx;
      if (!blocked(p.x, nz)) p.z = nz;
      this.fig.rotation.y = Math.atan2(dx, dz);
      speed = step / dt / max;
      return d;
    };
    if (this.state === 'going' && this.food) {
      if (go(this.food.position.x, this.food.position.z, 4.5, 0.35) <= 0.4) {
        this.state = 'eating';
        this.eatLeft = 1.6;
      }
    } else if (this.state === 'eating') {
      this.eatLeft -= dt;
      this.fig.rotation.x = 0.25;
      if (this.eatLeft <= 0 && this.food) {
        this.food.visible = false;
        this.food = null;
        this.fig.rotation.x = 0;
        this.fed = true;
        this.state = 'following';
        event = 'ate';
      }
    } else if (this.state === 'waiting') {
      // He knows the scribe: when he comes near, the dog falls in behind him.
      if (Math.hypot(scribe.x - p.x, scribe.z - p.z) < 6) {
        this.state = 'following';
        this.fed = true;
        event = 'follow';
      }
    } else if (this.state === 'following') {
      // A little behind, never underfoot; up a roof or out in the sea, he waits below.
      const up = scribe.y > ground(scribe.x, scribe.z) + 1.2 || scribe.y < -0.5;
      if (!up) go(scribe.x, scribe.z, Math.hypot(scribe.x - p.x, scribe.z - p.z) > 5 ? 9 : 5.5, 1.5);
    }
    p.y = ground(p.x, p.z);
    trot(this.fig, time, speed, this.state === 'following' || this.state === 'waiting' ? 0.6 : 0.1);
    return event;
  }
}
