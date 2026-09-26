// Between cycles: the scene has frozen into a relief on the spiral. The global CYCLE RUN
// (every reset of every player) is shown here; "Wake" is the player initiating the next reset.
import { h } from './dom.ts';

export class ResetScreen {
  private root = h('div', { className: 'reset', hidden: true });

  constructor(parent: HTMLElement) {
    parent.append(this.root);
  }

  /** Without onWake: waiting for the server. With it: ready. */
  show(cycleRun: number | null, onWake?: () => void, quiet = 'The rain has stopped. It is morning, and it is the same morning.'): void {
    const run = cycleRun === null ? '····' : String(cycleRun);
    const wake = h('button', { type: 'button', disabled: !onWake }, 'Wake');
    wake.addEventListener('click', () => {
      this.root.hidden = true;
      onWake?.();
    }, { once: true });
    this.root.replaceChildren(
      h('p', { className: 'log' }, `LOG: CYCLE RUN #${run}`),
      h('p', { className: 'log' }, 'RESET COMPLETED SUCCESSFULLY'),
      h('p', { className: 'reset-quiet' }, quiet),
      wake,
    );
    this.root.hidden = false;
    if (onWake) wake.focus();
  }
}
