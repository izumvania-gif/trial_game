// Stage II, "The Last Day": third-person, camera ¾ from above, real-time, the whole polis.
// The layout is generated from a fixed seed and the residents follow fixed schedules:
// the city is the same city, and the day the same day, every cycle.
import * as THREE from 'three';
import { RESIDENTS, type Resident } from '../../content/residents.ts';
import { residentAt } from '../../core/schedule.ts';
import { daySeed, seededRng } from '../../core/rng.ts';
import { distanceToStreets, PLACES, STREET_EDGES } from '../../core/streets.ts';
import { makeSea } from '../../render/sea.ts';
import { disposeScene } from '../dispose.ts';
import { lambert, makeFigure } from '../figures.ts';
import type { Stage, StageHost } from '../types.ts';

interface Interactable {
  x: number;
  z: number;
  radius: number;
  knot: string;
  label: string;
}

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const SPEED = 5.5;
const PLAYER_RADIUS = 0.4;
/** How far the player can see a resident well enough for the Book of Strangers. */
const SEEN_DISTANCE = 11;
const BOUNDS = { minX: -28, maxX: 28, minZ: -26, maxZ: 21 };
const ENTRIES: Record<string, [number, number, number]> = {
  temple: [0, -11.5, 0],
  shore: [0, 18.5, Math.PI],
  mountain: [9.5, -20.5, 0],
};

const PLACES_TO_TALK: Interactable[] = [
  { x: -4.5, z: -10, radius: 1.8, knot: 'stele', label: 'Star stele' },
  { x: 0, z: -13.2, radius: 1.6, knot: 'temple_door', label: 'Bronze door' },
  { x: 10.5, z: 2.4, radius: 1.8, knot: 'agora_crier', label: 'Crier' },
  { x: 0, z: 20.2, radius: 2, knot: 'to_shore', label: 'Path to the sea' },
  { x: 10, z: -22.5, radius: 2, knot: 'mountain_path', label: 'Path up the mountain' },
];

interface Npc {
  resident: Resident;
  figure: THREE.Group;
}

export class TownStage implements Stage {
  readonly id = 'town' as const;
  readonly palette = 'vase' as const;
  readonly clockRuns = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);

  private host: StageHost;
  private player = makeFigure('#120e0b');
  private facing = Math.PI;
  private boxes: Box[] = [];
  private sun = new THREE.DirectionalLight('#fff4dc', 2.2);
  private sky = new THREE.HemisphereLight('#f4ead0', '#5a3520', 0.9);
  private sea = makeSea(220);
  private cloud = new THREE.Group();
  private npcs: Npc[] = [];
  private mask = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.08), new THREE.MeshLambertMaterial({ color: '#f2ead6' }));

  constructor(host: StageHost, start: { x: number; z: number; facing: number }) {
    this.host = host;
    this.buildWorld();
    this.player.position.set(start.x, 0, start.z);
    this.facing = start.facing;
    // A worn mask shows on the figure: a pale face on a black silhouette.
    this.mask.position.set(0, 1.47, 0.2);
    this.player.add(this.mask);
    this.scene.add(this.player);
    for (const resident of RESIDENTS) {
      const figure = makeFigure(resident.color, resident.id === 'cleon' ? 1.85 : 1.7);
      this.scene.add(figure);
      this.npcs.push({ resident, figure });
    }
  }

  private buildWorld(): void {
    const s = this.scene;
    s.background = new THREE.Color('#d9c9a8');
    s.fog = new THREE.Fog('#d9c9a8', 40, 110);
    s.add(this.sky);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 150 });
    s.add(this.sun, this.sun.target);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), lambert('#a86a45'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -10;
    ground.receiveShadow = true;
    s.add(ground);
    this.buildStreets();

    // The sea sits just below the shoreline and runs to the horizon.
    this.sea.position.set(0, -0.6, 24 + 110);
    s.add(this.sea);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(140, 6), lambert('#e3d3b0'));
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, 0.01, 22.5);
    beach.receiveShadow = true;
    s.add(beach);

    this.buildTemple();
    this.addBox(-4.5, -11, 1.2, 0.5, 3.2, '#f4eedd').rotation.y = 0.15; // the star stele
    this.buildAgora();
    this.buildLandmarks();
    this.buildHouses();
    this.buildMountain();
  }

  /** Pale paving along the street graph, so the city reads as a map. */
  private buildStreets(): void {
    const paving = lambert('#c89a72');
    for (const [a, b] of STREET_EDGES) {
      const pa = PLACES[a];
      const pb = PLACES[b];
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, len + 2.2), paving);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = -Math.atan2(pb.x - pa.x, pb.z - pa.z);
      strip.position.set((pa.x + pb.x) / 2, 0.005, (pa.z + pb.z) / 2);
      strip.receiveShadow = true;
      this.scene.add(strip);
    }
  }

  private addBox(x: number, z: number, w: number, d: number, h: number, color: string): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }

  private addColumns(cx: number, cz: number, xs: number[], zs: number[], height: number): void {
    for (const x of xs) {
      for (const z of zs) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, height, 8), lambert('#f2ead6'));
        col.position.set(cx + x, height / 2 + 1, cz + z);
        col.castShadow = true;
        this.scene.add(col);
      }
    }
  }

  private buildTemple(): void {
    this.addBox(0, -19, 14, 10, 1, '#efe6cf'); // stylobate
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 3, 4, 1), lambert('#d8ccb0'));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.62);
    roof.position.set(0, 8.5, -19);
    roof.castShadow = true;
    this.scene.add(roof);
    this.addColumns(0, -19, [-5.8, -3.5, -1.2, 1.2, 3.5, 5.8], [4.4, -4.4], 6);
    this.addBox(0, -19, 9, 7, 6.5, '#e6dcc2'); // cella
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.2), lambert('#3a2414'));
    door.position.set(0, 2.6, -15.45);
    this.scene.add(door);
  }

  private buildAgora(): void {
    this.addBox(12.8, 0.5, 4, 3, 1.4, '#efe6cf'); // council house steps
    const crier = makeFigure('#1a1410', 1.8);
    crier.position.set(10.8, 0, 2.8);
    crier.rotation.y = -Math.PI / 2;
    this.scene.add(crier);
  }

  private buildLandmarks(): void {
    // Aristion's house, door facing the lane.
    this.addBox(-16.8, -5.5, 5, 4.4, 3.2, '#e9dfc4');
    // Shrine of Demeter: a small porch of four columns.
    this.addBox(19.6, -12.2, 5, 3.6, 0.8, '#efe6cf');
    this.addColumns(19.6, -12.2, [-1.8, 1.8], [-1.2, 1.2], 3.2);
    const shrineRoof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 4), lambert('#d8ccb0'));
    shrineRoof.position.set(19.6, 4.5, -12.2);
    shrineRoof.castShadow = true;
    this.scene.add(shrineRoof);
    // The port tavern, with an awning over the door.
    this.addBox(-13.5, 16.8, 7, 4, 3, '#c9a57c');
    const awning = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 2), lambert('#6b3a22'));
    awning.position.set(-12.5, 2.6, 14.2);
    awning.castShadow = true;
    this.scene.add(awning);
    // Stones marking the path up the holy mountain.
    for (let i = 0; i < 6; i++) {
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), lambert('#efe6cf'));
      stone.position.set(8.2 + (i % 2) * 3.4, 0.2, -14 - i * 1.7);
      this.scene.add(stone);
    }
  }

  private buildHouses(): void {
    const rand = seededRng(daySeed('eferon/houses/v2'));
    const clear = (x: number, z: number) =>
      distanceToStreets(x, z) < 2.8 ||
      Math.hypot(x - 9, z - 1.5) < 6 || // agora
      (z < -12.5 && Math.abs(x) < 9) || // temple
      Math.hypot(x - 1, z - 21) < 5; // path to the sea
    let placed = 0;
    for (let tries = 0; tries < 800 && placed < 42; tries++) {
      const x = -26 + rand() * 52;
      const z = -24 + rand() * 40;
      const w = 2.5 + rand() * 3;
      const d = 2.5 + rand() * 3;
      const corners = [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2], [x, z]];
      if (corners.some(([cx, cz]) => clear(cx!, cz!))) continue;
      const overlaps = this.boxes.some((b) => x + w / 2 > b.minX - 1 && x - w / 2 < b.maxX + 1 && z + d / 2 > b.minZ - 1 && z - d / 2 < b.maxZ + 1);
      if (overlaps) continue;
      this.addBox(x, z, w, d, 2 + rand() * 2.5, rand() > 0.3 ? '#ece2c8' : '#c9a57c');
      placed++;
    }
  }

  private buildMountain(): void {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(30, 34, 7), lambert('#8a5a3c'));
    mountain.position.set(-6, 17, -78);
    this.scene.add(mountain);
    // The storm that ends the age gathers over the holy mountain and sinks as midnight nears.
    const dark = lambert('#2a2320');
    const rand = seededRng(daySeed('eferon/cloud'));
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + rand() * 4, 0), dark);
      puff.position.set((rand() - 0.5) * 26, (rand() - 0.5) * 5, (rand() - 0.5) * 8);
      this.cloud.add(puff);
    }
    // It has a face. Nobody in Eferon mentions it. (Unless the Curator patched the eyes out.)
    if (this.host.patches().includes('cloud_smooth')) {
      this.scene.add(this.cloud);
      return;
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#f5e9c8' });
    for (const x of [-3.2, 3.2]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), eyeMat);
      eye.position.set(x, 1, 7.5);
      this.cloud.add(eye);
    }
    this.scene.add(this.cloud);
  }

  enter(entry?: string): void {
    const at = entry ? ENTRIES[entry] : undefined;
    if (at) {
      this.player.position.set(at[0], 0, at[1]);
      this.facing = at[2];
    }
    this.onResize();
  }

  exit(): void {
    this.host.prompt(null);
  }

  dispose(): void {
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  snapshot() {
    return { x: this.player.position.x, z: this.player.position.z, facing: this.facing };
  }

  update(dt: number): void {
    const { input, clock } = this.host;
    this.sea.material.tick(dt);
    this.movePlayer(dt);
    this.updateSky(clock.progress);
    this.updateResidents();
    this.mask.visible = this.host.cycle.wornMask !== null;

    const near = this.nearest();
    this.host.prompt(near ? `E — ${near.label}` : null);
    if (near && (input.wasPressed('KeyE') || input.wasPressed('Enter'))) this.host.interact(near.knot);

    const p = this.player.position;
    this.camera.position.set(p.x, p.y + 21, p.z + 17);
    this.camera.lookAt(p.x, p.y + 1, p.z);
  }

  private nearest(): Interactable | null {
    const p = this.player.position;
    const candidates: Interactable[] = [
      ...PLACES_TO_TALK,
      ...this.npcs
        .filter((n) => n.figure.visible)
        .map((n) => ({ x: n.figure.position.x, z: n.figure.position.z, radius: 1.9, knot: n.resident.knot, label: n.resident.name })),
    ];
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < c.radius && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  private updateResidents(): void {
    const { clock, memory } = this.host;
    const patches = this.host.patches();
    const p = this.player.position;
    for (const { resident, figure } of this.npcs) {
      const state = residentAt(resident, clock.minute, patches);
      figure.position.set(state.x, 0, state.z);
      // Lying figures: Aristion in his fever, Eion asleep under the table.
      const lying = !state.walking && state.entry.pose === 'lying';
      figure.rotation.set(lying ? -Math.PI / 2 : 0, state.walking ? state.heading : figure.rotation.y, 0);
      if (lying) figure.position.y = 0.25;
      if (!state.walking) figure.position.y += Math.sin(clock.minute * 0.8 + resident.id.length) * 0.02;
      // Once the player has watched a resident at a point of their day, the Book of Strangers records it.
      const key = `${resident.id}:${state.entryIndex}`;
      if (!state.walking && Math.hypot(state.x - p.x, state.z - p.z) < SEEN_DISTANCE && !memory.seen.includes(key)) {
        memory.seen.push(key);
      }
    }
  }

  private movePlayer(dt: number): void {
    const { input } = this.host;
    let dx = 0;
    let dz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
    if (!dx && !dz) return;
    const len = Math.hypot(dx, dz);
    const step = (SPEED * dt) / len;
    const p = this.player.position;
    const nx = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x + dx * step));
    const nz = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, p.z + dz * step));
    // Slide along walls: try each axis separately.
    if (!this.blocked(nx, p.z)) p.x = nx;
    if (!this.blocked(p.x, nz)) p.z = nz;
    this.facing = Math.atan2(dx, dz);
    this.player.rotation.y = this.facing;
  }

  private blocked(x: number, z: number): boolean {
    const r = PLAYER_RADIUS;
    return this.boxes.some((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ);
  }

  private updateSky(progress: number): void {
    // Sun: rises in the east, sets in the west around 20:00 (progress ≈ 0.78), then night.
    const dayArc = Math.min(1, progress / 0.78);
    const angle = Math.PI * dayArc;
    const night = THREE.MathUtils.smoothstep(progress, 0.72, 0.9);
    this.sun.position.set(Math.cos(angle) * 60, Math.max(4, Math.sin(angle) * 70), 20);
    this.sun.intensity = 2.2 * (1 - night) + 0.25;
    this.sky.intensity = 0.9 * (1 - night) + 0.25;
    const bg = new THREE.Color('#d9c9a8').lerp(new THREE.Color('#2b211b'), night);
    (this.scene.background as THREE.Color).copy(bg);
    this.scene.fog!.color.copy(bg);
    this.cloud.position.set(-6, THREE.MathUtils.lerp(58, 22, progress), THREE.MathUtils.lerp(-70, -40, progress * progress));
  }
}
