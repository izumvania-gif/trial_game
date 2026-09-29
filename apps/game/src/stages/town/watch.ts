// The watch: two Scythian archers, the city's public slaves who keep order at the agora (in Athens
// they did). When the scribe has made enough trouble they come after him. Walking, he cannot outrun
// them; running, he can; they will not follow him up a wall or into the sea, only wait below.
import * as THREE from 'three';
import { PLACES, route, type Place, type Point } from '../../core/streets.ts';
import { bob, lambert, makeFigure, PAINT } from '../figures.ts';

const POSTS: Point[] = [{ x: 6.2, z: -2.4 }, { x: 10.6, z: 4.9 }];
const SPEED = 6.4;
const CATCH = 0.85;
/** Out of sight this long, he has got away. */
const LOSE_AFTER = 9;

interface Guard {
  fig: THREE.Group;
  post: Point;
  path: Point[];
  repath: number;
}

export type WatchEvent = 'spotted' | 'waiting' | 'lost' | 'caught' | null;

export class Watch {
  private guards: Guard[] = [];
  /** 'post': standing guard; 'chase': after him; 'back': walking back to their posts. */
  state: 'post' | 'chase' | 'back' = 'post';
  private unseen = 0;
  private waited = 0;
  private waitBark = 0;

  constructor(scene: THREE.Scene) {
    for (const post of POSTS) {
      const fig = makeFigure('#15100c', 1.8);
      // The Scythian's tall pointed cap, in added red, and the bow on his back.
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.46, 6), PAINT.red);
      cap.position.set(0, 1.92, -0.02);
      cap.rotation.x = -0.25;
      fig.add(cap);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 4, 12, Math.PI * 0.9), lambert('#3a2418'));
      bow.position.set(0.05, 1.15, -0.26);
      bow.rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.2);
      fig.add(bow);
      fig.position.set(post.x, 0, post.z);
      fig.rotation.y = Math.atan2(8 - post.x, 1.5 - post.z);
      scene.add(fig);
      this.guards.push({ fig, post, path: [], repath: 0 });
    }
  }

  /** Where the guards are, for the scribe to walk round and for barks. */
  positions(): THREE.Vector3[] {
    return this.guards.filter((g) => g.fig.visible).map((g) => g.fig.position);
  }

  /** After a catch: the two of them at his sides, then back to their posts. */
  escort(x: number, z: number): void {
    this.guards.forEach((g, i) => {
      g.fig.position.set(x + (i ? 0.8 : -0.8), 0, z + 0.6);
      g.path = [];
    });
    this.state = 'back';
  }

  /**
   * One step of the watch. `target` is where the scribe stands, `reachable` false while he is up on a
   * roof or out in the water; `hot` whether the city wants him caught. Returns what happened.
   */
  update(dt: number, time: number, on: boolean, still: boolean, target: Point, reachable: boolean, hot: boolean, wall: (x: number, z: number) => boolean): WatchEvent {
    for (const g of this.guards) g.fig.visible = on;
    if (!on) {
      this.state = 'post';
      for (const g of this.guards) g.fig.position.set(g.post.x, 0, g.post.z);
      return null;
    }
    if (still) {
      for (const g of this.guards) bob(g.fig, time, 0);
      return null;
    }
    let event: WatchEvent = null;
    // Once after him, they keep on until they have him or have lost him: the city cooling down does not call them off.
    if (hot && this.state !== 'chase') {
      this.state = 'chase';
      this.unseen = 0;
      this.waited = 0;
      event = 'spotted';
    }
    // A guard on the watch cannot see him while he is out of the way; lose him for long enough and they give up.
    if (this.state === 'chase') {
      const near = Math.min(...this.guards.map((g) => Math.hypot(g.fig.position.x - target.x, g.fig.position.z - target.z)));
      this.unseen = near > 22 ? this.unseen + dt : 0;
      // Up a wall or out at sea, they wait below a while, then shrug.
      this.waited = reachable ? 0 : this.waited + dt;
      if (this.unseen > LOSE_AFTER || this.waited > 25) {
        this.state = 'back';
        return 'lost';
      }
    }
    // They stay on the shore: nobody wades in after him.
    const goal = { x: target.x, z: Math.min(target.z, 25.2) };
    let waiting = false;
    this.guards.forEach((g, i) => {
      const p = g.fig.position;
      // From afar they come at him from two sides; close in, straight at him.
      const spread = Math.hypot(p.x - goal.x, p.z - goal.z) > 3 ? (i ? 0.9 : -0.9) : 0;
      const to = this.state === 'chase' ? { x: goal.x + spread, z: goal.z } : g.post;
      g.repath -= dt;
      if (g.repath <= 0 || !g.path.length) {
        g.repath = 0.7;
        g.path = this.clear(p.x, p.z, to.x, to.z, wall) ? [to] : [...route(nearest(p.x, p.z), nearest(to.x, to.z)), to];
        // Not back to a street corner he has already passed.
        const [a, b] = g.path;
        if (a && b && Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(b.x - a.x, b.z - a.z)) g.path.shift();
      }
      const next = g.path[0]!;
      const dx = next.x - p.x;
      const dz = next.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5 && g.path.length > 1) g.path.shift();
      const moving = d > 0.3;
      if (moving) {
        const step = Math.min(d, SPEED * dt * (this.state === 'back' ? 0.5 : 1));
        const nx = p.x + (dx / d) * step;
        const nz = p.z + (dz / d) * step;
        // Standing against a wall already, they may step away from it.
        const stuck = wall(p.x, p.z);
        if (stuck || !wall(nx, p.z)) p.x = nx;
        if (stuck || !wall(p.x, nz)) p.z = nz;
        g.fig.rotation.y = Math.atan2(dx, dz);
      } else if (this.state === 'back') g.fig.rotation.y = Math.atan2(8 - p.x, 1.5 - p.z);
      bob(g.fig, time + i, moving ? (this.state === 'chase' ? 1.4 : 0.8) : 0);
      if (this.state === 'chase') {
        const dd = Math.hypot(p.x - target.x, p.z - target.z);
        if (reachable && dd < CATCH) event = 'caught';
        if (!reachable && dd < 4) waiting = true;
      }
    });
    if (this.state === 'back' && this.guards.every((g) => Math.hypot(g.fig.position.x - g.post.x, g.fig.position.z - g.post.z) < 0.4)) this.state = 'post';
    if (event) return event;
    if (waiting) {
      this.waitBark -= dt;
      if (this.waitBark <= 0) {
        this.waitBark = 7;
        return 'waiting';
      }
    }
    return null;
  }

  /** The nearest guard to (x, z), for who shouts. */
  nearest(x: number, z: number): THREE.Vector3 {
    return this.guards.map((g) => g.fig.position).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]!;
  }

  /** A straight walk with nothing in the way. */
  private clear(x0: number, z0: number, x1: number, z1: number, wall: (x: number, z: number) => boolean): boolean {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
    for (let i = 1; i < n; i++) if (wall(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)) return false;
    return true;
  }
}

/** The street node nearest a point, to route by. */
function nearest(x: number, z: number): Place {
  let best: Place = 'center';
  let bestD = Infinity;
  for (const [id, p] of Object.entries(PLACES) as [Place, Point][]) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}
