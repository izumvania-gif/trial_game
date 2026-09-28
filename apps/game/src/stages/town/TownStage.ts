// Stage II, "The Last Day": third-person, camera ¾ from above, real-time, the whole polis.
// The layout is generated from a fixed seed and the residents follow fixed schedules:
// the city is the same city, and the day the same day, every cycle.
import * as THREE from 'three';
import { RESIDENTS, type Resident } from '../../content/residents.ts';
import { residentAt } from '../../core/schedule.ts';
import { daySeed, seaRandom, seededRng } from '../../core/rng.ts';
import { distanceToStreets, pathLength, PLACES, route, STREET_EDGES, type Place } from '../../core/streets.ts';
import { PLACE_NAMES } from '../../ui/Book.ts';
import { makeSea } from '../../render/sea.ts';
import { disposeScene } from '../dispose.ts';
import { amphora, bob, cypress, dimPaint, dressFigure, gableRoof, giveWay, lambert, makeFigure, olive, pavingTexture, textured, worldUV } from '../figures.ts';
import { HEIGHTS, LOOKS } from '../../content/looks.ts';
import type { AgentAction, Stage, StageAgent, StageHost } from '../types.ts';
import { BEACH, buildHarbour, buildWalls, groundAt, HOROS, outsideRoad, tooDeep, Torches, type Box } from './city.ts';
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
const BOUNDS = { minX: -28, maxX: 28, minZ: -40, maxZ: 40 };
/** How close the scribe comes to anyone: he walks around people, not through them. */
const PERSON_GAP = 0.75;
const ENTRIES: Record<string, [number, number, number]> = {
  temple: [0, -11.5, 0],
  shore: [0, 18.5, Math.PI],
  mountain: [9.5, -20.5, 0],
};

/** The singer's table stands on the tavern's spot, where he sleeps until two. */
const TAVERN_TABLE: [number, number] = [PLACES.tavern.x, PLACES.tavern.z];

/** How much nearer than a resident a place may be and still be the one E talks to. */
const PLACE_BIAS = 0.4;

/** Street corners without a place of their own, named for agent mode. */
const who = (name: string) => name.replace(/^The /, 'the ');
const STREET_NAMES: Record<string, string> = {
  south: 'the street down to the port', westLane: 'the west lane', eastLane: 'the east lane', northEast: 'the road to the mountain gate', eastRoad: 'the east road',
};

const PLACES_TO_TALK: Interactable[] = [
  { x: -4.5, z: -10, radius: 1.8, knot: 'stele', label: 'Star stele' },
  { x: 0, z: -13.2, radius: 1.6, knot: 'temple_door', label: 'Bronze door' },
  // On the crier himself, and small: Cleon stands on the steps just north of him at dawn.
  { x: 10.8, z: 2.8, radius: 1.5, knot: 'agora_crier', label: 'Listen to the crier' },
  { x: 0, z: 20.2, radius: 2, knot: 'to_shore', label: 'The path to the shore' },
  { x: -6, z: 33.6, radius: 1.5, knot: 'mole_end', label: 'The end of the mole' },
  // Out through the gate, where the sacred road starts to climb.
  { x: HOROS.x - 1, z: HOROS.z + 0.6, radius: 2, knot: 'horos', label: 'The boundary stone' },
  // The foot of the path, on the town side of where the early climbers stand.
  { x: 10, z: -21, radius: 2, knot: 'mountain_path', label: 'The path up the mountain' },
  { x: 12.8, z: -1.7, radius: 1.5, knot: 'council_steps', label: 'Council steps' },
  { x: -5.5, z: 5.5, radius: 1.7, knot: 'well', label: 'The well' },
  { x: PLACES.tavern.x, z: PLACES.tavern.z, radius: 1.7, knot: 'tavern_table', label: "Eion's table" },
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
  private socle = lambert('#b98a62');
  private tavernLamps: THREE.Mesh[] = [];
  private tavernDrinkers: THREE.Group[] = [];
  private tavernLight = new THREE.PointLight('#ffb25a', 0, 9, 1.3);
  private terrace = lambert('#d8c49c');
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
  /** Over where the first goal is (the stele), seen from across the town. */
  private goalMarker = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4), new THREE.MeshBasicMaterial({ color: '#6e2a1c' }));
  private marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: '#f4efe4' }));
  private mask = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.08), new THREE.MeshLambertMaterial({ color: '#f2ead6' }));
  /** A small mark over every place that can be looked at, near enough; seen through roofs, so nothing hides behind a house. */
  private placeMarks = PLACES_TO_TALK.map(() => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#f4efe4', depthTest: false, fog: false }));
    m.scale.set(1, 1.5, 1);
    m.renderOrder = 11;
    m.userData.noOutline = true;
    m.userData.hud = true;
    return m;
  });

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
    this.marker.userData.hud = this.goalMarker.userData.hud = true;
    this.marker.visible = false;
    this.goalMarker.rotation.x = Math.PI;
    this.goalMarker.visible = false;
    this.scene.add(this.goalMarker);
    this.scene.add(this.marker);
    for (const m of this.placeMarks) this.scene.add(m);
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

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 110), lambert('#b8784e'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -30;
    ground.receiveShadow = true;
    s.add(ground);
    this.buildStreets();

    // The sea sits just below the shoreline and runs to the horizon.
    this.sea.position.set(0, -0.6, 24 + 110);
    s.add(this.sea);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(140, BEACH.dry - 19.5), lambert('#e3d3b0'));
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, 0.01, (19.5 + BEACH.dry) / 2);
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
    this.boats = buildHarbour(s, this.boxes);
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

  /**
   * The port tavern, a kapeleion: a low tiled house with an open counter, a courtyard under a vine
   * (south of the house, so the camera looks into it across the courtyard, not over the roof)
   * pergola, and the singer's table right where he sleeps until two (the tavern's spot in the street
   * graph). In the evening its lamps are lit and a few drinkers sit on the benches.
   */
  private buildTavern(): void {
    const s = this.scene;
    const [tx, tz] = TAVERN_TABLE;
    const wood = lambert('#4a2c1a');
    const top = lambert('#e9dcbc');
    // The house: plastered, on a stone socle, under a low roof of tiles, ridge along the street.
    this.addBox(-13.5, 9.7, 7, 3, 2.9, '#c9a57c');
    const socle = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.5, 3.1), this.socle);
    socle.position.set(-13.5, 0.25, 9.7);
    s.add(socle);
    const roof = gableRoof(3, 7, 0.7, '#9a5a3a', '#e4d8bc');
    roof.position.set(-13.5, 2.9, 9.7);
    roof.rotation.y = Math.PI / 2;
    s.add(roof);
    // The open front: a wide dark mouth that glows at night, and the counter in front of it.
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), this.windowLit);
    mouth.position.set(-13.9, 1.2, 11.21);
    s.add(mouth);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 0.5), lambert('#c9a57c'));
    counter.position.set(-13.9, 0.5, 11.5);
    counter.castShadow = counter.receiveShadow = true;
    s.add(counter);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.62), top);
    counterTop.position.set(-13.9, 1.03, 11.5);
    s.add(counterTop);
    this.boxes.push({ minX: -15.7, maxX: -12.1, minZ: 11.2, maxZ: 11.8 });
    // Amphorae stacked against the wall by the counter, one lying on its side.
    for (const [x, z, lie] of [[-16.5, 11.6, 0], [-16, 11.65, 0], [-16.6, 12.2, 1]] as const) {
      const a = amphora();
      a.position.set(x, lie ? 0.25 : 0, z);
      if (lie) a.rotation.z = Math.PI / 2;
      s.add(a);
    }
    this.boxes.push({ minX: -17, maxX: -15.7, minZ: 11.2, maxZ: 12.5 });
    // The sign: a board with a painted jug, hung from a bracket at the corner, over the street.
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.1), wood);
    bracket.position.set(-9.55, 2.55, 11.0);
    s.add(bracket);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.8), top);
    board.position.set(-9.2, 2.05, 11.0);
    s.add(board);
    const jug = amphora('#1a120c');
    jug.scale.setScalar(0.42);
    jug.position.set(-9.14, 1.8, 11.0);
    s.add(jug);
    // The pergola: posts, beams and slats over the courtyard, the vine in dark clumps along them.
    const x0 = -16.9;
    const x1 = -10.1;
    const z0 = 11.3;
    const z1 = 14.6;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [(x0 + x1) / 2, z1], [x1, z1]] as const) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22), wood);
      post.position.set(x, 1.3, z);
      post.castShadow = true;
      s.add(post);
      this.boxes.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15 });
    }
    for (const z of [z0, (z0 + z1) / 2, z1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.4, 0.16, 0.2), wood);
      beam.position.set((x0 + x1) / 2, 2.62, z);
      beam.castShadow = true;
      s.add(beam);
    }
    for (let x = x0 + 0.5; x < x1; x += 0.9) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, z1 - z0 + 0.3), wood);
      slat.position.set(x, 2.74, (z0 + z1) / 2);
      slat.castShadow = true;
      s.add(slat);
    }
    const leaves = lambert('#4a3a22');
    const rand = seededRng(daySeed('eferon/tavern/vine'));
    for (let i = 0; i < 16; i++) {
      // Thick over the drinkers' side, thin over the singer's table, so he can be seen from above.
      const x = x0 + rand() * (x1 - x0) * (i < 12 ? 0.62 : 1);
      const z = z0 + rand() * (z1 - z0);
      if (Math.hypot(x - tx, z - tz) < 1.6) continue;
      const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + rand() * 0.2, 0), leaves);
      clump.position.set(x, 2.95 + rand() * 0.15, z);
      clump.castShadow = true;
      s.add(clump);
    }
    // Two tables with benches: the singer's, and the drinkers'.
    const table = (x: number, z: number) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.9), top);
      t.position.set(x, 0.78, z);
      t.castShadow = t.receiveShadow = true;
      s.add(t);
      for (const [dx, dz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.74, 0.1), wood);
        leg.position.set(x + dx, 0.37, z + dz);
        s.add(leg);
      }
      for (const side of [-1, 1]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.3), wood);
        bench.position.set(x, 0.44, z + side * 0.72);
        bench.castShadow = true;
        s.add(bench);
      }
      this.boxes.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.45, maxZ: z + 0.45 });
      // A lamp on the table, lit with the torches.
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), new THREE.MeshBasicMaterial({ color: '#ffd68c' }));
      flame.position.set(x + 0.4, 0.97, z);
      flame.visible = false;
      s.add(flame);
      this.tavernLamps.push(flame);
    };
    table(tx, tz);
    table(-15, 13.3);
    // The drinkers: they sit down at six and leave for the procession at nine.
    for (const [x, z, facing] of [[-15.5, 12.58, 0], [-14.5, 12.58, 0], [-15.2, 14.02, Math.PI], [-14.3, 14.02, Math.PI]] as const) {
      const f = makeFigure('#2a1a12', 1.55);
      f.position.set(x, -0.42, z);
      f.rotation.y = facing;
      f.visible = false;
      s.add(f);
      this.tavernDrinkers.push(f);
    }
    this.tavernLight.position.set(-13.5, 2.2, 12.8);
    s.add(this.tavernLight);
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
    this.buildTavern();
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
      Math.hypot(x - 1, z - 21) < 5 || // path to the sea
      (x > -18 && x < -8.5 && z > 7.5 && z < 15.5); // the tavern and its courtyard
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
      // A stone socle under the mud brick, the way Greek houses stood.
      const socle = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.5, d + 0.1), this.socle);
      socle.position.set(x, 0.25, z);
      socle.receiveShadow = true;
      this.scene.add(socle);
      this.houseFront(x, z, w, d, hgt, rand);
      const alongX = w > d;
      if (rand() < 0.35) {
        // A flat roof: a terrace of beaten earth on beams, the beam ends showing under the edge.
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.2, d + 0.3), this.terrace);
        slab.position.set(x, hgt + 0.1, z);
        slab.castShadow = slab.receiveShadow = true;
        this.scene.add(slab);
      } else {
        // A low-pitched roof of terracotta tiles, ridge along the longer side.
        const span = alongX ? d : w;
        const roof = gableRoof(span, alongX ? w : d, span * 0.17 + 0.1, '#9a5a3a', '#e4d8bc');
        roof.position.set(x, hgt, z);
        if (alongX) roof.rotation.y = Math.PI / 2;
        this.scene.add(roof);
      }
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
    for (const [x, z] of [[4.2, 7.9], [5.8, 7.9], [-15.8, -12.9], [17.4, 4.2]] as const) {
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
    this.settleView();
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

  // ─── Agent mode: the town in words, walking by the streets, talking by name ───

  agent(): StageAgent {
    return { describe: () => this.agentDescribe(), actions: () => this.agentActions(), perform: (id, arg) => this.agentPerform(id, arg) };
  }

  private nodeNear(x: number, z: number): Place {
    let best: Place = 'center';
    let bestD = Infinity;
    for (const [id, pt] of Object.entries(PLACES) as [Place, { x: number; z: number }][]) {
      const d = Math.hypot(pt.x - x, pt.z - z);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  private placeName(x: number, z: number): string {
    const node = this.nodeNear(x, z);
    const d = Math.hypot(PLACES[node].x - x, PLACES[node].z - z);
    const name = PLACE_NAMES[node] ?? STREET_NAMES[node] ?? 'the streets';
    return d < 4 ? `at ${name}` : `in the streets near ${name}`;
  }

  private agentPeople(radius = 20): { npc: Npc; d: number; where: string; walking: boolean }[] {
    const p = this.player.position;
    const patches = this.host.patches();
    return this.npcs
      .filter((n) => n.figure.visible)
      .map((npc) => {
        const f = npc.figure.position;
        const state = residentAt(npc.resident, this.host.clock.minute, patches);
        return { npc, d: Math.hypot(f.x - p.x, f.z - p.z), where: this.placeName(f.x, f.z), walking: state.walking && !npc.still };
      })
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d);
  }

  private agentDescribe(): string[] {
    const p = this.player.position;
    const out = [`You are ${this.placeName(p.x, p.z)}.`];
    const people = this.agentPeople();
    out.push(people.length
      ? `In sight: ${people.map((x) => `${who(x.npc.resident.name)} (${x.npc.still ? 'standing still, facing the mountain' : x.walking ? 'walking' : 'standing'} ${x.where}, ${Math.round(x.d)} m)`).join('; ')}.`
      : 'Nobody you know is in sight.');
    const near = this.nearest();
    if (near) out.push(`Right here: ${near.label}.`);
    if (this.host.clock.minute >= at(19)) out.push('Torches are lit. People are going up the mountain path.');
    return out;
  }

  private agentActions(): AgentAction[] {
    const p = this.player.position;
    const out: AgentAction[] = [];
    for (const x of this.agentPeople(14)) {
      out.push({ id: `talk:${x.npc.resident.id}`, label: `${x.npc.still ? 'Look at' : 'Talk to'} ${who(x.npc.resident.name)} (${Math.round(x.d)} m)` });
    }
    for (const spot of PLACES_TO_TALK) {
      const d = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (d <= 14) out.push({ id: `talk:${spot.knot}`, label: `${spot.label} (${Math.round(d)} m)` });
    }
    for (const x of this.agentPeople(30)) out.push({ id: `meet:${x.npc.resident.id}`, label: `Walk up to ${who(x.npc.resident.name)}` });
    for (const [id, name] of Object.entries(PLACE_NAMES)) out.push({ id: `go:${id}`, label: `Walk to ${name}` });
    out.push({ id: 'wait', label: 'Wait here', arg: 'minutes (default 30)' });
    out.push({ id: 'wait_until', label: 'Wait until a time of day', arg: 'HH:MM, e.g. 18:00' });
    return out;
  }

  /** Walk by the streets to (x, z): the clock moves by the time it takes. Returns minutes spent. */
  private agentWalk(x: number, z: number): number {
    const p = this.player.position;
    const path = route(this.nodeNear(p.x, p.z), this.nodeNear(x, z));
    const first = path[0] ?? { x: p.x, z: p.z };
    const last = path[path.length - 1] ?? { x, z };
    const dist = Math.hypot(first.x - p.x, first.z - p.z) + pathLength(path) + Math.hypot(x - last.x, z - last.z);
    const minutes = dist / SPEED / this.host.clock.secondsPerMinute;
    this.host.clock.spend(minutes);
    return minutes;
  }

  /** Stand `gap` m from (x, z), on the street side, facing it. */
  private agentStandBy(x: number, z: number, gap: number): void {
    const node = PLACES[this.nodeNear(x, z)];
    let a = Math.atan2(node.x - x, node.z - z);
    if (Math.hypot(node.x - x, node.z - z) < 0.3) a = 0;
    // Round the spot at the asked distance, then further out (a table may stand on it).
    for (let k = 0; k < 36; k++) {
      const t = a + (k % 2 ? 1 : -1) * Math.ceil((k % 12) / 2) * 0.5;
      const d = gap + Math.floor(k / 12) * 0.6;
      const px = x + Math.sin(t) * d;
      const pz = z + Math.cos(t) * d;
      if (!this.blocked(px, pz) && !tooDeep(px, pz) && outsideRoad(px, pz)) {
        this.player.position.set(px, 0, pz);
        this.settleView();
        this.facing = Math.atan2(x - px, z - pz);
        this.player.rotation.y = this.facing;
        return;
      }
    }
    this.player.position.set(node.x, 0, node.z);
    this.settleView();
  }

  private agentPerform(id: string, arg?: string): string | null {
    const [verb, what] = id.split(':');
    const clock = this.host.clock;
    if (verb === 'wait' || verb === 'wait_until') {
      let minutes = Number(arg) || 30;
      if (verb === 'wait_until') {
        const m = /^(\d{1,2}):(\d{2})$/.exec(arg ?? '');
        if (!m) return 'Give the time as HH:MM.';
        minutes = at(Number(m[1]), Number(m[2])) - clock.minute;
        if (minutes <= 0) return 'That hour has already passed today.';
      }
      clock.spend(minutes);
      return `You wait ${Math.round(minutes)} minutes.`;
    }
    const npc = this.npcs.find((n) => n.resident.id === what && n.figure.visible);
    const spot = PLACES_TO_TALK.find((s) => s.knot === what);
    if (verb === 'meet') {
      if (npc) {
        const f = npc.figure.position;
        const minutes = this.agentWalk(f.x, f.z);
        this.updateResidents();
        this.agentStandBy(npc.figure.position.x, npc.figure.position.z, 1.2);
        return `You walk up to ${who(npc.resident.name)} (${Math.round(minutes)} min).`;
      }
      return `${what} is not in sight.`;
    }
    if (verb === 'go') {
      const place = PLACES[what as Place];
      if (!place) return null;
      const minutes = this.agentWalk(place.x, place.z);
      this.player.position.set(place.x, 0, place.z);
      this.settleView();
      return `You walk to ${PLACE_NAMES[what!] ?? what} (${Math.round(minutes)} min).`;
    }
    if (verb === 'talk') {
      if (npc) {
        const f = npc.figure.position;
        if (Math.hypot(f.x - this.player.position.x, f.z - this.player.position.z) > 1.6) {
          this.agentWalk(f.x, f.z);
          this.updateResidents();
          this.agentStandBy(npc.figure.position.x, npc.figure.position.z, 1.2);
        }
        const name = npc.resident.name;
        if (npc.still) this.host.interact('still', [name]);
        else this.host.interact(npc.resident.knot);
        return `You turn to ${name}.`;
      }
      if (spot) {
        if (Math.hypot(spot.x - this.player.position.x, spot.z - this.player.position.z) > spot.radius * 0.8) {
          this.agentWalk(spot.x, spot.z);
          this.agentStandBy(spot.x, spot.z, Math.min(0.8, spot.radius * 0.5));
        }
        this.host.interact(spot.knot, spot.args);
        return `${spot.label}.`;
      }
      return null;
    }
    return null;
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
    PLACES_TO_TALK.forEach((place, i) => {
      const m = this.placeMarks[i]!;
      const d = Math.hypot(place.x - this.player.position.x, place.z - this.player.position.z);
      m.visible = d < 18 && near !== place && this.host.input.enabled;
      m.position.set(place.x, 2.6 + Math.sin(this.time * 2 + i) * 0.08, place.z);
    });
    // The first morning's goal, marked where it is: the stele, until the name under the moss is found.
    const goal = !this.host.knowledge.knows('name_in_stone') && this.host.memory.cycle <= 2 ? PLACES_TO_TALK.find((x) => x.knot === 'stele')! : null;
    this.goalMarker.visible = !!goal && near?.knot !== 'stele' && this.host.input.enabled;
    if (goal) {
      this.goalMarker.position.set(goal.x, 3.2 + Math.sin(this.time * 2.2) * 0.25, goal.z);
      this.goalMarker.rotation.y = -this.time;
    }
    if (near && (input.wasPressed('KeyE') || input.wasPressed('Enter'))) this.host.interact(near.knot, near.args);

    // A stutter: the person nearest the scribe takes the same few steps over and over.
    const g = this.glitch;
    const replay = g ? g.g.minute + (((g.g.seconds - g.left) * 2.5) % 1) * 1.6 : 0;
    const stutter = g?.g.kind === 'stutter' ? { x: this.player.position.x, z: this.player.position.z, minute: replay } : undefined;
    this.crowd.update(clock.minute, this.time, this.dusk, stutter, this.player.position, this.wall);
    this.people = this.npcs.filter((n) => n.figure.visible).map((n) => ({ x: n.figure.position.x, z: n.figure.position.z }));
    this.crowd.positions(this.people);
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
    // On the beach the view turns round to face the sea (but not in the last hours, when it looks up at the mountain).
    this.seaward += (this.seawardAt(p.z, u) - this.seaward) * Math.min(1, dt * 1.6);
    const yaw = this.viewYaw();
    const back = lerp(16, 12.5, u);
    const ahead = lerp(1, 18, u);
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    this.camera.position.set(p.x + sway * cy + back * sy, p.y + lerp(17, 5.2, u), p.z - sway * sy + back * cy);
    this.camera.lookAt(p.x - ahead * sy, p.y + lerp(1, 1.7, u), p.z - ahead * cy);
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
    // While the singer is at his table, E is for him; the table itself is looked at once he has gone.
    const eion = this.npcs.find((n) => n.resident.id === 'eion');
    const eionAtTable = !!eion?.figure.visible && Math.hypot(eion.figure.position.x - TAVERN_TABLE[0], eion.figure.position.z - TAVERN_TABLE[1]) < 2.5;
    const candidates: Interactable[] = [
      ...PLACES_TO_TALK.filter((c) => !(eionAtTable && c.knot === 'tavern_table')),
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
      // Someone walking steps round the scribe instead of through him.
      if (state.walking) giveWay(figure.position, p, this.wall);
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

  /** How far the view has turned round to face the sea (0 in the streets, 1 on the beach). */
  private seaward = 0;
  /** The turn the keys are read in: kept while a direction is held, so turning the view never turns you round. */
  private controlYaw = 0;
  private heldDir = '';

  /** How far the view should be turned to the sea at z (and `lookUp` in the last hours). */
  private seawardAt(z: number, lookUp = this.lookUp): number {
    return THREE.MathUtils.smoothstep(z, 18.5, 22.5) * (1 - lookUp);
  }

  /** The turn of the view, as drawn: with reduced motion it snaps instead of swinging. */
  private viewYaw(): number {
    return Math.PI * (this.host.reducedMotion() ? Math.round(this.seaward) : this.seaward);
  }

  /** After a jump (an entry, an agent's walk), the view starts where it belongs, not mid-swing. */
  private settleView(): void {
    const p = this.player.position;
    p.y = groundAt(p.x, p.z);
    this.seaward = this.seawardAt(p.z);
    this.controlYaw = this.viewYaw();
    this.heldDir = '';
  }

  private movePlayer(dt: number): void {
    const { input } = this.host;
    this.time += dt;
    const p = this.player.position;
    // The ground under him: the streets, the mole a step up, the wet sand sloping into the water.
    p.y += (groundAt(p.x, p.z) - p.y) * Math.min(1, dt * 10);
    let dx = 0;
    let dz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
    bob(this.player, this.time, dx || dz ? 1 : 0);
    const dir = `${dx},${dz}`;
    if (dir !== this.heldDir) {
      this.heldDir = dir;
      this.controlYaw = this.viewYaw();
    }
    if (!dx && !dz) return;
    // Keys move him as the view sees it: on the beach, with the view turned to the sea, W walks to the water.
    const c = Math.cos(this.controlYaw);
    const sn = Math.sin(this.controlYaw);
    const wx = dx * c + dz * sn;
    const wz = -dx * sn + dz * c;
    const len = Math.hypot(wx, wz);
    // Wading is slow.
    const step = (SPEED * dt * (p.y < -0.15 ? 0.55 : 1)) / len;
    const nx = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x + wx * step));
    const nz = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, p.z + wz * step));
    // Slide along walls and round people: try each axis separately.
    if (this.free(p.x, p.z, nx, p.z)) p.x = nx;
    if (this.free(p.x, p.z, p.x, nz)) p.z = nz;
    this.facing = Math.atan2(wx, wz);
    this.player.rotation.y = this.facing;
  }

  /** Can he step from (x0, z0) to (x, z)? Not into walls or deep water, and not into anyone (stepping away is always fine). */
  private free(x0: number, z0: number, x: number, z: number): boolean {
    if (this.blocked(x, z) || tooDeep(x, z) || !outsideRoad(x, z)) return false;
    for (const o of this.people) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < PERSON_GAP && d < Math.hypot(x0 - o.x, z0 - o.z)) return false;
    }
    return true;
  }

  /** Where everyone stood last frame, residents and crowd, for the scribe to walk around. */
  private people: { x: number; z: number }[] = [];

  /** For walkers stepping round the scribe: a wall they must not step into. */
  private wall = (x: number, z: number): boolean => this.boxes.some((b) => x > b.minX - 0.2 && x < b.maxX + 0.2 && z > b.minZ - 0.2 && z < b.maxZ + 0.2);

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
    const minute = this.host.clock.minute;
    const drinking = minute >= at(18) && minute < Math.min(at(21), this.host.clock.endMinute - 60);
    for (const d of this.tavernDrinkers) d.visible = drinking;
    for (const [i, lamp] of this.tavernLamps.entries()) {
      lamp.visible = dusk > 0.05;
      lamp.scale.y = 0.85 + 0.3 * Math.abs(Math.sin(this.time * 8 + i * 2));
    }
    this.tavernLight.intensity = dusk * 10;
    dimPaint(night);
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
