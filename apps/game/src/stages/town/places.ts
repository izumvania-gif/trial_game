// Places to walk in, beyond the streets: each is somewhere to stand and look, with a line of its
// own and a small life that follows the clock. They bring their own ground (steps, ridges, rock),
// which the town's `groundAt` asks first; `free` in TownStage refuses any step up or down higher
// than `STEP`, so the edges of these places are cliffs without a wall being built for them.
import * as THREE from 'three';
import { daySeed, seededRng } from '../../core/rng.ts';
import { at } from '../../core/clock.ts';
import { lambert, makeFigure, pavingTexture, textured } from '../figures.ts';
import type { Box } from './city.ts';
import { buildCountry, COUNTRY_SPOTS, countryHeight, inCountry } from './country.ts';

/** The highest step the scribe takes without a stair. */
export const STEP = 0.7;

export interface PlaceSpot {
  x: number;
  z: number;
  radius: number;
  knot: string;
  label: string;
  /** Up off the ground (the wall walk): the height he must be at. */
  y?: number;
  /** Reached swimming. */
  water?: boolean;
  /** Found, not shown: no mark over it, and agents are not told of it. */
  secret?: boolean;
}

// ─── The theatre, in the north-east corner: a cavea of stone rows open to the south, the sea beyond ───

export const THEATRE = { x: 21.5, z: -18.8, orchestra: 2.3, first: 2.6, depth: 0.55, rise: 0.42, rows: 8, trim: 0.25 };
const THEATRE_OUTER = THEATRE.first + THEATRE.rows * THEATRE.depth;

function theatreHeight(x: number, z: number): number | null {
  const dx = x - THEATRE.x;
  const dz = z - THEATRE.z;
  const r = Math.hypot(dx, dz);
  if (r < THEATRE.first || r > THEATRE_OUTER || dz > 0) return null;
  // Angle from east through north to west (0 … π); the ends are left open as the side passages.
  const a = Math.atan2(-dz, dx);
  if (a < THEATRE.trim || a > Math.PI - THEATRE.trim) return null;
  const row = Math.min(THEATRE.rows, Math.floor((r - THEATRE.first) / THEATRE.depth) + 1);
  return row * THEATRE.rise;
}

// ─── The cape of Poseidon, east of the beach: a rock ridge into the sea, a shrine and a light ───

export const CAPE = { x: 22, from: 22.4, to: 35.2, half: 1.5, top: 0.6, end: { x: 22, z: 38.6, r: 3.8, top: 0.9 } };
/** The hollow in the east face of the cape, reached only by swimming round. */
export const SEA_CAVE = { x: 25, z: 30.5 };

function capeHeight(x: number, z: number): number | null {
  const { end } = CAPE;
  if (Math.hypot(x - end.x, z - end.z) < end.r) return end.top;
  if (Math.abs(x - CAPE.x) < CAPE.half && z > CAPE.from && z < CAPE.to + 0.8) {
    // Up from the sand over the first few metres, then along the top.
    return Math.min(CAPE.top, ((z - CAPE.from) / 2.4) * CAPE.top) + (z > CAPE.to ? ((z - CAPE.to) / 0.8) * (end.top - CAPE.top) : 0);
  }
  return null;
}

// ─── The lookout: a rock west of the temple of Apollo, a stair up its south face ───

export const LOOKOUT = { x0: -14.4, x1: -8.2, z0: -26, z1: -20.4, top: 3.4, stair: { x0: -12.2, x1: -10.8, foot: -16.2 } };

function lookoutHeight(x: number, z: number): number | null {
  const L = LOOKOUT;
  if (x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1) return L.top;
  if (x > L.stair.x0 && x < L.stair.x1 && z >= L.z1 && z < L.stair.foot) return ((L.stair.foot - z) / (L.stair.foot - L.z1)) * L.top;
  return null;
}

// ─── The west gate, and outside it the road of the dead ───

export const WEST_GATE = { z: 4.2, half: 1.9 };
export const NECROPOLIS = { from: -30.1, to: -45.5, half: 4.2 };

/** Outside the west wall: the road of the dead, and the country beyond it (country.ts). */
export function placeOutside(x: number, z: number): boolean {
  return inCountry(x, z);
}

// ─── The gymnasium, inside the west wall south of the gate ───

export const GYM = { x0: -27.8, x1: -18.6, z0: 7.6, z1: 16.2, track: 14.4 };

// ─── The olive grove, south of the temple of Zeus; the fish market and the shipyard by the water ───

export const GROVE = { x0: 15, x1: 28.4, z0: 11.2, z1: 18.6, press: { x: 25.6, z: 13.2 }, planter: { x: 18.6, z: 17.4 } };
export const MARKET = { x: -3.6, z: 16.9 };
export const SHIPYARD = { x: -20.5, z: 22.6 };

/** Walkable rock or stone out over the water, where the sea is not too deep. */
export function onPlaceOverWater(x: number, z: number): boolean {
  return capeHeight(x, z) !== null;
}

/** The ground of these places at (x, z), or null where they do not reach. */
export function placeGround(x: number, z: number): number | null {
  return theatreHeight(x, z) ?? capeHeight(x, z) ?? lookoutHeight(x, z) ?? countryHeight(x, z);
}

/** Where the player can talk or look. */
export const PLACE_SPOTS: PlaceSpot[] = [
  { x: THEATRE.x, z: THEATRE.z + 0.4, radius: 2, knot: 'theatre', label: 'The theatre' },
  { x: CAPE.end.x - 0.6, z: CAPE.end.z - 2.2, radius: 1.8, knot: 'cape_shrine', label: 'The shrine of Poseidon' },
  { x: -10.6, z: -23.4, radius: 2, knot: 'lookout', label: 'The lookout' },
  { x: -39.5, z: 5.6, radius: 1.5, knot: 'phyllis_grave', label: 'A grave by the road' },
  { x: -43.6, z: WEST_GATE.z, radius: 1.8, knot: 'west_road', label: 'The road into the hills' },
  { x: -21, z: 11.2, radius: 2, knot: 'gymnasium', label: 'The gymnasium' },
  { x: GROVE.press.x - 1.4, z: GROVE.press.z + 1.6, radius: 1.8, knot: 'olive_press', label: 'The olive press' },
  { x: GROVE.planter.x, z: GROVE.planter.z - 0.9, radius: 1.5, knot: 'olive_grove', label: 'The old man with the sapling' },
  { x: MARKET.x + 1.2, z: MARKET.z - 1.3, radius: 1.8, knot: 'fish_market', label: 'The fish market' },
  { x: SHIPYARD.x + 0.4, z: SHIPYARD.z - 1.9, radius: 1.8, knot: 'shipyard', label: 'The boat on the stocks' },
  ...COUNTRY_SPOTS,
  // Up on the north wall walk, between two towers, where nobody goes.
  { x: -10.75, z: -27, y: 3.64, radius: 1.6, knot: 'wall_scratch', label: 'Scratches in the coping', secret: true },
  // In the water on the far side of the cape, where the rock is hollow.
  { x: SEA_CAVE.x + 1.3, z: SEA_CAVE.z, radius: 2.2, knot: 'sea_cave', label: 'A hollow in the rock', water: true, secret: true },
];

/** Keep houses out of these places. */
export function placeReserved(x: number, z: number): boolean {
  return (x > 13.5 && z < -14.6 && z > -27) || (x > 17 && x < 27 && z > 19) ||
    (x > -15.6 && x < -7.6 && z < -15.4 && z > -27) || // the lookout
    (x < -18 && z > 1.2 && z < 16.8) || // the gate road and the gymnasium
    (x > GROVE.x0 - 0.5 && z > GROVE.z0 - 0.4 && z < GROVE.z1 + 0.5) || // the olive grove
    (x > MARKET.x - 2.4 && x < MARKET.x + 3.6 && z > MARKET.z - 1.6 && z < MARKET.z + 1.8); // the fish market
}

/** The places' small lives, moved by the clock. */
/** What a place can see of the scribe's doings: things he left lying about, and what has changed today. */
export interface PlaceWorld {
  /** Where carried things lie on the ground (put down, dropped, thrown). */
  things: { x: number; z: number }[];
  /** Did this already happen today? */
  happened(id: string): boolean;
  /** The fixed day has been changed here: the observers notice. */
  event(id: string, x: number, z: number): void;
}

export interface PlaceLife {
  update(minute: number, time: number, dusk: number, world: PlaceWorld): void;
  /** Things lying there that the scribe can pick up (see carry.ts). */
  loose?: [THREE.Object3D, 'fish'][];
}

const stone = () => lambert('#e6d9b8');

function buildTheatre(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const T = THEATRE;
  const mat = stone();
  const riser = lambert('#cdbb92');
  // Treads (flat rings) and risers (upright bands), row by row, over the northern half.
  const phi = T.trim;
  const len = Math.PI - 2 * T.trim;
  for (let k = 1; k <= T.rows; k++) {
    const r0 = T.first + (k - 1) * T.depth;
    const tread = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + T.depth, 28, 1, phi, len), mat);
    tread.rotation.x = -Math.PI / 2;
    tread.position.set(T.x, k * T.rise, T.z);
    tread.receiveShadow = true;
    scene.add(tread);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, T.rise, 28, 1, true, Math.PI / 2 + phi, len), riser);
    band.material.side = THREE.DoubleSide;
    band.position.set(T.x, (k - 0.5) * T.rise, T.z);
    band.castShadow = band.receiveShadow = true;
    scene.add(band);
  }
  // The back of the cavea, and its two ends, walled.
  const back = new THREE.Mesh(new THREE.CylinderGeometry(THEATRE_OUTER, THEATRE_OUTER, T.rows * T.rise + 0.4, 28, 1, true, Math.PI / 2 + phi, len), riser);
  back.material.side = THREE.DoubleSide;
  back.position.set(T.x, (T.rows * T.rise + 0.4) / 2, T.z);
  scene.add(back);
  for (const a of [phi, Math.PI - phi]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(THEATRE_OUTER - T.first, 0.25, 0.3), riser);
    const mid = (T.first + THEATRE_OUTER) / 2;
    end.position.set(T.x + Math.cos(a) * mid, 0.12, T.z - Math.sin(a) * mid);
    end.rotation.y = a;
    scene.add(end);
  }
  // The orchestra: a round floor of beaten earth ringed with stone, an altar at its heart.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(T.orchestra, 32), lambert('#efe3c6'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(T.x, 0.015, T.z);
  floor.receiveShadow = true;
  scene.add(floor);
  const rim = new THREE.Mesh(new THREE.RingGeometry(T.orchestra, T.orchestra + 0.18, 32), lambert('#b98a62'));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(T.x, 0.02, T.z);
  scene.add(rim);
  const thymele = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 8), mat);
  thymele.position.set(T.x, 0.35, T.z);
  scene.add(thymele);
  boxes.push({ minX: T.x - 0.3, maxX: T.x + 0.3, minZ: T.z - 0.3, maxZ: T.z + 0.3 });
  // The skene: the stage building south of the orchestra, three doors facing the rows.
  const skene = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 1), lambert('#d9c7a0'));
  skene.position.set(T.x, 1.7, T.z + 2.9);
  skene.castShadow = skene.receiveShadow = true;
  scene.add(skene);
  boxes.push({ minX: T.x - 4.5, maxX: T.x + 4.5, minZ: T.z + 2.4, maxZ: T.z + 3.4 });
  for (const dx of [-2.6, 0, 2.6]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(dx ? 1 : 1.3, dx ? 2 : 2.4), lambert('#1a120c'));
    door.position.set(T.x + dx, dx ? 1 : 1.2, T.z + 2.39);
    door.rotation.y = Math.PI;
    scene.add(door);
  }
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.3, 1.3), lambert('#9a5a3a'));
  cornice.position.set(T.x, 3.55, T.z + 2.9);
  scene.add(cornice);
  // The chorus, rehearsing in the orchestra from nine to five, and the man with the staff who
  // teaches them; a tragedy masks every face white.
  const chorus: THREE.Group[] = [];
  const mask = new THREE.MeshBasicMaterial({ color: '#f2ead6' });
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.2 + (i / 6) * Math.PI * 0.6;
    const f = makeFigure(i === 6 ? '#2a1a12' : '#3a2418', i === 6 ? 1.7 : 1.6);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.08), mask);
    face.position.set(0, 1.47, 0.18);
    if (i < 6) f.add(face);
    const r = i === 6 ? 0.9 : 1.6;
    f.position.set(T.x + Math.cos(a) * r, 0, T.z - Math.sin(a) * r + (i === 6 ? 1.6 : 0));
    f.rotation.y = i === 6 ? Math.PI : Math.atan2(-(f.position.x - T.x), -(f.position.z - T.z)) + Math.PI;
    f.visible = false;
    scene.add(f);
    chorus.push(f);
  }
  return {
    update(minute, time) {
      const on = minute >= at(9) && minute < at(17);
      chorus.forEach((f, i) => {
        f.visible = on;
        // The chorus sways as one, a beat behind the leader.
        f.rotation.z = on && i < 6 ? Math.sin(time * 1.4 - i * 0.2) * 0.06 : 0;
      });
    },
  };
}

function buildCape(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const rock = lambert('#7a4a30');
  const top = textured(pavingTexture(), '#d8c49c');
  const rand = seededRng(daySeed('eferon/cape'));
  // The ridge: a rough causeway of rock from the sand out into the water.
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(CAPE.half * 2, 1.9, CAPE.to - CAPE.from - 1.2), top);
  ridge.position.set(CAPE.x, CAPE.top - 0.95, (CAPE.from + 1.2 + CAPE.to) / 2 + 0.3);
  ridge.receiveShadow = true;
  scene.add(ridge);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(CAPE.half * 2, 0.1, 2.6), top);
  ramp.position.set(CAPE.x, CAPE.top / 2, CAPE.from + 1.2);
  ramp.rotation.x = -Math.atan(CAPE.top / 2.4);
  scene.add(ramp);
  for (let z = CAPE.from + 1.5; z < CAPE.to; z += 1.3) {
    for (const side of [-1, 1]) {
      const r = 0.6 + rand() * 0.7;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock);
      m.position.set(CAPE.x + side * (CAPE.half + r * 0.5), -0.3 + rand() * 0.3, z + rand() * 0.6);
      m.rotation.set(rand() * 3, rand() * 3, 0);
      m.castShadow = true;
      scene.add(m);
    }
  }
  // The hollow on the far side: a hump of rock over the water with a black mouth in it, facing the open sea.
  const hump = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), rock);
  hump.position.set(SEA_CAVE.x - 0.6, 0.2, SEA_CAVE.z);
  hump.scale.set(0.8, 0.9, 1.4);
  hump.castShadow = true;
  scene.add(hump);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.9, 10, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#0d0b09' }));
  mouth.position.set(SEA_CAVE.x + 1.02, -0.45, SEA_CAVE.z);
  mouth.rotation.y = Math.PI / 2;
  scene.add(mouth);
  boxes.push({ minX: SEA_CAVE.x - 1.9, maxX: SEA_CAVE.x + 0.9, minZ: SEA_CAVE.z - 2.4, maxZ: SEA_CAVE.z + 2.4 });
  // The headland: a round platform of rock with boulders at its edge.
  const { end } = CAPE;
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(end.r, end.r + 0.8, 2.2, 12), rock);
  plat.position.set(end.x, end.top - 1.1, end.z);
  plat.castShadow = plat.receiveShadow = true;
  scene.add(plat);
  const deck = new THREE.Mesh(new THREE.CircleGeometry(end.r - 0.1, 24), top);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(end.x, end.top + 0.01, end.z);
  deck.receiveShadow = true;
  scene.add(deck);
  // The shrine: four columns and a roof over a stone that is always wet.
  const sx = end.x - 1.2;
  const sz = end.z - 0.2;
  const col = lambert('#f0e6cc');
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]] as const) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.2, 8), col);
    c.position.set(sx + dx, end.top + 1.1, sz + dz);
    c.castShadow = true;
    scene.add(c);
    boxes.push({ minX: sx + dx - 0.2, maxX: sx + dx + 0.2, minZ: sz + dz - 0.2, maxZ: sz + dz + 0.2 });
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.8, 4), lambert('#9a5a3a'));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(sx, end.top + 2.6, sz);
  roof.castShadow = true;
  scene.add(roof);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 2.3), col);
  lintel.position.set(sx, end.top + 2.25, sz);
  scene.add(lintel);
  const altar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), lambert('#cdbb92'));
  altar.position.set(sx, end.top + 0.3, sz);
  scene.add(altar);
  // The light: a square tower with a fire on top, lit at dusk for boats that do not sail tonight.
  const lx = end.x + 1.7;
  const lz = end.z + 1.6;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.3, 5.4, 1.3), lambert('#e6d4aa'));
  tower.position.set(lx, end.top + 2.7, lz);
  tower.castShadow = tower.receiveShadow = true;
  scene.add(tower);
  boxes.push({ minX: lx - 0.7, maxX: lx + 0.7, minZ: lz - 0.7, maxZ: lz + 0.7 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 0.45, 8), lambert('#1e140e'));
  bowl.position.set(lx, end.top + 5.6, lz);
  scene.add(bowl);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 6), new THREE.MeshBasicMaterial({ color: '#ffd68c' }));
  fire.position.set(lx, end.top + 6.3, lz);
  fire.visible = false;
  scene.add(fire);
  const light = new THREE.PointLight('#ffb25a', 0, 18, 1.2);
  light.position.set(lx, end.top + 6.4, lz);
  scene.add(light);
  return {
    update(_minute, time, dusk) {
      fire.visible = dusk > 0.05;
      fire.scale.set(1, 0.8 + 0.35 * Math.abs(Math.sin(time * 7) * Math.sin(time * 3.1)), 1);
      light.intensity = dusk * 30;
    },
  };
}

function buildLookout(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const L = LOOKOUT;
  const rock = lambert('#8a5a3c');
  const rand = seededRng(daySeed('eferon/lookout'));
  const w = L.x1 - L.x0;
  const d = L.z1 - L.z0;
  const block = new THREE.Mesh(new THREE.BoxGeometry(w, L.top, d), rock);
  block.position.set((L.x0 + L.x1) / 2, L.top / 2, (L.z0 + L.z1) / 2);
  block.castShadow = block.receiveShadow = true;
  scene.add(block);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2), textured(pavingTexture(), '#d8c49c'));
  top.rotation.x = -Math.PI / 2;
  top.position.set((L.x0 + L.x1) / 2, L.top + 0.01, (L.z0 + L.z1) / 2);
  top.receiveShadow = true;
  scene.add(top);
  // Boulders round its foot, so it reads as rock and not as a building.
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const onX = i % 2 === 0;
    const x = onX ? L.x0 + t * w : (i % 4 === 1 ? L.x0 - 0.3 : L.x1 + 0.3);
    const z = onX ? L.z1 + 0.3 : L.z0 + t * d;
    if (x > L.stair.x0 - 0.8 && x < L.stair.x1 + 0.8 && z > L.z1 - 0.5) continue;
    const r = 0.7 + rand() * 0.8;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock);
    m.position.set(x, r * 0.6 + rand() * 1.2, z);
    m.rotation.set(rand() * 3, rand() * 3, 0);
    m.castShadow = true;
    scene.add(m);
  }
  // The stair cut into the south face, step by step.
  const steps = 10;
  const run = (L.stair.foot - L.z1) / steps;
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) / steps) * L.top;
    const st = new THREE.Mesh(new THREE.BoxGeometry(L.stair.x1 - L.stair.x0, h, run), lambert('#cdbb92'));
    st.position.set((L.stair.x0 + L.stair.x1) / 2, h / 2, L.stair.foot - (i + 0.5) * run);
    st.receiveShadow = true;
    scene.add(st);
  }
  // On top: a stone bench, a herm, and a cypress bent by the wind off the mountain.
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 0.5), lambert('#e6d9b8'));
  bench.position.set(-10.6, L.top + 0.22, -24.8);
  scene.add(bench);
  boxes.push({ minX: -11.6, maxX: -9.6, minZ: -25.05, maxZ: -24.55 });
  const herm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), lambert('#f0e6cc'));
  herm.position.set(-13.3, L.top + 0.8, -21.4);
  herm.castShadow = true;
  scene.add(herm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), lambert('#f0e6cc'));
  head.position.set(-13.3, L.top + 1.85, -21.4);
  scene.add(head);
  boxes.push({ minX: -13.55, maxX: -13.05, minZ: -21.65, maxZ: -21.15 });
  return { update() {} };
}

function buildNecropolis(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const N = NECROPOLIS;
  const z0 = WEST_GATE.z;
  const rand = seededRng(daySeed('eferon/necropolis'));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(N.from - N.to + 2, 3), textured(pavingTexture(), '#e6d5b2'));
  road.rotation.x = -Math.PI / 2;
  road.position.set((N.from + N.to) / 2, 0.012, z0);
  road.receiveShadow = true;
  scene.add(road);
  const marble = lambert('#f0e6cc');
  const grey = lambert('#d8c8a8');
  const put = (m: THREE.Mesh, x: number, y: number, z: number, block: [number, number]) => {
    m.position.set(x, y, z);
    m.castShadow = true;
    scene.add(m);
    boxes.push({ minX: x - block[0], maxX: x + block[0], minZ: z - block[1], maxZ: z + block[1] });
  };
  // Grave stelai on both sides of the road, some with a pediment, some a small column.
  for (let x = N.from - 1.6; x > N.to + 1.5; x -= 2.1) {
    for (const side of [-1, 1]) {
      if (side === 1 && Math.abs(x + 39.5) < 1.2) continue; // Phyllis's place is kept for her stone
      const z = z0 + side * (3.2 + rand() * 0.5);
      const kind = rand();
      if (kind < 0.55) {
        const h = 1.1 + rand() * 0.6;
        put(new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.18), rand() < 0.5 ? marble : grey), x, h / 2, z, [0.3, 0.12]);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 3), marble);
        cap.rotation.z = Math.PI / 2;
        cap.rotation.y = Math.PI / 2;
        cap.position.set(x, h + 0.12, z);
        scene.add(cap);
      } else if (kind < 0.8) {
        const h = 0.9 + rand() * 0.5;
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 8), marble), x, h / 2, z, [0.2, 0.2]);
      } else {
        const lek = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.9, 8), grey);
        put(lek, x, 0.45, z, [0.25, 0.25]);
      }
    }
  }
  // A family tomb: a stone house of the dead with a pediment, on the north side.
  const tomb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 1.6), grey);
  put(tomb, -34.2, 0.9, z0 - 4, [1.25, 0.85]);
  const ped = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 3), marble);
  ped.rotation.set(0, Math.PI / 2, Math.PI / 2);
  ped.scale.set(1, 1, 0.55);
  ped.position.set(-34.2, 2.0, z0 - 4);
  scene.add(ped);
  // Phyllis: a tall stele with a painted panel, a woman carrying a water jar.
  const phyllis = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.22), marble);
  put(phyllis, -39.5, 0.95, z0 + 3.4, [0.4, 0.14]);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.04), new THREE.MeshBasicMaterial({ color: '#b5532a' }));
  panel.position.set(-39.5, 1.15, z0 + 3.28);
  scene.add(panel);
  const woman = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.05), new THREE.MeshBasicMaterial({ color: '#17110d' }));
  woman.position.set(-39.5, 1.08, z0 + 3.25);
  scene.add(woman);
  const sprig = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.12), lambert('#4a3a22'));
  sprig.position.set(-39.5, 0.06, z0 + 3.1);
  scene.add(sprig);
  // Cypresses behind the graves.
  for (let x = N.from - 3; x > N.to; x -= 4.3) {
    for (const side of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4 + rand() * 2, 6), lambert('#241a12'));
      c.position.set(x + rand(), 2.4, z0 + side * (5.4 + rand()));
      c.castShadow = true;
      scene.add(c);
    }
  }
  // Rocks where the graves end; the road goes on between them into the country (country.ts).
  for (const dz of [-3.4, 3.6]) {
    const r = 0.8 + rand() * 0.5;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), lambert('#7a4a30'));
    put(m, N.to + 0.6, r * 0.6, z0 + dz, [r * 0.7, r * 0.7]);
  }
  return { update() {} };
}

function buildGymnasium(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const G = GYM;
  // The palaestra: a court of raked sand, a stoa along the wall, a running track at the far side.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(G.x1 - G.x0, G.z1 - G.z0), lambert('#e3d3b0'));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((G.x0 + G.x1) / 2, 0.01, (G.z0 + G.z1) / 2);
  sand.receiveShadow = true;
  scene.add(sand);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(G.x1 - G.x0 - 1, 1.6), lambert('#c9a57c'));
  track.rotation.x = -Math.PI / 2;
  track.position.set((G.x0 + G.x1) / 2, 0.015, G.track);
  scene.add(track);
  for (const x of [G.x0 + 0.8, G.x1 - 0.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), lambert('#f0e6cc'));
    post.position.set(x, 0.6, G.track - 1);
    scene.add(post);
    boxes.push({ minX: x - 0.15, maxX: x + 0.15, minZ: G.track - 1.15, maxZ: G.track - 0.85 });
  }
  // The stoa: columns along the court, a tiled roof back to the city wall.
  const col = lambert('#f0e6cc');
  const sx = G.x0 + 1.6;
  for (let z = G.z0 + 0.6; z <= G.z1 - 0.4; z += 1.7) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 2.8, 8), col);
    c.position.set(sx, 1.4, z);
    c.castShadow = true;
    scene.add(c);
    boxes.push({ minX: sx - 0.22, maxX: sx + 0.22, minZ: z - 0.22, maxZ: z + 0.22 });
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, G.z1 - G.z0), lambert('#9a5a3a'));
  roof.position.set(G.x0 + 0.75, 3, (G.z0 + G.z1) / 2);
  roof.rotation.z = -0.12;
  roof.castShadow = true;
  scene.add(roof);
  // Runners down the track and back, wrestlers in the sand, the trainer with his forked stick.
  const runners = [0, 1, 2].map(() => makeFigure('#3a2418', 1.62));
  const wrestlers = [0, 1].map(() => makeFigure('#2a1a12', 1.62));
  const trainer = makeFigure('#17110d', 1.7);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), lambert('#4a2c1a'));
  stick.position.set(0.32, 0.9, 0.1);
  trainer.add(stick);
  for (const f of [...runners, ...wrestlers, trainer]) scene.add(f);
  wrestlers[0]!.position.set(-22.8, 0, 10.4);
  wrestlers[1]!.position.set(-22.1, 0, 10.4);
  wrestlers[0]!.rotation.set(0, Math.PI / 2, 0.35);
  wrestlers[1]!.rotation.set(0, -Math.PI / 2, -0.35);
  trainer.position.set(-24.6, 0, 11.6);
  trainer.rotation.y = Math.PI / 2;
  const length = G.x1 - G.x0 - 2.4;
  let fell: { x: number } | null = null;
  let lastX = 0;
  return {
    update(minute, time, _dusk, world) {
      const open = (minute >= at(7) && minute < at(12)) || (minute >= at(15) && minute < at(18, 30));
      for (const f of [...runners, ...wrestlers, trainer]) f.visible = open;
      if (!open) return;
      if (world.happened('runner_fell') && !fell) fell = { x: (G.x0 + G.x1) / 2 };
      runners.forEach((f, i) => {
        const lane = G.track + (i - 1) * 0.45;
        // The third one down, since something was left on his lane: sitting in the sand, holding his ankle.
        if (i === 2 && fell) {
          f.position.set(fell.x, 0.25, lane);
          f.rotation.set(-Math.PI / 2 + 0.5, Math.PI / 2, 0);
          return;
        }
        // Down and back, the pace fixed by the clock; the third is always one stride behind the second.
        const phase = (minute * 0.9 + (i === 2 ? 0.36 : i * 0.4)) % 2;
        const t = phase < 1 ? phase : 2 - phase;
        f.position.set(G.x0 + 1.2 + t * length, Math.abs(Math.sin(time * 11 + i)) * 0.08, lane);
        f.rotation.set(0, phase < 1 ? Math.PI / 2 : -Math.PI / 2, 0);
        // Whatever lies on his lane between where he was and where he is now, he trips over.
        if (i === 2) {
          const x0 = Math.min(lastX, f.position.x) - 0.3;
          const x1 = Math.max(lastX, f.position.x) + 0.3;
          const hit = Math.abs(lastX - f.position.x) < 3 && world.things.find((th) => Math.abs(th.z - lane) < 0.4 && th.x > x0 && th.x < x1);
          lastX = f.position.x;
          if (hit) {
            fell = { x: hit.x };
            world.event('runner_fell', hit.x, lane);
          }
        }
      });
      wrestlers.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(time * 1.3) * 0.08); });
    },
  };
}

function buildGrove(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const G = GROVE;
  const rand = seededRng(daySeed('eferon/grove'));
  // Rows of old olives on two terraces, each tree a crooked trunk under dark clumps of leaves.
  const trunk = lambert('#2a1a12');
  const leaves = lambert('#4a3a22');
  const tree = (x: number, z: number, s = 1) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 1.5 * s, 5), trunk);
    t.position.set(x, 0.75 * s, z);
    t.rotation.z = (rand() - 0.5) * 0.4;
    t.castShadow = true;
    scene.add(t);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry((0.6 + rand() * 0.35) * s, 0), leaves);
      c.position.set(x + (rand() - 0.5) * 1.1 * s, (1.6 + rand() * 0.5) * s, z + (rand() - 0.5) * 1.1 * s);
      c.castShadow = true;
      scene.add(c);
    }
    boxes.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
  };
  for (const z of [12.2, 15.6]) {
    for (let x = G.x0 + 1.2; x < G.x1 - 1; x += 3.3) {
      if (Math.hypot(x - G.press.x, z - G.press.z) < 2.6 || Math.hypot(x - G.planter.x, z - G.planter.z) < 2) continue;
      tree(x + (rand() - 0.5) * 0.6, z + (rand() - 0.5) * 0.6);
    }
  }
  // A low terrace wall between the rows, open in the middle.
  const wallMat = lambert('#b98a62');
  for (const [x0, x1] of [[G.x0, 20.6], [22.4, G.x1]] as const) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.45, 0.4), wallMat);
    w.position.set((x0 + x1) / 2, 0.22, 13.95);
    w.castShadow = w.receiveShadow = true;
    scene.add(w);
    boxes.push({ minX: x0, maxX: x1, minZ: 13.75, maxZ: 14.15 });
  }
  // The press: a round stone basin, a millstone on its edge turning round a post, a lever beam.
  const p = G.press;
  const stone = lambert('#d8c8a8');
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.6, 16), stone);
  basin.position.set(p.x, 0.3, p.z);
  basin.castShadow = basin.receiveShadow = true;
  scene.add(basin);
  boxes.push({ minX: p.x - 1.2, maxX: p.x + 1.2, minZ: p.z - 1.2, maxZ: p.z + 1.2 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), trunk);
  post.position.set(p.x, 1, p.z);
  scene.add(post);
  const turn = new THREE.Group();
  turn.position.set(p.x, 0.6, p.z);
  const mill = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14), stone);
  mill.rotation.z = Math.PI / 2;
  mill.position.set(0.5, 0.5, 0);
  const axle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), trunk);
  axle.position.set(0.9, 0.55, 0);
  turn.add(mill, axle);
  scene.add(turn);
  for (let i = 0; i < 4; i++) {
    const a = amphoraLike(i);
    a.position.set(p.x + 1.6 + (i % 2) * 0.5, 0, p.z - 1 + Math.floor(i / 2) * 0.55);
    scene.add(a);
  }
  // The worker walking the millstone round, and the old man planting an olive he will not see grow.
  const worker = makeFigure('#3a2418', 1.62);
  scene.add(worker);
  const old = makeFigure('#2a1a12', 1.45);
  old.position.set(G.planter.x, -0.35, G.planter.z);
  old.rotation.set(0.35, Math.PI, 0);
  scene.add(old);
  const sapling = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), trunk);
  stem.position.y = 0.45;
  const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), leaves);
  tuft.position.y = 0.95;
  sapling.add(stem, tuft);
  sapling.position.set(G.planter.x, 0, G.planter.z - 0.7);
  scene.add(sapling);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), lambert('#6b3a22'));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(G.planter.x, 0.02, G.planter.z - 0.7);
  scene.add(hole);
  let stoppedAt = -1;
  return {
    update(minute, _time, _dusk, world) {
      const working = minute >= at(7) && minute < at(18);
      worker.visible = working;
      old.visible = working;
      if (!working) return;
      // A stone in the basin jams the millstone: the one thing in the day that has never happened.
      if (!world.happened('press_stopped') && world.things.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 1.1)) {
        world.event('press_stopped', p.x, p.z);
      }
      if (world.happened('press_stopped')) {
        // The stone stands where it stuck; the worker stands and stares at it.
        if (stoppedAt < 0) stoppedAt = minute;
        const a = (stoppedAt / 8) * Math.PI * 2;
        turn.rotation.y = -a;
        worker.position.set(p.x + Math.cos(a) * 2.2, 0, p.z + Math.sin(a) * 2.2);
        worker.rotation.y = Math.atan2(p.x - worker.position.x, p.z - worker.position.z);
        return;
      }
      // One slow round every eight minutes of the day.
      const a = (minute / 8) * Math.PI * 2;
      turn.rotation.y = -a;
      worker.position.set(p.x + Math.cos(a) * 2.2, 0, p.z + Math.sin(a) * 2.2);
      worker.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
    },
  };
}

/** A small storage jar standing in the grove. */
function amphoraLike(i: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.7, 8), lambert(i % 2 ? '#8f4a2a' : '#a55a34'));
  m.geometry.translate(0, 0.35, 0);
  m.castShadow = true;
  return m;
}

function buildMarket(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const M = MARKET;
  const wood = lambert('#4a2c1a');
  const cloth = [lambert('#9a5a3a'), lambert('#e6d4aa')];
  const fishMat = new THREE.MeshBasicMaterial({ color: '#e8e2d0' });
  const sellers: THREE.Group[] = [];
  const fish: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const x = M.x + i * 2.5;
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.9), lambert('#d8c49c'));
    table.position.set(x, 0.8, M.z);
    table.castShadow = table.receiveShadow = true;
    scene.add(table);
    boxes.push({ minX: x - 0.95, maxX: x + 0.95, minZ: M.z - 0.45, maxZ: M.z + 0.45 });
    for (const dx of [-0.85, 0.85]) {
      for (const dz of [-0.4, 0.8]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), wood);
        pole.position.set(x + dx, 1.1, M.z + dz);
        scene.add(pole);
      }
    }
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.6), cloth[i]!);
    awning.position.set(x, 2.25, M.z + 0.2);
    awning.rotation.x = -0.15;
    awning.castShadow = true;
    scene.add(awning);
    for (let k = 0; k < 5; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), fishMat);
      f.scale.set(2.2, 0.6, 1);
      f.position.set(x - 0.7 + k * 0.35, 0.9, M.z - 0.15 + (k % 2) * 0.28);
      f.rotation.y = (k % 3) * 0.4;
      scene.add(f);
      fish.push(f);
    }
    const seller = makeFigure(i ? '#2a1a12' : '#3a2418', 1.6);
    seller.position.set(x, 0, M.z + 0.9);
    seller.rotation.y = Math.PI;
    scene.add(seller);
    sellers.push(seller);
  }
  // Baskets of the morning's catch at the side.
  for (const [dx, dz] of [[-1.4, 0.6], [4.1, -0.3], [4.3, 0.5]] as const) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.4, 8), lambert('#c99a5a'));
    b.position.set(M.x + dx, 0.2, M.z + dz);
    scene.add(b);
  }
  return {
    update(minute) {
      // The catch sells out by noon; after that the tables are bare.
      const open = minute < at(12, 30);
      for (const s of sellers) s.visible = open;
      // A fish someone walked off with stays with them.
      for (const f of fish) if (!f.userData.taken) f.visible = open;
    },
    loose: fish.map((f) => [f, 'fish']),
  };
}

function buildShipyard(scene: THREE.Scene, boxes: Box[]): PlaceLife {
  const S = SHIPYARD;
  const wood = lambert('#3a2418');
  const pale = lambert('#c9a57c');
  // The keel on its stocks, the ribs standing bare, planks up one side only.
  const keel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.22, 0.26), wood);
  keel.position.set(S.x, 0.62, S.z);
  scene.add(keel);
  for (const dx of [-2.4, 0, 2.4]) {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.2), pale);
    stock.position.set(S.x + dx, 0.25, S.z);
    scene.add(stock);
  }
  for (let i = 0; i < 9; i++) {
    const x = S.x - 2.8 + i * 0.7;
    const w = 1.2 - Math.abs(i - 4) * 0.12;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(w, 0.07, 4, 10, Math.PI), wood);
    rib.rotation.set(0, Math.PI / 2, Math.PI);
    rib.position.set(x, 1.7, S.z);
    rib.castShadow = true;
    scene.add(rib);
  }
  for (let k = 0; k < 3; k++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(5.6 - k * 0.6, 0.12, 0.2), pale);
    const a = 0.5 + k * 0.35;
    plank.position.set(S.x, 1.7 - Math.cos(a) * 1.1, S.z + Math.sin(a) * 1.1);
    plank.rotation.x = a;
    plank.castShadow = true;
    scene.add(plank);
  }
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), wood);
  stem.position.set(S.x + 3.3, 1.5, S.z);
  stem.rotation.z = -0.3;
  scene.add(stem);
  boxes.push({ minX: S.x - 3.4, maxX: S.x + 3.6, minZ: S.z - 1.3, maxZ: S.z + 1.3 });
  // A sawhorse with a plank across it, and the shipwright with his adze.
  const horse = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.3), pale);
  horse.position.set(S.x - 1.5, 0.8, S.z - 2.6);
  scene.add(horse);
  for (const dx of [-0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.5), wood);
    leg.position.set(S.x - 1.5 + dx, 0.4, S.z - 2.6);
    scene.add(leg);
  }
  boxes.push({ minX: S.x - 2.3, maxX: S.x - 0.7, minZ: S.z - 2.85, maxZ: S.z - 2.35 });
  const wright = makeFigure('#2a1a12', 1.66);
  wright.position.set(S.x + 1.2, 0, S.z - 1.8);
  wright.rotation.y = Math.PI;
  const adze = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), wood);
  adze.position.set(0.35, 1.1, 0.25);
  wright.add(adze);
  scene.add(wright);
  return {
    update(minute, time) {
      const working = minute >= at(7) && minute < at(18);
      wright.visible = working;
      adze.rotation.x = working ? Math.abs(Math.sin(time * 2.4)) * 1.2 : 0;
    },
  };
}

/** Build every place; the returned lives are updated with the clock each frame. */
export function buildPlaces(scene: THREE.Scene, boxes: Box[]): PlaceLife[] {
  return [
    buildTheatre(scene, boxes), buildCape(scene, boxes), buildLookout(scene, boxes), buildNecropolis(scene, boxes),
    buildGymnasium(scene, boxes), buildGrove(scene, boxes), buildMarket(scene, boxes), buildShipyard(scene, boxes),
    buildCountry(scene, boxes),
  ];
}
