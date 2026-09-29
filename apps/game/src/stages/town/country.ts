// Beyond the west gate and the road of the dead: the country. Low hills of red earth, field walls,
// a farm where a mule goes round the threshing floor all day, goats on the slope, and the road
// running on west into the hills until it stops getting anywhere: the edge of the world, where the
// hill ahead never comes nearer. Everything is fixed by the seed, as in the city.
import * as THREE from 'three';
import { at } from '../../core/clock.ts';
import { daySeed, seededRng } from '../../core/rng.ts';
import { lambert, makeFigure } from '../figures.ts';
import { quadruped, trot } from './animals.ts';
import type { Box } from './city.ts';

/** The walkable country outside the west wall: from the wall to the edge, from the north hills to the shore. */
export const COUNTRY = { west: -71, east: -30.1, north: -24, south: 34, road: 4.2, shore: 22 };
/** The farm north of the road, its yard level; the threshing floor in front of it. */
export const FARM = { x: -55, z: -9, floor: { x: -50.5, z: -3.2, r: 3 } };
/** Where the road stops getting anywhere. */
export const EDGE_X = -69;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

function hills(x: number, z: number): number {
  return 1.1 + 0.9 * Math.sin(x * 0.13 + 1) * Math.sin(z * 0.11 + 0.4) + 0.6 * Math.sin(x * 0.07 - z * 0.09 + 2);
}

/** The height of the country at (x, z), or null outside it (the city, the sea). */
export function countryHeight(x: number, z: number): number | null {
  if (x >= COUNTRY.east || x < COUNTRY.west - 1 || z < COUNTRY.north - 1 || z > COUNTRY.shore) return null;
  // The road and the necropolis beside it stay level; the hills rise away from them and from the wall.
  const band = x > -46 ? 5.8 : 2.4;
  let k = smooth((Math.abs(z - COUNTRY.road) - band) / 6);
  k *= smooth((COUNTRY.east - x) / 5);
  k *= smooth((Math.hypot(x - FARM.x, z - FARM.z) - 7) / 3);
  k *= smooth((COUNTRY.shore - z) / 5);
  // Higher towards the edge of the world.
  const rise = Math.max(0, (-56 - x) * 0.2);
  return k * (hills(x, z) + rise);
}

export function inCountry(x: number, z: number): boolean {
  return x < COUNTRY.east && x > COUNTRY.west && z > COUNTRY.north && z < COUNTRY.south;
}

export const COUNTRY_SPOTS = [
  { x: FARM.floor.x, z: FARM.floor.z + 3.4, radius: 2, knot: 'farm', label: 'The threshing floor' },
  { x: EDGE_X, z: COUNTRY.road, radius: 2.2, knot: 'world_edge', label: 'The road west' },
];

export interface CountryLife {
  update(minute: number, time: number): void;
}

export function buildCountry(scene: THREE.Scene, boxes: Box[]): CountryLife {
  const rand = seededRng(daySeed('eferon/country'));
  // The ground: one sheet shaped to the hills, faceted like everything else.
  const w = COUNTRY.east - COUNTRY.west + 2;
  const d = COUNTRY.shore - COUNTRY.north + 2;
  const geo = new THREE.PlaneGeometry(w, d, 84, 92);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position!;
  const cx = (COUNTRY.east + COUNTRY.west) / 2 - 1;
  const cz = (COUNTRY.north + COUNTRY.shore) / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    pos.setY(i, (countryHeight(x, z) ?? 0) + 0.015);
  }
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#b27048', flatShading: true }));
  land.position.set(cx, 0, cz);
  land.receiveShadow = true;
  scene.add(land);
  // The road on west, beaten earth now, not paving.
  const road = new THREE.Mesh(new THREE.PlaneGeometry(-45.5 - COUNTRY.west + 1, 2.6), lambert('#dcc39a'));
  road.rotation.x = -Math.PI / 2;
  road.position.set((-45.5 + COUNTRY.west) / 2, 0.03, COUNTRY.road);
  road.receiveShadow = true;
  scene.add(road);

  const ground = (x: number, z: number) => countryHeight(x, z) ?? 0;
  const block = (x: number, z: number, w: number, dd: number, h: number, color: string, top = true) => {
    const y0 = ground(x, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), lambert(color));
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dd / 2, maxZ: z + dd / 2, top: top ? y0 + h : undefined });
    return m;
  };

  // The farm: a house of two wings round a yard, flat-roofed; a pen wall; a fig tree.
  block(FARM.x - 1.5, FARM.z - 2.2, 7, 3.2, 2.6, '#e2d2ae');
  block(FARM.x - 5.8, FARM.z + 1.2, 2.8, 4.2, 2.4, '#d6c49c');
  block(FARM.x + 2.6, FARM.z + 2.6, 4.2, 0.4, 1.2, '#cdb892');
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.08), lambert('#24160f'));
  door.position.set(FARM.x - 1.5, 0.8, FARM.z - 0.56);
  scene.add(door);
  const fig = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), lambert('#3a2a1a'));
  fig.position.set(FARM.x + 3.5, 2.2, FARM.z - 1.2);
  fig.scale.y = 0.8;
  fig.castShadow = true;
  scene.add(fig);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6), lambert('#24160f'));
  trunk.position.set(FARM.x + 3.5, 0.8, FARM.z - 1.2);
  scene.add(trunk);
  boxes.push({ minX: FARM.x + 3.3, maxX: FARM.x + 3.7, minZ: FARM.z - 1.4, maxZ: FARM.z - 1 });

  // The threshing floor: a ring of stone, straw on it, the mule going round and round, the farmer at the pole.
  const F = FARM.floor;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(F.r, F.r, 0.12, 20), lambert('#e8dcbc'));
  floor.position.set(F.x, 0.06, F.z);
  floor.receiveShadow = true;
  scene.add(floor);
  const straw = new THREE.Mesh(new THREE.RingGeometry(1.2, F.r - 0.3, 20), new THREE.MeshBasicMaterial({ color: '#e2c27a', side: THREE.DoubleSide }));
  straw.rotation.x = -Math.PI / 2;
  straw.position.set(F.x, 0.13, F.z);
  scene.add(straw);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 5), lambert('#3a2418'));
  pole.position.set(F.x, 0.8, F.z);
  scene.add(pole);
  const mule = quadruped(1.3, 1.1, '#241a12');
  scene.add(mule);
  const farmer = makeFigure('#2a1a12', 1.66);
  scene.add(farmer);

  // Goats on the slope north of the farm.
  const goats = Array.from({ length: 6 }, (_, i) => {
    const g = quadruped(0.62, 0.5, i % 3 ? '#1a120d' : '#e8e2d0', true);
    scene.add(g);
    return { g, x: FARM.x - 6 + rand() * 12, z: FARM.z - 7 - rand() * 6, phase: rand() * 10 };
  });

  // Field walls of piled stone across the slopes, low enough to step over with a jump.
  for (let i = 0; i < 7; i++) {
    const x = COUNTRY.west + 6 + rand() * 30;
    const z = (i % 2 ? -1 : 1) * (8 + rand() * 10) + COUNTRY.road;
    if (Math.hypot(x - FARM.x, z - FARM.z) < 9 || z > COUNTRY.shore - 3) continue;
    const len = 4 + rand() * 5;
    block(x, z, rand() < 0.5 ? len : 0.5, rand() < 0.5 ? 0.5 : len, 0.7, '#cdb892');
  }
  // Olive trees and cypresses, scattered.
  for (let i = 0; i < 26; i++) {
    const x = COUNTRY.west + 2 + rand() * 36;
    const z = COUNTRY.north + 2 + rand() * 40;
    if (Math.abs(z - COUNTRY.road) < 4 || Math.hypot(x - FARM.x, z - FARM.z) < 8 || Math.hypot(x - F.x, z - F.z) < 5) continue;
    const y = ground(x, z);
    if (rand() < 0.6) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rand() * 0.5, 0), lambert('#4a3a22'));
      crown.position.set(x, y + 1.9, z);
      crown.scale.y = 0.7;
      crown.castShadow = true;
      scene.add(crown);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.4, 5), lambert('#24160f'));
      t.position.set(x, y + 0.7, z);
      scene.add(t);
    } else {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.5 + rand() * 2, 6), lambert('#241a12'));
      c.position.set(x, y + 2.2, z);
      c.castShadow = true;
      scene.add(c);
    }
    boxes.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
  }
  // The last milestone, and beyond it hills that are only painted on the distance.
  block(EDGE_X - 0.8, COUNTRY.road + 1.9, 0.5, 0.4, 1.1, '#e6d9b8', false);
  for (let i = 0; i < 7; i++) {
    // Wholly past the edge: nothing painted on the distance can be walked into.
    const r = 8 + i * 1.5;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), lambert('#9a5c3c'));
    m.position.set(COUNTRY.west - 4 - r - (i % 3) * 5, 0, COUNTRY.road + (i - 3) * 9);
    m.scale.y = 0.55;
    scene.add(m);
  }

  return {
    update(minute, time) {
      // The farmer and his mule thresh from early morning till dusk, round and round.
      const working = minute >= at(6, 30) && minute < at(19);
      mule.visible = farmer.visible = working;
      if (working) {
        const a = minute * 0.9;
        mule.position.set(F.x + Math.cos(a) * 2.1, 0.12, F.z + Math.sin(a) * 2.1);
        mule.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI;
        trot(mule, time, 0.6);
        farmer.position.set(F.x + Math.cos(a - 0.5) * 0.7, 0.12, F.z + Math.sin(a - 0.5) * 0.7);
        farmer.rotation.y = mule.rotation.y;
      }
      for (const { g, x, z, phase } of goats) {
        const gx = x + Math.sin(minute * 0.05 + phase) * 2.2;
        const gz = z + Math.cos(minute * 0.04 + phase * 1.3) * 1.6;
        g.rotation.y = Math.atan2(Math.cos(minute * 0.05 + phase), -Math.sin(minute * 0.04 + phase * 1.3));
        g.position.set(gx, ground(gx, gz), gz);
        trot(g, time + phase, 0.25);
      }
    },
  };
}
