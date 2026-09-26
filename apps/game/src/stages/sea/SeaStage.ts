// The shore: no palette, no dithering, no HUD. The only non-deterministic place in the game.
import * as THREE from 'three';
import { makeSea } from '../../render/sea.ts';
import { lambert } from '../figures.ts';
import { disposeScene } from '../dispose.ts';
import { SEA_SKY, Sky } from '../sky.ts';
import type { Stage, StageHost } from '../types.ts';

export class SeaStage implements Stage {
  readonly id = 'sea' as const;
  readonly palette = 'none' as const;
  readonly clockRuns = true;
  readonly hideHud = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);

  private host: StageHost;
  private sea = makeSea(400);
  private look = 0;
  private sky: Sky;
  private time = 0;

  constructor(host: StageHost) {
    this.host = host;
    this.scene.background = new THREE.Color('#9fc3cc');
    this.scene.fog = new THREE.Fog('#9fc3cc', 60, 220);
    this.scene.add(new THREE.HemisphereLight('#fdf6e3', '#6b5a44', 1.6));
    this.sea.position.set(0, -0.3, -206); // starts just past the waterline
    this.scene.add(this.sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(200, 30), lambert('#d9c7a0'));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.25, 8);
    this.scene.add(sand);
    this.camera.position.set(0, 1.7, 12);
    // The moon comes up over the water, a little to the right of straight out to sea.
    this.sky = new Sky(this.scene, SEA_SKY, { moonDir: new THREE.Vector3(0.3, 0.16, -1), moonColor: '#f6f0dc', starColor: '#f2f4f8', sunset: '#ff8a4a' });
  }

  enter(entry?: string): void {
    this.onResize();
    // After the strikes Leont comes down to the sea in the dark, with the knife.
    this.final = entry === 'final';
    this.host.interact(this.final ? 'sea_final' : 'shore');
  }

  private final = false;

  exit(): void {}

  dispose(): void {
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.sea.material.tick(dt);
    const { input, clock } = this.host;
    this.look += (input.mouse.x * 0.35 - this.look) * Math.min(1, dt * 2);
    this.camera.rotation.set(-0.05, -this.look, 0);
    // The sea at night is still the sea: a red sunset over it, then the moon.
    this.time += dt;
    this.sky.update(this.final ? 1 : clock.progress, this.camera, this.time);
    (this.scene.background as THREE.Color).copy(this.sky.horizon);
    this.scene.fog!.color.copy(this.sky.horizon);
    if (!this.final && (input.wasPressed('Escape') || input.wasPressed('KeyS'))) this.host.switchStage('town', 'shore');
  }
}
