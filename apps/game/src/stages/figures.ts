import * as THREE from 'three';

/** A robed silhouette in profile, turned on a lathe: shoulders, waist, a hem that flares. */
const ROBE_PROFILE = [
  [0.0, 0.0], [0.34, 0.0], [0.3, 0.12], [0.24, 0.45], [0.2, 0.7], [0.24, 0.9], [0.22, 1.02], [0.1, 1.1], [0.0, 1.12],
].map(([x, y]) => new THREE.Vector2(x!, y!));

const robeGeometry = new THREE.LatheGeometry(ROBE_PROFILE, 7);

/** A black-figure person: the vase painters' silhouette, in low poly. `height` in metres. */
export function makeFigure(color = '#1a1410', height = 1.7): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(robeGeometry, mat);
  const s = height / 1.45;
  body.scale.set(s, s, s);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(height * 0.1, 0), mat);
  head.position.y = height * 0.86;
  // A bundle of hair or a hood at the back of the head, so the silhouette has a direction.
  const back = new THREE.Mesh(new THREE.IcosahedronGeometry(height * 0.07, 0), mat);
  back.position.set(0, height * 0.87, -height * 0.06);
  for (const m of [body, head, back]) {
    m.castShadow = true;
    g.add(m);
  }
  g.userData.bobPhase = Math.random() * Math.PI * 2;
  return g;
}

/** Walking bob: a small vertical hop per step. `moving` 0..1. */
export function bob(figure: THREE.Group, time: number, moving: number): void {
  const inner = figure.children;
  const y = Math.abs(Math.sin(time * 9 + (figure.userData.bobPhase as number))) * 0.07 * moving;
  for (const c of inner) c.position.y = (c.userData.baseY ??= c.position.y) + y;
}

export function lambert(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

/** Canvas textures, drawn once: the palette pass turns their light lines into incisions. */
const textures = new Map<string, THREE.CanvasTexture>();

function canvasTexture(key: string, size: number, draw: (c: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  let tex = textures.get(key);
  if (!tex) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d')!, size);
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, tex);
  }
  return tex;
}

/** Rows of roof tiles: dark glaze, the clay showing along each row and between the tiles. */
export function tileTexture(): THREE.CanvasTexture {
  return canvasTexture('tiles', 64, (c, s) => {
    c.fillStyle = '#3a2317';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#b06a42';
    for (let y = 0; y < s; y += 8) {
      c.fillRect(0, y, s, 2);
      for (let x = (y / 8) % 2 ? 0 : 8; x < s; x += 16) c.fillRect(x, y, 2, 8);
    }
  });
}

/** Flagstones for the streets: pale stone, darker joints, no two alike. */
export function pavingTexture(): THREE.CanvasTexture {
  return canvasTexture('paving', 128, (c, s) => {
    c.fillStyle = '#ead6b2';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#9c7a58';
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < s; y += 16) {
      c.fillRect(0, y, s, 2);
      let x = Math.floor(rnd() * 16);
      while (x < s) {
        c.fillRect(x, y, 2, 16);
        x += 14 + Math.floor(rnd() * 22);
      }
    }
  });
}

/** Material with a tiling texture; `repeat` in texture tiles per world unit. */
export function textured(tex: THREE.Texture, color = '#ffffff'): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, map: tex, flatShading: true });
}

const roofMaterials = new Map<string, THREE.Material>();

/** Stretch a plane's UVs so a texture repeats every `unit` world units instead of once per plane. */
export function worldUV(geo: THREE.BufferGeometry, width: number, height: number, unit: number): void {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / unit, (uv.getY(i) * height) / unit);
  uv.needsUpdate = true;
}

/** A gabled roof as a triangular prism, `w` across the ridge, `d` along it. */
export function gableRoof(w: number, d: number, h: number, color: string, gableColor?: string): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.15, 0);
  shape.lineTo(w / 2 + 0.15, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.3, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.3) / 2);
  // Tile rows run along the ridge: the side faces take their UVs from world units.
  let mat = roofMaterials.get(color);
  if (!mat) {
    const tiles = tileTexture();
    tiles.repeat.set(0.5, 0.5);
    mat = textured(tiles, color);
    roofMaterials.set(color, mat);
  }
  // ExtrudeGeometry groups: 0 = the two triangular ends (the gables), 1 = the sloping sides.
  const roof = new THREE.Mesh(geo, gableColor ? [lambert(gableColor), mat] : mat);
  roof.castShadow = roof.receiveShadow = true;
  return roof;
}

/** An olive tree: a crooked trunk and a few dark, round masses of leaves. */
export function olive(seed: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 5), lambert('#2a1a12'));
  trunk.position.y = 0.7;
  trunk.rotation.z = Math.sin(seed) * 0.25;
  g.add(trunk);
  const leaves = lambert('#4a3a22');
  for (let i = 0; i < 3; i++) {
    const a = seed * 2.3 + i * 2.1;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + (i % 2) * 0.2, 0), leaves);
    crown.position.set(Math.cos(a) * 0.5, 1.6 + (i % 2) * 0.35, Math.sin(a) * 0.5);
    crown.castShadow = true;
    g.add(crown);
  }
  return g;
}

export function cypress(height: number): THREE.Mesh {
  const tree = new THREE.Mesh(new THREE.ConeGeometry(height * 0.12, height, 6), lambert('#2a2018'));
  tree.position.y = height / 2;
  tree.castShadow = true;
  return tree;
}

const AMPHORA = new THREE.LatheGeometry(
  [[0, 0], [0.08, 0.02], [0.2, 0.25], [0.22, 0.4], [0.12, 0.62], [0.07, 0.7], [0.09, 0.75], [0, 0.76]].map(([x, y]) => new THREE.Vector2(x!, y!)),
  8,
);

export function amphora(color = '#8f4a2a'): THREE.Mesh {
  const a = new THREE.Mesh(AMPHORA, lambert(color));
  a.castShadow = true;
  return a;
}
