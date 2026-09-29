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
import { buildPlaces, PLACE_SPOTS, placeReserved, STEP, type PlaceLife, type PlaceWorld } from './places.ts';
import { BEACH, buildHarbour, buildWalls, groundAt, HOROS, outsideRoad, tooDeep, topOf, Torches, type Box } from './city.ts';
import { Carry, stone, type Carryable, type CarryKind } from './carry.ts';
import { Watch } from './watch.ts';
import { Dog } from './animals.ts';
import { Puffs, ScribeBody, type Pose } from './body.ts';
import { Barks, StaminaRing } from './barks.ts';
import { BARKS, HEARD, HEAT, type Mischief } from '../../content/barks.ts';
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
  /** Up off the ground (the wall walk). */
  y?: number;
  /** Reached swimming. */
  water?: boolean;
  /** Found, not shown: no mark, not listed for agents. */
  secret?: boolean;
}


const SPEED = 5.5;
const SNAP_RIGHT = new THREE.Vector3();
const SNAP_UP = new THREE.Vector3();
const PLAYER_RADIUS = 0.4;
/** How far the player can see a resident well enough for the Book of Strangers. */
const SEEN_DISTANCE = 11;
const BOUNDS = { minX: -71, maxX: 28, minZ: -40, maxZ: 48 };
/** Out here the open sea begins: nothing repeats. */
const OPEN_SEA_Z = 44;
/** Up-speed of a jump (about a metre high) and the pull back down. */
const JUMP = 6.3;
const GRAVITY = 20;
/** Where he floats, swimming: head and shoulders out of the water. */
const SWIM_Y = -1.05;
const RUN = 1.75;
/** How fast the day goes by while he sits and waits. */
const SIT_SPEED = 24;
/** How close the scribe comes to anyone: he walks around people, not through them. */
const PERSON_GAP = 0.75;
const FAR = new THREE.Vector3(1e4, 0, 1e4);
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
  ...PLACE_SPOTS,
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
  private body = new ScribeBody('#120e0b');
  private player = this.body.root;
  private puffs!: Puffs;
  private stamRing: StaminaRing;
  private facing = Math.PI;
  private boxes: Box[] = [];
  private socle = lambert('#b98a62');
  private tavernLamps: THREE.Mesh[] = [];
  private placeLives: PlaceLife[] = [];
  private loose: [THREE.Object3D, CarryKind][] = [];
  private carry!: Carry;
  private watch!: Watch;
  private barks: Barks;
  /** How much trouble the city thinks he is in: seen mischief heats it, time cools it; at 2 the watch comes. */
  private heat = 0;
  private lastMinute = -1;
  private barkN = 0;
  /** Up on a roof, on a tavern table: counted once each time he gets up there. */
  private upOn: 'roof' | 'table' | null = null;
  /** Named residents who have said their piece about today's mischief. */
  private heard = new Set<string>();
  private shoveWait = 0;
  /** Residents knocked or hit: how long they stagger. */
  private stumble = new Map<string, number>();
  private dog!: Dog;
  private openSea = false;
  /** What the places see of the scribe's doings (levers: see places.ts). */
  private world: PlaceWorld = {
    things: [],
    happened: (id) => this.host.cycle.noticed.includes(id),
    event: (id, x, z) => this.lever(id, x, z),
  };
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
    this.barks = new Barks(host.overlay);
    this.stamRing = new StaminaRing(host.overlay);
    this.buildWorld();
    this.player.position.set(start.x, 0, start.z);
    this.facing = start.facing;
    // A worn mask shows on the figure: a pale face on a black silhouette.
    // The mask is worn on the face, and turns with the head.
    this.mask.position.set(0, 0, 0.17);
    this.mask.userData.worn = true;
    this.body.head.add(this.mask);
    this.puffs = new Puffs(this.scene);
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
    this.lastBox().top = undefined; // nobody stands on the stele
    this.buildAgora();
    this.buildLandmarks();
    this.placeLives = buildPlaces(s, this.boxes);
    this.sky2 = new Sky(s, TOWN_SKY, { moonDir: new THREE.Vector3(0.42, 0.26, -0.9), moonColor: '#f4ecd8', starColor: '#f4ecd8', sunset: '#ff7a3a' });
    this.street = new StreetLife(s, this.boxes);
    this.buildHouses();
    buildWalls(s, this.boxes);
    this.street.build();
    this.boats = buildHarbour(s, this.boxes);
    this.torches = new Torches(s, this.boxes);
    this.buildMountain();
    // Stones on the beach, to pick up and throw into the sea.
    const rand = seededRng(daySeed('eferon/stones/v1'));
    for (let i = 0; i < 9; i++) {
      const st = stone(0.13 + rand() * 0.08);
      st.position.set(-24 + rand() * 46, 0.08, 20.2 + rand() * 4.4);
      if (this.blocked(st.position.x, st.position.z)) continue;
      s.add(st);
      this.loose.push([st, 'stone']);
    }
    for (const b of this.street.baskets) this.loose.push([b, 'basket']);
    for (const life of this.placeLives) for (const l of life.loose ?? []) this.loose.push(l);
    this.watch = new Watch(s);
    // The stray dog lies by Phyllis's stone; fed on three days, he waits inside the west gate.
    const remembers = this.host.memory.dog.days >= 3;
    this.dog = new Dog(s, remembers ? { x: -27.4, z: 5.6 } : { x: -41.6, z: 7.6 }, remembers);
    this.carry = new Carry(s, {
      floorAt: (x, z, y) => this.floorAt(x, z, y),
      blocked: (x, z, y) => this.blocked(x, z, y, 0.15),
      landed: (item, how, x, z) => this.landed(item, how, x, z),
      strike: (item, x, y, z) => this.strike(item, x, y, z),
    });
    for (const [obj, kind] of this.loose) this.carry.add(obj, kind);
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
    // Its top can be stood on (a roof, a step, a stall) unless the builder says otherwise.
    this.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h });
    return mesh;
  }

  private lastBox(): Box {
    return this.boxes[this.boxes.length - 1]!;
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
    this.lastBox().top = 0.68;
    const step3 = this.addBox(0, -19, 13.4, 9.4, 0.34, '#efe6cf');
    step3.position.y = 0.68 + 0.17;
    this.lastBox().top = 1.02;
    this.addColumns(0, -19, [-5.8, -3.5, -1.2, 1.2, 3.5, 5.8], [4.1, -4.1], 6, 1.02);
    // The columns can be climbed, up to the eaves; over them the roof, walked under, stood on to the ridge.
    for (const x of [-5.8, -3.5, -1.2, 1.2, 3.5, 5.8]) {
      for (const z of [-19 + 4.1, -19 - 4.1]) this.boxes.push({ minX: x - 0.42, maxX: x + 0.42, minZ: z - 0.42, maxZ: z + 0.42, top: 7.92 });
    }
    this.boxes.push({ minX: -6.75, maxX: 6.75, minZ: -23.75, maxZ: -14.25, bottom: 7.02, top: 7.92, gable: { alongX: false, rise: 2.2 } });
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
    this.lastBox().top = undefined; // under the roof beams
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
    this.lastBox().gable = { alongX: true, rise: 0.7 };
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
    this.boxes.push({ minX: -15.7, maxX: -12.1, minZ: 11.2, maxZ: 11.8, top: 1.06 });
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
    // One can climb up onto it and walk the slats among the vine.
    this.boxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, bottom: 2.5, top: 2.8 });
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
      this.boxes.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.45, maxZ: z + 0.45, top: 0.82 });
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
    this.lastBox().top = 4; // on the roof slab
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
      (x > -18 && x < -8.5 && z > 7.5 && z < 15.5) || // the tavern and its courtyard
      placeReserved(x, z);
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
      const house = this.lastBox();
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
        house.top = hgt + 0.2;
      } else {
        // A low-pitched roof of terracotta tiles, ridge along the longer side.
        const span = alongX ? d : w;
        const roof = gableRoof(span, alongX ? w : d, span * 0.17 + 0.1, '#9a5a3a', '#e4d8bc');
        roof.position.set(x, hgt, z);
        if (alongX) roof.rotation.y = Math.PI / 2;
        this.scene.add(roof);
        house.gable = { alongX, rise: span * 0.17 + 0.1 };
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
      this.loose.push([a, 'amphora']);
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
    // Each copy sits beside its part, under the same joint, so it moves as he moves.
    for (const part of this.body.meshes()) {
      const copy = new THREE.Mesh(part.geometry, ghost);
      copy.position.copy(part.position);
      copy.rotation.copy(part.rotation);
      copy.scale.copy(part.scale);
      copy.userData.ghost = true;
      // After everything else, so the depth it compares against is the finished city.
      copy.renderOrder = 10;
      part.parent!.add(copy);
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
    this.barks.clear();
    this.stamRing.update(1, false, this.player.position, this.camera);
    if (this.sitting) this.stand();
    this.host.clock.speed = 1;
  }

  dispose(): void {
    this.barks.dispose();
    this.stamRing.dispose();
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
    const said = this.barks.lines();
    if (said.length) out.push(`Said out loud: ${said.map((l) => `"${l}"`).join(' ')}`);
    if (this.watch.state === 'chase') out.push('The watch is after you.');
    return out;
  }

  private agentActions(): AgentAction[] {
    const p = this.player.position;
    const out: AgentAction[] = [];
    for (const x of this.agentPeople(14)) {
      out.push({ id: `talk:${x.npc.resident.id}`, label: `${x.npc.still ? 'Look at' : 'Talk to'} ${who(x.npc.resident.name)} (${Math.round(x.d)} m)` });
    }
    for (const spot of PLACES_TO_TALK) {
      if (spot.secret) continue;
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
    this.animate(dt);
    this.updateSky(clock.progress);
    this.updateResidents();
    this.mask.visible = this.host.cycle.wornMask !== null;

    const p0 = this.player.position;
    this.carry.update(dt, this.player);
    let near = this.nearest();
    // Things to pick up: the nearer of a thing and a person or place wins E.
    const thing = !this.carry.held && !this.sitting && !this.air && !this.move && !this.wallHold ? this.carry.nearest(p0.x, p0.y, p0.z) : null;
    // A thing he is facing wins over a person or place beside it (the fish on the stall over the market itself).
    const facingIt = thing && Math.sin(this.facing) * (thing.item.obj.position.x - p0.x) + Math.cos(this.facing) * (thing.item.obj.position.z - p0.z) > thing.d * 0.5;
    const pickUp = thing && (!near || facingIt || thing.d < Math.hypot(near.x - p0.x, near.z - p0.z)) ? thing.item : null;
    if (pickUp) near = null;
    const held = this.carry.held;
    // With a fish in hand, the dog is not someone to talk to: the fish is for him.
    const forDog = held?.kind === 'fish' && near?.knot === 'dog' && !this.dog.fed;
    if (forDog) near = null;
    this.host.prompt(
      forDog ? 'E — give the dog the fish' :
      near ? `E — ${near.label}` : pickUp ? `E — pick up ${this.carry.name(pickUp)}` : held ? `E — put down ${this.carry.name(held)} · F — throw it` : null,
    );
    if (input.enabled && !this.sitting) {
      if (pickUp && (input.wasPressed('KeyE') || input.wasPressed('Enter'))) {
        // A fish off the stall while the sellers are there is theft.
        if (pickUp.kind === 'fish' && this.host.clock.minute < at(12, 30)) this.misdeed('fish', pickUp.obj.position.x, pickUp.obj.position.z);
        this.carry.pick(pickUp);
        this.host.setControls('WASD — walk · E — put it down · F — throw');
      } else if (held && !near && (input.wasPressed('KeyE') || input.wasPressed('Enter'))) {
        this.carry.drop(p0, this.facing);
        this.feed(held);
        this.host.setControls(null);
      } else if (held && input.wasPressed('KeyF') && !this.move) {
        this.carry.throw(p0, this.facing, this.running);
        this.throwT = 0;
        this.host.setControls(null);
      }
    }
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
      m.visible = d < 18 && near !== place && this.host.input.enabled && !this.host.pilgrim() && !place.secret;
      m.position.set(place.x, (place.y ?? groundAt(place.x, place.z)) + 2.6 + Math.sin(this.time * 2 + i) * 0.08, place.z);
    });
    // The first morning's goal, marked where it is: the stele, until the name under the moss is found.
    const goal = !this.host.knowledge.knows('name_in_stone') && this.host.memory.cycle <= 2 && !this.host.pilgrim() ? PLACES_TO_TALK.find((x) => x.knot === 'stele')! : null;
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
    this.crowd.update(clock.minute, this.time, this.dusk, stutter, this.feet(), this.wall);
    this.people = this.npcs.filter((n) => n.figure.visible).map((n) => ({ x: n.figure.position.x, z: n.figure.position.z }));
    this.crowd.positions(this.people);
    for (const w of this.watch.positions()) this.people.push({ x: w.x, z: w.z });
    this.updateTrouble(dt);
    this.updateDog(dt);
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
    const cy0 = this.camY;
    this.camera.position.set(p.x + sway * cy + back * sy, cy0 + lerp(17, 5.2, u), p.z - sway * sy + back * cy);
    this.camera.lookAt(p.x - ahead * sy, cy0 + lerp(1, 1.7, u), p.z - ahead * cy);
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
            : { x: n.figure.position.x, z: n.figure.position.z, radius: 1.9, knot: n.resident.id === 'cleon' && this.cleonSore() ? 'cleon_sore' : n.resident.knot, label: `Talk to ${name}` };
        }),
    ];
    // The dog, when he is near: what he makes of the scribe today.
    const dp = this.dog.fig.position;
    candidates.push({ x: dp.x, z: dp.z, radius: 1.5, knot: 'dog', args: [this.dog.fed ? 'fed' : this.host.memory.dog.days >= 3 ? 'remembers' : 'hungry'], label: 'The dog' });
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      // Not from a roof to the street below; in the water, only what is reached swimming.
      if (this.swimming !== !!c.water || (!c.water && Math.abs((c.y ?? groundAt(c.x, c.z)) - p.y) > 1.6)) continue;
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
    const feet = this.feet();
    // The last hour (however early the wind made midnight): whoever did not go up the mountain
    // stops where they are and looks at it. Not the singer, who goes down to the water, and not
    // the priest of the sea.
    const lastStart = clock.endMinute - 60;
    const lastHour = clock.minute >= lastStart;
    const placed = this.npcs.map((npc) => {
      const free = FREE_AT_LAST.includes(npc.resident.id);
      const state = residentAt(npc.resident, free ? clock.minute : Math.min(clock.minute, lastStart), patches);
      npc.still = lastHour && !free;
      // Whoever climbs the mountain tonight is on it by the last hour, however early the wind brought it.
      const climbs = npc.resident.schedule(patches).some((e) => e.place === 'mountain');
      npc.figure.visible = !(npc.still && climbs);
      if (npc.still) state.walking = false;
      if (npc.resident.seaSpot) {
        state.x = this.glaucusX;
        state.z = 22.4;
      }
      // Knocked about before his speech, Cleon nurses his head on the council steps until evening: no speech today.
      if (npc.resident.id === 'cleon' && this.cleonSore() && !npc.still) {
        state.x = PLACES.council.x;
        state.z = PLACES.council.z;
        state.walking = false;
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
      // Knocked or hit: they reel for a moment and turn to see who did it.
      const reel = this.stumble.get(resident.id) ?? 0;
      if (reel > 0 && !lying) {
        figure.rotation.z = Math.sin(reel * 14) * 0.25 * reel;
        figure.rotation.y = Math.atan2(p.x - state.x, p.z - state.z);
      }
      // Someone walking steps round the scribe instead of through him.
      if (state.walking) giveWay(figure.position, feet, this.wall);
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
    // On whatever he stands on: the street (under a roof on columns, too), or a roof he was on when
    // the day was saved, if the street there is inside a house; or the water.
    const low = this.floorAt(p.x, p.z, groundAt(p.x, p.z));
    p.y = Math.max(this.blocked(p.x, p.z, low, 0) ? this.floorAt(p.x, p.z, 99) : low, SWIM_Y);
    this.camY = p.y;
    this.vy = 0;
    this.vel.set(0, 0, 0);
    this.air = false;
    this.wallHold = null;
    this.move = null;
    this.landT = 0;
    if (this.sitting) this.stand();
    this.seaward = this.seawardAt(p.z);
    this.controlYaw = this.viewYaw();
    this.heldDir = '';
  }

  // ─── The body: walking, running, jumping, climbing, falling, swimming, sitting ───

  /** Horizontal velocity: kept through a jump, so a running leap carries across a lane. */
  private vel = new THREE.Vector3();
  private vy = 0;
  /** In the air: jumping, or falling off a roof. */
  private air = false;
  private fallFrom = 0;
  /** Seconds since his feet left the ground (a jump still counts just after running off an edge). */
  private sinceGround = 0;
  /** Seconds since Space was pressed (a press just before landing still jumps). */
  private sinceJump = 9;
  /** A crouch after a long drop. */
  private landT = 0;
  /** A scripted movement: pulling up over an edge, or a roll. */
  private move: { kind: 'mantle' | 'roll'; t: number; dur: number; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } | null = null;
  /** Clinging to a face: which box (or the rock), the way out from it, and the way along it. */
  private wallHold: { box: Box | null; nx: number; nz: number; top: number } | null = null;
  /** How long he can still hang on a wall, 0..1 (seven seconds of climbing). */
  private stamina = 1;
  /** A moment after letting go of a wall before he can catch it again. */
  private regrab = 0;
  private sitting = false;
  private swimming = false;
  private running = false;
  private throwT = Infinity;
  private climbedNow = 0;
  /** The camera's height, following his a little behind so a jump does not jolt the view. */
  private camY = 0;

  /** The highest surface under (x, z) that is not above y (plus a step): the ground, a step, a roof, the wall walk. */
  private floorAt(x: number, z: number, y: number): number {
    let f = groundAt(x, z);
    for (const b of this.boxes) {
      if (b.top === undefined || x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      const t = topOf(b, x, z);
      if (t > f && t <= y + STEP) f = t;
    }
    return f;
  }

  private sit(): void {
    this.sitting = true;
    this.host.setControls('X — get up · the day goes by while he waits');
  }

  private stand(): void {
    this.sitting = false;
    this.host.clock.speed = 1;
    this.host.setControls(this.carry?.held ? 'WASD — walk · E — put it down · F — throw' : null);
  }

  /**
   * What is in front of him within reach, at his height: a box face (or a rock face of the ground)
   * rising above a step, with how high it goes and the way out from it.
   */
  private faceAhead(dirX: number, dirZ: number, reach = 0.55): { box: Box | null; top: number; nx: number; nz: number } | null {
    const p = this.player.position;
    const x = p.x + dirX * (PLAYER_RADIUS + reach);
    const z = p.z + dirZ * (PLAYER_RADIUS + reach);
    let best: { box: Box | null; top: number; nx: number; nz: number } | null = null;
    for (const b of this.boxes) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if (b.bottom !== undefined && p.y + 1.9 < b.bottom) continue;
      const top = topOf(b, x, z);
      if (top <= p.y + STEP) continue;
      // The side of the box he is on: the way out from its face.
      const out = [
        { nx: -1, nz: 0, d: b.minX - p.x },
        { nx: 1, nz: 0, d: p.x - b.maxX },
        { nx: 0, nz: -1, d: b.minZ - p.z },
        { nx: 0, nz: 1, d: p.z - b.maxZ },
      ].sort((a, c) => c.d - a.d)[0]!;
      if (!best || top < best.top) best = { box: b, top, nx: out.nx, nz: out.nz };
    }
    if (best) return best;
    const g = groundAt(x, z);
    if (g > p.y + STEP) return { box: null, top: g, nx: -dirX, nz: -dirZ };
    return null;
  }

  /** Where he would stand after pulling himself up over the edge in front (null: no room up there). */
  private overEdge(nx: number, nz: number, top: number, inward = 0.55): { x: number; y: number; z: number } | null {
    const p = this.player.position;
    for (const d of [inward, inward + 0.4, inward + 0.9]) {
      const x = p.x - nx * (PLAYER_RADIUS + d);
      const z = p.z - nz * (PLAYER_RADIUS + d);
      const y = this.floorAt(x, z, top + 0.9);
      if (y < top - STEP || this.blocked(x, z, y) || !outsideRoad(x, z)) continue;
      return { x, y, z };
    }
    return null;
  }

  private mantle(to: { x: number; y: number; z: number }, dur = 0.45): void {
    const p = this.player.position;
    this.move = { kind: 'mantle', t: 0, dur, x0: p.x, y0: p.y, z0: p.z, x1: to.x, y1: to.y, z1: to.z };
    this.wallHold = null;
    this.air = false;
    this.vy = 0;
    this.vel.set(0, 0, 0);
  }

  /** Catch hold of a wall face and start climbing. */
  private grab(f: { box: Box | null; top: number; nx: number; nz: number }): void {
    if (f.box?.noClimb || this.stamina <= 0.05) return;
    this.wallHold = { box: f.box, nx: f.nx, nz: f.nz, top: f.top };
    this.air = false;
    this.vy = 0;
    this.vel.set(0, 0, 0);
    this.facing = Math.atan2(-f.nx, -f.nz);
    this.player.rotation.y = this.facing;
    this.host.setControls('W S — up, down · A D — along · Space — leap up · S + Space — let go');
  }

  private letGo(kick: boolean): void {
    const h = this.wallHold;
    if (!h) return;
    this.wallHold = null;
    this.regrab = 0.35;
    this.air = true;
    this.fallFrom = this.player.position.y;
    this.vy = kick ? 4.5 : 0;
    if (kick) this.vel.set(h.nx * 4, 0, h.nz * 4);
    this.host.setControls(this.carry?.held ? 'WASD — walk · E — put it down · F — throw' : null);
  }

  private movePlayer(dt: number): void {
    const { input, clock } = this.host;
    this.time += dt;
    this.throwT += dt;
    this.regrab -= dt;
    const p = this.player.position;
    this.camY += (p.y - this.camY) * Math.min(1, dt * 7);
    this.climbedNow = 0;
    if (input.wasPressed('Space')) this.sinceJump = 0;
    else this.sinceJump += dt;

    // Pulling up over an edge, or rolling out of a fall: the body goes where the move takes it.
    if (this.move) {
      const m = this.move;
      m.t = Math.min(1, m.t + dt / m.dur);
      if (m.kind === 'mantle') {
        const up = Math.min(1, m.t / 0.6);
        const over = Math.max(0, (m.t - 0.6) / 0.4);
        p.set(m.x0 + (m.x1 - m.x0) * over, m.y0 + (m.y1 - m.y0) * up * up * (3 - 2 * up), m.z0 + (m.z1 - m.z0) * over);
      } else {
        const nx = m.x0 + (m.x1 - m.x0) * m.t;
        const nz = m.z0 + (m.z1 - m.z0) * m.t;
        if (this.free(p.x, p.z, nx, p.z)) p.x = nx;
        if (this.free(p.x, p.z, p.x, nz)) p.z = nz;
        p.y = this.floorAt(p.x, p.z, p.y);
      }
      if (m.t >= 1) {
        this.move = null;
        this.sinceGround = 0;
      }
      return;
    }

    let dx = 0;
    let dz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
    const dir = `${dx},${dz}`;
    if (dir !== this.heldDir) {
      this.heldDir = dir;
      this.controlYaw = this.viewYaw();
    }
    // Keys move him as the view sees it: on the beach, with the view turned to the sea, W walks to the water.
    const c = Math.cos(this.controlYaw);
    const sn = Math.sin(this.controlYaw);
    let wx = dx * c + dz * sn;
    let wz = -dx * sn + dz * c;
    const len = Math.hypot(wx, wz);
    if (len) {
      wx /= len;
      wz /= len;
    }
    const lastHour = clock.minute >= clock.endMinute - 60;

    // Sitting, the day goes by fast; any step, or the last hour, gets him up.
    if (this.sitting) {
      if (dx || dz || input.wasPressed('KeyX') || input.wasPressed('Space') || lastHour) this.stand();
      else {
        clock.speed = input.enabled ? SIT_SPEED : 1;
        return;
      }
    } else if (input.wasPressed('KeyX') && !this.air && !this.swimming && !this.wallHold && !dx && !dz && !lastHour) {
      this.sit();
      return;
    }

    // ─ On a wall: hand over hand, up, down and along, while the strength lasts.
    if (this.wallHold) {
      const h = this.wallHold;
      const tx = -h.nz;
      const tz = h.nx;
      const along = wx * tx + wz * tz;
      const upDown = dz < 0 ? 1 : dz > 0 ? -1 : 0;
      const fast = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      this.stamina -= dt * (upDown || along ? (fast ? 0.26 : 0.15) : 0.07);
      if (this.sinceJump === 0) {
        if (dz > 0 || this.stamina < 0.2) this.letGo(dz > 0);
        else {
          // A leap up the face.
          this.stamina -= 0.2;
          p.y += 1.3;
          this.climbedNow = 1.3;
          this.host.sound('land');
        }
      }
      if (!this.wallHold) return;
      const ny = p.y + upDown * (fast ? 3.2 : 2.2) * dt;
      // Along the face, as long as there is still face there.
      if (along) {
        const ax = p.x + tx * Math.sign(along) * 1.6 * dt;
        const az = p.z + tz * Math.sign(along) * 1.6 * dt;
        const still = this.faceAt(ax, az, h);
        if (still && !this.blocked(ax, az, p.y)) {
          p.x = ax;
          p.z = az;
          h.top = still;
        }
      }
      this.climbedNow = Math.abs(ny - p.y) + Math.abs(along) * 1.6 * dt;
      p.y = ny;
      const ground = this.floorAt(p.x, p.z, p.y);
      if (p.y <= ground) {
        p.y = ground;
        // Climbed back down to his feet: he lets go.
        if (upDown < 0) {
          this.wallHold = null;
          this.host.setControls(null);
        }
      } else if (p.y + 1.9 >= h.top) {
        // Hands over the edge: up and over.
        const to = this.overEdge(h.nx, h.nz, h.top);
        if (to) this.mantle(to);
        else p.y = Math.min(p.y, h.top - 1.9);
      }
      if (this.stamina <= 0 && this.wallHold) this.letGo(false);
      return;
    }

    const floor = this.floorAt(p.x, p.z, p.y);
    const water = floor < SWIM_Y;
    const surface = water ? SWIM_Y : floor;
    if (!this.air && !water) this.stamina = Math.min(1, this.stamina + dt * 0.5);
    if (this.air) {
      this.sinceGround += dt;
      this.vy -= GRAVITY * dt;
      p.y += this.vy * dt;
      if (p.y <= surface) {
        const drop = this.fallFrom - surface;
        p.y = surface;
        this.vy = 0;
        this.air = false;
        this.sinceGround = 0;
        if (water) this.host.sound('splash');
        else if (drop > 2.2 && len) {
          // Coming down from high while moving: a roll takes the fall.
          this.move = { kind: 'roll', t: 0, dur: 0.5, x0: p.x, y0: p.y, z0: p.z, x1: p.x + wx * 2.4, y1: p.y, z1: p.z + wz * 2.4 };
          this.host.sound('land');
          return;
        } else if (drop > 2.2) {
          this.landT = 0.35;
          this.host.sound('land');
        } else if (drop > 0.6) {
          this.landT = 0.12;
          this.host.sound('land');
        }
        if (drop > 0.6) this.puffs.burst(p.x, p.y, p.z, 7);
      }
    } else if (surface < p.y - STEP) {
      // Walked off a roof, a wall, the mole: he falls.
      this.air = true;
      this.vy = 0;
      this.fallFrom = p.y;
      this.sinceGround = 0;
    } else {
      // Up and down steps, the slope of the wet sand, the swell when swimming.
      const target = water ? SWIM_Y + Math.sin(this.time * 2.2) * 0.05 : surface;
      p.y += (target - p.y) * Math.min(1, dt * 10);
      if (water && !this.swimming) this.host.sound('splash');
      this.sinceGround = 0;
    }
    this.swimming = water && !this.air;
    this.running = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && !this.swimming && p.y > -0.15 && !this.carry.held;
    const hermes = this.host.cycle.wornMask === 'Hermes' ? 1.2 : 1;
    if (this.landT > 0) this.landT -= dt;

    // Space: pull up onto a ledge within reach, catch a wall too high for that, or jump.
    const canJump = !this.air || this.sinceGround < 0.12;
    if (this.sinceJump < 0.12 && canJump && this.landT <= 0.2) {
      const fx = len ? wx : Math.sin(this.facing);
      const fz = len ? wz : Math.cos(this.facing);
      const face = this.carry.held ? null : this.faceAhead(fx, fz);
      if (face && face.top - p.y <= 2.1 && (!this.swimming || face.top - p.y <= 2.4)) {
        const to = this.overEdge(face.nx, face.nz, face.top);
        if (to) {
          this.sinceJump = 9;
          this.mantle(to);
          return;
        }
      }
      if (face && !this.swimming && face.box?.top !== undefined && !face.box.noClimb && face.top - p.y > 2.1) {
        this.sinceJump = 9;
        this.grab(face);
        return;
      }
      if (!this.swimming) {
        this.sinceJump = 9;
        this.vy = this.running ? 7 : JUMP;
        this.air = true;
        this.fallFrom = p.y;
        this.sinceGround = 1;
      }
    }

    // Speed: walking, running, wading, swimming; quick to change on the ground, little to steer in the air.
    const pace = this.swimming ? 0.5 : p.y < -0.15 ? 0.55 : this.running ? RUN * hermes : 1;
    const want = this.landT > 0.15 ? 0 : SPEED * pace;
    const accel = this.air ? 7 : 45;
    const tx = wx * want - this.vel.x;
    const tz = wz * want - this.vel.z;
    const tl = Math.hypot(tx, tz);
    const stepV = Math.min(tl, accel * dt);
    if (tl > 0) this.vel.set(this.vel.x + (tx / tl) * stepV, 0, this.vel.z + (tz / tl) * stepV);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.05) {
      const nx = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x + this.vel.x * dt));
      const nz = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, p.z + this.vel.z * dt));
      const ox = p.x;
      const oz = p.z;
      // Slide along walls and round people: try each axis separately.
      if (this.free(p.x, p.z, nx, p.z)) p.x = nx;
      else this.vel.x = 0;
      if (this.free(p.x, p.z, p.x, nz)) p.z = nz;
      else this.vel.z = 0;
      if (len) {
        // Turn to face the way he goes, quickly but not in one frame.
        const target = Math.atan2(wx, wz);
        let d = target - this.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, dt * 16);
        this.player.rotation.y = this.facing;
      }
      // Stopped by something in front of him while moving into it.
      if (len && Math.hypot(p.x - ox, p.z - oz) < speed * dt * 0.5) {
        const face = this.carry.held ? null : this.faceAhead(wx, wz, 0.35);
        if (face) {
          const rise = face.top - p.y;
          // Running into something low: over it without breaking stride.
          if (this.running && !this.air && rise <= 1.3) {
            const to = this.overEdge(face.nx, face.nz, face.top, 0.45);
            if (to) this.mantle(to, 0.28);
          } else if (this.air && rise <= 2.1) {
            // A ledge caught in the air.
            const to = this.overEdge(face.nx, face.nz, face.top);
            if (to) this.mantle(to);
          } else if (this.air && this.regrab <= 0 && face.box?.top !== undefined && !face.box.noClimb) this.grab(face);
        }
      }
    }
  }

  /** The top of the climbable face at (x, z) beside the one held, if the face goes on there. */
  private faceAt(x: number, z: number, h: { box: Box | null; nx: number; nz: number }): number | null {
    const bx = x - h.nx * (PLAYER_RADIUS + 0.3);
    const bz = z - h.nz * (PLAYER_RADIUS + 0.3);
    if (!h.box) {
      const g = groundAt(bx, bz);
      return g > this.player.position.y ? g : null;
    }
    let top: number | null = null;
    for (const b of this.boxes) {
      if (b.top === undefined || b.noClimb || bx < b.minX || bx > b.maxX || bz < b.minZ || bz > b.maxZ) continue;
      const t = topOf(b, bx, bz);
      if (t > this.player.position.y && (top === null || t > top)) top = t;
    }
    return top;
  }

  /** Can he step from (x0, z0) to (x, z) at his height? Not into walls or a ledge higher than a step, and not into anyone (stepping away is always fine). */
  private free(x0: number, z0: number, x: number, z: number): boolean {
    const y = this.player.position.y;
    if (this.blocked(x, z, y) || !outsideRoad(x, z)) return false;
    // Up a stair or a slope, yes; up a rock face higher than a step, no (Space climbs it). Down is a fall.
    if (groundAt(x, z) > y + STEP) return false;
    // Up on a roof or out in the water, the people in the street are not in his way.
    if (y > groundAt(x, z) + 1.2 || this.swimming) return true;
    for (const o of this.people) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < PERSON_GAP && d < Math.hypot(x0 - o.x, z0 - o.z)) {
        // Running into someone knocks them.
        if (this.running && this.shoveWait <= 0) {
          this.shoveWait = 1.5;
          const npc = this.npcs.find((n) => n.figure.visible && Math.hypot(n.figure.position.x - o.x, n.figure.position.z - o.z) < 0.05);
          if (npc) this.hurt(npc);
          this.host.sound('land');
          this.misdeed('shove', o.x, o.z, npc?.figure.position ?? new THREE.Vector3(o.x, 0, o.z));
        }
        return false;
      }
    }
    return true;
  }

  /** The body's pose for the frame, from what he is doing. */
  private animate(dt: number): void {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const p = this.player.position;
    const pose: Pose = this.move ? this.move.kind : this.wallHold ? 'climb' : this.sitting ? 'sit' : this.swimming ? 'swim' : this.air ? 'air'
      : this.landT > 0 ? 'land' : speed > 6.2 ? 'run' : speed > 0.3 ? (p.y < -0.15 ? 'wade' : 'walk') : 'idle';
    this.body.update({
      pose, speed, vy: this.vy, climbed: this.climbedNow, progress: this.move?.t ?? 0,
      carrying: !!this.carry.held, throwing: this.throwT, dt, time: this.time,
    });
    if (this.body.footfall && pose === 'run') this.puffs.burst(p.x - Math.sin(this.facing) * 0.3, p.y, p.z - Math.cos(this.facing) * 0.3, 2);
    this.puffs.update(dt);
    this.stamRing.update(this.stamina, !!this.wallHold || this.stamina < 0.99, p, this.camera);
  }

  /** Where everyone stood last frame, residents and crowd, for the scribe to walk around. */
  private people: { x: number; z: number }[] = [];

  /** For walkers stepping round the scribe: a wall they must not step into. */
  private wall = (x: number, z: number): boolean => this.boxes.some((b) => b.bottom === undefined && x > b.minX - 0.2 && x < b.maxX + 0.2 && z > b.minZ - 0.2 && z < b.maxZ + 0.2);

  /** A box in the way at (x, z) for someone whose feet are at y: one he cannot step up onto. Without y, any box. */
  private blocked(x: number, z: number, y = -Infinity, r = PLAYER_RADIUS): boolean {
    // A roof on columns or a pergola overhead is walked under.
    return this.boxes.some((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && topOf(b, x, z) > y + STEP && !(b.bottom !== undefined && y + 1.9 < b.bottom));
  }

  /** Where he is, for walkers to step round: nowhere, while he is up on a roof or out in the sea. */
  private feet(): THREE.Vector3 {
    const p = this.player.position;
    return p.y > groundAt(p.x, p.z) + 1.2 || this.swimming ? FAR : p;
  }

  /** Something he threw came down. */
  private landed(item: Carryable, how: 'shatter' | 'splash' | 'thud', x: number, z: number): void {
    this.host.sound(how === 'shatter' ? 'shatter' : how === 'splash' ? 'splash' : 'land');
    void item;
    if (how === 'shatter') this.misdeed('pot', x, z);
    if (how === 'thud') this.feed(item);
  }

  // ─── Mischief: the city sees, shouts, and sends the watch; midnight forgives it all ───

  /** Someone saw (or not) what he did: count it for the day, let the nearest person say so, heat the city. */
  private misdeed(kind: Mischief, x: number, z: number, speaker?: THREE.Vector3 | null): void {
    const c = this.host.cycle;
    c.mischief = { ...c.mischief, [kind]: (c.mischief?.[kind] ?? 0) + 1 };
    const who = speaker ?? this.personNear(x, z, 14);
    if (!who) return;
    this.bark(BARKS[kind], who);
    this.heat += HEAT[kind] ?? 0;
  }

  private bark(lines: string[], at: THREE.Vector3): void {
    if (lines.length) this.barks.say(lines[this.barkN++ % lines.length]!, at);
  }

  /** The nearest person (resident, crowd, guard) within r of (x, z), if any. */
  private personNear(x: number, z: number, r: number, except?: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = r;
    const consider = (v: THREE.Vector3) => {
      const d = Math.hypot(v.x - x, v.z - z);
      if (v !== except && d < bestD) {
        best = v;
        bestD = d;
      }
    };
    for (const n of this.npcs) if (n.figure.visible) consider(n.figure.position);
    for (const g of this.watch.positions()) consider(g);
    const crowd: { x: number; z: number }[] = [];
    this.crowd.positions(crowd);
    for (const o of crowd) {
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < bestD) {
        best = new THREE.Vector3(o.x, 0, o.z);
        bestD = d;
      }
    }
    return best;
  }

  /** Each frame: the city cools down, notices him up on roofs and tables, sends the watch, and says so. */
  private updateTrouble(dt: number): void {
    const { clock } = this.host;
    const p = this.player.position;
    const minutes = this.lastMinute < 0 ? 0 : Math.max(0, clock.minute - this.lastMinute);
    this.lastMinute = clock.minute;
    if (this.watch.state !== 'chase') this.heat = Math.max(0, this.heat - minutes * 0.05);
    this.shoveWait -= dt;
    for (const [id, t] of this.stumble) {
      if (t - dt <= 0) this.stumble.delete(id);
      else this.stumble.set(id, t - dt);
    }
    // Up somewhere he should not be: a roof, or a tavern table while the drinkers are at it.
    const ground = groundAt(p.x, p.z);
    const onTable = !this.air && Math.abs(p.y - 0.82) < 0.06 && p.x > -17 && p.x < -8 && p.z > 11.8 && p.z < 17;
    const where = onTable ? 'table' : !this.air && p.y > ground + 1.8 ? 'roof' : null;
    if (where !== this.upOn && where) {
      if (where === 'table' && this.tavernDrinkers.some((d) => d.visible)) this.misdeed('table', p.x, p.z, this.tavernDrinkers.find((d) => d.visible)!.position);
      else if (where === 'roof') {
        const who = this.personNear(p.x, p.z, 12);
        if (who) this.misdeed('roof', p.x, p.z, who);
      }
    }
    if (!this.air || where) this.upOn = where;
    // The named residents have heard, and say so once a day, in passing.
    const done = Object.entries(this.host.cycle.mischief ?? {}).some(([k, n]) => n > 0 && k !== 'roof' && k !== 'table');
    if (done) {
      for (const n of this.npcs) {
        if (!n.figure.visible || n.still || this.heard.has(n.resident.id) || !HEARD[n.resident.id]) continue;
        if (Math.hypot(n.figure.position.x - p.x, n.figure.position.z - p.z) < 3.2) {
          this.heard.add(n.resident.id);
          this.barks.say(HEARD[n.resident.id]!, n.figure.position);
        }
      }
    }
    // The watch.
    const lastHour = clock.minute >= clock.endMinute - 60;
    const on = clock.minute >= at(6, 30) && !clock.isOver;
    const reachable = this.feet() === p && !this.move && !this.wallHold;
    const event = this.watch.update(dt, this.time, on, lastHour, { x: p.x, z: p.z }, reachable, this.heat >= 2 && !lastHour, this.wall);
    if (event === 'spotted') {
      this.bark(BARKS.watch, this.watch.nearest(p.x, p.z));
      this.host.sound('whistle');
    } else if (event === 'waiting') this.bark(BARKS.watch_wait, this.watch.nearest(p.x, p.z));
    else if (event === 'lost') {
      this.heat = 0.6;
      this.bark(BARKS.watch_lost, this.watch.nearest(p.x, p.z));
      this.host.cycle.mischief = { ...this.host.cycle.mischief, escaped: (this.host.cycle.mischief?.escaped ?? 0) + 1 };
    } else if (event === 'caught') this.caught();
    this.barks.update(dt, this.camera);
  }

  /** Taken by the watch: walked to the council house, his name written in the archon's register. */
  private caught(): void {
    const c = this.host.cycle;
    c.mischief = { ...c.mischief, caught: (c.mischief?.caught ?? 0) + 1 };
    this.heat = 0;
    if (this.carry.held) this.carry.drop(this.player.position, this.facing);
    this.host.setControls(null);
    this.player.position.set(12.8, 0, 3.1);
    this.facing = Math.PI;
    this.player.rotation.y = Math.PI;
    this.settleView();
    this.watch.escort(12.8, 3.1);
    this.barks.clear();
    this.host.interact('caught_by_watch', [String(c.mischief.caught)]);
  }

  /** Cleon, kept from his speech today (hit or knocked over before it), until he goes up the mountain. */
  private cleonSore(): boolean {
    return this.host.cycle.noticed.includes('cleon_silent') && this.host.clock.minute < at(20);
  }

  /** Someone knocked or hit: if it is Cleon before his speech, there will be no speech today. */
  private hurt(npc: Npc): void {
    this.stumble.set(npc.resident.id, 0.8);
    const speech = this.host.patches().includes('cleon_early') ? at(11) : at(12);
    if (npc.resident.id === 'cleon' && this.host.clock.minute < speech) this.lever('cleon_silent', npc.figure.position.x, npc.figure.position.z);
  }

  /**
   * A lever: something the scribe did has changed the fixed day (a runner down, the press stopped,
   * Cleon with no speech). The observers notice, the wind rises, and whoever is there says so.
   */
  private lever(id: string, x: number, z: number): void {
    if (this.host.cycle.noticed.includes(id)) return;
    this.host.notice(id, 0.12);
    const LINES: Record<string, string> = {
      runner_fell: 'My ankle! Who left that there?',
      press_stopped: "Something's in the stone!",
      cleon_silent: 'My head. There will be no speech today.',
    };
    const who = id === 'cleon_silent' ? this.npcs.find((n) => n.resident.id === 'cleon')?.figure.position : null;
    const at = who ?? this.personNear(x, z, 6) ?? new THREE.Vector3(x, 0, z);
    if (LINES[id]) this.barks.say(LINES[id]!, at);
  }

  /** Food for the dog: put down or thrown near him, he goes to it. */
  private feed(item: Carryable): void {
    if (item.kind === 'fish' && this.dog.offer(item.obj)) item.gone = true;
  }

  private updateDog(dt: number): void {
    const p = this.player.position;
    const event = this.dog.update(dt, this.time, p, (x, z) => groundAt(x, z), (x, z) => this.blocked(x, z, groundAt(x, z), 0.2));
    if (event) this.host.sound('dog');
    if (event === 'ate') {
      const m = this.host.memory;
      if (m.dog.last !== m.cycle) m.dog = { days: m.dog.days + 1, last: m.cycle };
    }
    // Out where the water does not repeat: once a day, a moment of it.
    if (this.swimming && p.z > OPEN_SEA_Z && !this.openSea) {
      this.openSea = true;
      this.host.interact('open_sea');
    }
  }

  /** A thrown thing in flight: does it hit someone? */
  private strike(item: Carryable, x: number, y: number, z: number): boolean {
    if (y > 2.3 || y < -0.3) return false;
    const npc = this.npcs.find((n) => n.figure.visible && Math.hypot(n.figure.position.x - x, n.figure.position.z - z) < 0.55);
    const who = npc?.figure.position ?? this.personNear(x, z, 0.55);
    if (!who) return false;
    if (npc) this.hurt(npc);
    this.host.sound('land');
    this.misdeed('hit', x, z, who);
    void item;
    return true;
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
    this.world.things = this.carry.items.filter((i) => !i.gone && !i.vel && i !== this.carry.held && i.obj.visible).map((i) => i.obj.position);
    for (const life of this.placeLives) life.update(minute, this.time, dusk, this.world);
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
