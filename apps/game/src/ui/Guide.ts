// How-to cards (blocking, one per place, H shows them again) and tips (a small card beside the
// action that does not stop it). Seen ids are kept in LoopMemory so a new day does not repeat them.
import type { Guide } from '../content/guides.ts';
import { h } from './dom.ts';
import { keycaps } from './keys.ts';

const TIP_MS = 11000;
/** Quiet time after a card or tip before the next tip may appear. */
const TIP_GAP_MS = 9000;

export class Guides {
  private card = h('section', { className: 'guide', hidden: true });
  private tipEl = h('aside', { className: 'guide-tip', hidden: true });
  private tipTimer = 0;
  private onClose: (() => void) | null = null;
  private quietUntil = 0;
  private seen: () => string[];
  private enabled: () => boolean;

  constructor(parent: HTMLElement, seen: () => string[], enabled: () => boolean) {
    this.seen = seen;
    this.enabled = enabled;
    parent.append(this.card, this.tipEl);
    window.addEventListener('keydown', (e) => {
      if (this.card.hidden) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyH') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.close();
      }
    }, true);
    this.tipEl.addEventListener('click', () => this.hideTip());
  }

  get open(): boolean {
    return !this.card.hidden;
  }

  get tipVisible(): boolean {
    return !this.tipEl.hidden;
  }

  /** The first time only (and only with tips on). Returns whether it was shown. */
  first(guide: Guide, onClose?: () => void): boolean {
    if (!this.enabled() || this.seen().includes(guide.id)) return false;
    this.seen().push(guide.id);
    this.show(guide, onClose);
    return true;
  }

  /** Always: the H key. */
  show(guide: Guide, onClose?: () => void): void {
    this.hideTip();
    this.onClose = onClose ?? null;
    const ok = h('button', { type: 'button' }, 'Understood');
    ok.addEventListener('click', () => this.close());
    this.card.replaceChildren(
      h('p', { className: 'guide-kicker' }, guide.kicker),
      h('h2', {}, guide.title),
      h('ol', { className: 'guide-steps' }, ...guide.steps.map((s) =>
        h('li', {}, h('span', { className: 'guide-keys' }, ...keycaps(s.keys)), h('span', {}, s.text)))),
      h('div', { className: 'guide-foot' }, ok, h('span', { className: 'guide-note' }, h('kbd', {}, 'Enter'), ' to continue')),
    );
    this.card.hidden = false;
    ok.focus();
  }

  close(): void {
    if (this.card.hidden) return;
    this.card.hidden = true;
    this.quietUntil = performance.now() + TIP_GAP_MS;
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  /** `urgent` tips explain what is happening right now and skip the quiet time. */
  tip(guide: Guide, urgent = false): boolean {
    if (!this.enabled() || this.seen().includes(guide.id)) return false;
    if (!urgent && performance.now() < this.quietUntil) return false;
    this.seen().push(guide.id);
    this.tipEl.replaceChildren(
      h('p', { className: 'guide-kicker' }, guide.kicker),
      h('h3', {}, guide.title),
      ...guide.steps.map((s) => h('p', {}, h('span', { className: 'guide-keys' }, ...keycaps(s.keys)), s.text)),
    );
    this.tipEl.hidden = false;
    window.clearTimeout(this.tipTimer);
    this.tipTimer = window.setTimeout(() => this.hideTip(), TIP_MS);
    return true;
  }

  hideTip(): void {
    window.clearTimeout(this.tipTimer);
    if (!this.tipEl.hidden) this.quietUntil = performance.now() + TIP_GAP_MS;
    this.tipEl.hidden = true;
  }
}
