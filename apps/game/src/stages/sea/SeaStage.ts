// The shore: no palette, no dithering, no HUD. The only non-deterministic place in the game.
import * as THREE from 'three';
import { makeSea } from '../../render/sea.ts';
import { lambert } from '../figures.ts';
import { disposeScene } from '../dispose.ts';
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
  }

  enter(): void {
    this.onResize();
    this.host.interact('shore');
  }

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
    // The sea at night is still the sea.
    const night = THREE.MathUtils.smoothstep(clock.progress, 0.72, 0.9);
    (this.scene.background as THREE.Color).set('#9fc3cc').lerp(new THREE.Color('#0b1622'), night);
    this.scene.fog!.color.copy(this.scene.background as THREE.Color);
    if (input.wasPressed('Escape') || input.wasPressed('KeyS')) this.host.switchStage('town', 'shore');
  }
}
