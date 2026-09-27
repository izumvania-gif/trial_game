// The Book of Strangers (Bombers' Notebook): who does what, when — as far as Leont has watched.
import { RESIDENTS, WALK_SPEED, type ScheduleEntry } from '../content/residents.ts';
import { pathLength, route } from '../core/streets.ts';
import { DAWN_HOUR } from '../core/clock.ts';
import { isOpen, threadView, THREADS } from '../content/threads.ts';
import type { Knowledge } from '../core/knowledge.ts';
import type { LoopMemory } from '../core/save.ts';
import { h } from './dom.ts';

/** Where a place is, in the words a stranger would use: enough to find it, not what happens there. */
const PLACE_NAMES: Record<string, string> = {
  temple: 'the temple of Apollo', stele: 'the star stele', center: 'the central square', agora: 'the agora',
  council: 'the council steps', aristion: "Aristion's house, west of the temple", shrine: 'the shrine of Demeter, east',
  port: 'the port', tavern: 'the port tavern', shore: 'the shore', mountain: 'the mountain path',
  villa: "Lysimachus' villa, north-west", zeus: 'the temple of Zeus, east', stall: 'the stall by the agora',
  shoreWest: 'the west end of the beach', shoreEast: 'the east end of the beach',
};

function clockLabel(minute: number): string {
  const total = DAWN_HOUR * 60 + minute;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** When someone gets there, not when they set off: "there by ~10:45" once the walk takes a while. */
function arrival(entries: ScheduleEntry[], i: number): string {
  if (i === 0) return '';
  const walk = pathLength(route(entries[i - 1]!.place, entries[i]!.place)) / WALK_SPEED;
  // A few minutes across the square is not worth a note, and "~12:10" for a speech at noon reads as late.
  if (walk < 10) return '';
  return ` (there by ~${clockLabel(Math.round((entries[i]!.from + walk) / 5) * 5)})`;
}

/**
 * Who was where, and when. What someone does at an hour is written only once the player has
 * seen it; for the hours not yet seen the book still says when and where, so they can be found.
 * The hour it is now is marked.
 */
export function bookOfStrangers(memory: LoopMemory, knowledge: Knowledge, patches: string[], minute = 0): (Node | string)[] {
  const met = RESIDENTS.filter((r) => memory.seen.some((s) => s.startsWith(`${r.id}:`)));
  if (!met.length) return [h('p', {}, 'Blank pages. Watch the people of Eferon and their day will write itself here.')];
  return met.map((r) => {
    const entries = r.schedule(patches);
    let current = 0;
    entries.forEach((e, i) => { if (e.from <= minute) current = i; });
    const notes = entries.map((e, i) => {
      const now = i === current ? h('span', { className: 'book-now' }, 'now') : '';
      return memory.seen.includes(`${r.id}:${i}`)
        ? h('li', { className: i === current ? 'current' : '' }, e.note, arrival(entries, i), now)
        : h('li', { className: `unknown${i === current ? ' current' : ''}` }, `${clockLabel(e.from)} · ${PLACE_NAMES[e.place] ?? 'somewhere'}${arrival(entries, i)} — not seen yet`, now);
    });
    return h('section', { className: 'book-entry' },
      h('h3', {}, r.name, h('span', {}, ` — ${r.epithet}`)),
      h('ul', {}, ...notes),
      knowledge.knows(r.trouble.fact) ? h('p', { className: 'trouble' }, r.trouble.text) : h('p', { className: 'trouble unknown' }, 'Trouble: not yet understood.'),
    );
  });
}

/**
 * "Where to look next" is there only if the player asks for it; once asked, it stays shown
 * until that step is done.
 */
export function hintLine(text: string, key: string, hintsShown: string[]): HTMLElement {
  const line = h('p', { className: 'thread-next' });
  const reveal = () => line.replaceChildren(h('span', {}, 'Next'), text);
  if (hintsShown.includes(key)) reveal();
  else {
    const btn = h('button', { type: 'button', className: 'hint-button' }, 'Show hint');
    btn.addEventListener('click', () => {
      if (!hintsShown.includes(key)) hintsShown.push(key);
      reveal();
    });
    line.append(btn);
  }
  return line;
}

/**
 * The chronicle: first the questions still open, each with what bears on it and where to look
 * next; then the ones answered; then everything written, in full.
 */
export function chronicle(knowledge: Knowledge, facts: { id: string; text: string }[], hintsShown: string[]): (Node | string)[] {
  const known = facts.filter((f) => knowledge.knows(f.id));
  if (!known.length) return [h('p', {}, 'The wax is smooth. Nothing written yet.')];
  const knows = (id: string) => knowledge.knows(id);
  const text = (id: string) => facts.find((f) => f.id === id)?.text ?? '';
  const views = THREADS.filter((t) => isOpen(t, knows)).map((t) => threadView(t, knows));
  const open = views.filter((v) => !v.closed);
  const answered = views.filter((v) => v.closed);
  const out: (Node | string)[] = [];
  if (open.length) {
    out.push(h('h3', { className: 'chronicle-section' }, 'Open questions'));
    for (const v of open) {
      out.push(h('section', { className: 'thread' },
        h('p', { className: 'thread-question' }, v.thread.question),
        ...(v.found.length ? [h('ul', { className: 'thread-found' }, ...v.found.map((f) => h('li', {}, text(f))))] : []),
        ...(v.next && v.hintKey ? [hintLine(v.next, v.hintKey, hintsShown)] : []),
      ));
    }
  }
  if (answered.length) {
    out.push(h('h3', { className: 'chronicle-section' }, 'Answered'));
    for (const v of answered) {
      out.push(h('section', { className: 'thread closed' },
        h('p', { className: 'thread-question' }, v.thread.question),
        h('p', { className: 'thread-answer' }, text(v.thread.closes))));
    }
  }
  const all = h('details', { className: 'chronicle-all' },
    h('summary', {}, `Everything written (${known.length})`),
    h('ul', {}, ...known.map((f) => h('li', {}, f.text))));
  out.push(all);
  return out;
}
