// Eion's lyre. R raises it; arrow keys pluck the four strings. The Song of Return
// (Majora's Song of Time, turned inside out) sends Leont back to dawn — at his own request.
import { LYRE_NOTES } from '../engine/audio.ts';
import { h } from './dom.ts';

export const SONG_OF_RETURN = ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
/** A traveller's tune Eion hums between verses: right, down, up, twice (the shape of a certain song about storms). */
export const SONG_OF_STORMS = ['ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowUp'];
const GLYPH: Record<string, string> = { ArrowUp: '▲', ArrowDown: '▼', ArrowLeft: '◀', ArrowRight: '▶' };

export class Lyre {
  private root = h('div', { className: 'lyre', hidden: true });
  private staff = h('div', { className: 'lyre-staff' });
  private status = h('p', { className: 'lyre-status' });
  private notes: string[] = [];
  private onSong: (() => void) | null = null;
  private onStorm: (() => void) | null = null;
  private onPluck: (semis: number) => void;

  constructor(parent: HTMLElement, onPluck: (semis: number) => void = () => {}) {
    this.onPluck = onPluck;
    this.root.append(h('p', { className: 'lyre-title' }, 'The lyre'), this.staff, this.status,
      h('p', { className: 'lyre-hint' }, 'Arrow keys pluck the strings · R or Esc to lower it'));
    parent.append(this.root);
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      if (e.code in GLYPH) {
        e.preventDefault();
        this.pluck(e.code);
      } else if (e.code === 'Escape' || e.code === 'KeyR') {
        e.preventDefault();
        this.close();
      }
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(knowsSong: boolean, onSong: () => void, onStorm?: () => void): void {
    this.notes = [];
    this.onSong = onSong;
    this.onStorm = onStorm ?? null;
    this.status.textContent = knowsSong ? 'You remember a song. Six notes, falling and climbing.' : 'You do not know any songs. The strings are cold.';
    this.render();
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  private pluck(code: string): void {
    this.onPluck(LYRE_NOTES[code] ?? 0);
    this.notes.push(code);
    const n = this.notes.length;
    const fits = (song: string[]) => song.slice(0, n).every((c, i) => c === this.notes[i]);
    const matches = fits(SONG_OF_RETURN) || (!!this.onStorm && fits(SONG_OF_STORMS));
    this.render();
    if (!matches) {
      this.status.textContent = 'The strings buzz against each other.';
      this.notes = [];
      window.setTimeout(() => this.render(), 400);
      return;
    }
    if (n === SONG_OF_STORMS.length && this.onStorm && fits(SONG_OF_STORMS)) {
      this.status.textContent = 'A song of storms.';
      const cb = this.onStorm;
      window.setTimeout(() => {
        this.close();
        cb();
      }, 500);
      return;
    }
    if (n === SONG_OF_RETURN.length) {
      this.status.textContent = 'The Song of Return.';
      const cb = this.onSong;
      window.setTimeout(() => {
        this.close();
        cb?.();
      }, 900);
    }
  }

  private render(): void {
    this.staff.replaceChildren(...Array.from({ length: SONG_OF_RETURN.length }, (_, i) =>
      h('span', { className: this.notes[i] ? 'note on' : 'note' }, this.notes[i] ? GLYPH[this.notes[i]!]! : '·')));
  }
}
