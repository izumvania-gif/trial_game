// The sea: the only thing in Eferon that is neither dithered nor deterministic.
// It writes alpha 0 so DitherRenderer passes it through in full color, and its phase
// offsets come from real entropy, so the waves are never the same twice.
import * as THREE from 'three';
import { seaRandom } from '../core/rng.ts';

const VERTEX = /* glsl */ `
uniform float time;
uniform vec4 swell;
varying float vHeight;
varying vec3 vWorld;
void main() {
  vec3 p = position;
  float h = sin(p.x * 0.35 + time * 0.9 + swell.x) * 0.35
          + sin(p.y * 0.52 - time * 1.3 + swell.y) * 0.22
          + sin((p.x + p.y) * 0.9 + time * 2.1 + swell.z) * 0.08;
  p.z += h;
  vHeight = h;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = /* glsl */ `
uniform float time;
uniform vec4 swell;
varying float vHeight;
varying vec3 vWorld;
void main() {
  vec3 deep = vec3(0.02, 0.10, 0.16);
  vec3 shallow = vec3(0.05, 0.38, 0.45);
  vec3 foam = vec3(0.85, 0.92, 0.90);
  float t = clamp(vHeight * 1.2 + 0.5, 0.0, 1.0);
  vec3 c = mix(deep, shallow, t);
  // Glints broken into flecks, not lines: two waves of light that only meet here and there.
  float glint = pow(max(0.0, sin(vWorld.x * 1.7 + vWorld.z * 0.6 + time * 1.5 + swell.w) * sin(vWorld.x * 0.9 - vWorld.z * 2.3 - time * 1.1)), 10.0);
  c = mix(c, foam, glint * 0.6 + smoothstep(0.45, 0.62, vHeight) * 0.5);
  // alpha 0 = "do not dither me"
  gl_FragColor = vec4(c, 0.0);
}`;

export function makeSeaMaterial(): THREE.ShaderMaterial & { tick(dt: number): void } {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      time: { value: seaRandom() * 1000 },
      swell: { value: new THREE.Vector4(seaRandom() * 6.28, seaRandom() * 6.28, seaRandom() * 6.28, seaRandom() * 6.28) },
    },
    blending: THREE.NoBlending,
  }) as THREE.ShaderMaterial & { tick(dt: number): void };
  // A little real randomness in the tempo too.
  const tempo = 0.85 + seaRandom() * 0.3;
  material.tick = (dt) => {
    material.uniforms.time!.value += dt * tempo;
  };
  return material;
}

export function makeSea(size = 200, segments = 120): THREE.Mesh<THREE.PlaneGeometry, ReturnType<typeof makeSeaMaterial>> {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, segments, segments), makeSeaMaterial());
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
