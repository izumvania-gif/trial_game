// Stage III, "The Plan": the night of Eferon painted on a board, seen from above.
// Place your allies, read the enemies' routes, then let the night play out.
import * as THREE from 'three';
import {
  ALLY_NAMES, canPlace, COLS, ENEMIES, LANDMARKS, ROWS, sameTile, simulate, type AllyId, type EnemyState, type Tile,
} from '../../core/board.ts';
import { makeSea } from '../../render/sea.ts';
import { h } from '../../ui/dom.ts';
import { disposeScene } from '../dispose.ts';
import { lambert, makeFigure } from '../figures.ts';
import type { Stage, StageHost } from '../types.ts';

const TILE = 2.2;
const STEP_SECONDS = 0.7;

const tileToWorld = ([c, r]: Tile) => new THREE.Vector3((c - (COLS - 1) / 2) * TILE, 0, (r - (ROWS - 1) / 2) * TILE);


export class BoardStage implements Stage {
  readonly id = 'board' as const;
  readonly palette = 'vase' as const;
  readonly clockRuns = false;
  readonly hideHud = true;
  scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;

  private host: StageHost;
  private panel = h('aside', { className: 'board-panel', hidden: true });
  private allies: Partial<Record<AllyId, Tile>> = {};
  private allyFigures = new Map<AllyId, THREE.Group>();
  private enemyFigures = new Map<string, THREE.Group>();
  private selected: AllyId | null = null;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private playback: { turns: EnemyState[][]; t: number } | null = null;
  private result: ReturnType<typeof simulate>['outcome'] | null = null;

  constructor(host: StageHost) {
    this.host = host;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(0, 18, 11);
    this.camera.lookAt(0, 0, 0.6);
    host.overlay.append(this.panel);
    this.build();
  }

  private available(): AllyId[] {
    const k = this.host.knowledge;
    const out: AllyId[] = ['eion'];
    if (k.knows('kora_ally')) out.push('kora');
    if (k.knows('aristion_trust')) out.push('aristion');
    return out;
  }

  private build(): void {
    const s = this.scene;
    s.background = new THREE.Color('#1c1511');
    s.add(new THREE.HemisphereLight('#f4ead0', '#3a2414', 1.2));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    s.add(sun);

    // The pinax: a painted board, terracotta ground and bone roads.
    const canvas = document.createElement('canvas');
    canvas.width = COLS * 64;
    canvas.height = ROWS * 64;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#b5532a';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = '#0d0b09';
    g.lineWidth = 6;
    g.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        g.fillStyle = (c + r) % 2 ? '#d9b48c' : '#e8d2b0';
        g.fillRect(c * 64 + 6, r * 64 + 6, 52, 52);
      }
    }
    g.fillStyle = '#0d0b09';
    for (const [c, r] of Object.values(LANDMARKS)) g.fillRect(c * 64 + 6, r * 64 + 6, 52, 52);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    // Unlit, so the painted colors land exactly on the palette and the labels stay crisp.
    const board = new THREE.Mesh(new THREE.PlaneGeometry(COLS * TILE, ROWS * TILE), new THREE.MeshBasicMaterial({ map: tex }));
    board.rotation.x = -Math.PI / 2;
    s.add(board);
    this.buildLandmarks();

    // Enemies and their telegraphed routes: black lines ending in a black arrowhead.
    const ink = lambert('#0d0b09');
    for (const enemy of ENEMIES) {
      for (let i = 1; i < enemy.path.length; i++) {
        const a = tileToWorld(enemy.path[i - 1]!);
        const b = tileToWorld(enemy.path[i]!);
        const len = a.distanceTo(b);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, len), ink);
        seg.position.copy(a).add(b).multiplyScalar(0.5).setY(0.05);
        seg.lookAt(b.x, 0.05, b.z);
        s.add(seg);
      }
      const end = tileToWorld(enemy.path[enemy.path.length - 1]!);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), ink);
      head.position.copy(end).setY(0.4);
      s.add(head);
      const fig = makeFigure(enemy.id.startsWith('guard') ? '#3a2414' : '#0d0b09', 1.3);
      fig.position.copy(tileToWorld(enemy.path[0]!));
      s.add(fig);
      this.enemyFigures.set(enemy.id, fig);
    }
    for (const id of ['kora', 'aristion', 'eion'] as AllyId[]) {
      const fig = makeFigure('#f2ead6', 1.4);
      fig.visible = false;
      s.add(fig);
      this.allyFigures.set(id, fig);
    }
  }

  /** Little models instead of labels: text does not survive a third of the resolution. */
  private buildLandmarks(): void {
    const bone = lambert('#efe6cf');
    const hall = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.2), bone);
    base.position.y = 0.15;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.6, 4), bone);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.3;
    hall.add(base, roof);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), bone);
      col.position.set(x, 0.7, 0.45);
      hall.add(col);
    }
    hall.position.copy(tileToWorld(LANDMARKS.hall!));
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.8, 6), lambert('#8a5a3c'));
    mountain.position.copy(tileToWorld(LANDMARKS.mountain!)).setY(0.9);
    const tavern = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1), lambert('#c9a57c'));
    tavern.position.copy(tileToWorld(LANDMARKS.tavern!)).setY(0.4);
    // The shore tile holds a scrap of real sea: undithered, like everywhere else.
    const sea = makeSea(2);
    sea.geometry = new THREE.PlaneGeometry(2, 2, 12, 12);
    sea.position.copy(tileToWorld(LANDMARKS.shore!)).setY(0.35);
    sea.scale.set(0.95, 0.95, 0.25); // flatten the swell to fit on one tile
    this.sea = sea;
    for (const m of [hall, mountain, tavern, sea]) this.scene.add(m);
    for (const m of [hall, mountain, tavern]) m.traverse((o) => (o.castShadow = true));
  }

  private sea: ReturnType<typeof makeSea> | null = null;

  enter(): void {
    this.onResize();
    this.allies = {};
    this.selected = this.available()[0] ?? null;
    this.playback = null;
    this.result = null;
    for (const fig of this.allyFigures.values()) fig.visible = false;
    for (const e of ENEMIES) this.enemyFigures.get(e.id)!.position.copy(tileToWorld(e.path[0]!));
    this.panel.hidden = false;
    this.renderPanel();
  }

  exit(): void {
    this.panel.hidden = true;
  }

  dispose(): void {
    this.panel.remove();
    disposeScene(this.scene);
  }

  onResize(): void {
    // Frame the board in the space to the right of the plan panel (~24rem wide).
    const aspect = this.host.aspect();
    const halfH = 6.8;
    const unitsPerPx = (halfH * 2) / window.innerHeight;
    const shift = (24 * 16 * unitsPerPx) / 2;
    this.camera.left = -halfH * aspect - shift;
    this.camera.right = halfH * aspect - shift;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const { input } = this.host;
    this.sea?.material.tick(dt);
    if (this.playback) return this.play(dt);
    if (this.result) return;
    const tile = this.tileUnderMouse();
    if (input.wasClicked() && tile && this.selected) {
      if (canPlace(tile) && !Object.values(this.allies).some((t) => sameTile(t, tile))) {
        this.allies[this.selected] = tile;
        const fig = this.allyFigures.get(this.selected)!;
        fig.position.copy(tileToWorld(tile));
        fig.visible = true;
        const free = this.available().find((a) => !this.allies[a]);
        this.selected = free ?? this.selected;
        this.renderPanel();
      }
    }
  }

  private tileUnderMouse(): Tile | null {
    const { mouse } = this.host.input;
    this.raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), this.camera);
    const p = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!p) return null;
    const c = Math.round(p.x / TILE + (COLS - 1) / 2);
    const r = Math.round(p.z / TILE + (ROWS - 1) / 2);
    return c >= 0 && r >= 0 && c < COLS && r < ROWS ? [c, r] : null;
  }

  private start(): void {
    const { turns, outcome } = simulate(this.allies);
    this.playback = { turns, t: 0 };
    this.result = outcome;
    this.renderPanel();
  }

  private play(dt: number): void {
    const pb = this.playback!;
    pb.t += dt / STEP_SECONDS;
    const i = Math.min(pb.turns.length - 1, Math.floor(pb.t));
    const frac = Math.min(1, pb.t - i);
    const now = pb.turns[i]!;
    const next = pb.turns[Math.min(pb.turns.length - 1, i + 1)]!;
    for (const e of ENEMIES) {
      const a = tileToWorld(e.path[now.find((s) => s.id === e.id)!.step]!);
      const b = tileToWorld(e.path[next.find((s) => s.id === e.id)!.step]!);
      this.enemyFigures.get(e.id)!.position.lerpVectors(a, b, frac);
    }
    if (pb.t >= pb.turns.length) {
      this.playback = null;
      this.host.cycle.night = this.result;
      this.host.persist();
      this.renderPanel();
    }
  }

  private renderPanel(): void {
    const avail = this.available();
    const allyButtons = avail.map((id) => {
      const b = h('button', { type: 'button', className: id === this.selected ? 'selected' : 'ghost' },
        `${ALLY_NAMES[id]}${this.allies[id] ? ` · (${this.allies[id]!.join(',')})` : ''}`);
      b.addEventListener('click', () => {
        this.selected = id;
        this.renderPanel();
      });
      return b;
    });
    const rules = h('ul', { className: 'board-rules' },
      h('li', {}, 'The Hall is top centre, the Mountain top right, the Shore bottom centre, the tavern bottom left.'),
      h('li', {}, 'Black lines: where each of them will walk tonight.'),
      h('li', {}, 'An ally standing on a route stops whoever they can talk to.'),
      h('li', {}, 'Guards listen only to Aristion. Nobody listens to a blind singer about the ritual.'),
      h('li', {}, 'Stop the priest before the Mountain, the guards before the Hall, Lysimachus before the Shore.'));
    const missing = (['kora', 'aristion'] as AllyId[]).filter((a) => !avail.includes(a)).map((a) => ALLY_NAMES[a]);

    const children: (Node | string)[] = [h('h2', {}, 'The Night of Anamnesis'), rules,
      h('p', {}, 'Choose an ally, then a tile:'), h('div', { className: 'board-allies' }, ...allyButtons)];
    if (missing.length) children.push(h('p', { className: 'desk-note' }, `Not with you tonight: ${missing.join(', ')}.`));
    if (!this.result) {
      const go = h('button', { type: 'button' }, 'Let the night come');
      go.addEventListener('click', () => this.start());
      children.push(go);
    } else if (!this.playback) {
      const r = this.result;
      children.push(h('div', { className: 'board-result' },
        h('p', {}, r.citySilent ? 'The priest never reaches the mountain. Nobody will lead the Yes.' : 'The priest reaches the mountain. The city will answer him.'),
        h('p', {}, r.hallClear ? 'The Hall is empty. The spiral is yours.' : 'Guards stand in the Hall. They will mend what you break.'),
        h('p', {}, r.shoreClear ? 'Nobody waits on the shore.' : 'Lysimachus waits on the shore, watching the water.')));
      const hall = h('button', { type: 'button' }, 'Go down to the Hall');
      hall.addEventListener('click', () => this.host.switchStage('strikes'));
      const again = h('button', { type: 'button', className: 'ghost' }, 'Plan again');
      again.addEventListener('click', () => this.enter());
      children.push(hall, again);
    }
    this.panel.replaceChildren(...children);
  }
}
