// The five strikes. First person, 1-bit, the spiral cut into five ages. Each strike destroys
// one age of the archive — and with it one of the player's tools from the other stages.
import * as THREE from 'three';
import type { Mechanic } from '../../core/types.ts';
import { h } from '../../ui/dom.ts';
import { disposeScene } from '../dispose.ts';
import { lambert } from '../figures.ts';
import type { AgentAction, Stage, StageAgent, StageHost } from '../types.ts';

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
  /** Marble chips knocked off by the blows. */
  private chips: { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number }[] = [];
  private crackMat = lambert('#0d0b09');

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
    // The spiral's turns cut into the stone, so the ages read as one carving before they break.
    const marble = new THREE.MeshLambertMaterial({ color: '#efe9dc', map: spiralGrooves(), flatShading: true });
    for (let i = 0; i < AGES.length; i++) {
      const wedge = new THREE.Mesh(new THREE.CircleGeometry(4.6, 16, (i / 5) * Math.PI * 2 + 0.02, (Math.PI * 2) / 5 - 0.04), marble.clone());
      wedge.userData.age = i;
      this.scene.add(wedge);
      this.sectors.push(wedge);
    }
    this.camera.position.set(0, 0, 12);
    const chipGeo = new THREE.TetrahedronGeometry(0.12, 0);
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(chipGeo, marble);
      mesh.visible = false;
      this.scene.add(mesh);
      this.chips.push({ mesh, v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  /** A crack from where the staff landed: a few jagged runs of dark line, part of the wedge now. */
  private crack(wedge: THREE.Mesh, at: THREE.Vector3, blow: number): void {
    const local = wedge.worldToLocal(at.clone());
    const runs = 3 + blow;
    for (let r = 0; r < runs; r++) {
      let a = (r / runs) * Math.PI * 2 + Math.random() * 0.8;
      const p = new THREE.Vector2(local.x, local.y);
      for (let k = 0; k < 4; k++) {
        const len = 0.25 + Math.random() * 0.45;
        a += (Math.random() - 0.5) * 1.1;
        const q = p.clone().add(new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(len));
        const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.02), this.crackMat);
        seg.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, 0.02);
        seg.rotation.z = a;
        wedge.add(seg);
        p.copy(q);
      }
    }
  }

  /** Chips fly out of the blow and fall. */
  private burst(at: THREE.Vector3, count: number): void {
    let n = 0;
    for (const c of this.chips) {
      if (c.life > 0) continue;
      c.mesh.position.copy(at).setZ(0.3);
      c.v.set((Math.random() - 0.5) * 7, Math.random() * 5 + 1, Math.random() * 4 + 1);
      c.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      c.life = 1.6;
      c.mesh.visible = true;
      if (++n >= count) break;
    }
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
      s.userData.falling = false;
      s.position.set(0, 0, 0);
      s.rotation.set(0, 0, 0);
      for (const c of [...s.children]) {
        s.remove(c);
        (c as THREE.Mesh).geometry.dispose();
      }
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

  agent(): StageAgent {
    const standing = () => this.sectors.filter((s) => !s.userData.falling);
    return {
      describe: () => [
        'The spiral in the burning Hall, seen from above: five ages carved in the stone. Each blow of the staff breaks something in you as well.',
        ...AGES.map((a, i) => {
          const s = this.sectors.find((x) => x.userData.age === i);
          return `${a.name} Age: ${s?.userData.falling ? 'broken' : `standing (${this.hits[i]} of ${this.strikesNeeded()} blows)`}.`;
        }),
        ...(this.carry ? [`The Hall is burning. ${Math.ceil(this.carry.left)} seconds to carry the tablets out, or let them burn and go down to the sea.`] : []),
      ],
      actions: () => [
        ...standing().map((s): AgentAction => ({ id: `strike:${s.userData.age}`, label: `Strike the ${AGES[s.userData.age as number]!.name} Age` })),
        ...(this.carry ? [{ id: 'wait', label: 'Let the fire have them: wait', arg: 'seconds (default 5)' }] : []),
      ],
      perform: (id) => {
        const [verb, what] = id.split(':');
        if (verb !== 'strike') return null;
        const sector = standing().find((s) => s.userData.age === Number(what));
        if (!sector) return 'That age is already broken.';
        sector.geometry.computeBoundingSphere();
        this.strike(sector, sector.localToWorld(sector.geometry.boundingSphere!.center.clone()));
        return `You strike the ${AGES[Number(what)]!.name} Age.`;
      },
    };
  }

  update(dt: number): void {
    const { input } = this.host;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.camera.position.x = (Math.random() - 0.5) * this.shake * 0.3;
    this.camera.position.y = (Math.random() - 0.5) * this.shake * 0.3;
    for (const c of this.chips) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.v.y -= 14 * dt;
      c.mesh.position.addScaledVector(c.v, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.visible = c.life > 0;
    }
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
    // Not recursive: the cracks drawn into a wedge are its children and carry no age.
    const hit = this.raycaster.intersectObjects(this.sectors.filter((s) => s.visible), false)[0];
    if (!hit) return;
    if (hit.object.userData.falling) {
      this.say('That part is already falling. Strike what is still standing.');
      return;
    }
    this.strike(hit.object as THREE.Mesh, hit.point);
  }

  /** One blow of the staff on one age of the spiral. */
  private strike(sector: THREE.Mesh, point: THREE.Vector3): void {
    const age = sector.userData.age as number;
    this.hits[age]! += 1;
    if (!this.host.reducedMotion()) this.shake = 1;
    this.host.sound('strike');
    this.crack(sector, point, this.hits[age]!);
    this.burst(point, this.host.reducedMotion() ? 6 : 16);
    if (this.hits[age]! < this.strikesNeeded()) {
      this.say('The marble cracks. A guard kneels and presses the crack shut with his palms.');
      return;
    }
    sector.userData.falling = true;
    this.host.loseMechanic(AGES[age]!.mechanic);
    this.say(AGES[age]!.loss);
    // The last age's loss stays on screen with the fire, not under it.
    if (this.sectors.every((s) => s.userData.falling)) this.startFire(AGES[age]!.loss);
  }

  private startFire(lastLoss: string): void {
    // The last temptation: everything you learned, in your arms, still warm.
    const button = h('button', { type: 'button', className: 'carry' }, '');
    button.addEventListener('click', () => {
      button.remove();
      this.carry = null;
      this.host.ending('aoidos');
    });
    this.host.overlay.append(button);
    this.carry = { left: CARRY_SECONDS, button };
    this.host.setControls('Click the button — carry the tablets out · Wait — go down to the sea');
    this.say(`${lastLoss} Then the hall is burning. Your chronicle is on the floor, the wax running. The sea is down the path.`);
  }
}

/** Concentric turns of the spiral as grooves: dark lines on white, read by the palette as incisions. */
function spiralGrooves(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#6a655c';
  g.lineWidth = 3;
  g.beginPath();
  // Five turns, one per age, from the rim to the centre.
  for (let a = 0; a < Math.PI * 10; a += 0.05) {
    const r = (size / 2 - 6) * (1 - a / (Math.PI * 10));
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r;
    if (a === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
