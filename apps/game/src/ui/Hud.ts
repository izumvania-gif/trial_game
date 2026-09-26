// Heads-up display: the clock ring (Majora's Mask), the CYCLE RUN, the interaction prompt,
// "written in the chronicle" toasts and the chronicle itself (C).
import { sundialHour, type DayClock } from '../core/clock.ts';
import type { Fact } from '../core/knowledge.ts';
import { h } from './dom.ts';

const RING_R = 34;
const RING_LEN = 2 * Math.PI * RING_R;

export class Hud {
  readonly root = h('div', { className: 'hud' });
  private cycleEl = h('div', { className: 'hud-cycle' });
  private promptEl = h('div', { className: 'hud-prompt' });
  private toastEl = h('div', { className: 'hud-toast' });
  private chronicleEl = h('aside', { className: 'chronicle', hidden: true });
  private hourEl: SVGTextElement;
  private arcEl: SVGCircleElement;
  private timeEl = h('div', { className: 'hud-time' });
  private toastTimer = 0;
  private openPanelId: string | null = null;
  private windEl = h('div', { className: 'hud-wind' });
  private maskEl = h('div', { className: 'hud-mask' });
  private clockEl: HTMLElement;

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
    this.root.append(this.cycleEl, clock, this.windEl, this.maskEl, this.promptEl, this.toastEl);
    parent.append(this.root, this.chronicleEl);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  setCycle(cycleRun: number | null, localCycle: number): void {
    const run = cycleRun === null ? '····' : String(cycleRun);
    this.cycleEl.textContent = `CYCLE RUN #${run} · day ${localCycle}`;
  }

  updateClock(clock: DayClock): void {
    this.arcEl.style.strokeDashoffset = String(RING_LEN * clock.progress);
    this.hourEl.textContent = sundialHour(clock.minute);
    this.timeEl.textContent = clock.label();
    this.root.classList.toggle('late', clock.progress > 0.85);
  }

  prompt(label: string | null): void {
    this.promptEl.textContent = label ?? '';
    this.promptEl.hidden = !label;
  }

  factLearned(fact: Fact): void {
    this.toast(`Written in the chronicle: ${fact.text}`);
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 4500);
  }

  /** Side panels: the chronicle (C), the Book of Strangers (B). One at a time. */
  togglePanel(id: string, title: string, content: () => (Node | string)[]): void {
    if (this.openPanelId === id) return this.closePanel();
    this.chronicleEl.replaceChildren(h('h2', {}, title), ...content(), h('p', { className: 'chronicle-hint' }, 'Esc to close'));
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

  /** 0..1; each third is a gust that brings midnight an hour closer. */
  setWind(wind: number, hidden: boolean): void {
    this.windEl.hidden = hidden;
    const gusts = Math.min(3, Math.floor(wind * 3 + 1e-9));
    this.windEl.textContent = `wind ${'≋'.repeat(gusts)}${'·'.repeat(3 - gusts)}`;
    this.windEl.title = gusts ? `Midnight comes ${gusts} hour${gusts > 1 ? 's' : ''} early` : 'Still air';
  }

  setMask(mask: string | null): void {
    this.maskEl.textContent = mask ? `mask: ${mask}` : '';
    this.maskEl.hidden = !mask;
  }

  /** The strikes take the clock away. */
  setClockVisible(visible: boolean): void {
    this.clockEl.hidden = !visible;
  }
}
