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

/**
 * What makes a named figure recognisable across the square: the black-figure painter's tricks —
 * women's faces in white, added red for wreaths, veils and cloaks, a white beard for age — and
 * one prop each, big enough to survive the low resolution as a shape. Follows `ui/portraits.ts`.
 */
export interface FigureLook {
  /** White face and hands: the vase painters' women. */
  whiteFace?: boolean;
  /** The robe in another tone (the priest in white, the merchant in red). */
  robe?: 'bone' | 'red';
  bent?: boolean;
  wide?: boolean;
  beard?: 'white' | 'dark';
  hair?: 'bun' | 'wild';
  head?: 'laurel' | 'fillet' | 'blindfold' | 'veil' | 'hood' | 'petasos' | 'oak';
  cape?: boolean;
  /** A white mantle across the body, front and back (the old man's himation). */
  himation?: boolean;
  arm?: 'raised';
  props?: ('staff' | 'tablet' | 'wheat' | 'lyre' | 'purse' | 'trident' | 'masks' | 'net' | 'kerykeion' | 'basket')[];
}

export const BONE = '#f2ead6';
export const RED = '#8a3322';

/**
 * Added white and added red, as the vase painters laid them on: flat and unlit, so they keep their
 * tone through the dither (the robes stay lit: they are the figure, the accents are paint). Shared
 * by every figure, and dimmed with the town's night so they do not glow in the dark.
 */
const PAINT = {
  bone: new THREE.MeshBasicMaterial({ color: '#e8e2d0' }),
  red: new THREE.MeshBasicMaterial({ color: '#6e2a1c' }),
};
const PAINT_DAY = { bone: new THREE.Color('#e8e2d0'), red: new THREE.Color('#6e2a1c') };
const PAINT_NIGHT = new THREE.Color('#1a120d');

/** 0 by day, 1 at night: the painted accents go down with the light. */
export function dimPaint(night: number): void {
  PAINT.bone.color.copy(PAINT_DAY.bone).lerp(PAINT_NIGHT, night * 0.8);
  PAINT.red.color.copy(PAINT_DAY.red).lerp(PAINT_NIGHT, night * 0.8);
}

/** Dress a figure made by `makeFigure` in its look. Every part is a direct child, so it bobs and x-rays with the rest. */
export function dressFigure(g: THREE.Group, look: FigureLook, height = 1.7): void {
  const h = height;
  const [body, head, back] = g.children as THREE.Mesh[];
  const dark = body!.material as THREE.Material;
  const bone = PAINT.bone;
  const red = PAINT.red;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (look.robe) body!.material = lambert(look.robe === 'bone' ? BONE : RED);
  if (look.wide) body!.scale.x = body!.scale.z = body!.scale.y * 1.35;
  if (look.whiteFace || look.beard === 'white') head!.material = bone;
  if (look.bent) {
    body!.rotation.x = 0.14;
    for (const m of [head!, back!]) {
      m.position.z += h * 0.07;
      m.position.y -= h * 0.04;
    }
  }
  const hy = head!.position.y;
  const hz = head!.position.z;
  const r = h * 0.1;
  if (look.beard) add(new THREE.ConeGeometry(r * (look.beard === 'white' ? 0.9 : 0.6), h * (look.beard === 'white' ? 0.24 : 0.16), 5), look.beard === 'white' ? bone : dark, 0, hy - r * 1.2, hz + r * 0.5, Math.PI + 0.35);
  if (look.hair === 'bun') add(new THREE.IcosahedronGeometry(r * 0.6, 0), dark, 0, hy + r * 0.7, hz - r * 0.8);
  if (look.hair === 'wild') back!.scale.setScalar(1.8);
  switch (look.head) {
    case 'laurel': case 'fillet': case 'oak': case 'blindfold': {
      const ring = new THREE.TorusGeometry(r * 1.05, r * (look.head === 'fillet' ? 0.3 : 0.45), 4, 8);
      add(ring, look.head === 'blindfold' ? bone : look.head === 'fillet' ? bone : red, 0, hy + (look.head === 'blindfold' ? 0 : r * 0.35), hz, Math.PI / 2 - (look.head === 'blindfold' ? 0 : 0.15));
      break;
    }
    case 'veil': // red, over the head and down to the shoulders
      add(new THREE.ConeGeometry(r * 2.6, h * 0.5, 6), red, 0, hy - r * 2.2, hz - r * 0.6);
      add(new THREE.IcosahedronGeometry(r * 1.15, 0), red, 0, hy + r * 0.15, hz - r * 0.35);
      break;
    case 'hood':
      add(new THREE.ConeGeometry(r * 1.5, h * 0.42, 6), dark, 0, hy + r * 1.1, hz - r * 0.3, -0.25);
      break;
    case 'petasos': // the traveller's broad hat
      add(new THREE.CylinderGeometry(r * 2.4, r * 2.4, r * 0.25, 10), dark, 0, hy + r * 0.8, hz);
      add(new THREE.CylinderGeometry(r * 0.8, r, r * 0.8, 8), dark, 0, hy + r * 1.2, hz);
      break;
  }
  // The robe is about 0.17 h in radius at the back: things worn on the back sit outside it.
  if (look.cape) add(new THREE.BoxGeometry(h * 0.42, h * 0.52, h * 0.05), red, 0, h * 0.5, -h * 0.2, -0.14);
  if (look.himation) {
    // A mantle thrown over one shoulder: a white band across the chest and across the back.
    for (const side of [1, -1]) add(new THREE.BoxGeometry(h * 0.2, h * 0.5, h * 0.04), bone, h * 0.02, h * 0.55, side * h * 0.19, 0, 0, side * 0.45);
  }
  if (look.arm === 'raised') {
    add(new THREE.CylinderGeometry(h * 0.05, h * 0.06, h * 0.5, 5), dark, h * 0.22, h * 0.95, h * 0.05, 0.2, 0, -0.4);
    add(new THREE.IcosahedronGeometry(h * 0.07, 0), dark, h * 0.32, h * 1.19, h * 0.1);
  }
  for (const prop of look.props ?? []) {
    switch (prop) {
      case 'staff': // an old man's stick, taller than he is
        add(new THREE.CylinderGeometry(h * 0.035, h * 0.035, h * 1.15, 5), dark, h * 0.24, h * 0.57, h * 0.14, 0.08, 0, -0.08);
        break;
      case 'kerykeion': // the herald's staff, with its twined head
        add(new THREE.CylinderGeometry(h * 0.035, h * 0.035, h * 1.2, 5), dark, h * 0.24, h * 0.6, h * 0.1);
        add(new THREE.TorusGeometry(h * 0.08, h * 0.035, 4, 8), dark, h * 0.24, h * 1.25, h * 0.1, 0, Math.PI / 2);
        break;
      case 'tablet': // the scribe's wax tablets, under the arm
        add(new THREE.BoxGeometry(h * 0.08, h * 0.26, h * 0.2), bone, h * 0.22, h * 0.5, h * 0.02, 0, 0, 0.15);
        break;
      case 'wheat': // a sheaf over the shoulder
        add(new THREE.ConeGeometry(h * 0.11, h * 0.55, 5), bone, -h * 0.16, h * 0.85, -h * 0.06, 0.4, 0, 0.45);
        break;
      case 'lyre': { // held at his side, face out, so it shows from the front, the back and the side
        const x = h * 0.28;
        const arm = new THREE.BoxGeometry(h * 0.1, h * 0.44, h * 0.08);
        add(arm, bone, x, h * 0.74, -h * 0.1, 0.22, 0, 0);
        add(arm, bone, x, h * 0.74, h * 0.14, -0.22, 0, 0);
        add(new THREE.BoxGeometry(h * 0.1, h * 0.07, h * 0.4), bone, x, h * 0.95, h * 0.02);
        add(new THREE.BoxGeometry(h * 0.14, h * 0.2, h * 0.32), bone, x, h * 0.5, h * 0.02);
        break;
      }
      case 'basket': // a white basket on the hip
        add(new THREE.CylinderGeometry(h * 0.13, h * 0.1, h * 0.15, 7), bone, h * 0.26, h * 0.42, 0);
        break;
      case 'purse': // fat, red, at the belt
        add(new THREE.IcosahedronGeometry(h * 0.1, 0), bone, h * 0.22, h * 0.45, h * 0.08);
        break;
      case 'trident':
        add(new THREE.CylinderGeometry(h * 0.035, h * 0.035, h * 1.4, 5), dark, h * 0.24, h * 0.7, h * 0.08);
        for (const dx of [-1, 0, 1]) add(new THREE.BoxGeometry(h * 0.04, h * 0.2, h * 0.04), dark, h * 0.24 + dx * h * 0.08, h * 1.47, h * 0.08);
        add(new THREE.BoxGeometry(h * 0.2, h * 0.04, h * 0.04), dark, h * 0.24, h * 1.38, h * 0.08);
        break;
      case 'masks': // a pole over the shoulder with white faces hanging from it
        add(new THREE.CylinderGeometry(h * 0.03, h * 0.03, h * 1.0, 5), dark, h * 0.15, h * 1.0, -h * 0.1, 0.75, 0, 0);
        for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(h * 0.16, h * 0.2, h * 0.04), bone, h * 0.15, h * (0.92 - i * 0.1), -h * (0.2 + i * 0.13));
        break;
      case 'net': // a red bundle of net over the shoulder
        add(new THREE.IcosahedronGeometry(h * 0.17, 0), red, -h * 0.25, h * 0.55, 0).scale.set(0.8, 1.1, 1.3);
        break;
    }
  }
}

/** Walking bob: a small vertical hop per step. `moving` 0..1. */
export function bob(figure: THREE.Group, time: number, moving: number): void {
  const inner = figure.children;
  const y = Math.abs(Math.sin(time * 9 + (figure.userData.bobPhase as number))) * 0.07 * moving;
  for (const c of inner) c.position.y = (c.userData.baseY ??= c.position.y) + y;
}

/** Moves a walker's figure (not their day) out to a step's distance from the scribe. */
export function giveWay(pos: THREE.Vector3, player: THREE.Vector3, wall?: (x: number, z: number) => boolean, gap = 0.95): void {
  const dx = pos.x - player.x;
  const dz = pos.z - player.z;
  const d = Math.hypot(dx, dz);
  if (d >= gap) return;
  // Straight through the middle: step to one side.
  const a = d > 0.01 ? Math.atan2(dz, dx) : 0;
  // Out on their own side if the wall allows it, else round the other way; never into a wall.
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2, -Math.PI / 2]) {
    const x = player.x + Math.cos(a + turn) * gap;
    const z = player.z + Math.sin(a + turn) * gap;
    if (!wall?.(x, z)) {
      pos.x = x;
      pos.z = z;
      return;
    }
  }
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
    // Joints wide enough to survive the low resolution as lines rather than breaking into specks.
    c.fillStyle = '#a3825f';
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < s; y += 32) {
      c.fillRect(0, y, s, 4);
      let x = Math.floor(rnd() * 24);
      while (x < s) {
        c.fillRect(x, y, 4, 32);
        x += 30 + Math.floor(rnd() * 34);
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
    tiles.repeat.set(0.34, 0.34);
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
