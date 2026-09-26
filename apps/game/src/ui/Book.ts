// The Book of Strangers (Bombers' Notebook): who does what, when — as far as Leont has watched.
import { RESIDENTS } from '../content/residents.ts';
import { isOpen, threadView, THREADS } from '../content/threads.ts';
import type { Knowledge } from '../core/knowledge.ts';
import type { LoopMemory } from '../core/save.ts';
import { h } from './dom.ts';

export function bookOfStrangers(memory: LoopMemory, knowledge: Knowledge, patches: string[]): (Node | string)[] {
  const met = RESIDENTS.filter((r) => memory.seen.some((s) => s.startsWith(`${r.id}:`)));
  if (!met.length) return [h('p', {}, 'Blank pages. Watch the people of Eferon and their day will write itself here.')];
  return met.map((r) => {
    const entries = r.schedule(patches);
    const notes = entries.map((e, i) => (memory.seen.includes(`${r.id}:${i}`) ? h('li', {}, e.note) : h('li', { className: 'unknown' }, '· · ·')));
    return h('section', { className: 'book-entry' },
      h('h3', {}, r.name, h('span', {}, ` — ${r.epithet}`)),
      h('ul', {}, ...notes),
      knowledge.knows(r.trouble.fact) ? h('p', { className: 'trouble' }, r.trouble.text) : h('p', { className: 'trouble unknown' }, 'Trouble: not yet understood.'),
    );
  });
}

/**
 * The chronicle: first the questions still open, each with what bears on it and where to look
 * next; then the ones answered; then everything written, in full.
 */
export function chronicle(knowledge: Knowledge, facts: { id: string; text: string }[]): (Node | string)[] {
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
        ...(v.next ? [h('p', { className: 'thread-next' }, h('span', {}, 'Next'), v.next)] : []),
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
