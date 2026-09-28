// The prologue: the scribe's house on the first morning, before the city. Three rooms and one
// thing learned in each, by doing it: the study (walk, read the tablet, open the chronicle), the
// courtyard (Eion: talking, choosing, finishing a line you have heard before) and the vestibule
// (the hour, the Book, the front door). A line at the bottom of the screen says what to press,
// one thing at a time; nothing else pops up. Played once (LoopMemory.prologueDone).
import * as THREE from 'three';
import { LOOKS } from '../../content/looks.ts';
import { RESIDENTS } from '../../content/residents.ts';
import { disposeScene } from '../dispose.ts';
import { bob, dressFigure, lambert, makeFigure, olive, pavingTexture, textured, worldUV } from '../figures.ts';
import type { AgentAction, Stage, StageAgent, StageHost } from '../types.ts';

type Step = 'walk' | 'tablet' | 'chronicle' | 'eion' | 'book' | 'door';

interface Spot {
  id: 'tablet' | 'eion' | 'sundial' | 'door';
  x: number;
  z: number;
  radius: number;
  knot: string;
  label: string;
}

const SPEED = 4.2;
const RADIUS = 0.35;
const WALL_H = 2.3;

export class HouseStage implements Stage {
  readonly id = 'house' as const;
  readonly palette = 'vase' as const;
  readonly clockRuns = false;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.3, 120);

  private host: StageHost;
  private player = makeFigure('#120e0b');
  private eion: THREE.Group;
  private boxes: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  private marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: '#f4efe4' }));
  private step: Step = 'walk';
  private walked = 0;
  private time = 0;
  private talking: string | null = null;
  private panelSeen = false;
  private eionGone = false;
  private skip = document.createElement('div');
  private spots: Spot[] = [
    { id: 'tablet', x: -4.6, z: -1.2, radius: 1.3, knot: 'prologue_tablet', label: 'Read the tablet' },
    { id: 'eion', x: 1.9, z: 1.1, radius: 1.5, knot: 'prologue_eion', label: 'Talk to Eion' },
    { id: 'sundial', x: 3.9, z: 2.6, radius: 1.2, knot: 'prologue_sundial', label: 'Look at the sundial' },
    { id: 'door', x: 7.4, z: 0, radius: 1.2, knot: 'prologue_door', label: 'The front door' },
  ];

  constructor(host: StageHost) {
    this.host = host;
    this.build();
    dressFigure(this.player, LOOKS.leont!);
    this.scene.add(this.player);
    const eion = RESIDENTS.find((r) => r.id === 'eion')!;
    this.eion = makeFigure(eion.color, 1.7);
    dressFigure(this.eion, LOOKS.eion!, 1.7);
    // Sitting on the rim of the cistern, facing the morning.
    this.eion.position.set(1.9, -0.35, 0.95);
    this.eion.rotation.y = 0.4;
    this.scene.add(this.eion);
    this.marker.scale.set(1, 1.6, 1);
    this.scene.add(this.marker);
    this.skip.className = 'prologue-skip';
    this.skip.hidden = true;
    host.overlay.append(this.skip);
  }

  private wall(x0: number, z0: number, x1: number, z1: number, mat: THREE.Material): void {
    const w = Math.max(0.3, Math.abs(x1 - x0));
    const d = Math.max(0.3, Math.abs(z1 - z0));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), mat);
    m.position.set((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
    m.castShadow = m.receiveShadow = true;
    this.scene.add(m);
    this.boxes.push({ minX: m.position.x - w / 2, maxX: m.position.x + w / 2, minZ: m.position.z - d / 2, maxZ: m.position.z + d / 2 });
  }

  private solid(mesh: THREE.Mesh, w: number, d: number): void {
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.boxes.push({ minX: mesh.position.x - w / 2, maxX: mesh.position.x + w / 2, minZ: mesh.position.z - d / 2, maxZ: mesh.position.z + d / 2 });
  }

  private build(): void {
    const s = this.scene;
    s.background = new THREE.Color('#2a1a12');
    const sun = new THREE.DirectionalLight('#fff0d8', 2.1);
    sun.position.set(-6, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    s.add(sun, new THREE.HemisphereLight('#f4ead0', '#5a3520', 0.9));

    // Floors: tiles in the study and the vestibule, flagstones open to the sky in the courtyard.
    const floor = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(g, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      m.receiveShadow = true;
      s.add(m);
      return g;
    };
    floor(-7, -1.5, -3.5, 3.5, lambert('#b8784e'));
    const paving = pavingTexture();
    const court = floor(-1.5, 5, -3.5, 3.5, textured(paving, '#ffffff'));
    worldUV(court, 6.5, 7, 3.2);
    floor(5, 8, -1.5, 1.5, lambert('#a8683e'));
    // The street beyond the door, glimpsed.
    floor(8, 16, -4, 4, lambert('#c79a6e'));

    const plaster = lambert('#e6dcc4');
    // Outer walls (a Greek house turns a blank face to the street).
    this.wall(-7.15, -3.65, 5, -3.35, plaster); // north
    this.wall(-7.15, 3.35, 5, 3.65, plaster); // south
    this.wall(-7.3, -3.5, -7, 3.5, plaster); // west
    this.wall(5, -3.65, 8.15, -1.35, plaster); // vestibule north
    this.wall(5, 1.35, 8.15, 3.65, plaster); // vestibule south
    this.wall(7.85, -1.5, 8.15, -0.7, plaster); // door jambs
    this.wall(7.85, 0.7, 8.15, 1.5, plaster);
    // Inner walls, with doorways.
    this.wall(-1.65, -3.5, -1.35, -1.1, plaster);
    this.wall(-1.65, 1.1, -1.35, 3.5, plaster);
    this.wall(4.85, -3.5, 5.15, -1.1, plaster);
    this.wall(4.85, 1.1, 5.15, 3.5, plaster);
    // The front door, ajar.
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 1.3), lambert('#3a2414'));
    door.position.set(8.4, 1.05, -0.2);
    door.rotation.y = 0.9;
    s.add(door);

    // The study: the desk with the chronicle, a stool, a shelf of rolled tablets, a lamp.
    const wood = lambert('#4a2c1a');
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 0.9), wood);
    desk.position.set(-4.6, 0.425, -2.2);
    this.solid(desk, 1.8, 0.9);
    const bone = new THREE.MeshBasicMaterial({ color: '#e8e2d0' });
    for (let i = 0; i < 3; i++) {
      const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.32), i === 2 ? bone : lambert('#d8c8a2'));
      tablet.position.set(-5.1 + i * 0.5, 0.88, -2.15 + (i % 2) * 0.08);
      tablet.rotation.y = (i - 1) * 0.15;
      s.add(tablet);
    }
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.45, 8), wood);
    stool.position.set(-4.6, 0.225, -1.35);
    s.add(stool);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.4), wood);
    shelf.position.set(-6.6, 0.8, 0.8);
    shelf.rotation.y = Math.PI / 2;
    this.solid(shelf, 0.4, 2.6);
    for (let i = 0; i < 6; i++) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.34, 6), lambert('#d8c8a2'));
      roll.rotation.x = Math.PI / 2;
      roll.position.set(-6.55, 0.5 + (i % 3) * 0.45, -0.1 + Math.floor(i / 3) * 1.4);
      s.add(roll);
    }
    const lamp = new THREE.PointLight('#ffc46a', 6, 5, 1.6);
    lamp.position.set(-4, 1.4, -2);
    s.add(lamp);

    // The courtyard: a cistern with a stone rim, an olive, a sundial on a post, amphorae.
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.5, 12), lambert('#d8ccb0'));
    rim.position.set(1.9, 0.25, 0);
    this.solid(rim, 1.8, 1.8);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.72, 12), lambert('#3a2a20'));
    water.rotation.x = -Math.PI / 2;
    water.position.set(1.9, 0.46, 0);
    s.add(water);
    const tree = olive(3);
    tree.position.set(3.7, 0, -2.3);
    tree.scale.setScalar(0.8);
    s.add(tree);
    this.boxes.push({ minX: 3.4, maxX: 4, minZ: -2.6, maxZ: -2 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 6), lambert('#d8ccb0'));
    post.position.set(3.9, 0.55, 2.9);
    s.add(post);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), bone);
    dial.position.set(3.9, 1.12, 2.9);
    s.add(dial);
    const gnomon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.3), lambert('#1a1410'));
    gnomon.position.set(3.9, 1.24, 2.9);
    s.add(gnomon);
  }

  enter(): void {
    this.onResize();
    this.player.position.set(-4.6, 0, -0.4);
    this.player.rotation.y = Math.PI;
    // Back into a prologue left halfway (a reload): pick up where it was, from what is already known.
    this.eionGone = this.host.memory.seen.includes('eion:0');
    this.eion.visible = !this.eionGone;
    this.panelSeen = false;
    this.step = this.eionGone ? 'door' : this.host.knowledge.knows('other_hand') ? 'eion' : 'walk';
    if (this.step !== 'walk') return;
    this.talking = 'prologue_wake';
    this.host.interact('prologue_wake');
  }

  exit(): void {
    this.host.coach(null);
    this.host.prompt(null);
    this.skip.hidden = true;
  }

  dispose(): void {
    this.skip.remove();
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  afterDialogue(): void {
    const knot = this.talking;
    this.talking = null;
    if (knot === 'prologue_tablet' && (this.step === 'walk' || this.step === 'tablet')) this.step = 'chronicle';
    if (knot === 'prologue_eion' && !this.eionGone) {
      // He goes out by the front door; his day is in the Book now.
      this.eionGone = true;
      this.eion.visible = false;
      const eion = RESIDENTS.find((r) => r.id === 'eion')!;
      eion.schedule([]).forEach((_, i) => {
        const key = `eion:${i}`;
        if (!this.host.memory.seen.includes(key)) this.host.memory.seen.push(key);
      });
      this.step = 'book';
      this.panelSeen = false;
      this.host.persist();
    }
  }

  /** What to press now, one thing at a time. */
  private coachLine(): string | null {
    switch (this.step) {
      case 'walk': return 'W A S D — walk';
      case 'tablet': return 'E — read the tablet on your desk';
      case 'chronicle': return this.panelSeen ? 'C — close the chronicle' : 'C — open your chronicle: what you learn is kept there';
      case 'eion': return 'Someone is humming in the courtyard · E — talk to him';
      case 'book': return this.panelSeen ? 'B — close the Book' : 'B — the Book of Strangers: where people will be, and when';
      case 'door': return 'The ring at the top right is the hour · E — go out into Eferon';
    }
  }

  private target(): Spot | null {
    const id = this.step === 'walk' || this.step === 'tablet' ? 'tablet' : this.step === 'eion' || this.step === 'chronicle' ? 'eion' : 'door';
    return this.spots.find((s) => s.id === id) ?? null;
  }

  private available(spot: Spot): boolean {
    if (spot.id === 'eion') return !this.eionGone && this.host.knowledge.knows('other_hand');
    if (spot.id === 'door') return this.eionGone;
    return true;
  }

  private nearest(): Spot | null {
    const p = this.player.position;
    let best: Spot | null = null;
    let bestD = Infinity;
    for (const s of this.spots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < s.radius && d < bestD && this.available(s)) { best = s; bestD = d; }
    }
    return best;
  }

  private use(spot: Spot): void {
    this.talking = spot.knot;
    this.host.interact(spot.knot);
  }

  update(dt: number): void {
    const { input } = this.host;
    this.time += dt;
    // The chronicle and the Book: open once, then close, and the next room calls.
    const panel = this.host.openPanel();
    if ((this.step === 'chronicle' && panel === 'chronicle') || (this.step === 'book' && panel === 'book')) this.panelSeen = true;
    if (this.step === 'chronicle' && this.panelSeen && !panel) { this.step = 'eion'; this.panelSeen = false; }
    if (this.step === 'book' && this.panelSeen && !panel) { this.step = 'door'; this.panelSeen = false; }
    // Walking on is fine too: nobody is made to open a panel.
    if (this.step === 'chronicle' && !panel && this.player.position.x > -1.5) this.step = 'eion';
    if (this.step === 'book' && !panel && this.player.position.x > 5) this.step = 'door';

    if (this.skipOpen()) return;
    if (input.wasPressed('Escape')) return this.offerSkip();
    this.move(dt);
    const near = this.nearest();
    this.host.prompt(near ? `E — ${near.label}` : null);
    if (near && (input.wasPressed('KeyE') || input.wasPressed('Enter'))) this.use(near);

    const t = this.target();
    this.marker.visible = !!t && this.available(t) && this.step !== 'walk';
    if (t) this.marker.position.set(t.x, 2.2 + Math.sin(this.time * 3) * 0.12, t.z);
    this.marker.rotation.y += dt * 1.5;
    this.host.coach(this.coachLine());

    const p = this.player.position;
    this.camera.position.set(p.x * 0.6 + 0.6, 10.5, p.z + 8.8);
    this.camera.lookAt(p.x * 0.6 + 0.6, 0.6, p.z - 0.6);
  }

  private move(dt: number): void {
    const { input } = this.host;
    let dx = 0;
    let dz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
    bob(this.player, this.time, dx || dz ? 1 : 0);
    if (!dx && !dz) return;
    const len = Math.hypot(dx, dz);
    const p = this.player.position;
    const nx = p.x + (dx / len) * SPEED * dt;
    const nz = p.z + (dz / len) * SPEED * dt;
    const before = p.clone();
    if (!this.blocked(nx, p.z)) p.x = nx;
    // Brushing a door jamb slides you into the doorway instead of stopping you.
    else if (dx && !dz && Math.abs(p.z) < 1.6) p.z -= Math.sign(p.z) * Math.min(Math.abs(p.z), SPEED * dt);
    if (!this.blocked(p.x, nz)) p.z = nz;
    this.walked += p.distanceTo(before);
    if (this.step === 'walk' && this.walked > 0.8) this.step = 'tablet';
    this.player.rotation.y = Math.atan2(dx, dz);
  }

  private blocked(x: number, z: number): boolean {
    if (x > 8.6 || x < -7 || z < -3.4 || z > 3.4) return true;
    if (!this.eionGone && Math.hypot(x - this.eion.position.x, z - this.eion.position.z) < 0.55) return true;
    return this.boxes.some((b) => x + RADIUS > b.minX && x - RADIUS < b.maxX && z + RADIUS > b.minZ && z - RADIUS < b.maxZ);
  }

  // Esc: leave the prologue for those who have played before.
  private skipOpen(): boolean {
    return !this.skip.hidden;
  }

  private offerSkip(): void {
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.textContent = 'Skip the prologue';
    yes.addEventListener('click', () => this.skipAll());
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'ghost';
    no.textContent = 'Stay';
    no.addEventListener('click', () => { this.skip.hidden = true; });
    const p = document.createElement('p');
    p.textContent = 'Leave the house and start the day in the city?';
    this.skip.replaceChildren(p, yes, no);
    this.skip.hidden = false;
    yes.focus();
  }

  private skipAll(): void {
    this.skip.hidden = true;
    this.host.knowledge.learn('other_hand');
    this.host.switchStage('town');
  }

  agent(): StageAgent {
    return {
      describe: () => [
        'Your house, at first light: the study with your desk, the courtyard open to the sky with its cistern, the vestibule and the front door to the street.',
        ...(this.eionGone ? [] : this.host.knowledge.knows('other_hand') ? ['Eion, the blind singer, sits on the rim of the cistern in the courtyard.'] : ['Someone is humming in the courtyard.']),
        `Now: ${this.coachLine()}`,
      ],
      actions: () => [
        ...this.spots.filter((s) => this.available(s)).map((s): AgentAction => ({ id: `use:${s.id}`, label: s.label })),
        { id: 'skip', label: 'Skip the prologue and start the day in the city' },
      ],
      perform: (id) => {
        if (id === 'skip') { this.skipAll(); return 'You leave the house.'; }
        const spot = this.spots.find((s) => `use:${s.id}` === id);
        if (!spot || !this.available(spot)) return null;
        this.player.position.set(spot.x - 0.6, 0, spot.z + 0.5);
        if (this.step === 'walk') this.step = 'tablet';
        this.use(spot);
        return `${spot.label}.`;
      },
    };
  }
}
