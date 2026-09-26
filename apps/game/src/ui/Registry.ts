// The registry page for one past Leont, and the overview of all six.
import { ATTEMPTS, FATES, PAST_LEONTS, type PastLeont } from '../content/leonts.ts';
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

export function registryOverview(memory: LoopMemory, inspected: string[], onChange: () => void): (Node | string)[] {
  const rows = PAST_LEONTS.filter((l) => inspected.includes(l.id) || memory.registry[l.id]);
  return [
    h('p', { className: 'registry-rule' }, 'Three correct identifications confirm one another. Wrong ones are never marked.'),
    ...(rows.length ? rows.map((l) => registryRow(memory, l, onChange)) : [h('p', {}, 'Click a carved scribe on the spiral to begin.')]),
  ];
}
