// The sky over the last day: a dome whose colors follow the clock (pale noon, a red sunset,
// then night), the afterglow where the sun went down, stars, and the moon. In the town it
// passes through the vase palette (the sunset comes out in added red); at the sea it is in
// full color. The stars are fixed by the seed: the same sky every night.
import * as THREE from 'three';
import { daySeed, seededRng } from '../core/rng.ts';

export interface SkyKey {
  /** Progress of the day, 0 at dawn, 1 at midnight. */
  at: number;
  horizon: string;
  zenith: string;
}

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 horizon;
uniform vec3 zenith;
uniform vec3 sunDir;
uniform vec3 glow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(horizon, zenith, smoothstep(-0.02, 0.55, d.y));
  float s = max(dot(d, sunDir), 0.0);
  col += glow * (pow(s, 5.0) * 0.55 + pow(s, 80.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const smooth = THREE.MathUtils.smoothstep;
const RADIUS = 300;

export class Sky {
  private dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Points[] = [];
  private moon: THREE.Mesh;
  private keys: { at: number; horizon: THREE.Color; zenith: THREE.Color }[];
  private moonDir: THREE.Vector3;
  private sunset: THREE.Color;
  /** The current horizon color: fog should match it. */
  readonly horizon = new THREE.Color();

  constructor(scene: THREE.Scene, keys: SkyKey[], opts: { moonDir: THREE.Vector3; moonColor: string; starColor: string; sunset: string }) {
    this.keys = keys.map((k) => ({ at: k.at, horizon: new THREE.Color(k.horizon), zenith: new THREE.Color(k.zenith) }));
    this.sunset = new THREE.Color(opts.sunset);
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          horizon: { value: new THREE.Color() },
          zenith: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3(0, 1, 0) },
          glow: { value: new THREE.Color(0, 0, 0) },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    scene.add(this.dome);

    // Two sets of stars that fade against each other: a slow twinkle, the same every night.
    const rand = seededRng(daySeed('eferon/stars'));
    for (let set = 0; set < 2; set++) {
      const pos: number[] = [];
      for (let i = 0; i < 220; i++) {
        const y = 0.08 + rand() * 0.9;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(1 - y * y);
        pos.push(Math.cos(a) * r * (RADIUS - 10), y * (RADIUS - 10), Math.sin(a) * r * (RADIUS - 10));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: opts.starColor, size: set ? 1.5 : 2.2, sizeAttenuation: false, fog: false }));
      points.frustumCulled = false;
      points.visible = false;
      scene.add(points);
      this.stars.push(points);
    }
    this.moonDir = opts.moonDir.clone().normalize();
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: opts.moonColor, fog: false }));
    this.moon.visible = false;
    scene.add(this.moon);
  }

  update(progress: number, camera: THREE.Camera, time: number): void {
    // Interpolate between the keys the day is between.
    let i = 0;
    while (i + 1 < this.keys.length && this.keys[i + 1]!.at <= progress) i++;
    const a = this.keys[i]!;
    const b = this.keys[Math.min(i + 1, this.keys.length - 1)]!;
    const t = b.at > a.at ? THREE.MathUtils.clamp((progress - a.at) / (b.at - a.at), 0, 1) : 0;
    const u = this.dome.material.uniforms;
    (u.horizon!.value as THREE.Color).copy(a.horizon).lerp(b.horizon, t);
    (u.zenith!.value as THREE.Color).copy(a.zenith).lerp(b.zenith, t);
    this.horizon.copy(u.horizon!.value as THREE.Color);
    // The sun goes down in the north-west, where the camera can see its afterglow.
    const elevation = THREE.MathUtils.lerp(0.9, -0.12, smooth(progress, 0.45, 0.85));
    (u.sunDir!.value as THREE.Vector3).set(-0.72, elevation, -0.7).normalize();
    const glow = smooth(progress, 0.64, 0.77) * (1 - smooth(progress, 0.83, 0.9));
    (u.glow!.value as THREE.Color).copy(this.sunset).multiplyScalar(glow);

    const cam = camera.position;
    this.dome.position.copy(cam);
    const night = smooth(progress, 0.84, 0.92);
    this.stars.forEach((s, k) => {
      s.position.copy(cam);
      s.visible = night > 0.3 && Math.sin(time * 0.7 + k * Math.PI) > -0.6;
    });
    this.moon.visible = night > 0.2;
    // Rising slowly through the night.
    const rise = smooth(progress, 0.8, 1) * 0.12;
    this.moon.position.copy(cam).addScaledVector(new THREE.Vector3(this.moonDir.x, this.moonDir.y + rise, this.moonDir.z).normalize(), RADIUS - 20);
    this.moon.lookAt(cam);
  }
}

/** The town's sky, in colors that land on the vase palette: sand by day, added red at sunset. */
export const TOWN_SKY: SkyKey[] = [
  { at: 0, horizon: '#efe0bc', zenith: '#d8c29a' },
  { at: 0.64, horizon: '#efe0bc', zenith: '#d4bd94' },
  { at: 0.74, horizon: '#e39a5c', zenith: '#b8784c' },
  { at: 0.8, horizon: '#c8542a', zenith: '#6e2a1c' },
  { at: 0.87, horizon: '#5c2418', zenith: '#26120d' },
  { at: 0.93, horizon: '#2e1610', zenith: '#0e0a09' },
  { at: 1, horizon: '#2a140f', zenith: '#0d0a09' },
];

/** The sea's sky, the only one in full color. */
export const SEA_SKY: SkyKey[] = [
  { at: 0, horizon: '#d6e8ea', zenith: '#7fb1c6' },
  { at: 0.6, horizon: '#d6e8ea', zenith: '#86b4c8' },
  { at: 0.71, horizon: '#f2b67e', zenith: '#8a97b8' },
  { at: 0.78, horizon: '#dc623a', zenith: '#3f3f70' },
  { at: 0.86, horizon: '#1d2744', zenith: '#0b1024' },
  { at: 1, horizon: '#131c34', zenith: '#050913' },
];
