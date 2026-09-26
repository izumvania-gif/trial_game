import * as THREE from 'three';

/** A black-figure person: the vase painters' silhouette, in low poly. */
export function makeFigure(color = '#1a1410', height = 1.7): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, height * 0.72, 6), mat);
  body.position.y = height * 0.36;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(height * 0.13, 0), mat);
  head.position.y = height * 0.86;
  for (const m of [body, head]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

export function lambert(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}
