// Renders a scene at low resolution, then quantizes it to the stage palette with ordered
// (Bayer) dithering — the Obra Dinn half of the look. Anything drawn with alpha 0 is exempt:
// that is how the sea stays in full color inside dithered stages (see makeSeaMaterial).
import * as THREE from 'three';
import { MAX_PALETTE, PALETTES, type Palette, type PaletteId } from './palettes.ts';

const POST_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const POST_FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 lowRes;
uniform vec3 palette[${MAX_PALETTE}];
uniform int paletteSize;
uniform float exposure;
uniform float contrast;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

void main() {
  vec4 src = texture2D(tScene, vUv);
  vec3 color = toSrgb(src.rgb);
  // alpha 0 marks the undithered layer (the sea), or a stage with no palette.
  if (src.a < 0.5 || paletteSize == 0) {
    gl_FragColor = vec4(color, 1.0);
    return;
  }
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  lum = clamp((lum * exposure - 0.5) * contrast + 0.5, 0.0, 1.0);
  float steps = float(paletteSize - 1);
  float scaled = lum * steps;
  float base = floor(scaled);
  float threshold = bayer4(floor(vUv * lowRes)) + 0.5 / 16.0;
  int idx = int(min(base + step(threshold, scaled - base), steps));
  vec3 outColor = palette[0];
  for (int i = 1; i < ${MAX_PALETTE}; i++) if (i == idx) outColor = palette[i];
  gl_FragColor = vec4(outColor, 1.0);
}`;

export class DitherRenderer {
  readonly gl: THREE.WebGLRenderer;
  /** Screen pixels per dithered pixel. */
  pixelScale = 3;
  private target: THREE.WebGLRenderTarget;
  private post: THREE.ShaderMaterial;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private palette: Palette = PALETTES.vase;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.gl.setPixelRatio(1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.BasicShadowMap;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
    });
    this.post = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        tScene: { value: this.target.texture },
        lowRes: { value: new THREE.Vector2(1, 1) },
        palette: { value: Array.from({ length: MAX_PALETTE }, () => new THREE.Color()) },
        paletteSize: { value: 0 },
        exposure: { value: 1 },
        contrast: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.setPalette('vase');
    this.resize();
  }

  setPalette(id: PaletteId): void {
    this.palette = PALETTES[id];
    const u = this.post.uniforms;
    const colors = this.palette.colors ?? [];
    colors.forEach((hex, i) => {
      // Uniforms are compared against sRGB output directly, so bypass three's color management.
      const c = new THREE.Color();
      c.setStyle(hex, THREE.LinearSRGBColorSpace);
      (u.palette!.value as THREE.Color[])[i]!.copy(c);
    });
    u.paletteSize!.value = colors.length;
    u.exposure!.value = this.palette.exposure;
    u.contrast!.value = this.palette.contrast;
  }

  get paletteId(): PaletteId {
    return this.palette.id;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h, true);
    const lw = Math.max(1, Math.floor(w / this.pixelScale));
    const lh = Math.max(1, Math.floor(h / this.pixelScale));
    this.target.setSize(lw, lh);
    (this.post.uniforms.lowRes!.value as THREE.Vector2).set(lw, lh);
  }

  get aspect(): number {
    return window.innerWidth / window.innerHeight;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.setRenderTarget(this.target);
    this.gl.setClearAlpha(1);
    this.gl.clear();
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCamera);
  }
}
