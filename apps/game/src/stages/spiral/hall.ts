// The Hall of Anamnesis around the spiral: a half-ring of columns going up into the dark, the
// tablets and dead lamps the other Leonts left at its foot, and dust turning in the one beam
// of light. Everything is fixed by the seed except the dust, which only drifts with the clock.
import * as THREE from 'three';
import { daySeed, seededRng } from '../../core/rng.ts';
import { lambert } from '../figures.ts';

const FLOOR = -5.2;

export class HallDecor {
  private motes: THREE.InstancedMesh;
  private moteSeeds: { x: number; y: number; z: number; speed: number; phase: number }[] = [];
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const rand = seededRng(daySeed('eferon/hall/v1'));
    const marble = lambert('#e6e0d2');
    const worn = lambert('#b9b2a6');

    // Columns in a half-ring behind and beside the spiral, fluted, going up out of sight.
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.08 + (i / 8) * 0.84);
      const r = 10.5 + (i % 2) * 1.2;
      const z = -Math.sin(a) * r * 0.55 - 1.5;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 26, 14), marble);
      column.position.set(Math.cos(a) * r, FLOOR + 13, z);
      column.castShadow = column.receiveShadow = true;
      scene.add(column);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), worn);
      base.position.set(column.position.x, FLOOR + 0.25, z);
      base.receiveShadow = true;
      scene.add(base);
    }
    // A low step all round the foot of the spiral.
    const step = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.8, 0.5, 40, 1, false, Math.PI * 0.15, Math.PI * 1.7), worn);
    step.position.set(0, FLOOR + 0.25, -0.8);
    step.receiveShadow = true;
    scene.add(step);

    // What the others left: tablets leaning on the step, lamps that went out, a stylus.
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (2.2 + rand() * 4.6);
      const z = 1.2 + rand() * 2.4;
      const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.9 + rand() * 0.5, 1.2 + rand() * 0.6, 0.12), marble);
      tablet.position.set(x, FLOOR + 0.6, z);
      tablet.rotation.set(-0.25 - rand() * 0.3, (rand() - 0.5) * 0.8, (rand() - 0.5) * 0.3);
      tablet.castShadow = tablet.receiveShadow = true;
      scene.add(tablet);
    }
    const bronze = lambert('#3a342e');
    for (const x of [-4.6, 4.2]) {
      const lamp = new THREE.Group();
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5), bronze);
      legs.position.y = 0.75;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 0.3, 10), bronze);
      bowl.position.y = 1.6;
      lamp.add(legs, bowl);
      lamp.position.set(x, FLOOR, 2.6);
      lamp.traverse((o) => (o.castShadow = true));
      scene.add(lamp);
    }

    // Dust in the beam: pale specks, never outlined, never in the depth buffer.
    const count = 70;
    this.motes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false }), count);
    this.motes.userData.noOutline = true;
    this.motes.frustumCulled = false;
    for (let i = 0; i < count; i++) this.moteSeeds.push({ x: rand() * 9 - 4.5, y: rand() * 9 - 4, z: 3 + rand() * 6, speed: 0.05 + rand() * 0.1, phase: rand() * 6.28 });
    scene.add(this.motes);
  }

  update(time: number): void {
    this.moteSeeds.forEach((m, i) => {
      // Sinking slowly, swaying, and starting again at the top of the beam.
      const y = ((((m.y - time * m.speed + 4) % 9) + 9) % 9) - 4;
      this.dummy.position.set(m.x + Math.sin(time * 0.3 + m.phase) * 0.4, y, m.z + Math.cos(time * 0.23 + m.phase) * 0.3);
      this.dummy.updateMatrix();
      this.motes.setMatrixAt(i, this.dummy.matrix);
    });
    this.motes.instanceMatrix.needsUpdate = true;
  }
}
