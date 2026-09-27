// Stage II, "The Last Day": third-person, camera ¾ from above, real-time, the whole polis.
// The layout is generated from a fixed seed and the residents follow fixed schedules:
// the city is the same city, and the day the same day, every cycle.
import * as THREE from 'three';
import { RESIDENTS, type Resident } from '../../content/residents.ts';
import { residentAt } from '../../core/schedule.ts';
import { daySeed, seaRandom, seededRng } from '../../core/rng.ts';
import { distanceToStreets, PLACES, STREET_EDGES } from '../../core/streets.ts';
import { makeSea } from '../../render/sea.ts';
import { disposeScene } from '../dispose.ts';
import { amphora, bob, cypress, dressFigure, gableRoof, lambert, makeFigure, olive, pavingTexture, textured, worldUV } from '../figures.ts';
import { HEIGHTS, LOOKS } from '../../content/looks.ts';
import type { Stage, StageHost } from '../types.ts';
import { buildHarbour, buildWalls, Torches, type Box } from './city.ts';
import { Crowd, Dust, MountainLights, StormFace } from './night.ts';
import { SUMMIT } from '../../content/crowd.ts';
import { StreetLife } from './props.ts';
import { Sky, TOWN_SKY } from '../sky.ts';
import { at } from '../../core/clock.ts';
import { glitchesFor, type Glitch } from '../../core/wear.ts';

interface Interactable {
  x: number;
  z: number;
  radius: number;
  knot: string;
  /** Arguments for a knot that takes them (the last hour's 'still'). */
  args?: string[];
  label: string;
}


const SPEED = 5.5;
const SNAP_RIGHT = new THREE.Vector3();
const SNAP_UP = new THREE.Vector3();
const PLAYER_RADIUS = 0.4;
/** How far the player can see a resident well enough for the Book of Strangers. */
const SEEN_DISTANCE = 11;
const BOUNDS = { minX: -28, maxX: 28, minZ: -26, maxZ: 21 };
const ENTRIES: Record<string, [number, number, number]> = {
  temple: [0, -11.5, 0],
  shore: [0, 18.5, Math.PI],
  mountain: [9.5, -20.5, 0],
};

/** How much nearer than a resident a place may be and still be the one E talks to. */
const PLACE_BIAS = 0.4;

const PLACES_TO_TALK: Interactable[] = [
  { x: -4.5, z: -10, radius: 1.8, knot: 'stele', label: 'Star stele' },
  { x: 0, z: -13.2, radius: 1.6, knot: 'temple_door', label: 'Bronze door' },
  { x: 10.5, z: 2.4, radius: 1.8, knot: 'agora_crier', label: 'Listen to the crier' },
  { x: 0, z: 20.2, radius: 2, knot: 'to_shore', label: 'The path to the shore' },
  // The foot of the path, on the town side of where the early climbers stand.
  { x: 10, z: -21, radius: 2, knot: 'mountain_path', label: 'The path up the mountain' },
  { x: 12.8, z: -1.7, radius: 1.5, knot: 'council_steps', label: 'Council steps' },
  { x: -5.5, z: 5.5, radius: 1.7, knot: 'well', label: 'The well' },
  { x: -14.5, z: 14, radius: 1.4, knot: 'tavern_table', label: "Eion's table" },
  { x: -19, z: -14.2, radius: 1.5, knot: 'villa_door', label: "Lysimachus' door" },
];

interface Npc {
  resident: Resident;
  figure: THREE.Group;
  /** Stopped for the last hour, facing the mountain. */
  still?: boolean;
}

/** Residents the last hour does not stop. */
const FREE_AT_LAST = ['eion', 'glaucus'];
/** How far apart people sharing one spot stand. */
const SPREAD = 1.1;

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
  private storm!: StormFace;
  private mountainLights!: MountainLights;
  private crowd!: Crowd;
  private dust!: Dust;
  /** 0..1: late at night the camera lifts its eyes to the mountain and the thing over it. */
  private lookUp = 0;
  private dusk = 0;
  private npcs: Npc[] = [];
  private glaucusX = 0;
  private torches!: Torches;
  private street!: StreetLife;
  private sky2!: Sky;
  private boats: THREE.Group[] = [];
  /** Windows: some have a lamp behind them at night. Emissive, so the dither turns them to bone. */
  private windowDark = lambert('#24160f');
  private windowLit = new THREE.MeshLambertMaterial({ color: '#24160f', emissive: '#ffc46a', emissiveIntensity: 0, flatShading: true });
  /** Floats over whatever E would talk to or look at. */
  private marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: '#f4efe4' }));
  private mask = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.08), new THREE.MeshLambertMaterial({ color: '#f2ead6' }));

  constructor(host: StageHost, start: { x: number; z: number; facing: number }) {
    this.host = host;
    this.buildWorld();
    this.player.position.set(start.x, 0, start.z);
    this.facing = start.facing;
    // A worn mask shows on the figure: a pale face on a black silhouette.
    this.mask.position.set(0, 1.47, 0.2);
    this.player.add(this.mask);
    dressFigure(this.player, LOOKS.leont!);
    this.addXray();
    this.scene.add(this.player);
    this.marker.scale.set(1, 1.6, 1);
    this.marker.visible = false;
    this.scene.add(this.marker);
    for (const resident of RESIDENTS) {
      if (resident.appears && !resident.appears((f) => host.knowledge.knows(f))) continue;
      const height = HEIGHTS[resident.id] ?? 1.7;
      const figure = makeFigure(resident.color, height);
      const look = LOOKS[resident.id];
      if (look) dressFigure(figure, look, height);
      if (resident.id === 'xenos') {
        // A smooth white oval where a face should be.
        const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#f4efe4' }));
        face.scale.set(0.8, 1, 0.5);
        face.position.set(0, 1.47, 0.14);
        figure.add(face);
      }
      this.scene.add(figure);
      this.npcs.push({ resident, figure });
    }
    this.crowd = new Crowd(this.scene, host.patches());
    this.dust = new Dust(this.scene);
    // Glaucus is of the sea: where he stands along the shore is decided by real chance, not the seed.
    // Anywhere along the shore, but never right at the foot of the path, where the path's own prompt would win.
    const side = seaRandom() < 0.5 ? -1 : 1;
    this.glaucusX = side * (1.8 + seaRandom() * 10.2);
    // How worn this day is: fixed by the loop's number.
    this.glitches = glitchesFor(host.memory.cycle);
    this.markSign = makeMark();
    this.scene.add(this.markSign);
  }

  private glitches: Glitch[] = [];
  private glitchNext = 0;
  private glitch: { g: Glitch; left: number } | null = null;
  private markSign: THREE.Mesh;
  /** The clock of the city's small motions (smoke, washing, torches): it stops when the day freezes. */
  private streetTime = 0;

  /** Starts the next glitch of the day once its minute comes; skips any the clock jumped past. */
  private runGlitches(dt: number, minute: number): void {
    if (this.glitch) {
      this.glitch.left -= dt;
      if (this.glitch.left <= 0) this.glitch = null;
    }
    while (!this.glitch && this.glitchNext < this.glitches.length && minute >= this.glitches[this.glitchNext]!.minute) {
      const g = this.glitches[this.glitchNext++]!;
      if (minute - g.minute > 3) continue;
      this.glitch = { g, left: g.seconds };
      if (g.kind === 'mark') {
        // On a wall to one side of the scribe, for a few frames.
        const p = this.player.position;
        this.markSign.position.set(p.x + (g.pick < 0.5 ? -3.5 : 3.5), 2.4 + g.pick, p.z - 2.5);
        this.markSign.lookAt(this.camera.position);
      }
    }
    this.markSign.visible = this.glitch?.g.kind === 'mark';
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

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), lambert('#b8784e'));
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
    this.sky2 = new Sky(s, TOWN_SKY, { moonDir: new THREE.Vector3(0.42, 0.26, -0.9), moonColor: '#f4ecd8', starColor: '#f4ecd8', sunset: '#ff7a3a' });
    this.street = new StreetLife(s, this.boxes);
    this.buildHouses();
    buildWalls(s, this.boxes);
    this.street.build();
    this.boats = buildHarbour(s);
    this.torches = new Torches(s, this.boxes);
    this.buildMountain();
  }

  /** Pale paving along the street graph, so the city reads as a map. */
  private buildStreets(): void {
    const paving = textured(pavingTexture(), '#f0e2c6');
    for (const [i, [a, b]] of STREET_EDGES.entries()) {
      const pa = PLACES[a];
      const pb = PLACES[b];
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const geo = new THREE.PlaneGeometry(2.2, len + 2.2);
      worldUV(geo, 2.2, len + 2.2, 5.5);
      const strip = new THREE.Mesh(geo, paving);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = -Math.atan2(pb.x - pa.x, pb.z - pa.z);
      // Each strip a hair higher than the last: where two cross, one is always on top, so the crossing never flickers.
      strip.position.set((pa.x + pb.x) / 2, 0.006 + i * 0.002, (pa.z + pb.z) / 2);
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

  /** Doric columns: a tapering shaft and a square capital. `base` is the height they stand on. */
  private addColumns(cx: number, cz: number, xs: number[], zs: number[], height: number, base = 1): void {
    const stone = lambert('#f2ead6');
    for (const x of xs) {
      for (const z of zs) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, height - 0.3, 12), stone);
        col.position.set(cx + x, base + (height - 0.3) / 2, cz + z);
        col.castShadow = true;
        this.scene.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.3, 1.05), stone);
        cap.position.set(cx + x, base + height - 0.15, cz + z);
        cap.castShadow = true;
        this.scene.add(cap);
      }
    }
  }

  private buildTemple(): void {
    // Three steps up, a peristyle, an entablature with triglyphs, a tiled roof with a pale pediment.
    this.addBox(0, -19, 15, 11, 0.34, '#efe6cf');
    const step2 = this.addBox(0, -19, 14.2, 10.2, 0.34, '#f2ead6');
    step2.position.y = 0.34 + 0.17;
    const step3 = this.addBox(0, -19, 13.4, 9.4, 0.34, '#efe6cf');
    step3.position.y = 0.68 + 0.17;
    this.addColumns(0, -19, [-5.8, -3.5, -1.2, 1.2, 3.5, 5.8], [4.1, -4.1], 6, 1.02);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.9, 9.2), lambert('#efe6cf'));
    beam.position.set(0, 7.47, -19);
    beam.castShadow = true;
    this.scene.add(beam);
    const glyph = lambert('#3a2618');
    for (let i = 0; i < 14; i++) {
      for (const z of [-19 + 4.62, -19 - 4.62]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06), glyph);
        t.position.set(-6.2 + i * 0.955, 7.6, z);
        this.scene.add(t);
      }
    }
    const roof = gableRoof(13.2, 9.2, 2.2, '#9a5a3a', '#efe6cf');
    roof.position.set(0, 7.92, -19);
    this.scene.add(roof);
    this.addBox(0, -19, 9, 7, 6.5, '#e6dcc2'); // cella
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.2), lambert('#3a2414'));
    door.position.set(0, 2.6, -15.45);
    this.scene.add(door);
  }

  private buildAgora(): void {
    this.addBox(12.8, 0.5, 4, 3, 1.4, '#efe6cf'); // council house steps
    const crier = makeFigure('#1a1410', 1.8);
    dressFigure(crier, LOOKS.crier!, 1.8);
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
    // Lysimachus' villa, bigger than it needs to be.
    this.addBox(-20.5, -17.5, 7, 5.5, 3.6, '#f0e8d2');
    const villaRoof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.4, 6.1), lambert('#8f4a2a'));
    villaRoof.position.set(-20.5, 3.8, -17.5);
    villaRoof.castShadow = true;
    this.scene.add(villaRoof);
    // Temple of Zeus, east of the agora: darker stone, heavier columns.
    this.addBox(23.2, 6.5, 6, 7, 0.9, '#d9ccb0');
    this.addColumns(23.2, 6.5, [-2.2, 2.2], [-2.8, 0, 2.8], 5);
    const zeusRoof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.7, 7.4), lambert('#5c4636'));
    zeusRoof.position.set(23.2, 6.4, 6.5);
    zeusRoof.castShadow = true;
    this.scene.add(zeusRoof);
    // The well where Phyllis waits every Golden Age.
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.9, 10, 1, true), lambert('#efe6cf'));
    well.position.set(-5.5, 0.45, 6.8);
    this.scene.add(well);
    this.boxes.push({ minX: -6.4, maxX: -4.6, minZ: 5.9, maxZ: 7.7 });
    // The mask seller's stall: an awning and a row of pale faces.
    this.addBox(5, 6.9, 2.6, 1, 0.9, '#6b3a22');
    for (let i = 0; i < 5; i++) {
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.06), lambert('#f2ead6'));
      face.position.set(4 + i * 0.5, 1.25, 6.35);
      this.scene.add(face);
    }
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
      const hgt = 2 + rand() * 2.5;
      this.addBox(x, z, w, d, hgt, rand() > 0.3 ? '#ece2c8' : '#c9a57c');
      this.houseFront(x, z, w, d, hgt, rand);
      // Tiled gable roof, ridge along the longer side.
      const alongX = w > d;
      const roof = gableRoof(alongX ? d : w, alongX ? w : d, 0.9 + rand() * 0.5, '#9a5a3a', '#e4d8bc');
      roof.position.set(x, hgt, z);
      if (alongX) roof.rotation.y = Math.PI / 2;
      this.scene.add(roof);
      // An oven chimney on some roofs; its smoke says someone is home.
      if (rand() < 0.35) this.street.chimney(x + (alongX ? w * 0.28 : w * 0.18), hgt + 0.35, z + (alongX ? d * 0.15 : d * 0.28));
      placed++;
    }
    // Cypresses in the gaps, and amphorae by some doors: they do not block anyone.
    for (let i = 0, tries = 0; i < 34 && tries < 500; tries++) {
      const x = -27 + rand() * 54;
      const z = -25 + rand() * 42;
      if (clear(x, z) || this.blocked(x, z)) continue;
      const tree = i % 3 === 2 ? olive(i) : cypress(3 + rand() * 3);
      tree.position.x = x;
      tree.position.z = z;
      this.scene.add(tree);
      i++;
    }
    for (const [x, z] of [[4.2, 7.9], [5.8, 7.9], [-10.2, 15.2], [-9.6, 15.4], [-15.8, -12.9], [17.4, 4.2]] as const) {
      const a = amphora();
      a.position.set(x, 0, z);
      this.scene.add(a);
    }
  }

  /**
   * When a roof or a wall stands between the camera and the scribe, his silhouette shows through
   * it in pale bone: a copy of the figure drawn only where something nearer already covers it.
   */
  private addXray(): void {
    // Pulled a little towards the camera before the depth test, so the figure never shows through itself.
    const ghost = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color('#e8e2d0') } },
      vertexShader: 'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.z += 0.7; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    for (const part of [...this.player.children]) {
      if (!(part instanceof THREE.Mesh) || part === this.mask) continue;
      const copy = new THREE.Mesh(part.geometry, ghost);
      copy.position.copy(part.position);
      copy.rotation.copy(part.rotation);
      copy.scale.copy(part.scale);
      // After everything else, so the depth it compares against is the finished city.
      copy.renderOrder = 10;
      this.player.add(copy);
    }
  }

  /** A door towards the nearest street, a couple of small high windows, a step. */
  private houseFront(x: number, z: number, w: number, d: number, hgt: number, rand: () => number): void {
    const dark = this.windowDark;
    // Which side faces the street: try the four midpoints, keep the one closest to a street.
    const sides = [
      { nx: 0, nz: 1, len: w }, { nx: 0, nz: -1, len: w }, { nx: 1, nz: 0, len: d }, { nx: -1, nz: 0, len: d },
    ].map((s) => ({ ...s, dist: distanceToStreets(x + (s.nx * w) / 2, z + (s.nz * d) / 2) }));
    sides.sort((a, b) => a.dist - b.dist);
    const front = sides[0]!;
    const px = x + (front.nx * (w / 2 + 0.02));
    const pz = z + (front.nz * (d / 2 + 0.02));
    const along = (t: number) => ({ x: px + (front.nz !== 0 ? t : 0), z: pz + (front.nx !== 0 ? t : 0) });
    const face = (width: number, height: number, t: number, y: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(front.nz !== 0 ? width : 0.08, height, front.nx !== 0 ? width : 0.08), mat);
      const p = along(t);
      m.position.set(p.x, y, p.z);
      this.scene.add(m);
    };
    const doorAt = (rand() - 0.5) * (front.len - 1.4);
    face(0.9, 1.7, doorAt, 0.85, dark);
    const step = new THREE.Mesh(new THREE.BoxGeometry(front.nz !== 0 ? 1.3 : 0.5, 0.18, front.nx !== 0 ? 1.3 : 0.5), lambert('#efe6cf'));
    const sp = along(doorAt);
    step.position.set(sp.x + front.nx * 0.25, 0.09, sp.z + front.nz * 0.25);
    step.receiveShadow = true;
    this.scene.add(step);
    const windows = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < windows; i++) {
      const t = (i - (windows - 1) / 2) * 1.2 + (doorAt > 0 ? -0.9 : 0.9);
      if (Math.abs(t) < front.len / 2 - 0.3) face(0.34, 0.42, t, hgt - 0.75, rand() < 0.55 ? this.windowLit : dark);
    }
  }

  private buildMountain(): void {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(30, 34, 7), lambert('#8a5a3c'));
    mountain.position.set(-6, 17, -78);
    this.scene.add(mountain);
    this.mountainLights = new MountainLights(this.scene, { x: -6, z: -78, radius: 30, height: 34 });
    // The storm that ends the age has a face. Nobody in Eferon mentions it. (Unless the Curator patched the eyes out.)
    this.storm = new StormFace(this.scene, this.host.patches().includes('cloud_smooth'));
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
    // The sea is not part of the simulation: it goes on moving even when the city hitches.
    this.sea.material.tick(dt);
    this.runGlitches(dt, clock.minute);
    if (this.glitch?.g.kind === 'hitch') return;
    if (this.glitch?.g.kind !== 'freeze') this.streetTime += dt;
    this.movePlayer(dt);
    this.updateSky(clock.progress);
    this.updateResidents();
    this.mask.visible = this.host.cycle.wornMask !== null;

    const near = this.nearest();
    this.host.prompt(near ? `E — ${near.label}` : null);
    this.marker.visible = near !== null;
    if (near) {
      const npc = this.npcs.find((n) => n.resident.knot === near.knot || (near.args?.[0] === n.resident.name));
      const top = npc ? (npc.figure.position.y > 0.1 ? 1.2 : 2.35) : 2.2;
      this.marker.position.set(near.x, top + Math.sin(this.time * 3) * 0.12, near.z);
      this.marker.rotation.y = this.time * 1.5;
    }
    if (near && (input.wasPressed('KeyE') || input.wasPressed('Enter'))) this.host.interact(near.knot, near.args);

    // A stutter: the person nearest the scribe takes the same few steps over and over.
    const g = this.glitch;
    const replay = g ? g.g.minute + (((g.g.seconds - g.left) * 2.5) % 1) * 1.6 : 0;
    const stutter = g?.g.kind === 'stutter' ? { x: this.player.position.x, z: this.player.position.z, minute: replay } : undefined;
    this.crowd.update(clock.minute, this.time, this.dusk, stutter);
    const p = this.player.position;
    const u = this.lookUp;
    // From nine the view begins to sway, a little more every hour: the ground is not quite steady.
    const unease = this.host.reducedMotion() ? 0 : THREE.MathUtils.smoothstep(clock.progress, 0.83, 1);
    const sway = Math.sin(this.time * 0.37) * 0.6 * unease;
    // Lifting its eyes, the camera also comes down behind the scribe and widens a little, so the
    // storm fills the top of the frame and he still stands in the bottom of it.
    const lerp = THREE.MathUtils.lerp;
    const fov = lerp(40, 56, u);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(p.x + sway, p.y + lerp(17, 5.2, u), p.z + lerp(16, 12.5, u));
    this.camera.lookAt(p.x, p.y + lerp(1, 1.7, u), p.z - lerp(1, 18, u));
    this.snapCamera();
    this.camera.rotateZ((Math.sin(this.time * 0.51) * 0.03 + Math.sin(this.time * 1.3) * 0.008) * unease);
  }

  /**
   * Moves the camera only in whole steps of the dithered image, measured at the player's distance:
   * the city then slides by full pixels instead of swimming through the dither pattern.
   */
  private snapCamera(): void {
    const cam = this.camera;
    const dist = cam.position.distanceTo(this.player.position);
    const unit = (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / this.host.lowResHeight();
    const right = SNAP_RIGHT.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = SNAP_UP.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const r = cam.position.dot(right);
    const u = cam.position.dot(up);
    cam.position.addScaledVector(right, Math.round(r / unit) * unit - r).addScaledVector(up, Math.round(u / unit) * unit - u);
  }

  private nearest(): Interactable | null {
    const p = this.player.position;
    const candidates: Interactable[] = [
      ...PLACES_TO_TALK,
      ...this.npcs
        .filter((n) => n.figure.visible)
        .map((n) => {
          const name = n.resident.name === 'The mask seller' ? 'the mask seller' : n.resident.name;
          // In the last hour they do not answer: a line about the stillness instead of their day.
          return n.still
            ? { x: n.figure.position.x, z: n.figure.position.z, radius: 1.9, knot: 'still', args: [n.resident.name], label: `Look at ${name}` }
            : { x: n.figure.position.x, z: n.figure.position.z, radius: 1.9, knot: n.resident.knot, label: `Talk to ${name}` };
        }),
    ];
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      // A place wins a near tie with someone standing on it: people move, places don't.
      const rank = d - (PLACES_TO_TALK.includes(c) ? PLACE_BIAS : 0);
      if (d < c.radius && rank < bestD) {
        best = c;
        bestD = rank;
      }
    }
    return best;
  }

  private updateResidents(): void {
    const { clock, memory } = this.host;
    const patches = this.host.patches();
    const p = this.player.position;
    // The last hour: wherever they are at eleven, they stop there and look at the mountain.
    // Not the singer, who goes down to the water, and not the priest of the sea.
    const lastHour = clock.minute >= at(23);
    const placed = this.npcs.map((npc) => {
      const free = FREE_AT_LAST.includes(npc.resident.id);
      const state = residentAt(npc.resident, free ? clock.minute : Math.min(clock.minute, at(23)), patches);
      npc.still = lastHour && !free;
      if (npc.still) state.walking = false;
      if (npc.resident.seaSpot) {
        state.x = this.glaucusX;
        state.z = 22.4;
      }
      return { npc, state };
    });
    // Two people standing at the same spot (Kora waiting where Cleon speaks) would hide one behind
    // the other, and the nearer would always take the prompt: stand them apart, in a small circle.
    const groups: (typeof placed)[] = [];
    for (const item of placed) {
      if (item.state.walking || item.state.entry.pose === 'lying') continue;
      const near = groups.find((g) => Math.hypot(g[0]!.state.x - item.state.x, g[0]!.state.z - item.state.z) < SPREAD * 1.5);
      if (near) near.push(item);
      else groups.push([item]);
    }
    for (const group of groups) {
      if (group.length < 2) continue;
      group.forEach(({ state }, i) => {
        const a = (i / group.length) * Math.PI * 2 + 0.6;
        state.x += Math.cos(a) * SPREAD;
        state.z += Math.sin(a) * SPREAD;
      });
    }
    for (const { npc, state } of placed) {
      const { resident, figure } = npc;
      figure.position.set(state.x, 0, state.z);
      // Lying figures: Aristion in his fever, Eion asleep under the table.
      const lying = !state.walking && state.entry.pose === 'lying';
      const toMountain = Math.atan2(SUMMIT.x - state.x, SUMMIT.z - state.z);
      figure.rotation.set(lying ? -Math.PI / 2 : 0, state.walking ? state.heading : npc.still && !lying ? toMountain : figure.rotation.y, 0);
      if (lying) figure.position.y = 0.25;
      bob(figure, this.time, state.walking ? 1 : 0);
      if (!state.walking && !npc.still) figure.position.y += Math.sin(clock.minute * 0.8 + resident.id.length) * 0.02;
      // Once the player has watched a resident at a point of their day, the Book of Strangers records it.
      const key = `${resident.id}:${state.entryIndex}`;
      if (!state.walking && Math.hypot(state.x - p.x, state.z - p.z) < SEEN_DISTANCE && !memory.seen.includes(key)) {
        memory.seen.push(key);
      }
    }
  }

  private time = 0;

  private movePlayer(dt: number): void {
    const { input } = this.host;
    this.time += dt;
    let dx = 0;
    let dz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
    bob(this.player, this.time, dx || dz ? 1 : 0);
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
    // Never quite at the horizon: even at dawn the roofs catch the light.
    const angle = Math.PI * (0.14 + 0.72 * dayArc);
    const night = THREE.MathUtils.smoothstep(progress, 0.72, 0.9);
    this.sun.position.set(Math.cos(angle) * 60, Math.max(4, Math.sin(angle) * 70), 20);
    this.sun.intensity = 2.2 * (1 - night) + 0.25;
    this.sky.intensity = 0.9 * (1 - night) + 0.25;
    // The sky dome carries the colors; the fog and what is left of the background follow its horizon.
    this.sky2.update(progress, this.camera, this.time);
    (this.scene.background as THREE.Color).copy(this.sky2.horizon);
    this.scene.fog!.color.copy(this.sky2.horizon);
    // Lamps come on in the windows and the torches are lit as the sun goes.
    const dusk = THREE.MathUtils.smoothstep(progress, 0.68, 0.8);
    this.dusk = dusk;
    this.windowLit.emissiveIntensity = dusk * 1.6;
    // The last hours: gusts off the mountain (sooner if the player has raised the wind), and eyes up.
    const gust = Math.max(THREE.MathUtils.smoothstep(progress, 0.86, 0.99), this.host.cycle.wind * 0.6);
    this.torches.update(this.streetTime, dusk, gust);
    this.dust.update(this.time, gust, this.player.position);
    this.street.update(this.streetTime, gust);
    // Eased so that it has lifted enough to see the sunset by eight, and is looking at the storm by eleven.
    this.lookUp = Math.pow(THREE.MathUtils.smoothstep(progress, 0.72, 0.92), 0.65);
    this.mountainLights.update(progress, this.time);
    this.storm.update(progress, this.player.position, this.time);
    for (const [i, boat] of this.boats.entries()) {
      boat.position.y = (boat.userData.baseY as number) + Math.sin(this.time * 1.3 + i * 2) * 0.06;
      boat.rotation.z = Math.sin(this.time * 0.9 + i) * 0.03;
    }
  }
}

/** The mark: a circle with a line through it, in bone, cut out of nothing. */
function makeMark(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.strokeStyle = '#f4efe4';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(32, 32, 22, 0, Math.PI * 2);
  g.moveTo(14, 50);
  g.lineTo(50, 14);
  g.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, depthTest: false, fog: false }));
  mark.renderOrder = 10;
  mark.userData.noOutline = true;
  mark.visible = false;
  return mark;
}
