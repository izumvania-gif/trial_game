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

/** A gabled roof as a triangular prism, `w` across the ridge, `d` along it. */
export function gableRoof(w: number, d: number, h: number, color: string): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.15, 0);
  shape.lineTo(w / 2 + 0.15, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.3, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.3) / 2);
  const roof = new THREE.Mesh(geo, lambert(color));
  roof.castShadow = roof.receiveShadow = true;
  return roof;
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
