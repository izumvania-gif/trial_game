// Inside a carving: a frozen moment of a past cycle you can walk around (Obra Dinn's memento).
// First person, 1-bit. Walk close to a figure to hear the words that were in the air that second.
import * as THREE from 'three';
import { h } from '../../ui/dom.ts';
import { cloneCanvas, portrait, portraitFor } from '../../ui/portraits.ts';
import { disposeScene } from '../dispose.ts';
import { lambert, makeFigure } from '../figures.ts';
import type { Stage, StageHost } from '../types.ts';

interface Voice {
  at: THREE.Vector3;
  speaker: string;
  text: string;
}

const WALK = 3.2;
const TURN = 1.8;

export class ReliefStage implements Stage {
  readonly id = 'relief' as const;
  readonly palette = 'marble' as const;
  readonly clockRuns = false;
  readonly hideHud = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.05, 80);

  private host: StageHost;
  private yaw = 0;
  private voices: Voice[] = [];
  private chip!: THREE.Mesh;
  private caption = h('div', { className: 'relief-caption' });
  /** The voice whose caption is showing. */
  private heard: Voice | null = null;

  constructor(host: StageHost) {
    this.host = host;
    this.caption.hidden = true;
    host.overlay.append(this.caption);
    this.build();
  }

  private build(): void {
    const s = this.scene;
    s.background = new THREE.Color('#0a0908');
    s.fog = new THREE.Fog('#0a0908', 6, 22);
    s.add(new THREE.AmbientLight('#ffffff', 0.3));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(4, 9, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    s.add(key);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 1, 9), lambert('#8f8a82'));
    top.position.y = -0.5;
    top.receiveShadow = true;
    s.add(top);

    const altar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.9), lambert('#efe9dc'));
    altar.position.set(0, 0.5, -3);
    altar.castShadow = altar.receiveShadow = true;
    s.add(altar);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    fire.position.set(0, 1.45, -3);
    s.add(fire);

    // The priest, falling backwards, stopped halfway.
    const priest = makeFigure('#1a1614', 1.8);
    priest.position.set(0.3, 0.2, -1.9);
    priest.rotation.x = 0.9;
    s.add(priest);
    // The scribe, the knife still in his hand.
    const scribe = makeFigure('#141110', 1.7);
    scribe.position.set(0.9, 0, -0.8);
    scribe.rotation.y = -2.6;
    const knife = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), lambert('#f4efe4'));
    knife.position.set(-0.3, 1.05, -0.35);
    scribe.add(knife);
    s.add(scribe);

    // The crowd, every hand already holding a stone.
    const stoneMat = lambert('#d9d3c6');
    for (let i = 0; i < 11; i++) {
      const a = -0.3 + (i / 10) * (Math.PI + 0.6);
      const r = 5 + (i % 3) * 0.7;
      const person = makeFigure('#1c1916', 1.6 + (i % 2) * 0.15);
      person.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.9 + 0.5);
      person.lookAt(0.9, 0, -0.8);
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), stoneMat);
      stone.position.set(0.25, 1.95, 0);
      person.add(stone);
      s.add(person);
    }

    // Dust hanging in the air: time is stopped, not slowed.
    const dust = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 300; i++) pts.push((Math.sin(i * 12.9) * 0.5) * 16, 0.2 + ((i * 7) % 30) / 10, (Math.cos(i * 4.1) * 0.5) * 16);
    dust.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    s.add(new THREE.Points(dust, new THREE.PointsMaterial({ color: '#ffffff', size: 0.04 })));

    // A chip of the spiral hanging in the stopped air, at the very edge of the mountain.
    this.chip = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.chip.position.set(-6.6, 1.3, -3.2);
    s.add(this.chip);

    this.voices = [
      { at: new THREE.Vector3(0.3, 0, -1.9), speaker: 'The priest', text: '"Let the world return to its begin—"' },
      { at: new THREE.Vector3(0.9, 0, -0.8), speaker: 'Leont', text: 'If the voice stops, the ending stops. If the voice stops—' },
      { at: new THREE.Vector3(-4.2, 0, 2.4), speaker: 'A woman in the crowd', text: 'The stone was in my hand before he moved. Who put it there?' },
      { at: new THREE.Vector3(4.6, 0, 1.2), speaker: 'A boy', text: 'Is it the flood now? Mother said it would be the flood.' },
    ];
  }

  enter(): void {
    this.onResize();
    // Arrive at the edge of the moment, facing the altar.
    this.camera.position.set(0, 1.6, 3.2);
    this.yaw = 0;
    this.heard = null;
    this.caption.hidden = true;
  }

  exit(): void {
    this.heard = null;
    this.caption.hidden = true;
  }

  dispose(): void {
    this.caption.remove();
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const { input } = this.host;
    if (input.wasPressed('Escape')) {
      this.host.switchStage('spiral');
      return;
    }
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) this.yaw += TURN * dt;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) this.yaw -= TURN * dt;
    if (input.mouse.buttons & 1) this.yaw -= input.mouse.dx * 0.004;
    let move = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) move += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) move -= 1;
    const p = this.camera.position;
    p.x -= Math.sin(this.yaw) * move * WALK * dt;
    p.z -= Math.cos(this.yaw) * move * WALK * dt;
    const r = Math.hypot(p.x, p.z);
    if (r > 8) p.multiplyScalar(8 / r).setY(1.6);
    this.camera.rotation.set(0, this.yaw, 0, 'YXZ');

    this.chip.visible = !this.host.knowledge.knows('shard_relief');
    this.chip.rotation.y += dt * 0.3; // the only thing here that moves, and only barely
    if (this.chip.visible && Math.hypot(this.chip.position.x - p.x, this.chip.position.z - p.z) < 1.2) {
      this.host.knowledge.learn('shard_relief');
    }
    const near = this.voices.find((v) => Math.hypot(v.at.x - p.x, v.at.z - p.z) < 1.9);
    if (near !== this.heard) {
      this.heard = near ?? null;
      if (near) {
        const info = portraitFor(near.speaker);
        const face = info ? portrait(info.id, 'marble') : null;
        this.caption.replaceChildren(
          ...(face ? [h('span', { className: 'relief-face' }, cloneCanvas(face))] : []),
          h('span', {}, h('span', { className: 'speaker' }, near.speaker), near.text),
        );
      }
      this.caption.hidden = !near;
    }
  }
}
