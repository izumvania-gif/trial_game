// The five strikes. First person, 1-bit, the spiral cut into five ages. Each strike destroys
// one age of the archive — and with it one of the player's tools from the other stages.
import * as THREE from 'three';
import type { Mechanic } from '../../core/types.ts';
import { h } from '../../ui/dom.ts';
import { disposeScene } from '../dispose.ts';
import { lambert } from '../figures.ts';
import type { Stage, StageHost } from '../types.ts';

const AGES: { name: string; mechanic: Mechanic; loss: string }[] = [
  { name: 'Golden', mechanic: 'schedules', loss: 'The Golden Age breaks. The Book of Strangers is blank: you no longer know where anyone will be.' },
  { name: 'Silver', mechanic: 'clock', loss: 'The Silver Age breaks. The clock is gone, and the wind with it. You do not know when the end comes.' },
  { name: 'Bronze', mechanic: 'dejavu', loss: 'The Bronze Age breaks. People will say words you have never heard.' },
  { name: 'Heroic', mechanic: 'masks', loss: 'The Age of Heroes breaks. The masks are only clay. The voices of the other Leonts go quiet, one by one.' },
  { name: 'Iron', mechanic: 'chronicle', loss: 'The Iron Age breaks. The chronicle burns, and every line of every Leont flares at once.' },
];

/** Seconds the tablets can still be carried out of the fire. */
const CARRY_SECONDS = 8;

export class StrikesStage implements Stage {
  readonly id = 'strikes' as const;
  readonly palette = 'marble' as const;
  readonly clockRuns = false;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

  private host: StageHost;
  private sectors: THREE.Mesh[] = [];
  private hits: number[] = [];
  private raycaster = new THREE.Raycaster();
  private shake = 0;
  private caption = h('div', { className: 'strike-caption' });
  private carry: { left: number; button: HTMLButtonElement } | null = null;
  private fire = new THREE.PointLight('#ffffff', 0, 20);

  constructor(host: StageHost) {
    this.host = host;
    this.caption.hidden = true;
    host.overlay.append(this.caption);
    this.scene.background = new THREE.Color('#050404');
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.2));
    const spot = new THREE.SpotLight('#ffffff', 240, 30, 0.6, 0.5, 1.4);
    spot.position.set(3, 7, 8);
    this.scene.add(spot, spot.target);
    this.fire.position.set(0, -3, 3);
    this.scene.add(this.fire);
    const marble = lambert('#efe9dc');
    for (let i = 0; i < AGES.length; i++) {
      const wedge = new THREE.Mesh(new THREE.CircleGeometry(4.6, 16, (i / 5) * Math.PI * 2 + 0.02, (Math.PI * 2) / 5 - 0.04), marble.clone());
      wedge.userData.age = i;
      this.scene.add(wedge);
      this.sectors.push(wedge);
    }
    this.camera.position.set(0, 0, 12);
  }

  private strikesNeeded(): number {
    // Guards in the Hall mend every crack you make: each age takes two blows.
    return this.host.cycle.night?.hallClear === false ? 2 : 1;
  }

  enter(): void {
    this.onResize();
    this.hits = AGES.map(() => 0);
    for (const s of this.sectors) {
      s.visible = true;
      s.position.set(0, 0, 0);
      s.rotation.set(0, 0, 0);
    }
    this.say(this.strikesNeeded() > 1
      ? 'The guards are already here. Every crack you make, they fill. Strike each age twice.'
      : 'Oil on the floor. The staff in your hands. Five ages. Click to strike.');
  }

  exit(): void {
    this.caption.hidden = true;
    this.carry?.button.remove();
    this.carry = null;
  }

  dispose(): void {
    this.caption.remove();
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  private say(text: string): void {
    this.caption.textContent = text;
    this.caption.hidden = false;
  }

  update(dt: number): void {
    const { input } = this.host;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.camera.position.x = (Math.random() - 0.5) * this.shake * 0.3;
    this.camera.position.y = (Math.random() - 0.5) * this.shake * 0.3;
    for (const s of this.sectors) {
      if (s.userData.falling) {
        s.position.y -= dt * 6;
        s.rotation.z += dt * 2;
        if (s.position.y < -12) s.visible = false;
      }
    }
    if (this.carry) {
      this.carry.left -= dt;
      this.fire.intensity = 30 + Math.random() * 20;
      this.carry.button.textContent = `Carry the tablets out of the fire (${Math.ceil(this.carry.left)})`;
      if (this.carry.left <= 0) {
        this.carry.button.remove();
        this.carry = null;
        this.host.switchStage('sea', 'final');
      }
      return;
    }
    if (!input.wasClicked()) return;
    const { mouse } = input;
    this.raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), this.camera);
    const hit = this.raycaster.intersectObjects(this.sectors.filter((s) => s.visible && !s.userData.falling))[0];
    if (!hit) return;
    const age = hit.object.userData.age as number;
    this.hits[age]! += 1;
    if (!this.host.reducedMotion()) this.shake = 1;
    this.host.sound('strike');
    if (this.hits[age]! < this.strikesNeeded()) {
      this.say('The marble cracks. A guard kneels and presses the crack shut with his palms.');
      return;
    }
    hit.object.userData.falling = true;
    this.host.loseMechanic(AGES[age]!.mechanic);
    this.say(AGES[age]!.loss);
    if (this.sectors.every((s) => s.userData.falling)) this.startFire();
  }

  private startFire(): void {
    // The last temptation: everything you learned, in your arms, still warm.
    const button = h('button', { type: 'button', className: 'carry' }, '');
    button.addEventListener('click', () => {
      button.remove();
      this.carry = null;
      this.host.ending('aoidos');
    });
    this.host.overlay.append(button);
    this.carry = { left: CARRY_SECONDS, button };
    this.say('The hall is burning. Your chronicle is on the floor, the wax running. The sea is down the path.');
  }
}
