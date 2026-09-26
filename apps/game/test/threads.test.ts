import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KNOWLEDGE } from '../src/content/knowledge.ts';
import { isOpen, threadView, THREADS, UNLOCKS } from '../src/content/threads.ts';
import { validateGraph } from '../src/core/knowledge.ts';

const facts = new Set(KNOWLEDGE.facts.map((f) => f.id));

test('threads and unlock notes only name real facts', () => {
  for (const t of THREADS) {
    for (const id of [...t.opens, t.closes, ...t.steps, ...Object.keys(t.clues)]) assert.ok(facts.has(id), `${t.id}: unknown fact ${id}`);
  }
  for (const id of Object.keys(UNLOCKS)) assert.ok(facts.has(id), `UNLOCKS: unknown fact ${id}`);
});

test('every thread opens and can be answered, and says where to look while it is open', () => {
  const { reachable } = validateGraph(KNOWLEDGE);
  for (const t of THREADS) {
    // Walk the greedy learning order: the thread must open, then close, and always have a next step in between.
    const known = new Set<string>();
    let opened = false;
    for (const f of reachable) {
      known.add(f);
      const knows = (id: string) => known.has(id);
      if (!isOpen(t, knows)) continue;
      opened = true;
      const view = threadView(t, knows);
      if (view.closed) break;
      assert.ok(view.next, `${t.id}: nothing to say after ${f}`);
    }
    assert.ok(opened, `${t.id} never opens`);
    assert.ok(known.has(t.closes), `${t.id} is never answered`);
  }
});

test('the first morning already has a question', () => {
  const knows = (id: string) => id === 'other_hand';
  assert.ok(THREADS.some((t) => isOpen(t, knows) && !threadView(t, knows).closed));
});
