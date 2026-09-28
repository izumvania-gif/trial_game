// Heads-up display: the clock ring (Majora's Mask), the CYCLE RUN, the interaction prompt,
// "written in the chronicle" toasts and the chronicle itself (C).
import { sundialHour, type DayClock } from '../core/clock.ts';
import type { Fact } from '../core/knowledge.ts';
import { h } from './dom.ts';
import { keyLine } from './keys.ts';
import type { Mechanic } from '../core/types.ts';

const RING_R = 34;
const RING_LEN = 2 * Math.PI * RING_R;

export class Hud {
  readonly root = h('div', { className: 'hud' });
  private cycleEl = h('div', { className: 'hud-cycle' });
  private promptEl = h('div', { className: 'hud-prompt', hidden: true });
  private toastEl = h('div', { className: 'hud-toast' });
  private chronicleEl = (() => {
    const el = h('aside', { className: 'chronicle', hidden: true });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !el.classList.contains('wide')) return;
      const all = [...el.querySelectorAll<HTMLElement>('button, select, [tabindex="0"]')].filter((x) => !x.hidden && x.tabIndex >= 0 && x.offsetParent);
      if (!all.length) return;
      const first = all[0]!;
      const last = all[all.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return el;
  })();
  private hourEl: SVGTextElement;
  private arcEl: SVGCircleElement;
  private timeEl = h('div', { className: 'hud-time' });
  private toastTimer = 0;
  private toastGap = 0;
  /** Toasts wait their turn: a fact, then what it opened, then a new question. */
  private toastQueue: { text: string; kicker?: string; quiet?: boolean }[] = [];
  private openPanelId: string | null = null;
  private windEl = h('div', { className: 'hud-wind' });
  private maskEl = h('div', { className: 'hud-mask' });
  private clockEl: HTMLElement;
  private captionEl = h('div', { className: 'caption' });
  private captionTimer = 0;
  /** Keys for the current place; lives outside the HUD root so it shows where the HUD is hidden. */
  private controlsEl = h('div', { className: 'controls-bar' });
  private promptText: string | null = null;
  /** The prologue's teaching line: what to press now. */
  private coachEl = h('div', { className: 'hud-coach', hidden: true });
  private coachText: string | null = null;
  /** The question the player is following, under the clock. */
  private goalEl = h('div', { className: 'hud-goal', hidden: true });

  constructor(parent: HTMLElement) {
    const clock = h('div', { className: 'hud-clock' });
    clock.innerHTML = `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="${RING_R}" class="ring-bg"/>
        <circle cx="40" cy="40" r="${RING_R}" class="ring-arc" stroke-dasharray="${RING_LEN}" transform="rotate(-90 40 40)"/>
        <text x="40" y="47" text-anchor="middle" class="ring-hour"></text>
      </svg>`;
    clock.append(this.timeEl);
    this.hourEl = clock.querySelector('text')!;
    this.arcEl = clock.querySelectorAll('circle')[1] as SVGCircleElement;
    this.clockEl = clock;
    this.toastEl.setAttribute('role', 'status');
    this.coachEl.setAttribute('role', 'status');
    this.root.append(this.cycleEl, clock, this.windEl, this.maskEl, this.goalEl, this.promptEl, this.coachEl, this.toastEl);
    parent.append(this.root, this.chronicleEl, this.captionEl, this.controlsEl);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  setCycle(cycleRun: number | null, localCycle: number): void {
    const run = cycleRun === null ? '····' : String(cycleRun);
    this.cycleEl.replaceChildren(h('span', {}, `CYCLE RUN #${run}`), h('span', { className: 'hud-day' }, `day ${localCycle}`));
  }

  updateClock(clock: DayClock): void {
    this.arcEl.style.strokeDashoffset = String(RING_LEN * clock.progress);
    this.hourEl.textContent = sundialHour(clock.minute);
    this.timeEl.textContent = clock.label();
    this.root.classList.toggle('late', clock.progress > 0.85);
  }

  /** "E — Star stele": the key becomes a keycap. Called every frame, so it only redraws on change. */
  prompt(label: string | null): void {
    if (label === this.promptText) return;
    this.promptText = label;
    this.promptEl.replaceChildren(...(label ? keyLine(label) : []));
    this.promptEl.hidden = !label;
  }

  setControls(text: string | null): void {
    this.controlsEl.replaceChildren(...(text ? keyLine(text) : []));
    this.controlsEl.hidden = !text;
  }

  factLearned(fact: Fact): void {
    this.toast(fact.text, 'Written in the chronicle');
  }

  /** Sound captions stay visible even where the HUD is hidden (the sea, the Desk). */
  caption(text: string): void {
    this.captionEl.textContent = text;
    this.captionEl.classList.add('show');
    window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => this.captionEl.classList.remove('show'), 3000);
  }

  /** `quiet`: a note in the margin — no accent bar, the slanted hand. */
  toast(text: string, kicker?: string, quiet = false): void {
    this.toastQueue.push({ text, kicker, quiet });
    // Never a long backlog: keep the one showing and the three newest.
    if (this.toastQueue.length > 4) this.toastQueue.splice(1, this.toastQueue.length - 4);
    if (this.toastQueue.length === 1) this.nextToast();
  }

  /** A new day: yesterday's news is not news. */
  clearToasts(): void {
    this.toastQueue = [];
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.toastGap);
    this.toastEl.classList.remove('show');
  }

  private nextToast(): void {
    const t = this.toastQueue[0];
    if (!t) return;
    this.toastEl.classList.toggle('quiet', !!t.quiet);
    this.toastEl.replaceChildren(...(t.kicker ? [h('span', { className: 'toast-kicker' }, t.kicker)] : []), h('span', {}, t.text));
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      // A short gap so two toasts read as two.
      this.toastGap = window.setTimeout(() => {
        if (!this.toastQueue.length) return;
        this.toastQueue.shift();
        this.nextToast();
      }, 450);
    }, Math.max(4500, 2000 + t.text.length * 45)); // long lines (the masks) stay long enough to read
  }

  coach(text: string | null): void {
    if (text === this.coachText) return;
    this.coachText = text;
    this.coachEl.hidden = !text;
    if (text) this.coachEl.replaceChildren(...keyLine(text));
  }

  /** The open question to follow, or null. */
  setGoal(text: string | null): void {
    this.goalEl.hidden = !text;
    if (text) this.goalEl.replaceChildren(h('span', { className: 'hud-goal-kicker' }, 'Goal'), h('span', {}, text));
  }

  /** Side panels: the chronicle (C), the Book of Strangers (B). One at a time. */
  togglePanel(id: string, title: string, content: () => (Node | string)[], wide = false): void {
    if (this.openPanelId === id) return this.closePanel();
    // The chronicle's map takes the whole screen; the Book stays a page at the side.
    this.chronicleEl.classList.toggle('wide', wide);
    this.chronicleEl.replaceChildren(h('h2', { id: 'panel-title' }, title), ...content(), h('p', { className: 'chronicle-hint' }, ...keyLine('Esc — close')));
    // The full-screen chronicle is a dialog: named, modal, and Tab goes round inside it.
    if (wide) {
      this.chronicleEl.setAttribute('role', 'dialog');
      this.chronicleEl.setAttribute('aria-modal', 'true');
      this.chronicleEl.setAttribute('aria-labelledby', 'panel-title');
    } else {
      for (const a of ['role', 'aria-modal', 'aria-labelledby']) this.chronicleEl.removeAttribute(a);
    }
    this.chronicleEl.hidden = false;
    this.openPanelId = id;
  }

  closePanel(): void {
    this.chronicleEl.hidden = true;
    this.openPanelId = null;
  }

  get panelOpen(): boolean {
    return this.openPanelId !== null;
  }

  /** Which side panel is open, if any. */
  get panelId(): string | null {
    return this.openPanelId;
  }

  /** 0..1; each third is a gust that brings midnight an hour closer. */
  setWind(wind: number, hidden: boolean): void {
    this.windEl.hidden = hidden;
    const gusts = Math.min(3, Math.floor(wind * 3 + 1e-9));
    this.windEl.textContent = `wind ${'≋'.repeat(gusts)}${'·'.repeat(3 - gusts)}${gusts ? ` · midnight at ${24 - gusts}:00` : ''}`;
    this.windEl.title = gusts ? `Midnight comes ${gusts} hour${gusts > 1 ? 's' : ''} early` : 'Still air';
  }

  setMask(mask: string | null): void {
    this.maskEl.textContent = mask ? `mask: ${mask}` : '';
    this.maskEl.hidden = !mask;
  }

  /**
   * A tool the strikes took, breaking in front of the player: the clock itself cracks in two
   * and falls; the others appear as their key, and break.
   */
  shatter(m: Mechanic): void {
    const parent = this.root.parentElement;
    if (!parent) return;
    const box = h('div', { className: 'shatter' });
    let source: HTMLElement;
    if (m === 'clock' && !this.root.hidden && !this.clockEl.hidden) {
      source = this.clockEl.cloneNode(true) as HTMLElement;
      const r = this.clockEl.getBoundingClientRect();
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    } else {
      source = h('div', { className: 'shatter-chip' }, ...keyLine(LOST_LABEL[m]));
      box.classList.add('center');
      // An invisible copy gives the box its size; the halves lie over it.
      const sizer = source.cloneNode(true) as HTMLElement;
      sizer.style.visibility = 'hidden';
      box.append(sizer);
    }
    for (const side of ['left', 'right']) {
      const half = h('div', { className: `shatter-half ${side}` });
      half.append(source.cloneNode(true));
      box.append(half);
    }
    for (let i = 0; i < 8; i++) {
      const grit = h('span', { className: 'grit' });
      grit.style.setProperty('--gx', `${Math.round((i - 3.5) * 9)}px`);
      grit.style.animationDelay = `${0.55 + i * 0.03}s`;
      box.append(grit);
    }
    parent.append(box);
    window.setTimeout(() => box.remove(), 2400);
  }

  /** The strikes take the clock away. */
  setClockVisible(visible: boolean): void {
    this.clockEl.hidden = !visible;
  }
}

const LOST_LABEL: Record<Mechanic, string> = {
  schedules: 'B — the Book of Strangers',
  clock: 'the clock',
  dejavu: 'F — déjà vu',
  masks: 'M — masks',
  chronicle: 'C — the chronicle',
};
