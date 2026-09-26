// The epilogue: "Diary Without Dates". One page, in real time. Once per real day (by this
// computer's clock) something happens that has never happened before, and Leont may write one
// entry. No date field. The seam does not answer. Sometimes a wave brings a line from someone else.
import { fetchNotes, postNote } from '../../api.ts';
import { dayEvent, daysSince, FORBIDDEN, PROPHET_DAYS } from '../../content/epilogue.ts';
import { seaRandom } from '../../core/rng.ts';
import { h } from '../../ui/dom.ts';
import type { Stage, StageHost } from '../types.ts';

export class DiaryStage implements Stage {
  readonly id = 'diary' as const;
  readonly palette = null;
  readonly clockRuns = false;
  readonly hideHud = true;

  private host: StageHost;
  private root = h('section', { className: 'diary', hidden: true });
  private washedUp: string | null = null;

  constructor(host: StageHost) {
    this.host = host;
    host.overlay.append(this.root);
  }

  enter(): void {
    this.root.hidden = false;
    this.render();
    void fetchNotes().then((notes) => {
      // The sea brings one line, sometimes. Which one is up to the sea.
      if (notes?.length && seaRandom() < 0.7) this.washedUp = notes[Math.floor(seaRandom() * notes.length)]!;
      this.render();
    });
  }

  exit(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }

  update(): void {}

  private render(): void {
    const ep = this.host.memory.epilogue;
    if (!ep) return;
    const today = daysSince(ep.start, Date.now());
    const prophet = ep.mode === 'prophet';
    const written = ep.entries.some((e) => e.day === today);

    // The prophet's diary slowly grows dates; after a few days the circle comes back.
    if (prophet && today >= PROPHET_DAYS) {
      this.root.replaceChildren(h('p', { className: 'log' }, 'LOG: CYCLE RUN #1'));
      window.setTimeout(() => this.host.ending('prophet'), 1500);
      return;
    }

    const stamp = (day: number) => (prophet ? h('span', { className: 'diary-date' }, `the ${ordinal(day + 1)} day after the night`) : '');
    const entries = h('ol', { className: 'diary-entries' },
      ...ep.entries.map((e) => h('li', {}, stamp(e.day), e.text)));

    const children: (Node | string)[] = [
      h('p', { className: 'diary-event' }, dayEvent(today, today * 7 + ep.entries.length)),
      entries,
    ];
    if (this.washedUp) children.push(h('p', { className: 'diary-wave' }, 'A wave leaves a line on the sand, in a hand that is not yours: ', h('em', {}, this.washedUp)));

    if (!written) {
      const area = h('textarea', { rows: 3, maxLength: 140, placeholder: 'Today…' });
      const toSea = h('input', { type: 'checkbox' });
      const status = h('p', { className: 'desk-note' });
      const save = h('button', { type: 'button' }, 'Write');
      save.addEventListener('click', async () => {
        const text = area.value.replace(/\s+/g, ' ').trim();
        if (!text) return;
        if (FORBIDDEN.test(text)) {
          status.textContent = 'The wax will not take that word.';
          return;
        }
        ep.entries.push({ day: today, text });
        this.host.persist();
        if (toSea.checked) await postNote(text);
        this.render();
      });
      children.push(h('div', { className: 'diary-write' }, area,
        h('label', {}, toSea, ' let it go into the sea (someone else may find it)'), save, status));
    } else {
      children.push(h('p', { className: 'desk-note' }, 'You have written today. Come back when today is over.'));
    }

    const seam = h('button', { type: 'button', className: 'diary-seam', title: '' }, '⏻');
    seam.addEventListener('click', () => (seam.textContent = '⏻ — the mark does not answer.'));
    const forget = h('button', { type: 'button', className: 'ghost diary-forget' }, 'Forget everything');
    forget.addEventListener('click', () => {
      if (window.confirm('Forget everything? The diary goes. Something small may stay.')) this.host.forget();
    });
    children.push(h('footer', {}, seam, forget));
    this.root.replaceChildren(...children);
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
