// The shore: no palette, no dithering, no HUD. The only non-deterministic place in the game.
import * as THREE from 'three';
import { makeSea } from '../../render/sea.ts';
import { lambert } from '../figures.ts';
import { disposeScene } from '../dispose.ts';
import { SEA_SKY, Sky } from '../sky.ts';
import { Shore } from './shore.ts';
import type { Stage, StageAgent, StageHost } from '../types.ts';

export class SeaStage implements Stage {
  readonly id = 'sea' as const;
  readonly palette = 'none' as const;
  readonly clockRuns = true;
  readonly hideHud = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);

  private host: StageHost;
  private sea = makeSea(400, 220);
  private look = 0;
  private sky: Sky;
  private time = 0;
  private shore: Shore;
  private light: THREE.HemisphereLight;

  constructor(host: StageHost) {
    this.host = host;
    this.scene.background = new THREE.Color('#9fc3cc');
    this.scene.fog = new THREE.Fog('#9fc3cc', 60, 220);
    this.light = new THREE.HemisphereLight('#fdf6e3', '#6b5a44', 1.6);
    this.scene.add(this.light);
    this.sea.position.set(0, -0.3, -206); // starts just past the waterline
    this.scene.add(this.sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(200, 30), lambert('#d9c7a0'));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.25, 8);
    this.scene.add(sand);
    // Close enough to the water to watch it run up the sand.
    this.camera.position.set(0, 2, 3.5);
    // The moon comes up over the water, a little to the right of straight out to sea.
    const moonDir = new THREE.Vector3(0.3, 0.16, -1);
    this.sky = new Sky(this.scene, SEA_SKY, { moonDir, moonColor: '#f6f0dc', starColor: '#f2f4f8', sunset: '#ff8a4a' });
    this.shore = new Shore(this.scene);
    this.shore.placeRoad(moonDir);
  }

  enter(entry?: string): void {
    this.onResize();
    // After the strikes Leont comes down to the sea in the dark, with the knife.
    // 'after': the same night, resumed after the finale's dialogue (the Wake test, the hut).
    this.final = entry === 'final' || entry === 'after';
    this.shore.showGlaucus(entry === 'final');
    if (entry !== 'after') this.host.interact(this.final ? 'sea_final' : 'shore');
  }

  private final = false;

  afterDialogue(): void {
    // "Glaucus is gone."
    if (this.final) this.shore.releaseGlaucus();
  }

  exit(): void {}

  dispose(): void {
    disposeScene(this.scene);
  }

  onResize(): void {
    this.camera.aspect = this.host.aspect();
    this.camera.updateProjectionMatrix();
  }

  agent(): StageAgent {
    return {
      describe: () => [this.final ? 'The shore at night. The sea, the only thing here that is never the same twice.' : 'The shore. The sea comes in and goes out, never the same way twice.'],
      actions: () => (this.final ? [] : [{ id: 'leave', label: 'Go back up into the town' }]),
      perform: (id) => {
        if (id !== 'leave' || this.final) return null;
        this.host.switchStage('town', 'shore');
        return 'You go back up the path.';
      },
    };
  }

  update(dt: number): void {
    this.sea.material.tick(dt);
    const { input, clock } = this.host;
    this.look += (input.mouse.x * 0.35 - this.look) * Math.min(1, dt * 2);
    this.camera.rotation.set(-0.1, -this.look, 0, 'YXZ');
    // The sea at night is still the sea: a red sunset over it, then the moon.
    this.time += dt;
    this.sky.update(this.final ? 1 : clock.progress, this.camera, this.time);
    (this.scene.background as THREE.Color).copy(this.sky.horizon);
    this.scene.fog!.color.copy(this.sky.horizon);
    const progress = this.final ? 1 : clock.progress;
    const night = THREE.MathUtils.smoothstep(progress, 0.8, 0.92);
    // The sand goes blue and dim with the sky; the moon keeps a little of it.
    this.light.intensity = THREE.MathUtils.lerp(1.6, 0.7, night);
    this.light.color.set('#fdf6e3').lerp(new THREE.Color('#8ea4e0'), night);
    this.light.groundColor.set('#6b5a44').lerp(new THREE.Color('#2c3656'), night);
    this.shore.update(dt, night);
    if (!this.final && (input.wasPressed('Escape') || input.wasPressed('KeyS'))) this.host.switchStage('town', 'shore');
  }
}
