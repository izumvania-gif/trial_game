// Short lines said out loud in the street, shown over the speaker's head for a moment: a chip on
// the panel colour (text never sits on the dithered view), following the speaker as the camera moves.
import * as THREE from 'three';

interface Bark {
  el: HTMLElement;
  at: THREE.Vector3;
  left: number;
}

const SHOWN = 2.8;
const MAX = 3;
const V = new THREE.Vector3();

export class Barks {
  private root: HTMLElement;
  private items: Bark[] = [];

  constructor(overlay: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'barks';
    this.root.setAttribute('aria-live', 'polite');
    overlay.append(this.root);
  }

  /** `at` is followed while the line is up: pass the speaker's position itself. */
  say(text: string, at: THREE.Vector3): void {
    while (this.items.length >= MAX) this.items.shift()!.el.remove();
    const el = document.createElement('div');
    el.className = 'bark';
    el.textContent = text;
    this.root.append(el);
    this.items.push({ el, at, left: SHOWN });
  }

  /** The lines said since the last look, for agent mode. */
  lines(): string[] {
    return this.items.map((b) => b.el.textContent ?? '');
  }

  update(dt: number, camera: THREE.Camera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const b of [...this.items]) {
      b.left -= dt;
      if (b.left <= 0) {
        b.el.remove();
        this.items.splice(this.items.indexOf(b), 1);
        continue;
      }
      V.set(b.at.x, b.at.y + 2.3, b.at.z).project(camera);
      const off = V.z > 1 || Math.abs(V.x) > 1.1 || Math.abs(V.y) > 1.1;
      b.el.style.transform = `translate(${((V.x + 1) / 2) * w}px, ${((1 - V.y) / 2) * h}px) translate(-50%, -100%)`;
      b.el.style.opacity = off ? '0' : String(Math.min(1, b.left / 0.4, (SHOWN - b.left) / 0.15));
    }
  }

  clear(): void {
    for (const b of this.items) b.el.remove();
    this.items = [];
  }

  dispose(): void {
    this.clear();
    this.root.remove();
  }
}
