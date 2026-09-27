// The registry page for one past Leont, and the overview of all six.
import { ATTEMPTS, ATTEMPTS_SHORT, FATES, PAST_LEONTS, type PastLeont } from '../content/leonts.ts';
import type { LoopMemory } from '../core/save.ts';
import { h } from './dom.ts';

const RING_NAMES = ['outer ring', 'second ring', 'third ring', 'inner ring'];

function roman(n: number): string {
  const table: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

function select(options: Record<string, string>, value: string | null, disabled: boolean, onChange: (v: string) => void): HTMLSelectElement {
  const el = h('select', { disabled });
  el.append(h('option', { value: '' }, '— ? —'), ...Object.entries(options).map(([k, v]) => h('option', { value: k, selected: k === value }, v)));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

export function registryRow(memory: LoopMemory, leont: PastLeont, onChange: () => void): HTMLElement {
  const entry = (memory.registry[leont.id] ??= { attempt: null, ending: null, locked: false });
  const index = PAST_LEONTS.indexOf(leont) + 1;
  return h('div', { className: `registry-row${entry.locked ? ' locked' : ''}` },
    h('span', { className: 'registry-name' }, `Leont ${roman(index)}`, h('small', {}, ` · ${RING_NAMES[leont.ring]}`)),
    h('span', {}, 'He ', select(ATTEMPTS, entry.attempt, entry.locked, (v) => {
      entry.attempt = v || null;
      onChange();
    })),
    h('span', {}, 'and ', select(FATES, entry.ending, entry.locked, (v) => {
      entry.ending = v || null;
      onChange();
    })),
    entry.locked ? h('span', { className: 'registry-seal' }, 'confirmed') : '',
  );
}

/**
 * The thirty-six as one history (after Heaven's Vault's timeline): the scratches of the inner ring
 * first, the outer ring last, and then the one reading it. A confirmed Leont says what he tried.
 */
export function registryTimeline(memory: LoopMemory): HTMLElement {
  const byRing = [3, 2, 1, 0].map((ring) => PAST_LEONTS.map((l, i) => ({ l, n: i + 1 })).filter((x) => x.l.ring === ring).sort((a, b) => b.n - a.n));
  const ringLabel = ['the outer ring · latest', 'second ring', 'third ring', 'the scratches · oldest'];
  const groups = byRing.map((cells, gi) => h('div', { className: 'regline-group' },
    h('span', { className: 'regline-ring' }, ringLabel[3 - gi]!),
    h('div', { className: 'regline-cells' }, ...cells.map(({ l, n }) => {
      const e = memory.registry[l.id];
      const tried = e?.locked ? ATTEMPTS[l.attempt]! : '';
      const cell = h('span', { className: `regline-cell${e?.locked ? ' known' : e ? ' seen' : ''}` },
        h('b', {}, roman(n)), h('small', {}, e?.locked ? ATTEMPTS_SHORT[l.attempt] ?? '' : e ? '…' : '?'));
      cell.title = e?.locked ? `Leont ${roman(n)}: ${tried}, and ${FATES[l.fate]}` : `Leont ${roman(n)}: not yet named`;
      return cell;
    }))));
  // Then the player's own ring: every day already lived, carved from its last frame, and today.
  const mine = memory.days.slice(-8).map((d) => {
    const cell = h('span', { className: 'regline-cell mine' },
      d.relief ? h('img', { src: d.relief, alt: '' }) : '', h('small', {}, `day ${d.cycle}`));
    cell.title = `Day ${d.cycle}. ${d.summary}`;
    return cell;
  });
  const last = memory.days[memory.days.length - 1];
  return h('div', { className: 'regline' }, ...groups,
    h('div', { className: 'regline-group' }, h('span', { className: 'regline-ring' }, 'you · your own days'),
      h('div', { className: 'regline-cells' }, ...mine, h('span', { className: 'regline-cell you' }, h('b', {}, 'Today'), h('small', {}, `day ${memory.cycle}`)))),
    last ? h('p', { className: 'regline-last' }, `Yesterday's carving: ${last.summary}`) : '');
}

export function registryOverview(memory: LoopMemory, inspected: string[], onChange: () => void): (Node | string)[] {
  const rows = PAST_LEONTS.filter((l) => inspected.includes(l.id) || memory.registry[l.id]);
  return [
    registryTimeline(memory),
    h('p', { className: 'registry-rule' }, 'Three correct identifications confirm one another. Wrong ones are never marked.'),
    ...(rows.length ? rows.map((l) => registryRow(memory, l, onChange)) : [h('p', {}, 'Click a carved scribe on the spiral to begin.')]),
  ];
}
