// The Book of Strangers (Bombers' Notebook): who does what, when — as far as Leont has watched.
import { RESIDENTS } from '../content/residents.ts';
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

export function chronicle(knowledge: Knowledge, facts: { id: string; text: string }[]): (Node | string)[] {
  const known = facts.filter((f) => knowledge.knows(f.id));
  if (!known.length) return [h('p', {}, 'The wax is smooth. Nothing written yet.')];
  return [h('ul', {}, ...known.map((f) => h('li', {}, f.text)))];
}
