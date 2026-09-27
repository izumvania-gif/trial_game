// Stage III, "The Plan": the night of Eferon painted on a board, seen from above.
// Place your allies, read the enemies' routes, then let the night play out.
import * as THREE from 'three';
import {
  ALLY_NAMES, canPlace, COLS, ENEMIES, enemiesFor, EXTRA_GUARD, LANDMARKS, WELL_TILE, ROWS, sameTile, simulate, type AllyId, type Enemy, type EnemyState, type Tile,
} from '../../core/board.ts';
import { ACTION_LABELS, ACTION_USES, canUse, initialSprint, LANES, rolledBack, SPRINT_TURNS as NIGHT_TURNS, sprintTurn, type CuratorAction, type SprintState } from '../../core/sprint.ts';
import { makeSea } from '../../render/sea.ts';
import { h } from '../../ui/dom.ts';
import { disposeScene } from '../dispose.ts';
import { lambert, makeFigure } from '../figures.ts';
import type { Stage, StageHost } from '../types.ts';

const TILE = 2.2;
const STEP_SECONDS = 0.7;
/** The Curator's half of the night always lasts this many turns, however quickly Eferon's half ends. */

const BOARD_BACK = new THREE.Color('#1c1511');

const tileToWorld = ([c, r]: Tile) => new THREE.Vector3((c - (COLS - 1) / 2) * TILE, 0, (r - (ROWS - 1) / 2) * TILE);


export class BoardStage implements Stage {
  readonly id = 'board' as const;
  readonly palette = 'board' as const;
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
  /** Decided when the night starts: how loud the day was decides whether a third guard comes. */
  private enemies: Enemy[] = ENEMIES;
  private routes = new Map<string, THREE.Group>();
  /** The double board: present once the Curator is awake. */
  private sprint: SprintState | null = null;
  private sprintPanel = h('aside', { className: 'sprint-panel', hidden: true });
  /** Night turn waiting for the Curator's move (playback pauses on it). */
  private awaitingCurator = false;
  private turn = 0;
  /** The painted board, darkening as the night is played. */
  private boardMat!: THREE.MeshBasicMaterial;
  private dark = 0;
  private time = 0;
  private torches: THREE.Mesh[] = [];
  private candle!: THREE.Group;
  private candleWax!: THREE.Mesh;
  private candleFlame!: THREE.Mesh;
  private candleLight = new THREE.PointLight('#ffd08a', 0, 12, 1.2);

  constructor(host: StageHost) {
    this.host = host;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(0, 18, 11);
    this.camera.lookAt(0, 0, 0.6);
    host.overlay.append(this.panel, this.sprintPanel);
    this.build();
  }

  private available(): AllyId[] {
    const k = this.host.knowledge;
    const out: AllyId[] = ['eion'];
    if (k.knows('kora_ally')) out.push('kora');
    if (k.knows('aristion_trust')) out.push('aristion');
    if (k.knows('talia_friend')) out.push('talia');
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
    // The old well: a black ring with a white chip in it.
    const [wc, wr] = WELL_TILE;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(wc * 64 + 32, wr * 64 + 32, 16, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(wc * 64 + 28, wr * 64 + 28, 8, 8);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    // Unlit, so the painted colors land exactly on the palette and the labels stay crisp.
    this.boardMat = new THREE.MeshBasicMaterial({ map: tex });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(COLS * TILE, ROWS * TILE), this.boardMat);
    board.rotation.x = -Math.PI / 2;
    s.add(board);
    this.buildLandmarks();

    // Enemies and their telegraphed routes: black lines ending in a black arrowhead.
    const ink = lambert('#0d0b09');
    for (const enemy of [...ENEMIES, EXTRA_GUARD]) {
      const route = new THREE.Group();
      s.add(route);
      this.routes.set(enemy.id, route);
      for (let i = 1; i < enemy.path.length; i++) {
        const a = tileToWorld(enemy.path[i - 1]!);
        const b = tileToWorld(enemy.path[i]!);
        const len = a.distanceTo(b);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, len), ink);
        seg.position.copy(a).add(b).multiplyScalar(0.5).setY(0.05);
        seg.lookAt(b.x, 0.05, b.z);
        route.add(seg);
      }
      const end = tileToWorld(enemy.path[enemy.path.length - 1]!);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), ink);
      head.position.copy(end).setY(0.4);
      route.add(head);
      const fig = makeFigure(enemy.id.startsWith('guard') ? '#3a2414' : '#0d0b09', 1.3);
      fig.position.copy(tileToWorld(enemy.path[0]!));
      // Each of them carries a torch through the night.
      const torch = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      torch.position.set(0.32, 1.35, 0);
      torch.visible = false;
      fig.add(torch);
      this.torches.push(torch);
      s.add(fig);
      this.enemyFigures.set(enemy.id, fig);
    }
    // A candle at the corner of the board burns down while the night is played.
    this.candle = new THREE.Group();
    this.candleWax = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.6, 8), lambert('#efe6cf'));
    this.candleWax.geometry.translate(0, 0.8, 0);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.12, 10), lambert('#3a2414'));
    this.candleFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.candle.add(dish, this.candleWax, this.candleFlame, this.candleLight);
    this.candle.position.set((COLS / 2) * TILE - 1.2, 0, (ROWS / 2) * TILE + 1.1);
    this.candle.traverse((o) => (o.castShadow = true));
    s.add(this.candle);

    for (const id of ['kora', 'aristion', 'eion', 'talia'] as AllyId[]) {
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
    this.sprint = this.host.knowledge.knows('curator_awake') ? initialSprint() : null;
    this.onResize();
    this.enemies = enemiesFor(this.host.cycle.wind);
    for (const [id, route] of this.routes) {
      const active = this.enemies.some((e) => e.id === id);
      route.visible = active;
      this.enemyFigures.get(id)!.visible = active;
    }
    this.allies = {};
    this.selected = this.available()[0] ?? null;
    this.playback = null;
    this.result = null;
    this.turn = 0;
    this.awaitingCurator = false;
    this.sprintPanel.hidden = !this.sprint;
    this.renderSprint();
    for (const fig of this.allyFigures.values()) fig.visible = false;
    for (const e of this.enemies) this.enemyFigures.get(e.id)!.position.copy(tileToWorld(e.path[0]!));
    this.panel.hidden = false;
    this.renderPanel();
  }

  exit(): void {
    this.panel.hidden = true;
    this.sprintPanel.hidden = true;
  }

  dispose(): void {
    this.panel.remove();
    this.sprintPanel.remove();
    disposeScene(this.scene);
  }

  onResize(): void {
    // Frame the board between the plan panel (~24rem, left) and, on the double board,
    // the Curator's panel (~22rem, right); zoom out if the space between them is narrow.
    const aspect = this.host.aspect();
    const leftPx = 24 * 16;
    const rightPx = this.sprint ? 22 * 16 : 0;
    const freePx = Math.max(200, window.innerWidth - leftPx - rightPx);
    const halfH = Math.max(6.8, ((COLS * TILE + 1) * window.innerHeight) / (2 * freePx));
    const unitsPerPx = (halfH * 2) / window.innerHeight;
    const shift = ((leftPx - rightPx) * unitsPerPx) / 2;
    this.camera.left = -halfH * aspect - shift;
    this.camera.right = halfH * aspect - shift;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const { input } = this.host;
    this.sea?.material.tick(dt);
    this.night(dt);
    if (this.playback) return this.play(dt);
    if (this.result) return;
    const tile = this.tileUnderMouse();
    if (input.wasClicked() && tile && this.selected) {
      if (canPlace(tile, this.enemies) && !Object.values(this.allies).some((t) => sameTile(t, tile))) {
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

  /** While the night plays, the map darkens, the torches are lit and the candle burns down. */
  private night(dt: number): void {
    this.time += dt;
    const playing = this.playback !== null;
    const target = playing ? 1 : this.result ? 0.6 : 0;
    this.dark += (target - this.dark) * Math.min(1, dt * 1.5);
    this.boardMat.color.setScalar(1 - this.dark * 0.3);
    (this.scene.background as THREE.Color).copy(BOARD_BACK).multiplyScalar(1 - this.dark * 0.6);
    const flicker = 0.8 + 0.2 * Math.sin(this.time * 11) * Math.sin(this.time * 7.3);
    for (const t of this.torches) {
      t.visible = this.dark > 0.3;
      t.scale.y = flicker + 0.15 * Math.sin(this.time * 13 + t.id);
    }
    // How much of the night is gone: the candle's wax.
    const pb = this.playback;
    const burnt = pb ? Math.min(1, pb.t / Math.max(1, pb.turns.length)) : this.result ? 1 : 0;
    const height = 1 - burnt * 0.8;
    this.candleWax.scale.y = height;
    this.candleFlame.position.y = 1.6 * height + 0.25;
    this.candleFlame.scale.set(1, flicker * 1.1, 1);
    this.candleLight.position.y = 1.6 * height + 0.5;
    this.candleLight.intensity = (3 + this.dark * 9) * flicker;
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
    const { turns, outcome } = simulate(this.allies, this.enemies);
    this.playback = { turns, t: 0 };
    this.result = outcome;
    this.renderPanel();
  }

  private play(dt: number): void {
    const pb = this.playback!;
    if (this.awaitingCurator) return;
    const before = Math.floor(pb.t);
    pb.t += dt / STEP_SECONDS;
    // On the double board every new turn waits for the Curator's move.
    if (this.sprint && Math.floor(pb.t) > before && this.turn < NIGHT_TURNS) {
      pb.t = Math.floor(pb.t);
      this.awaitingCurator = true;
      this.renderSprint();
    }
    const i = Math.min(pb.turns.length - 1, Math.floor(pb.t));
    const frac = Math.min(1, pb.t - i);
    const now = pb.turns[i]!;
    const next = pb.turns[Math.min(pb.turns.length - 1, i + 1)]!;
    for (const e of this.enemies) {
      const a = tileToWorld(e.path[now.find((s) => s.id === e.id)!.step]!);
      const b = tileToWorld(e.path[next.find((s) => s.id === e.id)!.step]!);
      this.enemyFigures.get(e.id)!.position.lerpVectors(a, b, frac);
    }
    const curatorDone = !this.sprint || this.turn >= NIGHT_TURNS;
    if (pb.t >= pb.turns.length && curatorDone) {
      this.playback = null;
      if (this.sprint && this.result) this.result.rollbackAvoided = !rolledBack(this.sprint);
      this.host.cycle.night = this.result;
      this.host.knowledge.learn('board_played');
      if (Object.values(this.allies).some((t) => sameTile(t, WELL_TILE))) this.host.knowledge.learn('shard_board');
      this.host.persist();
      this.renderPanel();
    }
  }

  private curatorMove(action: CuratorAction): void {
    if (!this.sprint || !this.awaitingCurator) return;
    this.sprint = sprintTurn(this.sprint, action);
    this.turn += 1;
    // Once the rollback is approved the Curator has nothing left to answer: the night plays out.
    if (rolledBack(this.sprint)) this.turn = NIGHT_TURNS;
    this.awaitingCurator = false;
    this.renderSprint();
  }

  private renderSprint(): void {
    const s = this.sprint;
    if (!s) return;
    const lanes = h('ol', { className: 'sprint-lanes' }, ...LANES.map((name, i) =>
      h('li', { className: i === s.lane ? 'here' : '' }, name, i === s.lane ? ' ◀ ticket EFR-ROLLBACK' : '')));
    const children: (Node | string)[] = [
      h('h2', {}, 'Curator P-7 · the same night'),
      h('p', { className: 'desk-note' }, 'Minotaur_ops is pushing a rollback of tonight through the pipeline, one lane per turn. If it reaches ROLLBACK, none of this happened.'),
      lanes,
      h('p', {}, `Turn ${Math.min(this.turn + 1, NIGHT_TURNS)} of ${NIGHT_TURNS}`),
    ];
    if (rolledBack(s)) children.push(h('p', { className: 'sprint-bad' }, 'ROLLBACK APPROVED. Whatever happens below, the morning will not know it.'));
    else if (this.awaitingCurator) {
      for (const a of ['wait', 'defer', 'reply', 'noise'] as CuratorAction[]) {
        const b = h('button', { type: 'button', className: 'ghost', disabled: a !== 'wait' && !canUse(s, a) }, `${ACTION_LABELS[a]}${a === 'wait' ? '' : ` · ${Math.max(0, ACTION_USES[a] - s.used[a])} left`}`);
        b.addEventListener('click', () => this.curatorMove(a));
        children.push(b);
      }
    } else if (this.turn >= NIGHT_TURNS) children.push(h('p', { className: 'sprint-good' }, 'The ticket is still in the pipeline at dawn. Nobody approved anything.'));
    else children.push(h('p', { className: 'desk-note' }, this.playback ? 'The night moves…' : 'Waiting for the night to begin.'));
    this.sprintPanel.replaceChildren(...children);
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
      h('li', {}, 'Guards listen only to Aristion; the priest of Zeus only to Kora. Lysimachus stops for anyone who knows him.'),
      h('li', {}, 'Stop the priest before the Mountain, the guards before the Hall, Lysimachus before the Shore.'));
    const missing = (['kora', 'aristion', 'talia'] as AllyId[]).filter((a) => !avail.includes(a)).map((a) => ALLY_NAMES[a]);

    const children: (Node | string)[] = [h('h2', {}, 'The Night of Anamnesis'), rules,
      h('p', {}, 'Choose an ally, then a tile:'), h('div', { className: 'board-allies' }, ...allyButtons)];
    if (this.enemies.length > 4) children.push(h('p', { className: 'desk-note' }, 'The day was loud. A third guard is coming up from the port.'));
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
        h('p', {}, r.shoreClear ? 'Nobody waits on the shore.' : 'Lysimachus waits on the shore, watching the water.'),
        r.rollbackAvoided === undefined ? '' : h('p', {}, r.rollbackAvoided ? 'Upstairs, the rollback never gets approved.' : 'Upstairs, the rollback is approved.')));
      const hall = h('button', { type: 'button' }, 'Go down to the Hall');
      hall.addEventListener('click', () => this.host.switchStage('strikes'));
      const again = h('button', { type: 'button', className: 'ghost' }, 'Plan again');
      again.addEventListener('click', () => this.enter());
      children.push(hall, again);
    }
    this.panel.replaceChildren(...children);
  }
}
