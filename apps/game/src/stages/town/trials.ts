// A trial being run: the posts with their red ribbons standing along the course (the next one lit,
// a pale ring round its foot), the water-clock chip at the top of the screen, and the rules — each
// post in turn, within the time, and on the wall walk never the street.
import * as THREE from 'three';
import { seconds, type Trial } from '../../content/trials.ts';
import { lambert, PAINT } from '../figures.ts';

export type TrialEnd = { won: boolean; time: number; why?: string };

export class TrialRun {
  readonly trial: Trial;
  private posts: THREE.Group[] = [];
  private chip: HTMLElement;
  private next = 0;
  private time = 0;
  private started = false;
  private done: TrialEnd | null = null;
  private shown = 0;

  constructor(scene: THREE.Scene, overlay: HTMLElement, trial: Trial) {
    this.trial = trial;
    const wood = lambert('#3a2418');
    trial.gates.forEach((g, i) => {
      const post = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), wood);
      pole.position.y = 1.3;
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.04), PAINT.red);
      ribbon.position.set(0.28, 2.35, 0);
      ribbon.name = 'ribbon';
      const ring = new THREE.Mesh(new THREE.TorusGeometry(g.r ?? 1.6, 0.06, 4, 24), PAINT.bone);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      ring.name = 'ring';
      post.add(pole, ribbon, ring);
      post.position.set(g.x, g.y, g.z);
      // Part of the game's markings, not of the city: the carved frame at midnight leaves them out.
      post.traverse((o) => (o.userData.hud = true));
      post.userData.index = i;
      scene.add(post);
      this.posts.push(post);
    });
    this.chip = document.createElement('div');
    this.chip.className = 'trial-chip';
    this.chip.setAttribute('role', 'status');
    overlay.append(this.chip);
    this.render();
  }

  /**
   * One frame of the trial. `onStreet`: his feet are on the street (for the wall walk). Returns the
   * end once, the frame it comes.
   */
  update(dt: number, time: number, at: THREE.Vector3, onStreet: boolean): TrialEnd | null {
    if (this.done) {
      this.shown += dt;
      return null;
    }
    const gate = this.trial.gates[this.next]!;
    if (this.started) this.time += dt;
    const passed = Math.hypot(at.x - gate.x, at.z - gate.z) < (gate.r ?? 1.6) && Math.abs(at.y - gate.y) < 1.6;
    if (passed) {
      if (!this.started) this.started = true;
      this.next++;
      if (this.next >= this.trial.gates.length) return this.end({ won: this.time <= this.trial.limit, time: this.time, why: this.time > this.trial.limit ? 'The water-clock ran dry first.' : undefined });
    }
    if (this.started && this.time > this.trial.limit) return this.end({ won: false, time: this.time, why: 'The water-clock ran dry.' });
    if (this.started && this.trial.noStreet && onStreet) return this.end({ won: false, time: this.time, why: 'You touched the street.' });
    // The next post's ribbon flies; the rest hang still.
    this.posts.forEach((p, i) => {
      p.visible = i >= this.next;
      const ribbon = p.getObjectByName('ribbon')!;
      ribbon.rotation.y = i === this.next ? Math.sin(time * 9) * 0.5 : 0;
      p.getObjectByName('ring')!.visible = i === this.next;
    });
    this.render();
    return null;
  }

  private end(e: TrialEnd): TrialEnd {
    this.done = e;
    for (const p of this.posts) p.visible = false;
    this.chip.classList.add(e.won ? 'won' : 'lost');
    this.chip.textContent = e.won ? `${this.trial.name} · ${seconds(e.time)} · won` : `${this.trial.name} · ${e.why ?? 'lost'}`;
    return e;
  }

  private render(): void {
    const n = this.trial.gates.length;
    this.chip.textContent = this.started
      ? `${this.trial.name} · ${seconds(this.time)} / ${this.trial.limit} s · post ${this.next + 1} of ${n}${this.trial.noStreet ? ' · not the street' : ''}`
      : `${this.trial.name} · to the first post: the water-clock starts there`;
  }

  /** The result stays up a few seconds, then the trial can go. */
  get finished(): boolean {
    return !!this.done && this.shown > 4;
  }

  /** Where the next post stands, for agents. */
  nextGate(): { x: number; z: number; y: number } | null {
    return this.done ? null : this.trial.gates[this.next]!;
  }

  dispose(): void {
    for (const p of this.posts) p.removeFromParent();
    this.chip.remove();
  }
}
