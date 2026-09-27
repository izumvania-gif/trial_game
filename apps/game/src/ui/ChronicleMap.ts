// The chronicle drawn as a map of subjects, painted like a cup: cards for what Leont has looked
// into, black figures with a question mark for what he has only heard of, and painted arrows for
// what led where. Click a card to read it.
import { deductionsFor, isRight, type Deduction } from '../content/deductions.ts';
import { chronicleMap, nextOnCard, type Card } from '../content/subjects.ts';
import type { Knowledge } from '../core/knowledge.ts';
import type { LoopMemory } from '../core/save.ts';
import { hintLine } from './Book.ts';
import { h } from './dom.ts';
import { cloneCanvas, portrait } from './portraits.ts';

export interface MapHooks {
  /** A conclusion carved right: the game writes the margin note and saves. */
  onConclusion(d: Deduction): void;
  /** A card was moved, or the layout tidied: save it. */
  onLayout(): void;
}

/** The map's own coordinates: 100 wide, 60 high; a card is CARD_W × CARD_H of them. */
const W = 100;
const H = 60;
const CARD_W = 14;
const CARD_H = 7.4;


/** Where the line from a to b leaves the edge of b's card. */
function edgePoint(ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = ax - bx;
  const dy = ay - by;
  const sx = dx === 0 ? Infinity : (CARD_W / 2 + 0.8) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (CARD_H / 2 + 0.8) / Math.abs(dy);
  const s = Math.min(sx, sy, 1);
  return [bx + dx * s, by + dy * s];
}

const SVG = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Map or questions, kept between openings of the chronicle. */
let mode: 'map' | 'questions' = 'map';

/** The chronicle with its two faces: the map of subjects, and the list of open questions. */
export function chronicleTabs(map: () => HTMLElement, questions: () => (Node | string)[]): HTMLElement {
  const body = h('div', { className: 'cmap-body' });
  const tabs = (['map', 'questions'] as const).map((m) => {
    const b = h('button', { type: 'button', className: 'cmap-tab' }, m === 'map' ? 'Map' : 'Questions');
    b.addEventListener('click', () => render(m));
    return b;
  });
  const render = (m: typeof mode) => {
    mode = m;
    tabs.forEach((b, i) => b.classList.toggle('on', (i === 0) === (m === 'map')));
    body.replaceChildren(...(m === 'map' ? [map()] : [h('div', { className: 'cmap-questions' }, ...questions())]));
  };
  render(mode);
  return h('div', { className: 'cmap-wrap' }, h('nav', { className: 'cmap-tabs' }, ...tabs), body);
}

/** Which card is open, kept between openings of the chronicle. */
let selected: string | null = null;

export function chronicleMapView(knowledge: Knowledge, facts: { id: string; text: string }[], memory: LoopMemory, hooks: MapHooks): HTMLElement {
  const hintsShown = memory.hintsShown;
  const knows = (id: string) => knowledge.knows(id);
  const text = (id: string) => facts.find((f) => f.id === id)?.text ?? '';
  const map = chronicleMap(knows);
  const visible = map.cards.filter((c) => c.state !== 'hidden');
  const byId = new Map(map.cards.map((c) => [c.subject.id, c]));

  // Open on the card that has something to do, if the last one is gone or done.
  const pick = () =>
    visible.find((c) => c.state === 'explored' && nextOnCard(c.subject, knows))
    ?? visible.find((c) => c.state === 'rumour')
    ?? visible[0];
  if (!selected || !visible.some((c) => c.subject.id === selected)) selected = pick()?.subject.id ?? null;

  // New since the chronicle was last open: facts written since, and rumours first heard since.
  const seen = new Set(memory.mapSeen);
  const fresh = new Set(knowledge.list().filter((f) => !seen.has(f)));
  const isNew = (c: Card) => (c.state === 'rumour' ? !seen.has(`rumour:${c.subject.id}`) : c.found.some((f) => fresh.has(f)));
  memory.mapSeen = [...knowledge.list(), ...visible.filter((c) => c.state === 'rumour').map((c) => `rumour:${c.subject.id}`)];

  // Where each card is: where the player put it, or where it was painted to begin with.
  const place = (id: string) => memory.mapLayout[id] ?? { x: byId.get(id)!.subject.x, y: byId.get(id)!.subject.y };
  const at = (id: string) => ({ x: place(id).x, y: (place(id).y / 100) * H });

  const board = h('div', { className: 'cmap-board' });
  const lines = svg('svg', { class: 'cmap-lines', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const defs = svg('defs', {});
  const marker = svg('marker', { id: 'cmap-head', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
  marker.append(svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'cmap-head' }));
  defs.append(marker);
  const paths = svg('g', {});
  lines.append(defs, paths);
  const drawArrows = () => {
    paths.replaceChildren();
    for (const a of map.arrows) {
      const from = at(a.from);
      const to = at(a.to);
      const [x1, y1] = edgePoint(to.x, to.y, from.x, from.y);
      const [x2, y2] = edgePoint(from.x, from.y, to.x, to.y);
      // A painter's line: bowed a little, never ruled.
      const mx = (x1 + x2) / 2 - (y2 - y1) * 0.12;
      const my = (y1 + y2) / 2 + (x2 - x1) * 0.12;
      const rumour = byId.get(a.to)!.state === 'rumour';
      const path = svg('path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, class: `cmap-arrow${rumour ? ' to-rumour' : ''}${a.settled ? ' settled' : ''}`, 'marker-end': 'url(#cmap-head)' });
      if (a.both) path.setAttribute('marker-start', 'url(#cmap-head)');
      paths.append(path);
    }
  };
  drawArrows();
  board.append(lines);

  const detail = h('aside', { className: 'cmap-detail' });
  const cardEls = new Map<string, HTMLElement>();
  const show = (id: string) => {
    selected = id;
    for (const [cid, el] of cardEls) el.classList.toggle('selected', cid === id);
    detail.replaceChildren(...detailOf(byId.get(id)!, knows, text, memory, fresh, hooks, () => { const el = cardEls.get(id); el?.classList.add('understood'); el?.querySelector('.cmap-conclude')?.remove(); show(id); }));
    cardEls.get(id)?.classList.remove('new');
  };

  for (const card of visible) {
    const p = at(card.subject.id);
    const total = card.subject.facts.length;
    const more = card.state === 'explored' && !!nextOnCard(card.subject, knows);
    const pending = card.state !== 'rumour' && deductionsFor(card.subject.id).some((d) => d.requires.every(knows) && !memory.deductions.includes(d.id));
    const understood = deductionsFor(card.subject.id).some((d) => memory.deductions.includes(d.id));
    const face = card.state !== 'rumour' && card.subject.face ? h('span', { className: 'cmap-face' }, cloneCanvas(portrait(card.subject.face, 'vase'))) : '';
    const el = h('button', {
      type: 'button',
      className: `cmap-card ${card.state}${isNew(card) ? ' new' : ''}${understood ? ' understood' : ''}${face ? ' has-face' : ''}`,
      title: card.state === 'rumour' ? 'Heard of, not yet seen' : card.subject.name,
    },
    face,
    card.state === 'rumour'
      ? h('span', { className: 'cmap-q' }, '?')
      : h('span', { className: 'cmap-text' },
        h('span', { className: 'cmap-name' }, card.subject.name),
        h('span', { className: 'cmap-dots' }, ...card.subject.facts.map((f) => h('i', { className: knows(f) ? 'on' : '' })))),
    card.state === 'complete' ? h('span', { className: 'cmap-laurel', title: 'Nothing left to learn here' }, '❦') : '',
    more ? h('span', { className: 'cmap-more', title: 'There is more here, and the way is open' }, '!') : '',
    pending ? h('span', { className: 'cmap-conclude', title: 'A conclusion to draw' }, '✎') : '',
    h('span', { className: 'cmap-new' }, 'new'));
    el.style.left = `${(p.x / W) * 100}%`;
    el.style.top = `${(p.y / H) * 100}%`;
    el.setAttribute('aria-label', card.state === 'rumour' ? 'A rumour' : `${card.subject.name}: ${card.found.length} of ${total}`);
    // Drag to move the card; a press that hardly moves is a click and opens it.
    let drag: { x: number; y: number; moved: boolean } | null = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.moved = true;
      el.classList.add('dragging');
      const r = board.getBoundingClientRect();
      const halfW = (CARD_W / W) * 50;
      const halfH = (CARD_H / H) * 50;
      const x = Math.min(100 - halfW, Math.max(halfW, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.min(100 - halfH, Math.max(halfH, ((e.clientY - r.top) / r.height) * 100));
      memory.mapLayout[card.subject.id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      drawArrows();
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      el.classList.remove('dragging');
      if (moved) hooks.onLayout();
      else show(card.subject.id);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { drag = null; el.classList.remove('dragging'); });
    // Keyboard: Enter or Space opens it, as a button should.
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        show(card.subject.id);
      }
    });
    cardEls.set(card.subject.id, el);
    board.append(el);
  }

  // Back to the cup's own arrangement.
  const tidy = h('button', { type: 'button', className: 'cmap-tidy', title: 'Put every card back where it was painted' }, 'Tidy up');
  tidy.addEventListener('click', () => {
    memory.mapLayout = {};
    for (const [id, el] of cardEls) {
      const p = at(id);
      el.style.left = `${(p.x / W) * 100}%`;
      el.style.top = `${(p.y / H) * 100}%`;
    }
    drawArrows();
    hooks.onLayout();
  });

  const hint = h('p', { className: 'cmap-drag-hint' }, 'Drag the cards to arrange them. ', tidy);
  const root = h('div', { className: 'cmap' }, h('div', { className: 'cmap-frame' }, board, hint), detail);
  if (selected) show(selected);
  return root;
}

function detailOf(card: Card, knows: (id: string) => boolean, text: (id: string) => string, memory: LoopMemory, fresh: Set<string>,
  hooks: MapHooks, rerender: () => void): (Node | string)[] {
  const out: (Node | string)[] = [];
  const next = nextOnCard(card.subject, knows);
  if (card.state === 'rumour') {
    out.push(h('h3', {}, '?'), h('p', { className: 'cmap-kicker' }, 'Heard of, not yet seen. What led here:'));
    out.push(h('ul', {}, ...card.heard.map((f) => h('li', {}, text(f)))));
  } else {
    const face = card.subject.face ? h('span', { className: 'cmap-detail-face' }, cloneCanvas(portrait(card.subject.face, 'vase'))) : '';
    out.push(h('h3', {}, face, card.subject.name));
    out.push(h('ul', {}, ...card.found.map((f) => h('li', { className: fresh.has(f) ? 'fresh' : '' }, text(f)))));
    if (card.state === 'complete') out.push(h('p', { className: 'cmap-kicker' }, 'Nothing left to learn here.'));
    else if (!next) out.push(h('p', { className: 'cmap-kicker' }, 'There is more here. Something elsewhere has to come first.'));
  }
  if (next) out.push(hintLine(next.clue, `map:${next.fact}`, memory.hintsShown));
  if (card.state !== 'rumour') {
    for (const d of deductionsFor(card.subject.id)) {
      if (!d.requires.every(knows)) continue;
      out.push(conclusion(d, memory, hooks, rerender));
    }
  }
  return out;
}

/** The same shuffle every time for the same sentence, so the words don't jump about between visits. */
function shuffled(words: string[], seed: string): string[] {
  let x = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const out = [...words];
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) >>> 0;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A sentence to complete: one choice per blank, then carve it. Wrong words are not kept, and cost nothing. */
function conclusion(d: Deduction, memory: LoopMemory, hooks: MapHooks, rerender: () => void): HTMLElement {
  const box = h('section', { className: 'cmap-conclusion' });
  const parts = d.sentence.split('___');
  if (memory.deductions.includes(d.id)) {
    const filled = parts.flatMap((p, i) => (i < d.blanks.length ? [p, h('b', {}, d.blanks[i]![0]!)] : [p]));
    box.append(h('p', { className: 'cmap-kicker' }, 'Concluded'), h('p', { className: 'cmap-sentence done' }, ...filled), h('p', { className: 'cmap-margin' }, d.margin));
    return box;
  }
  const selects = d.blanks.map((words, i) => {
    const s = h('select', { className: 'cmap-blank' }, h('option', { value: '' }, '…'), ...shuffled(words, d.id + i).map((w) => h('option', { value: w }, w)));
    s.setAttribute('aria-label', `Blank ${i + 1}`);
    return s;
  });
  const status = h('p', { className: 'cmap-kicker' });
  const carve = h('button', { type: 'button', className: 'cmap-carve' }, 'Carve it');
  carve.addEventListener('click', () => {
    const chosen = selects.map((s) => s.value);
    if (chosen.some((c) => !c)) {
      status.textContent = 'Every gap needs a word.';
      return;
    }
    if (!isRight(d, chosen)) {
      status.textContent = 'The wax will not hold it. Something in the sentence is not true.';
      return;
    }
    memory.deductions.push(d.id);
    hooks.onConclusion(d);
    rerender();
  });
  const sentence = parts.flatMap((p, i) => (i < selects.length ? [p, selects[i]!] : [p]));
  box.append(h('p', { className: 'cmap-kicker' }, 'A conclusion to draw'), h('p', { className: 'cmap-sentence' }, ...sentence), carve, status);
  return box;
}
