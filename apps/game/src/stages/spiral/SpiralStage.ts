// Stage I, "The Spiral": first person, fixed position, strict 1-bit. A deduction game.
// Three rings, six carved scribes. Click a scribe to study the carving and fill in the
// registry; align the scribes of the outer two rings to find the seam.
import * as THREE from 'three';
import { PAST_LEONTS, type PastLeont } from '../../content/leonts.ts';
import { confirmEntries } from '../../core/registry.ts';
import { daySeed, seededRng } from '../../core/rng.ts';
import { h } from '../../ui/dom.ts';
import { registryOverview, registryRow } from '../../ui/Registry.ts';
import { disposeScene } from '../dispose.ts';
import { lambert, makeFigure } from '../figures.ts';
import type { Stage, StageHost } from '../types.ts';
import { HallDecor } from './hall.ts';

const RINGS = 4;
const OUTER = 4.6;
const BAND = 0.9;
const ALIGN_TOLERANCE = 0.07;
/** Draws nothing and writes no depth: only there for the raycaster. */
const HIT_MATERIAL = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

/** The two scribes whose alignment reveals the seam: one on the outer ring, one on the second. */
const ALIGN_PAIR = ['l1', 'l3'];

interface Ring {
  group: THREE.Group;
  inner: number;
  outer: number;
}

export class SpiralStage implements Stage {
  readonly id = 'spiral' as const;
  readonly palette = 'marble' as const;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

  /** Studying a carving stops the day: deduction should not be a race. */
  get clockRuns(): boolean {
    return !this.cardOpen;
  }

  private host: StageHost;
  private rings: Ring[] = [];
  private disk = new THREE.Group();
  private seam: THREE.Group;
  private scribes = new Map<string, THREE.Group>();
  private dragging: Ring | null = null;
  private dragDistance = 0;
  private raycaster = new THREE.Raycaster();
  private diskPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private aligned = false;
  private card: HTMLElement;
  private decor: HallDecor;
  private spot: THREE.SpotLight;
  /** 0..1: the flare of light across the stone when the rings line up. */
  private pulse = 0;
  private time = 0;
  private grindAt = 0;
  private cardOpen = false;

  constructor(host: StageHost) {
    this.host = host;
    this.scene.background = new THREE.Color('#050404');
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    const spot = new THREE.SpotLight('#ffffff', 220, 30, 0.6, 0.5, 1.4);
    this.spot = spot;
    spot.position.set(-3, 7, 8);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    this.scene.add(spot, spot.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), lambert('#6b6660'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5.2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.decor = new HallDecor(this.scene);
    this.buildDisk();
    this.seam = this.buildSeam();
    this.scene.add(this.disk);
    this.camera.position.set(0, 0.2, 12.5);

    this.card = h('section', { className: 'spiral-card', hidden: true });
    host.overlay.append(this.card);
  }

  private buildDisk(): void {
    const rand = seededRng(daySeed('eferon/spiral/v2'));
    const marble = lambert('#efe9dc');
    const eroded = this.host.patches().includes('registry_blur');
    for (let i = 0; i < RINGS; i++) {
      const outer = OUTER - i * BAND;
      const inner = outer - BAND + 0.08;
      const group = new THREE.Group();
      const band = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 72, 1), marble);
      band.receiveShadow = true;
      group.add(band);
      // Reliefs: the same scenes on every ring, cruder towards the centre. No sea anywhere.
      const count = 12 - i * 2;
      const size = 0.18 + i * 0.08;
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + rand() * 0.2;
        const r = (inner + outer) / 2;
        const relief = new THREE.Mesh(new THREE.BoxGeometry(size * (1 + rand()), size * (1 + rand() * 1.5), 0.18), marble);
        relief.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.09);
        relief.rotation.z = a;
        relief.castShadow = true;
        group.add(relief);
      }
      for (const leont of PAST_LEONTS.filter((l) => l.ring === i)) {
        const r = (inner + outer) / 2;
        const scribe = makeFigure(eroded && i === 1 ? '#6d6862' : '#141110', 0.5 + i * 0.05);
        scribe.position.set(Math.cos(leont.angle) * r, Math.sin(leont.angle) * r - 0.22, 0.12);
        scribe.userData.leont = leont.id;
        // A wider, invisible target around the small figure, so the mouse finds it without hunting.
        const target = new THREE.Mesh(new THREE.CircleGeometry(0.42 + i * 0.04, 12), HIT_MATERIAL);
        target.position.set(0, 0.28, 0.02);
        target.userData.noOutline = true;
        scribe.add(target);
        group.add(scribe);
        this.scribes.set(leont.id, scribe);
      }
      group.rotation.z = rand() * Math.PI * 2;
      this.disk.add(group);
      this.rings.push({ group, inner, outer });
    }
    // The empty centre.
    const hub = new THREE.Mesh(new THREE.CircleGeometry(OUTER - RINGS * BAND, 48), lambert('#1c1a18'));
    hub.position.z = -0.02;
    this.disk.add(hub);
  }

  private buildSeam(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 20), mat);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), mat);
    bar.position.y = 0.12;
    g.add(ring, bar);
    g.position.set(0, OUTER - BAND + 0.04, 0.25);
    g.visible = false;
    this.disk.add(g);
    return g;
  }

  enter(): void {
    this.onResize();
    this.aligned = this.host.knowledge.knows('leont_on_every_ring');
    if (this.aligned) this.snapAligned();
    this.seam.visible = this.aligned;
    const k = this.host.knowledge;
    if (!k.knows('spiral_repeats')) this.host.interact('spiral_enter');
    // After Glaucus: look for the sea on the stone.
    else if (k.knows('glaucus_no_calendar') && !k.knows('sea_absent')) this.host.interact('spiral_no_sea');
    // The illusion of the break: a previous Leont's act is carved on the outer ring.
    else if (this.host.breakShard() && !this.shardShown) {
      this.shardShown = true;
      this.host.interact('spiral_shard');
    }
  }

  exit(): void {
    this.dragging = null;
    document.body.style.cursor = '';
    this.closeCard();
    this.host.prompt(null);
  }

  dispose(): void {
    this.card.remove();
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const { input } = this.host;
    this.time += dt;
    this.decor.update(this.time);
    this.pulse = Math.max(0, this.pulse - dt * 0.6);
    this.spot.intensity = 220 * (1 + this.pulse * 2.2);
    // Leont can look around a little; he cannot walk away from it.
    const tx = input.mouse.x * 0.12;
    const ty = input.mouse.y * 0.08;
    this.camera.rotation.y += (-tx - this.camera.rotation.y) * Math.min(1, dt * 4);
    this.camera.rotation.x += (ty - this.camera.rotation.x) * Math.min(1, dt * 4);

    if (this.cardOpen) {
      if (input.wasPressedRaw('Escape')) this.closeCard();
      return;
    }
    if (input.wasPressed('Escape')) {
      this.host.switchStage('town', 'temple');
      return;
    }
    if (input.wasPressed('Tab')) {
      this.openRegistry();
      return;
    }

    const hit = this.pointOnDisk();
    const scribe = this.scribeUnderMouse();
    const overSeam = this.seam.visible && hit !== null && hit.distanceTo(this.seam.getWorldPosition(new THREE.Vector3())) < 0.4;
    this.host.prompt(
      overSeam ? 'Click — the mark' : scribe ? 'Click — study the carving' : null,
    );

    // Show that a scribe can be clicked.
    document.body.style.cursor = scribe || overSeam ? 'pointer' : '';
    const pressedNow = input.wasClicked();
    if (pressedNow) {
      this.press = { scribe, overSeam };
      this.dragDistance = 0;
      this.grindAt = 0;
      const r = hit?.length() ?? -1;
      this.dragging = this.aligned || overSeam ? null : this.rings.find((ring) => r >= ring.inner && r <= ring.outer) ?? null;
    }
    // Only while the button is still held: movement after release must not turn the ring.
    // Movement that arrived in the same frame as the press happened before it: it is not a drag.
    if (this.dragging && input.mouse.buttons & 1 && !pressedNow) {
      this.dragging.group.rotation.z -= input.mouse.dx * 0.006;
      this.dragDistance += Math.abs(input.mouse.dx) + Math.abs(input.mouse.dy);
      // Stone on stone, every so often while the ring turns.
      if (this.dragDistance - this.grindAt > 120) {
        this.grindAt = this.dragDistance;
        this.host.sound('grind');
      }
      this.checkAlignment();
    }
    if (this.press && !(input.mouse.buttons & 1)) {
      // Released without dragging: a click on whatever was under the cursor.
      const press = this.press;
      this.press = null;
      this.dragging = null;
      if (input.pressTravel < 6) {
        if (press.overSeam) this.host.interact('spiral_seam');
        else if (press.scribe) this.openCard(press.scribe);
      }
    }
  }

  private press: { scribe: PastLeont | null; overSeam: boolean } | null = null;
  private shardShown = false;

  private pointOnDisk(): THREE.Vector3 | null {
    const { mouse } = this.host.input;
    this.raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), this.camera);
    return this.raycaster.ray.intersectPlane(this.diskPlane, new THREE.Vector3());
  }

  private scribeUnderMouse(): PastLeont | null {
    const hits = this.raycaster.intersectObjects([...this.scribes.values()], true);
    let obj: THREE.Object3D | null = hits[0]?.object ?? null;
    while (obj && !obj.userData.leont) obj = obj.parent;
    return obj ? PAST_LEONTS.find((l) => l.id === obj!.userData.leont) ?? null : null;
  }

  private angleOf(id: string): number {
    const leont = PAST_LEONTS.find((l) => l.id === id)!;
    return leont.angle + this.rings[leont.ring]!.group.rotation.z;
  }

  private checkAlignment(): void {
    const [a, b] = ALIGN_PAIR.map((id) => this.angleOf(id!));
    const diff = Math.atan2(Math.sin(a! - b!), Math.cos(a! - b!));
    if (Math.abs(diff) > ALIGN_TOLERANCE || this.aligned) return;
    this.aligned = true;
    this.dragging = null;
    // The light runs across the stone once, and the hall answers with a chord.
    this.pulse = 1;
    this.host.sound('align');
    this.snapAligned();
    this.seam.visible = true;
    this.host.interact('spiral_aligned');
  }

  private snapAligned(): void {
    const second = PAST_LEONTS.find((l) => l.id === ALIGN_PAIR[1])!;
    this.rings[second.ring]!.group.rotation.z = this.angleOf(ALIGN_PAIR[0]!) - second.angle;
  }

  private openCard(leont: PastLeont): void {
    this.dragging = null;
    document.body.style.cursor = '';
    const render = () => {
      const rows = [
        h('p', { className: 'carving' }, leont.carving),
        registryRow(this.host.memory, leont, () => this.onRegistryChange(render)),
      ];
      if (leont.enterable) {
        const enter = h('button', { type: 'button' }, 'Put your hand into the carving');
        enter.addEventListener('click', () => {
          this.closeCard();
          this.host.switchStage('relief', leont.id);
        });
        rows.push(enter);
      }
      const close = h('button', { type: 'button', className: 'ghost' }, 'Step back (Esc)');
      close.addEventListener('click', () => this.closeCard());
      this.card.replaceChildren(h('h2', {}, 'The carving'), ...rows, close);
    };
    render();
    this.card.hidden = false;
    this.cardOpen = true;
  }

  private openRegistry(): void {
    const render = () => {
      const close = h('button', { type: 'button', className: 'ghost' }, 'Close (Esc)');
      close.addEventListener('click', () => this.closeCard());
      this.card.replaceChildren(h('h2', {}, 'Registry of Leonts'), ...registryOverview(this.host.memory, [], () => this.onRegistryChange(render)), close);
    };
    render();
    this.card.hidden = false;
    this.cardOpen = true;
  }

  private onRegistryChange(rerender: () => void): void {
    const locked = confirmEntries(this.host.memory.registry);
    if (locked.length) {
      this.host.notice('registry_read', 0.1);
      this.host.persist();
      rerender();
      // Tell the story what was confirmed; it hands out facts and masks.
      this.closeCard();
      this.host.interact('registry_confirmed');
    } else {
      this.host.persist();
    }
  }

  private closeCard(): void {
    this.card.hidden = true;
    this.cardOpen = false;
  }
}
