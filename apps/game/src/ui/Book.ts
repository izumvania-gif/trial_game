// The Book of Strangers (Bombers' Notebook): who does what, when — as far as Leont has watched.
import { RESIDENTS } from '../content/residents.ts';
import { DAWN_HOUR } from '../core/clock.ts';
import { isOpen, threadView, THREADS } from '../content/threads.ts';
import type { Knowledge } from '../core/knowledge.ts';
import type { LoopMemory } from '../core/save.ts';
import { h } from './dom.ts';
import { cloneCanvas, PORTRAIT_IDS, portrait } from './portraits.ts';

/** Where a place is, in the words a stranger would use: enough to find it, not what happens there. */
export const PLACE_NAMES: Record<string, string> = {
  temple: 'the temple of Apollo', stele: 'the star stele', center: 'the central square', agora: 'the agora',
  council: 'the council steps', aristion: "Aristion's house, west of the temple", shrine: 'the shrine of Demeter, east',
  port: 'the port', tavern: 'the port tavern', shore: 'the shore', mountain: 'the mountain path',
  villa: "Lysimachus' villa, north-west", zeus: 'the temple of Zeus, east', stall: 'the stall by the agora',
  shoreWest: 'the west end of the beach', shoreEast: 'the east end of the beach',
};

/** The same places in a word, short enough for a strip of the day. */
const PLACE_SHORT: Record<string, string> = {
  temple: 'temple', stele: 'stele', center: 'square', agora: 'agora', council: 'council', aristion: 'home', shrine: 'shrine',
  port: 'port', tavern: 'tavern', shore: 'shore', mountain: 'mountain', villa: 'villa', zeus: 'Zeus', stall: 'stall',
  shoreWest: 'beach', shoreEast: 'beach',
};

/** The whole day, dawn to midnight, in minutes. */
const DAY = (24 - DAWN_HOUR) * 60;

/**
 * One person's day as a strip (after Majora's Mask's notebook): a block for every part of it,
 * filled once it has been seen, and a line for now. Who crosses whom can be read down the page.
 */
function dayStrip(entries: { from: number; place: string }[], seenAt: (i: number) => boolean, minute: number): HTMLElement {
  // Drawn for the eye; the list under it says the same in words.
  const strip = h('div', { className: 'book-strip', ariaHidden: 'true' });
  entries.forEach((e, i) => {
    const end = entries[i + 1]?.from ?? DAY;
    const block = h('span', { className: `book-block${seenAt(i) ? ' seen' : ''}` }, PLACE_SHORT[e.place] ?? '');
    block.style.left = `${(e.from / DAY) * 100}%`;
    block.style.width = `${((end - e.from) / DAY) * 100}%`;
    block.title = `${clockLabel(e.from)} · ${PLACE_NAMES[e.place] ?? 'somewhere'}`;
    strip.append(block);
  });
  const now = h('span', { className: 'book-needle' });
  now.style.left = `${(Math.min(minute, DAY) / DAY) * 100}%`;
  strip.append(now);
  return strip;
}

/** Hours along the top of the page, so the strips can be read against them. */
function dayScale(): HTMLElement {
  const scale = h('div', { className: 'book-scale', ariaHidden: 'true' });
  for (const hour of [6, 9, 12, 15, 18, 21, 24]) {
    const tick = h('span', {}, `${String(hour).padStart(2, '0')}`);
    tick.style.left = `${(((hour - DAWN_HOUR) * 60) / DAY) * 100}%`;
    scale.append(tick);
  }
  return scale;
}

function clockLabel(minute: number): string {
  const total = DAWN_HOUR * 60 + minute;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Who was where, and when. What someone does at an hour is written only once the player has
 * seen it; for the hours not yet seen the book still says when and where, so they can be found.
 * The hour it is now is marked.
 */
export function bookOfStrangers(memory: LoopMemory, knowledge: Knowledge, patches: string[], minute = 0): (Node | string)[] {
  const met = RESIDENTS.filter((r) => memory.seen.some((s) => s.startsWith(`${r.id}:`)));
  if (!met.length) return [h('p', {}, 'Blank pages. Watch the people of Eferon and their day will write itself here.')];
  const pages = met.map((r) => {
    const entries = r.schedule(patches);
    let current = 0;
    entries.forEach((e, i) => { if (e.from <= minute) current = i; });
    const notes = entries.map((e, i) => {
      const now = i === current ? h('span', { className: 'book-now' }, 'now') : '';
      return memory.seen.includes(`${r.id}:${i}`)
        ? h('li', { className: i === current ? 'current' : '' }, e.note, now)
        : h('li', { className: `unknown${i === current ? ' current' : ''}` }, `${clockLabel(e.from)} · ${PLACE_NAMES[e.place] ?? 'somewhere'} — not seen yet`, now);
    });
    const face = PORTRAIT_IDS.includes(r.id) ? h('span', { className: 'book-face' }, cloneCanvas(portrait(r.id, 'vase'))) : '';
    return h('section', { className: 'book-entry' },
      h('h3', {}, face, h('span', { className: 'book-who' }, r.name, h('span', {}, ` — ${r.epithet}`))),
      dayStrip(entries, (i) => memory.seen.includes(`${r.id}:${i}`), minute),
      h('ul', {}, ...notes),
      knowledge.knows(r.trouble.fact) ? h('p', { className: 'trouble' }, r.trouble.text) : h('p', { className: 'trouble unknown' }, 'Trouble: not yet understood.'),
    );
  });
  return [dayScale(), ...pages];
}

/**
 * "Where to look next" is there only if the player asks for it; once asked, it stays shown
 * until that step is done.
 */
export function hintLine(text: string, key: string, hintsShown: string[], about?: string): HTMLElement {
  const line = h('p', { className: 'thread-next' });
  const reveal = () => line.replaceChildren(h('span', {}, 'Next'), text);
  if (hintsShown.includes(key)) reveal();
  else {
    const btn = h('button', { type: 'button', className: 'hint-button' }, 'Show hint');
    if (about) btn.setAttribute('aria-label', `Show hint: ${about}`);
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
        h('h4', { className: 'thread-question' }, v.thread.question),
        ...(v.found.length ? [h('ul', { className: 'thread-found' }, ...v.found.map((f) => h('li', {}, text(f))))] : []),
        ...(v.next && v.hintKey ? [hintLine(v.next, v.hintKey, hintsShown, v.thread.question)] : []),
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
