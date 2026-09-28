// Places to walk in, beyond the streets: each is somewhere to stand and look, with a line of its
// own and a small life that follows the clock. They bring their own ground (steps, ridges, rock),
// which the town's `groundAt` asks first; `free` in TownStage refuses any step up or down higher
// than `STEP`, so the edges of these places are cliffs without a wall being built for them.
import * as THREE from 'three';
import { daySeed, seededRng } from '../../core/rng.ts';
import { at } from '../../core/clock.ts';
import { lambert, makeFigure, pavingTexture, textured } from '../figures.ts';
import type { Box } from './city.ts';

/** The highest step the scribe takes without a stair. */
export const STEP = 0.7;

export interface PlaceSpot {
  x: number;
  z: number;
  radius: number;
  knot: string;
  label: string;
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

function capeHeight(x: number, z: number): number | null {
  const { end } = CAPE;
  if (Math.hypot(x - end.x, z - end.z) < end.r) return end.top;
  if (Math.abs(x - CAPE.x) < CAPE.half && z > CAPE.from && z < CAPE.to + 0.8) {
    // Up from the sand over the first few metres, then along the top.
    return Math.min(CAPE.top, ((z - CAPE.from) / 2.4) * CAPE.top) + (z > CAPE.to ? ((z - CAPE.to) / 0.8) * (end.top - CAPE.top) : 0);
  }
  return null;
}

/** Walkable rock or stone out over the water, where the sea is not too deep. */
export function onPlaceOverWater(x: number, z: number): boolean {
  return capeHeight(x, z) !== null;
}

/** The ground of these places at (x, z), or null where they do not reach. */
export function placeGround(x: number, z: number): number | null {
  return theatreHeight(x, z) ?? capeHeight(x, z);
}

/** Where the player can talk or look. */
export const PLACE_SPOTS: PlaceSpot[] = [
  { x: THEATRE.x, z: THEATRE.z + 0.4, radius: 2, knot: 'theatre', label: 'The theatre' },
  { x: CAPE.end.x - 0.6, z: CAPE.end.z - 2.2, radius: 1.8, knot: 'cape_shrine', label: 'The shrine of Poseidon' },
];

/** Keep houses out of these places. */
export function placeReserved(x: number, z: number): boolean {
  return (x > 13.5 && z < -14.6 && z > -27) || (x > 17 && x < 27 && z > 19);
}

/** The places' small lives, moved by the clock. */
export interface PlaceLife {
  update(minute: number, time: number, dusk: number): void;
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

/** Build every place; the returned lives are updated with the clock each frame. */
export function buildPlaces(scene: THREE.Scene, boxes: Box[]): PlaceLife[] {
  return [buildTheatre(scene, boxes), buildCape(scene, boxes)];
}
