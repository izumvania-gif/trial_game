import type * as THREE from 'three';

/** Frees geometries and materials of a stage's scene. */
export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}
