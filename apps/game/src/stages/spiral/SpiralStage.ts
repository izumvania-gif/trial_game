// Stage I, "The Spiral": first person, fixed position, strict 1-bit. A deduction game.
// Milestone 1 slice: drag the rings of the marble disk until the scribe on two rings lines up.
import * as THREE from 'three';
import { daySeed, seededRng } from '../../core/rng.ts';
import { lambert, makeFigure } from '../figures.ts';
import { disposeScene } from '../dispose.ts';
import type { Stage, StageHost } from '../types.ts';

const RINGS = 5;
const OUTER = 4.6;
const BAND = 0.7;
const ALIGN_TOLERANCE = 0.07;
/** The scribe stands at this angle on ring 0 and ring 1 (in ring-local space). */
const SCRIBE_ANGLE = [0.6, 2.3];

interface Ring {
  group: THREE.Group;
  inner: number;
  outer: number;
}

export class SpiralStage implements Stage {
  readonly id = 'spiral' as const;
  readonly palette = 'marble' as const;
  readonly clockRuns = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

  private host: StageHost;
  private rings: Ring[] = [];
  private disk = new THREE.Group();
  private seam: THREE.Group;
  private dragging: Ring | null = null;
  private raycaster = new THREE.Raycaster();
  private diskPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private aligned = false;

  constructor(host: StageHost) {
    this.host = host;
    this.scene.background = new THREE.Color('#050404');
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    const spot = new THREE.SpotLight('#ffffff', 220, 30, 0.6, 0.5, 1.4);
    spot.position.set(-3, 7, 8);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    this.scene.add(spot, spot.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), lambert('#6b6660'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5.2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.buildDisk();
    this.seam = this.buildSeam();
    this.scene.add(this.disk);
    this.camera.position.set(0, 0.2, 12.5);
  }

  private buildDisk(): void {
    const rand = seededRng(daySeed('eferon/spiral'));
    const marble = lambert('#efe9dc');
    for (let i = 0; i < RINGS; i++) {
      const outer = OUTER - i * BAND;
      const inner = outer - BAND + 0.06;
      const group = new THREE.Group();
      const band = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 72, 1), marble);
      band.receiveShadow = true;
      group.add(band);
      // Reliefs: the same scenes on every ring, cruder towards the centre.
      const count = 12 - i * 2;
      const size = 0.16 + i * 0.05;
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + rand() * 0.2;
        const r = (inner + outer) / 2;
        const relief = new THREE.Mesh(new THREE.BoxGeometry(size * (1 + rand()), size * (1 + rand() * 1.5), 0.18), marble);
        relief.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.09);
        relief.rotation.z = a;
        relief.castShadow = true;
        group.add(relief);
      }
      if (i < SCRIBE_ANGLE.length) {
        const a = SCRIBE_ANGLE[i]!;
        const r = (inner + outer) / 2;
        const scribe = makeFigure('#141110', 0.5 + i * 0.08);
        scribe.position.set(Math.cos(a) * r, Math.sin(a) * r - 0.2, 0.12);
        group.add(scribe);
      }
      group.rotation.z = rand() * Math.PI * 2;
      this.disk.add(group);
      this.rings.push({ group, inner, outer });
    }
    // The empty centre, and the broken line beneath it.
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
    g.position.set(0, OUTER - BAND + 0.03, 0.25);
    g.visible = false;
    this.disk.add(g);
    return g;
  }

  enter(): void {
    this.onResize();
    this.aligned = this.host.knowledge.knows('leont_on_every_ring');
    if (this.aligned) this.snapAligned();
    this.seam.visible = this.aligned;
    if (!this.host.knowledge.knows('spiral_repeats')) this.host.interact('spiral_enter');
  }

  exit(): void {
    this.dragging = null;
    this.host.prompt(null);
  }

  dispose(): void {
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const { input } = this.host;
    // Leont can look around a little; he cannot walk away from it.
    const tx = input.mouse.x * 0.12;
    const ty = input.mouse.y * 0.08;
    this.camera.rotation.y += (-tx - this.camera.rotation.y) * Math.min(1, dt * 4);
    this.camera.rotation.x += (ty - this.camera.rotation.x) * Math.min(1, dt * 4);

    if (input.wasPressed('Escape')) {
      this.host.switchStage('town', 'temple');
      return;
    }

    const hit = this.pointOnDisk();
    const overSeam = this.seam.visible && hit !== null && hit.distanceTo(this.seam.getWorldPosition(new THREE.Vector3())) < 0.4;
    this.host.prompt(overSeam ? 'Click — the mark' : this.aligned ? 'Esc — step back' : 'Drag a ring · Esc — step back');

    if (input.wasClicked() && hit) {
      if (overSeam) {
        this.host.interact('spiral_seam');
        return;
      }
      const r = hit.length();
      this.dragging = this.aligned ? null : this.rings.find((ring) => r >= ring.inner && r <= ring.outer) ?? null;
    }
    if (!(input.mouse.buttons & 1)) this.dragging = null;
    if (this.dragging) {
      this.dragging.group.rotation.z -= input.mouse.dx * 0.006;
      this.checkAlignment();
    }
  }

  private pointOnDisk(): THREE.Vector3 | null {
    const { mouse } = this.host.input;
    this.raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), this.camera);
    return this.raycaster.ray.intersectPlane(this.diskPlane, new THREE.Vector3());
  }

  private scribeAngle(i: number): number {
    return SCRIBE_ANGLE[i]! + this.rings[i]!.group.rotation.z;
  }

  private checkAlignment(): void {
    const diff = Math.atan2(Math.sin(this.scribeAngle(0) - this.scribeAngle(1)), Math.cos(this.scribeAngle(0) - this.scribeAngle(1)));
    if (Math.abs(diff) > ALIGN_TOLERANCE) return;
    this.aligned = true;
    this.dragging = null;
    this.snapAligned();
    this.seam.visible = true;
    this.host.interact('spiral_aligned');
  }

  private snapAligned(): void {
    this.rings[1]!.group.rotation.z = this.scribeAngle(0) - SCRIBE_ANGLE[1]!;
  }
}
