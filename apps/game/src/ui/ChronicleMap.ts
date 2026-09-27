// The chronicle drawn as a map of subjects, painted like a cup: cards for what Leont has looked
// into, black figures with a question mark for what he has only heard of, and painted arrows for
// what led where. Click a card to read it.
import { chronicleMap, nextOnCard, type Card } from '../content/subjects.ts';
import type { Knowledge } from '../core/knowledge.ts';
import { hintLine } from './Book.ts';
import { h } from './dom.ts';

/** The map's own coordinates: 100 wide, 60 high; a card is CARD_W × CARD_H of them. */
const W = 100;
const H = 60;
const CARD_W = 14;
const CARD_H = 7.4;

const at = (card: Card) => ({ x: card.subject.x, y: (card.subject.y / 100) * H });

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

export function chronicleMapView(knowledge: Knowledge, facts: { id: string; text: string }[], hintsShown: string[]): HTMLElement {
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

  const board = h('div', { className: 'cmap-board' });
  const lines = svg('svg', { class: 'cmap-lines', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const defs = svg('defs', {});
  const marker = svg('marker', { id: 'cmap-head', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
  marker.append(svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'cmap-head' }));
  defs.append(marker);
  lines.append(defs);
  for (const a of map.arrows) {
    const from = at(byId.get(a.from)!);
    const to = at(byId.get(a.to)!);
    const [x1, y1] = edgePoint(to.x, to.y, from.x, from.y);
    const [x2, y2] = edgePoint(from.x, from.y, to.x, to.y);
    // A painter's line: bowed a little, never ruled.
    const mx = (x1 + x2) / 2 - (y2 - y1) * 0.12;
    const my = (y1 + y2) / 2 + (x2 - x1) * 0.12;
    const rumour = byId.get(a.to)!.state === 'rumour';
    const path = svg('path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, class: `cmap-arrow${rumour ? ' to-rumour' : ''}${a.settled ? ' settled' : ''}`, 'marker-end': 'url(#cmap-head)' });
    if (a.both) path.setAttribute('marker-start', 'url(#cmap-head)');
    lines.append(path);
  }
  board.append(lines);

  const detail = h('aside', { className: 'cmap-detail' });
  const cardEls = new Map<string, HTMLElement>();
  const show = (id: string) => {
    selected = id;
    for (const [cid, el] of cardEls) el.classList.toggle('selected', cid === id);
    detail.replaceChildren(...detailOf(byId.get(id)!, knows, text, hintsShown));
  };

  for (const card of visible) {
    const p = at(card);
    const total = card.subject.facts.length;
    const el = h('button', {
      type: 'button',
      className: `cmap-card ${card.state}`,
      title: card.state === 'rumour' ? 'Heard of, not yet seen' : card.subject.name,
    },
    card.state === 'rumour'
      ? h('span', { className: 'cmap-q' }, '?')
      : h('span', { className: 'cmap-name' }, card.subject.name),
    card.state === 'rumour' ? '' : h('span', { className: 'cmap-dots' }, ...card.subject.facts.map((f) => h('i', { className: knows(f) ? 'on' : '' }))),
    card.state === 'complete' ? h('span', { className: 'cmap-laurel', title: 'Nothing left to learn here' }, '❦') : '');
    el.style.left = `${(p.x / W) * 100}%`;
    el.style.top = `${(p.y / H) * 100}%`;
    el.setAttribute('aria-label', card.state === 'rumour' ? 'A rumour' : `${card.subject.name}: ${card.found.length} of ${total}`);
    el.addEventListener('click', () => show(card.subject.id));
    cardEls.set(card.subject.id, el);
    board.append(el);
  }

  const root = h('div', { className: 'cmap' }, h('div', { className: 'cmap-frame' }, board), detail);
  if (selected) show(selected);
  return root;
}

function detailOf(card: Card, knows: (id: string) => boolean, text: (id: string) => string, hintsShown: string[]): (Node | string)[] {
  const out: (Node | string)[] = [];
  const next = nextOnCard(card.subject, knows);
  if (card.state === 'rumour') {
    out.push(h('h3', {}, '?'), h('p', { className: 'cmap-kicker' }, 'Heard of, not yet seen. What led here:'));
    out.push(h('ul', {}, ...card.heard.map((f) => h('li', {}, text(f)))));
  } else {
    out.push(h('h3', {}, card.subject.name));
    out.push(h('ul', {}, ...card.found.map((f) => h('li', {}, text(f)))));
    if (card.state === 'complete') out.push(h('p', { className: 'cmap-kicker' }, 'Nothing left to learn here.'));
    else if (!next) out.push(h('p', { className: 'cmap-kicker' }, 'There is more here. Something elsewhere has to come first.'));
  }
  if (next) out.push(hintLine(next.clue, `map:${next.fact}`, hintsShown));
  return out;
}
