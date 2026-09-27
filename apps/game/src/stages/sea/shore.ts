// What lives on the shore around the sea: the wash of foam that runs up the sand and back,
// the dark band it leaves, footprints going down to the water, gulls, sails far out, and at
// night the moon's road on the water. The foam and the moon road belong to the sea and take
// their timing from real chance (seaRandom); the sand, the footprints, gulls and sails do not.
import * as THREE from 'three';
import { daySeed, seaRandom, seededRng } from '../../core/rng.ts';
import { dressFigure, lambert, makeFigure } from '../figures.ts';
import { LOOKS } from '../../content/looks.ts';

/** The sand ends here and the water begins. */
export const WATERLINE = -7;
const GLAUCUS_Z = WATERLINE - 3.2;
const SAND_Y = 0.25;

const FOAM_VERTEX = /* glsl */ `
varying vec2 vPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

// reach: how far up the sand the current wave has run (metres). back: 0 while it rushes in,
// rising to 1 as it drains away, leaving a film that fades.
const FOAM_FRAGMENT = /* glsl */ `
uniform float reach;
uniform float back;
uniform float time;
uniform float seed;
varying vec2 vPos;
float wobble(float x) {
  return sin(x * 0.9 + seed) * 0.35 + sin(x * 2.3 - time * 0.4 + seed * 2.0) * 0.18 + sin(x * 5.1 + seed * 3.0) * 0.07;
}
void main() {
  // Metres up the sand from the waterline (z grows towards the camera).
  float up = vPos.y - (${WATERLINE.toFixed(1)});
  float front = reach + wobble(vPos.x);
  if (up > front + 0.05) discard;
  // The lace line at the front, broken into holes.
  float lace = smoothstep(0.35, 0.0, front - up);
  float holes = sin(vPos.x * 7.0 + up * 11.0 + seed) * sin(vPos.x * 3.1 - up * 6.0 + time * 0.6);
  lace *= smoothstep(-0.2, 0.5, holes);
  // Behind the front, a thin film of water that drains.
  float film = (1.0 - back) * 0.32 + 0.06;
  vec3 water = vec3(0.16, 0.42, 0.46);
  vec3 foam = vec3(0.96, 0.97, 0.94);
  // The film is thickest at the waterline and thins towards the front.
  float a = max(film * (0.4 + 0.6 * smoothstep(front, 0.0, up)), lace * (1.0 - back * 0.8));
  gl_FragColor = vec4(mix(water, foam, lace), a);
}`;

const ROAD_FRAGMENT = /* glsl */ `
uniform float time;
uniform float night;
uniform float seed;
varying vec2 vUv;
void main() {
  // Across the road: brightest down the middle, broken into glints that shiver.
  float across = abs(vUv.x - 0.5) * 2.0;
  float along = vUv.y;
  float width = mix(0.25, 1.0, along);
  float core = smoothstep(width, 0.0, across);
  float glint = sin(along * 420.0 + sin(vUv.x * 40.0 + seed) * 3.0 - time * 2.2) * sin(vUv.x * 90.0 + along * 60.0 + time * 1.3 + seed);
  float sparkle = smoothstep(0.05, 0.6, glint) + core * 0.25;
  float fade = smoothstep(0.0, 0.03, along) * (1.0 - smoothstep(0.85, 1.0, along) * 0.6);
  float a = core * sparkle * fade * night;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.82), a);
}`;

const ROAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

interface Gull { group: THREE.Group; left: THREE.Mesh; right: THREE.Mesh; cx: number; cz: number; r: number; y: number; speed: number; phase: number }
interface Sail { group: THREE.Group; x0: number; speed: number }

export class Shore {
  private foam: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private road: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private gulls: Gull[] = [];
  private sails: Sail[] = [];
  private glaucus: THREE.Group;
  private glaucusSink = 0;
  private glaucusLeaving = false;
  // The current wave: when it started, how long it rushes in and drains, how far it runs.
  private waveAt = 0;
  private waveIn = 1.6;
  private waveOut = 4;
  private waveReach = 3;
  private time = 0;

  constructor(scene: THREE.Scene) {
    const rand = seededRng(daySeed('eferon/shore/v1'));

    // Wet sand: dark at the water, drying into the beach over a few metres.
    const wetGeo = new THREE.PlaneGeometry(200, 6, 1, 6);
    const dry = new THREE.Color('#d9c7a0');
    const wet = new THREE.Color('#8f7c5c');
    const colors: number[] = [];
    const pos = wetGeo.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      // Plane y runs from -3 (towards the camera after the rotation) to 3 (the water).
      const t = THREE.MathUtils.smoothstep(pos.getY(i), -3, 2.2);
      const c = dry.clone().lerp(wet, t);
      colors.push(c.r, c.g, c.b);
    }
    wetGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const wetSand = new THREE.Mesh(wetGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    wetSand.rotation.x = -Math.PI / 2;
    wetSand.position.set(0, SAND_Y + 0.004, WATERLINE + 3);
    scene.add(wetSand);

    // Foam: one plane over the wet band; the shader decides how much of it the wave covers.
    this.foam = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 7),
      new THREE.ShaderMaterial({
        vertexShader: FOAM_VERTEX,
        fragmentShader: FOAM_FRAGMENT,
        uniforms: { reach: { value: 0 }, back: { value: 1 }, time: { value: 0 }, seed: { value: seaRandom() * 100 } },
        transparent: true,
        depthWrite: false,
      }),
    );
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.set(0, SAND_Y + 0.01, WATERLINE + 3.5);
    scene.add(this.foam);
    this.nextWave(0);

    // Footprints: someone walked straight down to the water and did not walk back.
    const print = new THREE.CircleGeometry(0.1, 8);
    const printMat = new THREE.MeshLambertMaterial({ color: '#b39f78' });
    let x = 1.6;
    for (let z = 6; z > WATERLINE + 2.2; z -= 0.42) {
      const step = Math.round((6 - z) / 0.42);
      const side = step % 2 ? 1 : -1;
      x += (rand() - 0.6) * 0.08;
      const foot = new THREE.Mesh(print, printMat);
      foot.rotation.x = -Math.PI / 2;
      foot.scale.set(0.8, 1.7, 1);
      foot.position.set(x + side * 0.13, SAND_Y + 0.006, z);
      scene.add(foot);
    }

    // Rocks at the end of the beach, where Lysimachus waits with his lamp on the last night.
    const rock = lambert('#6f6558');
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + rand() * 1.6, 0), rock);
      r.position.set(-17 - rand() * 9, -0.2 + rand() * 0.6, WATERLINE - 2 + rand() * 7);
      r.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      r.scale.y = 0.6 + rand() * 0.4;
      scene.add(r);
    }

    // Gulls: a pair of wings in a V, circling over the shallows.
    const wingGeo = new THREE.BoxGeometry(0.75, 0.04, 0.2);
    wingGeo.translate(0.37, 0, 0);
    const gullMat = new THREE.MeshBasicMaterial({ color: '#3c3f44' });
    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group();
      const left = new THREE.Mesh(wingGeo, gullMat);
      const right = new THREE.Mesh(wingGeo, gullMat);
      right.scale.x = -1;
      group.add(left, right);
      scene.add(group);
      this.gulls.push({ group, left, right, cx: -14 + rand() * 30, cz: -10 - rand() * 18, r: 4 + rand() * 7, y: 5 + rand() * 6, speed: (0.15 + rand() * 0.15) * (rand() < 0.5 ? -1 : 1), phase: rand() * 6.28 });
    }

    // Sails on the horizon, drifting so slowly you notice only when you look away and back.
    const hullMat = lambert('#3b2f28');
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.9), hullMat);
      const sailGeo = new THREE.BufferGeometry();
      sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1.3, 0.4, 0, 1.3, 0.4, 0, 0, 3.8, 0], 3));
      sailGeo.computeVertexNormals();
      const sail = new THREE.Mesh(sailGeo, new THREE.MeshLambertMaterial({ color: i === 1 ? '#b0543a' : '#efe6d2', side: THREE.DoubleSide }));
      group.add(hull, sail);
      const x0 = -80 + rand() * 160;
      group.position.set(x0, 0, -110 - rand() * 60);
      scene.add(group);
      this.sails.push({ group, x0, speed: (0.12 + rand() * 0.2) * (rand() < 0.5 ? -1 : 1) });
    }

    // The moon's road: from the far water towards the shore, under the moon.
    this.road = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: ROAD_VERTEX,
        fragmentShader: ROAD_FRAGMENT,
        uniforms: { time: { value: seaRandom() * 100 }, night: { value: 0 }, seed: { value: seaRandom() * 100 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.road.visible = false;
    scene.add(this.road);

    // Glaucus, in the water up to his knees, for the last scene only.
    this.glaucus = makeFigure('#2b2a2c', 1.85);
    dressFigure(this.glaucus, LOOKS.glaucus!, 1.85);
    // Close enough to be a man and not a post: the last face of the game should read as one.
    this.glaucus.position.set(1.2, -0.95, GLAUCUS_Z);
    this.glaucus.scale.setScalar(1.35);
    this.glaucus.visible = false;
    scene.add(this.glaucus);
  }

  private nextWave(at: number): void {
    this.waveAt = at;
    this.waveIn = 1.3 + seaRandom() * 0.9;
    this.waveOut = 3 + seaRandom() * 3;
    // Most waves stop short; now and then one runs far up the sand.
    this.waveReach = 1.2 + seaRandom() * 2.4 + (seaRandom() < 0.15 ? 1.6 : 0);
  }

  /** The moon road lies from the shore out along the direction of the moon. */
  placeRoad(moonDir: THREE.Vector3): void {
    const flat = new THREE.Vector2(moonDir.x, -moonDir.z).normalize();
    const length = 190;
    const start = 6;
    this.road.scale.set(26, length, 1);
    this.road.rotation.set(-Math.PI / 2, 0, Math.atan2(-flat.x, flat.y));
    const mid = start + length / 2;
    this.road.position.set(flat.x * mid, 0.5, WATERLINE - flat.y * mid);
  }

  showGlaucus(on: boolean): void {
    this.glaucus.visible = on;
    this.glaucusSink = 0;
    this.glaucusLeaving = false;
  }

  /** "Glaucus is gone": he goes out into deeper water and under. */
  releaseGlaucus(): void {
    if (this.glaucus.visible) this.glaucusLeaving = true;
  }

  update(dt: number, night: number): void {
    this.time += dt;
    const u = this.foam.material.uniforms;
    u.time!.value = this.time;
    let t = this.time - this.waveAt;
    if (t > this.waveIn + this.waveOut) {
      this.nextWave(this.time);
      t = 0;
    }
    if (t < this.waveIn) {
      // Rushing in, slowing as it spends itself.
      const k = t / this.waveIn;
      u.reach!.value = this.waveReach * (1 - (1 - k) * (1 - k));
      u.back!.value = 0;
    } else {
      // Draining back, slower, leaving its film behind.
      const k = (t - this.waveIn) / this.waveOut;
      u.reach!.value = this.waveReach * (1 - k * k * 0.9);
      u.back!.value = k;
    }

    for (const g of this.gulls) {
      const a = this.time * g.speed + g.phase;
      g.group.position.set(g.cx + Math.cos(a) * g.r, g.y + Math.sin(a * 2.3) * 0.6, g.cz + Math.sin(a) * g.r);
      g.group.rotation.set(0, -a + (g.speed > 0 ? 0 : Math.PI), Math.sin(a) * 0.2);
      // Mostly gliding, with a few beats now and then.
      const beat = Math.sin(this.time * 9 + g.phase) * Math.max(0, Math.sin(this.time * 0.7 + g.phase * 3)) * 0.5;
      g.left.rotation.z = 0.28 + beat;
      g.right.rotation.z = -0.28 - beat;
      g.group.visible = night < 0.6;
    }
    for (const s of this.sails) {
      s.group.position.x = s.x0 + this.time * s.speed;
      s.group.position.y = Math.sin(this.time * 0.8 + s.x0) * 0.15;
      s.group.rotation.z = Math.sin(this.time * 0.6 + s.x0) * 0.04;
    }

    const road = this.road.material.uniforms;
    road.time!.value += dt;
    road.night!.value = night;
    this.road.visible = night > 0.02;

    if (this.glaucus.visible) {
      // Standing in the swell: the water lifts and lowers him a little.
      if (this.glaucusLeaving) this.glaucusSink = Math.min(3.2, this.glaucusSink + dt * 0.35);
      this.glaucus.position.y = -0.95 + Math.sin(this.time * 0.9) * 0.05 - this.glaucusSink;
      this.glaucus.position.z = GLAUCUS_Z - this.glaucusSink * 2;
      if (this.glaucusSink >= 3.2) this.glaucus.visible = false;
    }
  }
}
