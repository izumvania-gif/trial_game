// Stage II, "The Last Day": third-person, camera ¾ from above, real-time, the whole polis.
// The layout is generated from a fixed seed: the city is the same city every cycle.
import * as THREE from 'three';
import { daySeed, seededRng } from '../../core/rng.ts';
import { makeSea } from '../../render/sea.ts';
import { lambert, makeFigure } from '../figures.ts';
import { disposeScene } from '../dispose.ts';
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
const BOUNDS = { minX: -28, maxX: 28, minZ: -26, maxZ: 21 };
const ENTRIES: Record<string, [number, number, number]> = {
  temple: [0, -11.5, 0],
  shore: [0, 18.5, Math.PI],
};

const INTERACTABLES: Interactable[] = [
  { x: -4.5, z: -10, radius: 1.8, knot: 'stele', label: 'Star stele' },
  { x: 0, z: -13.2, radius: 1.6, knot: 'temple_door', label: 'Bronze door' },
  { x: 9, z: 1, radius: 2.2, knot: 'agora_crier', label: 'Crier' },
  { x: 0, z: 20.2, radius: 2, knot: 'to_shore', label: 'Path to the sea' },
];

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
  private near: Interactable | null = null;

  constructor(host: StageHost, start: { x: number; z: number; facing: number }) {
    this.host = host;
    this.buildWorld();
    this.player.position.set(start.x, 0, start.z);
    this.facing = start.facing;
    this.scene.add(this.player);
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

    // The sea sits just below the shoreline and runs to the horizon.
    this.sea.position.set(0, -0.6, 24 + 110);
    s.add(this.sea);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(140, 6), lambert('#e3d3b0'));
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, 0.01, 22.5);
    beach.receiveShadow = true;
    s.add(beach);

    this.buildTemple();
    this.buildStele();
    this.buildHouses();
    this.buildAgora();
    this.buildMountain();
  }

  private addBox(x: number, z: number, w: number, d: number, h: number, color: string): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }

  private buildTemple(): void {
    this.addBox(0, -19, 14, 10, 1, '#efe6cf'); // stylobate
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 3, 4, 1), lambert('#d8ccb0'));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.62);
    roof.position.set(0, 8.5, -19);
    roof.castShadow = true;
    this.scene.add(roof);
    for (let i = 0; i < 6; i++) {
      for (const z of [-14.6, -23.4]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 6, 8), lambert('#f2ead6'));
        col.position.set(-5.8 + i * 2.32, 4, z);
        col.castShadow = true;
        this.scene.add(col);
      }
    }
    // Cella wall with the bronze door
    this.addBox(0, -19, 9, 7, 6.5, '#e6dcc2');
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.2), lambert('#3a2414'));
    door.position.set(0, 2.6, -15.45);
    this.scene.add(door);
  }

  private buildStele(): void {
    const stele = this.addBox(-4.5, -11, 1.2, 0.5, 3.2, '#f4eedd');
    stele.rotation.y = 0.15;
  }

  private buildHouses(): void {
    const rand = seededRng(daySeed('eferon/houses'));
    const keepClear = (x: number, z: number) =>
      (Math.abs(x) < 4 && z > -14) || // main street
      (x > 3 && x < 16 && z > -6 && z < 8) || // agora
      (x < -1 && x > -9 && z > -14 && z < -7) || // stele square
      (z < -12 && Math.abs(x) < 9); // temple
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 38; tries++) {
      const x = -26 + rand() * 52;
      const z = -24 + rand() * 40;
      const w = 2.5 + rand() * 3;
      const d = 2.5 + rand() * 3;
      if (keepClear(x, z) || keepClear(x + w / 2, z) || keepClear(x - w / 2, z)) continue;
      const overlaps = this.boxes.some((b) => x + w / 2 > b.minX - 1 && x - w / 2 < b.maxX + 1 && z + d / 2 > b.minZ - 1 && z - d / 2 < b.maxZ + 1);
      if (overlaps) continue;
      const h = 2 + rand() * 2.5;
      this.addBox(x, z, w, d, h, rand() > 0.3 ? '#ece2c8' : '#c9a57c');
      placed++;
    }
  }

  private buildAgora(): void {
    this.addBox(12.5, 0.5, 5, 3, 1.4, '#efe6cf'); // council house steps
    const crier = makeFigure('#1a1410', 1.8);
    crier.position.set(10.5, 0, 1);
    crier.rotation.y = -Math.PI / 2;
    this.scene.add(crier);
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
    // It has a face. Nobody in Eferon mentions it.
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

    this.near = INTERACTABLES.find((i) => Math.hypot(i.x - this.player.position.x, i.z - this.player.position.z) < i.radius) ?? null;
    this.host.prompt(this.near ? `E — ${this.near.label}` : null);
    if (this.near && (input.wasPressed('KeyE') || input.wasPressed('Enter'))) this.host.interact(this.near.knot);

    const p = this.player.position;
    this.camera.position.set(p.x, p.y + 21, p.z + 17);
    this.camera.lookAt(p.x, p.y + 1, p.z);
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
