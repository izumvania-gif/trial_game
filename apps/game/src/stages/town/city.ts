// The edges of Eferon and its night: the wall around three sides with the gate to the holy
// mountain, the harbour on the fourth, and the torches that are lit when the sun goes down.
// Everything here is fixed: the same city every cycle.
import * as THREE from 'three';
import { lambert, pavingTexture, textured } from '../figures.ts';

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Inner lines of the wall; the shore line is where the wall runs into the sea. */
export const WALL = { west: -29.5, east: 29.5, north: -27, shore: 24, gateX: 10, gateHalf: 1.9 };

const HEIGHT = 3.4;
const THICK = 1.1;
const TOWER = 2.7;

/** Coursed stone: the flagstone pattern, bigger, on the vertical faces. */
function ashlar(width: number, height: number): THREE.MeshLambertMaterial {
  const tex = pavingTexture().clone();
  tex.repeat.set(width / 3, height / 2.2);
  tex.needsUpdate = true;
  return textured(tex, '#dccaa4');
}

export function buildWalls(scene: THREE.Scene, boxes: Box[]): void {
  // Greek walls, after Messene: coursed ashlar with a plain parapet and a coping, no merlons;
  // square towers with slit windows and low tiled roofs.
  const copings: THREE.Matrix4[] = [];
  const coping = lambert('#e8dab8');
  const tile = lambert('#9a5a3a');
  const slit = lambert('#1a120c');
  const add = (x: number, z: number, w: number, d: number, h: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };
  // A wall segment between two points on one axis, finished with a coping along the top.
  const wall = (x1: number, z1: number, x2: number, z2: number) => {
    const alongX = z1 === z2;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    add((x1 + x2) / 2, (z1 + z2) / 2, alongX ? len : THICK, alongX ? THICK : len, HEIGHT, ashlar(len, HEIGHT));
    const c = new THREE.Matrix4().compose(
      new THREE.Vector3((x1 + x2) / 2, HEIGHT + 0.12, (z1 + z2) / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(alongX ? len : THICK + 0.25, 0.24, alongX ? THICK + 0.25 : len),
    );
    copings.push(c);
  };
  const tower = (x: number, z: number, h = HEIGHT + 1.4) => {
    add(x, z, TOWER, TOWER, h, ashlar(TOWER, h));
    const lip = new THREE.Mesh(new THREE.BoxGeometry(TOWER + 0.35, 0.22, TOWER + 0.35), coping);
    lip.position.set(x, h + 0.11, z);
    scene.add(lip);
    // A low pyramid of tiles.
    const roof = new THREE.Mesh(new THREE.ConeGeometry((TOWER + 0.5) * Math.SQRT1_2, 0.9, 4), tile);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(x, h + 0.22 + 0.45, z);
    roof.castShadow = true;
    scene.add(roof);
    // Slit windows high on every face.
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.06 : 0.28, 0.7, dz ? 0.06 : 0.28), slit);
      w.position.set(x + dx * (TOWER / 2 + 0.01), h - 1, z + dz * (TOWER / 2 + 0.01));
      scene.add(w);
    }
  };

  const { west: W, east: E, north: N, shore: S, gateX: G, gateHalf: g } = WALL;
  wall(W, N, G - g - TOWER / 2, N);
  wall(G + g + TOWER / 2, N, E, N);
  wall(W, N, W, S);
  wall(E, N, E, S);
  for (const z of [N, N + 12.5, N + 25, N + 37.5, S]) {
    tower(W, z);
    tower(E, z);
  }
  for (const x of [-17, -4.5, 21]) tower(x, N);

  // The gate to the holy mountain: two tall towers, a lintel, the doors standing open.
  tower(G - g - TOWER / 2, N, HEIGHT + 2.2);
  tower(G + g + TOWER / 2, N, HEIGHT + 2.2);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2 * g + 0.4, 0.9, THICK + 0.3), lambert('#d2bf97'));
  lintel.position.set(G, HEIGHT + 0.2, N);
  lintel.castShadow = true;
  scene.add(lintel);
  const wood = lambert('#3a2418');
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(g, HEIGHT - 0.5, 0.18), wood);
    leaf.geometry.translate((side * -g) / 2, 0, 0);
    leaf.position.set(G + side * g, (HEIGHT - 0.5) / 2, N + 0.3);
    leaf.rotation.y = side * 1.25;
    leaf.castShadow = true;
    scene.add(leaf);
  }

  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), coping, copings.length);
  copings.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.castShadow = true;
  scene.add(inst);
  buildOutsideGate(scene, boxes);
}

/** Past the gate: a short stretch of the sacred road between rocks, up to the boundary stone. */
export const OUTSIDE = { halfWidth: 5.2, end: -37.5 };

/** Outside the walls, only the road beyond the gate can be walked. */
export function outsideRoad(x: number, z: number): boolean {
  if (z > WALL.north - THICK / 2) return true;
  return Math.abs(x - WALL.gateX) < OUTSIDE.halfWidth && z > OUTSIDE.end;
}

/** Where the boundary stone stands, at the end of the walk: the god's land begins past it. */
export const HOROS = { x: WALL.gateX + 1.6, z: OUTSIDE.end + 1.2 };

function buildOutsideGate(scene: THREE.Scene, boxes: Box[]): void {
  const G = WALL.gateX;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(3, 14), textured(pavingTexture(), '#e6d5b2'));
  road.rotation.x = -Math.PI / 2;
  road.position.set(G, 0.012, WALL.north - 7);
  road.receiveShadow = true;
  scene.add(road);
  const rock = lambert('#7a4a30');
  // Rocks along both sides and across the far end, where the road starts to climb.
  const place = (x: number, z: number, r: number, turn: number) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock);
    m.position.set(x, r * 0.55, z);
    m.rotation.set(turn, turn * 2, 0);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    boxes.push({ minX: x - r * 0.8, maxX: x + r * 0.8, minZ: z - r * 0.8, maxZ: z + r * 0.8 });
  };
  for (let i = 0; i < 6; i++) {
    const z = WALL.north - 2 - i * 1.9;
    place(G - OUTSIDE.halfWidth - 0.3 + (i % 2) * 0.3, z, 1 + (i % 3) * 0.3, i);
    place(G + OUTSIDE.halfWidth + 0.3 - (i % 2) * 0.3, z - 0.8, 0.9 + ((i + 1) % 3) * 0.3, i + 2);
  }
  for (const [dx, r] of [[-4, 1.3], [-2.2, 1], [3.8, 1.2], [-0.2, 0.6]] as const) place(G + dx, OUTSIDE.end - 0.9, r, dx);
  // The boundary stone: a plain pillar with the god's word on it.
  const horos = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.35), lambert('#f0e6cc'));
  horos.position.set(HOROS.x, 0.65, HOROS.z);
  horos.castShadow = true;
  scene.add(horos);
  boxes.push({ minX: HOROS.x - 0.3, maxX: HOROS.x + 0.3, minZ: HOROS.z - 0.25, maxZ: HOROS.z + 0.25 });
}

/** The stone mole: walkable, from the beach out into the harbour. Its top stands at `top`. */
export const MOLE = { x: -6, half: 1.1, from: 22, to: 34.6, top: 0.3 };

/** The beach: dry sand to `dry`, then the foreshore slopes into the water and gets too deep at `deep`. */
export const BEACH = { dry: 25.3, slope: 0.5, deep: 27.2 };

/** How high the ground is at (x, z): the streets, the beach, the wet slope, the mole. */
export function groundAt(x: number, z: number): number {
  if (Math.abs(x - MOLE.x) < MOLE.half && z > MOLE.from && z < MOLE.to) return MOLE.top;
  if (z <= BEACH.dry) return 0;
  return -(z - BEACH.dry) * BEACH.slope;
}

/** Past the shallows, off the mole: the water is too deep to walk. */
export function tooDeep(x: number, z: number): boolean {
  if (Math.abs(x - MOLE.x) < MOLE.half + 0.1 && z > MOLE.from && z < MOLE.to) return false;
  return z > BEACH.deep;
}

/** The harbour: a stone mole out into the water, and two boats that did not sail. */
export function buildHarbour(scene: THREE.Scene, boxes: Box[]): THREE.Group[] {
  const stone = textured(pavingTexture(), '#e0cfa8');
  const mole = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 13), stone);
  mole.position.set(-6, -0.25, 28.5);
  mole.castShadow = mole.receiveShadow = true;
  scene.add(mole);
  for (let i = 0; i < 4; i++) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 6), lambert('#3a2418'));
    bollard.position.set(i % 2 ? -5 : -7, 0.55, 24 + i * 3);
    scene.add(bollard);
    boxes.push({ minX: bollard.position.x - 0.2, maxX: bollard.position.x + 0.2, minZ: bollard.position.z - 0.2, maxZ: bollard.position.z + 0.2 });
  }
  // The foreshore: wet sand sloping from the dry beach under the water, so the sea has an edge to wash up.
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(140, 4), lambert('#c79a6e'));
  const drop = 4 * BEACH.slope;
  wet.rotation.x = -Math.PI / 2 + Math.atan(BEACH.slope);
  wet.position.set(0, -drop / 2, BEACH.dry + 2 * Math.cos(Math.atan(BEACH.slope)));
  wet.receiveShadow = true;
  scene.add(wet);
  const boats: THREE.Group[] = [];
  for (const [x, z, turn] of [[-8.9, 27, 0.2], [-3.1, 30.5, -0.25]] as const) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 4.2, 10, 1, false, Math.PI / 2, Math.PI), lambert('#2e1c12'));
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1, 1, 0.55);
    hull.castShadow = true;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 5), lambert('#3a2418'));
    mast.position.y = 1.5;
    const sail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 0.28), lambert('#efe4c8'));
    sail.position.y = 2.7;
    boat.add(hull, mast, sail);
    boat.position.set(x, -0.2, z);
    boat.rotation.y = turn;
    boat.userData.baseY = -0.2;
    scene.add(boat);
    boxes.push({ minX: x - 1, maxX: x + 1, minZ: z - 2.2, maxZ: z + 2.2 });
    boats.push(boat);
  }
  return boats;
}

/** Where torches stand: by the temple steps, the stele, the agora, the port, the gate. */
export const TORCH_SPOTS: [number, number][] = [
  [-3.9, -13.3], [3.9, -13.3], [-6, -9.8], [5.6, 3.8], [9.6, -1.4], [1.9, 1.9], [-4.4, 15.8],
  [-9.6, 14.8], [WALL.gateX - WALL.gateHalf - 0.6, -25.2], [WALL.gateX + WALL.gateHalf + 0.6, -25.2],
  [16.4, -10], [19.6, 3], [-15.4, -12], [2, 19.2],
];

/** Torches on posts. They are lit at dusk; each is a real light that throws a warm pool around it. */
export class Torches {
  private flames: THREE.Mesh[] = [];
  private lights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene, boxes: Box[]) {
    const iron = lambert('#1e140e');
    const fire = new THREE.MeshBasicMaterial({ color: '#ffd68c' });
    TORCH_SPOTS.forEach(([x, z]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.2, 5), iron);
      post.position.set(x, 1.1, z);
      post.castShadow = true;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.12, 0.26, 7), iron);
      bowl.position.set(x, 2.3, z);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6), fire);
      flame.position.set(x, 2.7, z);
      const light = new THREE.PointLight('#ffb25a', 0, 12, 1.3);
      light.position.set(x, 3, z);
      scene.add(post, bowl, flame, light);
      this.flames.push(flame);
      this.lights.push(light);
      boxes.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15 });
    });
  }

  /** `lit` 0..1: dusk to night; `gust` makes them gutter. The flicker is a fixed function of time, not chance. */
  update(time: number, lit: number, gust = 0): void {
    this.flames.forEach((flame, i) => {
      const amp = 0.18 + 0.35 * gust;
      const flicker = 1 - amp + amp * Math.sin(time * (11 + 8 * gust) + i * 1.7) * Math.sin(time * 6.3 + i * 2.9);
      flame.rotation.z = gust * 0.5 * Math.sin(time * 7 + i);
      flame.visible = lit > 0.02;
      flame.scale.set(1, 0.85 + 0.3 * flicker, 1);
      this.lights[i]!.intensity = lit * 22 * flicker;
    });
  }
}
