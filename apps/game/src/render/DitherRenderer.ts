// Renders a scene at low resolution, then quantizes it to the stage palette with ordered
// (Bayer) dithering — the Obra Dinn half of the look. A second pass draws the scene's normals,
// and edges in depth or normal become lines in the darkest palette color: the incisions of
// black-figure painting. Anything drawn with alpha 0 is exempt from both: that is how the sea
// stays in full color inside dithered stages (see makeSeaMaterial).
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
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform bool outline;
uniform bool ortho;
uniform float near;
uniform float far;
uniform vec2 lowRes;
uniform vec3 palette[${MAX_PALETTE}];
uniform int paletteSize;
uniform float exposure;
uniform float contrast;
uniform float band;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (ortho) return near + d * (far - near);
  return (near * far) / (far - d * (far - near));
}

// A pixel is on a line if a neighbour is much farther away (it is the near side of a silhouette),
// or if the surface turns sharply between it and the pixel to the right or below.
bool edge(vec2 uv) {
  vec2 px = 1.0 / lowRes;
  float z = viewZ(uv);
  // The sky and what hangs in it (stars, the moon) are never outlined: at that distance a line is all there would be.
  if (z > far * 0.6) return false;
  float zr = viewZ(uv + vec2(px.x, 0.0));
  float zl = viewZ(uv - vec2(px.x, 0.0));
  float zu = viewZ(uv + vec2(0.0, px.y));
  float zd = viewZ(uv - vec2(0.0, px.y));
  float far4 = max(max(zr, zl), max(zu, zd));
  if (far4 - z > 0.06 * z + 0.08) return true;
  vec4 n = texture2D(tNormal, uv);
  if (n.a < 0.5) return false;
  vec4 nr = texture2D(tNormal, uv + vec2(px.x, 0.0));
  vec4 nu = texture2D(tNormal, uv + vec2(0.0, px.y));
  vec3 a = n.xyz * 2.0 - 1.0;
  float kr = nr.a < 0.5 ? 1.0 : dot(a, nr.xyz * 2.0 - 1.0);
  float ku = nu.a < 0.5 ? 1.0 : dot(a, nu.xyz * 2.0 - 1.0);
  return min(kr, ku) < 0.72 && abs(zr - z) < 0.2 * z && abs(zu - z) < 0.2 * z;
}

void main() {
  vec4 src = texture2D(tScene, vUv);
  vec3 color = toSrgb(src.rgb);
  // alpha 0 marks the undithered layer (the sea), or a stage with no palette.
  if (src.a < 0.5 || paletteSize == 0) {
    gl_FragColor = vec4(color, 1.0);
    return;
  }
  if (outline && edge(vUv)) {
    gl_FragColor = vec4(palette[0], 1.0);
    return;
  }
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  lum = clamp((lum * exposure - 0.5) * contrast + 0.5, 0.0, 1.0);
  float steps = float(paletteSize - 1);
  float scaled = lum * steps;
  float base = floor(scaled);
  // Dither only across a band around each step; flat areas stay one clean palette color.
  float frac = smoothstep(0.5 - band * 0.5, 0.5 + band * 0.5, scaled - base);
  float threshold = bayer4(floor(vUv * lowRes)) + 0.5 / 16.0;
  int idx = int(min(base + step(threshold, frac), steps));
  vec3 outColor = palette[0];
  for (int i = 1; i < ${MAX_PALETTE}; i++) if (i == idx) outColor = palette[i];
  gl_FragColor = vec4(outColor, 1.0);
}`;

export class DitherRenderer {
  readonly gl: THREE.WebGLRenderer;
  /** Screen pixels per dithered pixel. */
  pixelScale = 3;
  private target: THREE.WebGLRenderTarget;
  /** Scene normals, for the outline pass. */
  private normals: THREE.WebGLRenderTarget;
  private normalMaterial = new THREE.MeshNormalMaterial();
  private post: THREE.ShaderMaterial;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private palette: Palette = PALETTES.vase;
  private quality: 'auto' | 'high' | 'low' = 'auto';
  /** Auto quality: 0 = full, 1 = no shadows, 2 = no shadows and coarser pixels. Only ever steps down. */
  private autoLevel = 0;
  private slowSince: number | null = null;
  private lastFrame = 0;
  private frameAvg = 16;
  private shadowsDirty = false;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.gl.setPixelRatio(1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.BasicShadowMap;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(1, 1),
    });
    this.normals = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.post = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        tScene: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        tNormal: { value: this.normals.texture },
        outline: { value: false },
        ortho: { value: false },
        near: { value: 0.1 },
        far: { value: 100 },
        lowRes: { value: new THREE.Vector2(1, 1) },
        palette: { value: Array.from({ length: MAX_PALETTE }, () => new THREE.Color()) },
        paletteSize: { value: 0 },
        exposure: { value: 1 },
        contrast: { value: 1 },
        band: { value: 1 },
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
    u.band!.value = this.palette.band;
    u.outline!.value = this.palette.outline;
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
    this.normals.setSize(lw, lh);
    (this.post.uniforms.lowRes!.value as THREE.Vector2).set(lw, lh);
  }

  setQuality(q: 'auto' | 'high' | 'low'): void {
    this.quality = q;
    if (q !== 'auto') this.autoLevel = 0;
    this.applyQuality();
  }

  /** Human-readable, for the debug panel. */
  get qualityLabel(): string {
    return `${this.quality}${this.quality === 'auto' ? `:${this.autoLevel}` : ''} · ${this.pixelScale}px · ${Math.round(this.frameAvg)}ms`;
  }

  private applyQuality(): void {
    const level = this.quality === 'high' ? 0 : this.quality === 'low' ? 2 : this.autoLevel;
    const shadows = level === 0;
    const scale = level >= 2 ? 4 : 3;
    if (this.gl.shadowMap.enabled !== shadows) {
      this.gl.shadowMap.enabled = shadows;
      this.shadowsDirty = true;
    }
    if (this.pixelScale !== scale) {
      this.pixelScale = scale;
      this.resize();
    }
  }

  /** Watches frame time; if the machine struggles for three seconds, step quality down. */
  private measure(): void {
    const now = performance.now();
    if (this.lastFrame) {
      const dt = Math.min(200, now - this.lastFrame);
      this.frameAvg += (dt - this.frameAvg) * 0.05;
    }
    this.lastFrame = now;
    if (this.quality !== 'auto' || this.autoLevel >= 2 || document.hidden) return;
    if (this.frameAvg > 28) {
      this.slowSince ??= now;
      if (now - this.slowSince > 3000) {
        this.autoLevel += 1;
        this.slowSince = null;
        this.frameAvg = 16;
        this.applyQuality();
      }
    } else this.slowSince = null;
  }

  get aspect(): number {
    return window.innerWidth / window.innerHeight;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.measure();
    if (this.shadowsDirty) {
      // Materials compiled with (or without) shadow code must be rebuilt.
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
        else if (m) m.needsUpdate = true;
      });
      this.shadowsDirty = false;
    }
    this.gl.setRenderTarget(this.target);
    this.gl.setClearAlpha(1);
    this.gl.clear();
    this.gl.render(scene, camera);
    const u = this.post.uniforms;
    if (this.palette.outline) {
      // The same scene again, as normals; alpha 0 where nothing was drawn.
      const cam = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
      u.ortho!.value = (cam as THREE.OrthographicCamera).isOrthographicCamera === true;
      u.near!.value = cam.near;
      u.far!.value = cam.far;
      const background = scene.background;
      scene.background = null;
      scene.overrideMaterial = this.normalMaterial;
      // The shadow maps are already up to date for this frame.
      const shadows = this.gl.shadowMap.autoUpdate;
      this.gl.shadowMap.autoUpdate = false;
      this.gl.setRenderTarget(this.normals);
      this.gl.setClearColor(0x000000, 0);
      this.gl.clear();
      this.gl.render(scene, camera);
      this.gl.shadowMap.autoUpdate = shadows;
      scene.overrideMaterial = null;
      scene.background = background;
      this.gl.setClearColor(0x000000, 1);
    }
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCamera);
  }
}
