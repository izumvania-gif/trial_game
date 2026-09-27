// The chronicle drawn as a map of subjects, painted like a cup: cards for what Leont has looked
// into, black figures with a question mark for what he has only heard of, and painted arrows for
// what led where. Click a card to read it.
import { deductionsFor, isRight, type Deduction } from '../content/deductions.ts';
import { chronicleMap, nextOnCard, openOnCard, type Card } from '../content/subjects.ts';
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
  /** What had been seen when the chronicle was opened, so switching tabs keeps the "new" marks. */
  seen?: string[];
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
  const body = h('div', { className: 'cmap-body', id: 'cmap-panel' });
  body.setAttribute('role', 'tabpanel');
  const modes = ['map', 'questions'] as const;
  const tabs = modes.map((m) => {
    const b = h('button', { type: 'button', className: 'cmap-tab', id: `cmap-tab-${m}` }, m === 'map' ? 'Map' : 'Questions');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'cmap-panel');
    b.addEventListener('click', () => render(m));
    // Left and right switch tabs, as tabs do; the game never sees them.
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      const other = modes[(modes.indexOf(m) + 1) % 2]!;
      render(other);
      tabs[modes.indexOf(other)]!.focus();
    });
    return b;
  });
  const render = (m: typeof mode) => {
    mode = m;
    tabs.forEach((b, i) => {
      const on = (i === 0) === (m === 'map');
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    body.setAttribute('aria-labelledby', `cmap-tab-${m}`);
    body.replaceChildren(...(m === 'map' ? [map()] : [h('div', { className: 'cmap-questions' }, ...questions())]));
  };
  render(mode);
  const bar = h('nav', { className: 'cmap-tabs' }, ...tabs);
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Chronicle');
  return h('div', { className: 'cmap-wrap' }, bar, body);
}

/** Which card is open, kept between openings of the chronicle within a day (a new day opens on what to do next). */
let selected: string | null = null;
let selectedOn = -1;
/** How close the map is drawn, and what it is searched for: kept between openings. */
const ZOOMS = [1, 1.25, 1.5, 2, 2.5];
let zoomAt = 0;
let query = '';

export function chronicleMapView(knowledge: Knowledge, facts: { id: string; text: string }[], memory: LoopMemory, hooks: MapHooks): HTMLElement {
  const hintsShown = memory.hintsShown;
  const knows = (id: string) => knowledge.knows(id);
  const text = (id: string) => facts.find((f) => f.id === id)?.text ?? '';
  const map = chronicleMap(knows);
  const visible = map.cards.filter((c) => c.state !== 'hidden');
  const byId = new Map(map.cards.map((c) => [c.subject.id, c]));

  const pendingOn = (id: string) => deductionsFor(id).some((d) => d.requires.every(knows) && !memory.deductions.includes(d.id));
  // Where next: every card with something to do, in turn — more to find first, then a rumour, then a conclusion.
  const todo = () => [
    ...visible.filter((c) => c.state === 'explored' && nextOnCard(c.subject, knows)),
    ...visible.filter((c) => c.state === 'rumour'),
    ...visible.filter((c) => c.state !== 'rumour' && pendingOn(c.subject.id)),
  ].map((c) => c.subject.id).filter((id, i, all) => all.indexOf(id) === i);
  // Open on the card that has something to do: on a new day, or if the last one is gone.
  if (selectedOn !== memory.cycle || !selected || !visible.some((c) => c.subject.id === selected)) {
    selected = todo()[0] ?? visible[0]?.subject.id ?? null;
    selectedOn = memory.cycle;
  }

  // New since the chronicle was last open: facts written since, and rumours first heard since.
  // Seen as of this opening of the chronicle (switching tabs does not use the marks up); a save
  // from before the map had no list, and then everything already known counts as seen.
  const seen = new Set(hooks.seen ?? (memory.mapSeen.length || knowledge.list().length <= 3 ? memory.mapSeen : knowledge.list()));
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
      if (a.from === selected || a.to === selected) path.classList.add('lit');
      path.dataset.ends = `${a.from} ${a.to}`;
      paths.append(path);
    }
  };
  drawArrows();
  board.append(lines);

  const detail = h('aside', { className: 'cmap-detail' });
  detail.setAttribute('aria-label', 'The open card');
  // What a screen reader hears when a card opens: its name, not the whole card again.
  const opened = h('p', { className: 'visually-hidden' });
  opened.setAttribute('role', 'status');
  const cardEls = new Map<string, HTMLElement>();
  const show = (id: string) => {
    selected = id;
    for (const [cid, el] of cardEls) {
      el.classList.toggle('selected', cid === id);
      if (cid === id) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
      el.tabIndex = cid === id ? 0 : -1;
    }
    // The open card's own arrows stand out; the rest step back.
    board.classList.add('focused');
    for (const p of paths.querySelectorAll<SVGPathElement>('.cmap-arrow')) p.classList.toggle('lit', (p.dataset.ends ?? '').split(' ').includes(id));
    opened.textContent = `Opened: ${nameOf(id)}`;
    const links = linksOf(id).map(({ to, how }) => {
      const b = h('button', { type: 'button', className: 'cmap-link' }, `${how === 'to' ? '→' : '←'} ${nameOf(to)}`);
      b.title = how === 'to' ? 'What this led to' : 'What led here';
      b.addEventListener('click', () => { show(to); focusCard(to); });
      return b;
    });
    detail.replaceChildren(...detailOf(byId.get(id)!, nameOf(id), knows, text, memory, fresh, hooks, links, () => { const el = cardEls.get(id); el?.classList.add('understood'); if (!pendingOn(id)) el?.querySelector('.cmap-conclude')?.remove(); show(id); }));
    cardEls.get(id)?.classList.remove('new');
    markIn(detail, query);
  };

  // Keyboard: one card in the Tab order (the open one); arrows walk the map from card to card.
  const focusCard = (id: string) => {
    for (const [cid, el] of cardEls) el.tabIndex = cid === id ? 0 : -1;
    cardEls.get(id)?.focus({ preventScroll: true });
    cardEls.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  // The way back: the opposite arrow returns to the card the last step came from.
  let lastStep: { from: string; to: string; dx: number; dy: number } | null = null;
  const nearest = (from: string, dx: number, dy: number): string | null => {
    if (lastStep && lastStep.to === from && lastStep.dx === -dx && lastStep.dy === -dy && cardEls.has(lastStep.from)) return lastStep.from;
    const a = place(from);
    let best: string | null = null;
    let bestScore = Infinity;
    for (const id of cardEls.keys()) {
      if (id === from) continue;
      const b = place(id);
      const along = (b.x - a.x) * dx + ((b.y - a.y) * dy * H) / 100;
      if (along <= 0.5) continue;
      const across = Math.abs((b.x - a.x) * dy) + Math.abs(((b.y - a.y) * dx * H) / 100);
      // Only what lies that way, within a cone; nothing there, no step.
      if (across > along * 1.2) continue;
      const score = along + across * 2;
      if (score < bestScore) { bestScore = score; best = id; }
    }
    return best;
  };
  const halfW = (CARD_W / W) * 50;
  const halfH = (CARD_H / H) * 50;
  const moveTo = (id: string, el: HTMLElement, x: number, y: number) => {
    x = Math.min(100 - halfW, Math.max(halfW, x));
    y = Math.min(100 - halfH, Math.max(halfH, y));
    memory.mapLayout[id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
  };
  let arrowsQueued = false;
  const redraw = () => {
    if (arrowsQueued) return;
    arrowsQueued = true;
    requestAnimationFrame(() => { arrowsQueued = false; drawArrows(); });
  };

  // What a screen reader says for a card: what it is, how far along, its marks, and where its arrows go.
  // A rumour is named after where it was heard of, so two of them do not sound the same.
  const rumourNames = new Map<string, string>();
  for (const c of visible.filter((v) => v.state === 'rumour')) {
    const from = map.arrows.find((a) => a.to === c.subject.id || (a.both && a.from === c.subject.id));
    const via = from ? byId.get(from.to === c.subject.id ? from.from : from.to)!.subject.name : 'somewhere';
    let name = `a rumour from ${via}`;
    for (let n = 2; [...rumourNames.values()].includes(name); n++) name = `a rumour from ${via} (${n})`;
    rumourNames.set(c.subject.id, name);
  }
  const nameOf = (id: string) => rumourNames.get(id) ?? byId.get(id)!.subject.name;
  const linksOf = (id: string) => [
    ...map.arrows.filter((a) => a.from === id || (a.both && a.to === id)).map((a) => ({ to: a.from === id ? a.to : a.from, how: 'to' as const })),
    ...map.arrows.filter((a) => a.to === id && !a.both).map((a) => ({ to: a.from, how: 'from' as const })),
  ];
  const spoken = (card: Card, total: number, marks: { more: boolean; pending: boolean; isNew: boolean }) => {
    const id = card.subject.id;
    const heardFrom = [...new Set(map.arrows.filter((a) => a.to === id || (a.both && a.from === id)).map((a) => (a.to === id ? a.from : a.to)))].map(nameOf);
    const leadsTo = map.arrows.filter((a) => a.from === id || (a.both && a.to === id)).map((a) => (a.from === id ? a.to : a.from)).map(nameOf);
    return [
      card.state === 'rumour' ? `${nameOf(id)}, heard of through ${heardFrom.join(', ') || 'something'}` : `${card.subject.name}, ${card.found.length} of ${total} facts`,
      card.state === 'complete' ? 'complete' : '',
      marks.more ? 'more to find' : '',
      marks.pending ? 'a conclusion to draw' : '',
      marks.isNew ? 'new' : '',
      card.state !== 'rumour' && leadsTo.length ? `leads to ${leadsTo.join(', ')}` : '',
    ].filter(Boolean).join('; ');
  };

  for (const card of visible) {
    const p = at(card.subject.id);
    const total = card.subject.facts.length;
    const more = card.state === 'explored' && !!nextOnCard(card.subject, knows);
    const pending = card.state !== 'rumour' && pendingOn(card.subject.id);
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
        h('span', { className: 'cmap-dots' }, ...card.subject.facts.map((f) => h('i', { className: knows(f) ? 'on' : '' })),
          // The laurel ends the row of dots, never sits over the name.
          card.state === 'complete' ? h('span', { className: 'cmap-laurel', title: 'Nothing left to learn here' }, '❦') : '')),
    more ? h('span', { className: 'cmap-more', title: 'There is more here, and the way is open' }, '!') : '',
    pending ? h('span', { className: 'cmap-conclude', title: 'A conclusion to draw' }, '✎') : '',
    h('span', { className: 'cmap-new' }, 'new'));
    el.style.left = `${(p.x / W) * 100}%`;
    el.style.top = `${(p.y / H) * 100}%`;
    el.setAttribute('aria-label', spoken(card, total, { more, pending, isNew: isNew(card) }));
    // Drag to move the card; a press that hardly moves is a click and opens it. The card keeps
    // the spot where it was taken hold of, and the board is measured once per drag.
    let drag: { x: number; y: number; dx: number; dy: number; board: DOMRect; moved: boolean } | null = null;
    let justDragged = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      justDragged = false;
      const r = board.getBoundingClientRect();
      const c = el.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, dx: e.clientX - (c.left + c.width / 2), dy: e.clientY - (c.top + c.height / 2), board: r, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.moved = true;
      el.classList.add('dragging');
      const r = drag.board;
      moveTo(card.subject.id, el, ((e.clientX - drag.dx - r.left) / r.width) * 100, ((e.clientY - drag.dy - r.top) / r.height) * 100);
      redraw();
    });
    // Arrow keys go to the nearest card that way; with Shift they move this card instead.
    // The game never sees them.
    el.addEventListener('keydown', (e) => {
      const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      const now = place(card.subject.id);
      if (e.shiftKey) {
        moveTo(card.subject.id, el, now.x + d[0]! * 2, now.y + d[1]! * 2);
        redraw();
        hooks.onLayout();
        return;
      }
      const next = nearest(card.subject.id, d[0]!, d[1]!);
      if (!next) return;
      lastStep = { from: card.subject.id, to: next, dx: d[0]!, dy: d[1]! };
      show(next);
      focusCard(next);
    });
    // The click that ends a drag is not a click; every other one (mouse, Enter, Space, a screen reader) opens the card.
    const end = () => {
      if (!drag) return;
      justDragged = drag.moved;
      drag = null;
      el.classList.remove('dragging');
      if (justDragged) hooks.onLayout();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { drag = null; el.classList.remove('dragging'); });
    el.addEventListener('click', () => {
      if (justDragged) {
        justDragged = false;
        return;
      }
      show(card.subject.id);
    });
    cardEls.set(card.subject.id, el);
    board.append(el);
  }

  // Back to the cup's own arrangement.
  const tidy = h('button', { type: 'button', className: 'cmap-tidy', title: 'Put every card back where it was painted' }, 'Tidy up');
  const lay = (layout: typeof memory.mapLayout) => {
    memory.mapLayout = layout;
    for (const [id, el] of cardEls) {
      const p = at(id);
      el.style.left = `${(p.x / W) * 100}%`;
      el.style.top = `${(p.y / H) * 100}%`;
    }
    drawArrows();
    hooks.onLayout();
  };
  const undo = h('button', { type: 'button', className: 'cmap-tidy', hidden: true }, 'Undo');
  let before: typeof memory.mapLayout = {};
  tidy.addEventListener('click', () => {
    before = { ...memory.mapLayout };
    lay({});
    undo.hidden = Object.keys(before).length === 0;
  });
  undo.addEventListener('click', () => {
    lay(before);
    undo.hidden = true;
    tidy.focus();
  });

  const legend = h('span', { className: 'cmap-legend' }, h('b', {}, '!'), ' more to find · ✎ conclusion · ? rumour · ', h('b', {}, '❦'), ' done · ● a fact · NEW since last time · dashed: to a rumour · faint: settled');
  const keys = h('span', { id: 'cmap-keys' }, 'Arrows go from card to card; drag, or Shift + arrows, to move one. ');
  const hint = h('div', { className: 'cmap-drag-hint' }, h('p', {}, keys, tidy, undo), legend);
  const nextBtn = h('button', { type: 'button', className: 'cmap-next' }, 'Where next?');
  nextBtn.title = 'Open the next card that has something to do';
  const nextNote = h('span', { className: 'cmap-next-note' });
  nextNote.setAttribute('role', 'status');
  nextBtn.addEventListener('click', () => {
    const ids = todo();
    if (!ids.length) {
      nextNote.textContent = 'Nothing points anywhere new. Walk the city at another hour.';
      return;
    }
    const at = ids.indexOf(selected ?? '');
    const n = (at + 1) % ids.length;
    const id = ids[n]!;
    const card = byId.get(id)!;
    const what = card.state === 'rumour' ? 'heard of, not yet seen' : nextOnCard(card.subject, knows) ? 'more to find' : 'a conclusion to draw';
    nextNote.textContent = `${n + 1} of ${ids.length}: ${what} — ${nameOf(id)}`;
    show(id);
    // Asking where next is asking for the hint: it is shown at once.
    detail.querySelector<HTMLButtonElement>('.hint-button')?.click();
    focusCard(id);
  });
  // Zoom: the board grows inside a window that scrolls; card labels grow with it.
  const viewport = h('div', { className: 'cmap-viewport' });
  const zoomLabel = h('span', { className: 'cmap-zoom-level' });
  const zoomOut = h('button', { type: 'button', className: 'cmap-zoom', title: 'Zoom out (−)' }, '−');
  const zoomIn = h('button', { type: 'button', className: 'cmap-zoom', title: 'Zoom in (+)' }, '+');
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomIn.setAttribute('aria-label', 'Zoom in');
  const zoom = (to: number, keep?: string) => {
    zoomAt = Math.max(0, Math.min(ZOOMS.length - 1, to));
    board.style.width = `${ZOOMS[zoomAt]! * 100}%`;
    zoomLabel.textContent = `${Math.round(ZOOMS[zoomAt]! * 100)}%`;
    zoomOut.disabled = zoomAt === 0;
    zoomIn.disabled = zoomAt === ZOOMS.length - 1;
    viewport.classList.toggle('zoomed', zoomAt > 0);
    // Keep the card being looked at in view.
    const id = keep ?? selected;
    if (id) requestAnimationFrame(() => cardEls.get(id)?.scrollIntoView({ block: 'center', inline: 'center' }));
  };
  zoomOut.addEventListener('click', () => zoom(zoomAt - 1));
  zoomIn.addEventListener('click', () => zoom(zoomAt + 1));
  // Ctrl + wheel zooms (as a map does); a plain wheel scrolls the zoomed map.
  viewport.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom(zoomAt + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  // Find: cards whose name, or whose written facts, hold the words light up; the rest step back.
  const find = h('input', { type: 'search', className: 'cmap-find', placeholder: 'Find… (/)', value: query });
  find.setAttribute('aria-label', 'Find in the chronicle');
  const found = h('span', { className: 'cmap-found' });
  found.setAttribute('role', 'status');
  const matchesOf = (q: string) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    return visible.filter((c) => {
      const hay = [c.state === 'rumour' ? nameOf(c.subject.id) : c.subject.name, ...(c.state === 'rumour' ? c.heard : c.found).map(text)].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    }).map((c) => c.subject.id);
  };
  const applyFind = () => {
    query = find.value;
    const hits = matchesOf(query);
    board.classList.toggle('finding', !!hits);
    for (const [id, el] of cardEls) el.classList.toggle('match', !!hits?.includes(id));
    found.textContent = hits ? (hits.length ? `${hits.length} ${hits.length === 1 ? 'card' : 'cards'}` : 'Not written anywhere') : '';
    if (selected) markIn(detail, query);
    return hits;
  };
  find.addEventListener('input', () => { applyFind(); });
  find.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Enter opens the next card that matches.
      const hits = applyFind() ?? [];
      if (!hits.length) return;
      const id = hits[(hits.indexOf(selected ?? '') + 1) % hits.length]!;
      show(id);
      focusCard(id);
      e.preventDefault();
    } else if (e.key === 'Escape' && find.value) {
      // Esc empties the box first; a second Esc closes the chronicle.
      e.stopPropagation();
      find.value = '';
      applyFind();
    }
  });
  // From anywhere on the map: / to find, + and − to zoom.
  const onKeys = (e: KeyboardEvent) => {
    if (e.target === find) return;
    if (e.key === '/') { e.preventDefault(); e.stopPropagation(); find.focus(); find.select(); }
    else if (e.key === '+' || e.key === '=') { e.stopPropagation(); zoom(zoomAt + 1); }
    else if (e.key === '-' || e.key === '_') { e.stopPropagation(); zoom(zoomAt - 1); }
  };

  const bar = h('div', { className: 'cmap-toolbar' }, nextBtn, nextNote, h('span', { className: 'cmap-tools' }, find, found, zoomOut, zoomLabel, zoomIn));
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', `Map of subjects, ${visible.length} cards`);
  board.setAttribute('aria-describedby', 'cmap-keys');
  viewport.append(board);
  const root = h('div', { className: 'cmap' }, h('div', { className: 'cmap-frame' }, bar, viewport, hint), detail, opened);
  // Heard from anywhere while the map is on screen (focus may still be on the page itself).
  const winKeys = (e: KeyboardEvent) => {
    if (!root.isConnected) return window.removeEventListener('keydown', winKeys, true);
    if (!root.offsetParent || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    onKeys(e);
  };
  window.addEventListener('keydown', winKeys, true);
  zoom(zoomAt);
  applyFind();
  if (selected) show(selected);
  // Opening the chronicle puts the keyboard on the open card, so arrows and Enter work at once.
  if (selected) {
    const id = selected;
    window.setTimeout(() => { if (root.isConnected) cardEls.get(id)?.focus({ preventScroll: true }); }, 0);
  }
  return root;
}

function detailOf(card: Card, name: string, knows: (id: string) => boolean, text: (id: string) => string, memory: LoopMemory, fresh: Set<string>,
  hooks: MapHooks, links: HTMLElement[], rerender: () => void): (Node | string)[] {
  const out: (Node | string)[] = [];
  const next = nextOnCard(card.subject, knows);
  if (card.state === 'rumour') {
    out.push(h('h3', {}, '? ', h('small', {}, name)), h('p', { className: 'cmap-kicker' }, 'Heard of, not yet seen. What led here:'));
    out.push(h('ul', {}, ...card.heard.map((f) => h('li', {}, text(f)))));
  } else {
    const face = card.subject.face ? h('span', { className: 'cmap-detail-face' }, cloneCanvas(portrait(card.subject.face, 'vase'))) : '';
    out.push(h('h3', {}, face, card.subject.name));
    out.push(h('ul', {}, ...card.found.map((f) => h('li', { className: fresh.has(f) ? 'fresh' : '' }, text(f)))));
    if (card.state === 'complete') out.push(h('p', { className: 'cmap-kicker' }, 'Nothing left to learn here.'));
    else if (!next && openOnCard(card.subject, knows)) out.push(h('p', { className: 'cmap-kicker' }, 'There is more here, and the way is open, but nobody will point you to it. Look around.'));
    else if (!next) out.push(h('p', { className: 'cmap-kicker' }, 'There is more here. Something elsewhere has to come first.'));
  }
  if (next) out.push(hintLine(next.clue, `map:${next.fact}`, memory.hintsShown));
  // The arrows, in words and as buttons: the way to follow a thread without the mouse.
  if (links.length) out.push(h('div', { className: 'cmap-links' }, h('span', { className: 'cmap-kicker' }, 'Connected: '), ...links));
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
    box.dataset.concluded = d.id;
    box.tabIndex = -1;
    return box;
  }
  const selects = d.blanks.map((words, i) => {
    const s = h('select', { className: 'cmap-blank' }, h('option', { value: '' }, '…'), ...shuffled(words, d.id + i).map((w) => h('option', { value: w }, w)));
    s.setAttribute('aria-label', `Gap ${i + 1} of ${d.blanks.length}`);
    return s;
  });
  const status = h('p', { className: 'cmap-kicker' });
  status.setAttribute('role', 'status');
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
    // Keep the keyboard where the sentence was: on the sentence, now carved.
    document.querySelector<HTMLElement>(`[data-concluded="${d.id}"]`)?.focus();
  });
  const sentence = parts.flatMap((p, i) => (i < selects.length ? [p, selects[i]!] : [p]));
  const line = h('p', { className: 'cmap-sentence' }, ...sentence);
  line.setAttribute('role', 'group');
  line.setAttribute('aria-label', d.sentence.replace(/___/g, 'blank'));
  box.append(h('p', { className: 'cmap-kicker' }, 'A conclusion to draw'), line, carve, status);
  return box;
}

/** Mark the searched words in the open card's facts. */
function markIn(detail: HTMLElement, q: string): void {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  for (const li of detail.querySelectorAll<HTMLElement>('li')) {
    const text = (li.dataset.text ??= li.textContent ?? '');
    li.replaceChildren();
    if (!words.length) { li.append(text); continue; }
    const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    for (const part of text.split(re)) li.append(part && words.includes(part.toLowerCase()) ? h('mark', {}, part) : part);
  }
}
