import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KNOWLEDGE } from '../src/content/knowledge.ts';
import { chronicleMap, nextOnCard, SUBJECTS } from '../src/content/subjects.ts';
import { validateGraph } from '../src/core/knowledge.ts';

test('every fact sits on exactly one card of the chronicle map', () => {
  const seen = new Map<string, string>();
  for (const s of SUBJECTS) {
    for (const f of s.facts) {
      assert.ok(!seen.has(f), `${f} is on ${seen.get(f)} and ${s.id}`);
      seen.set(f, s.id);
    }
  }
  for (const f of KNOWLEDGE.facts) assert.ok(seen.has(f.id), `${f.id} is on no card`);
  assert.equal(seen.size, KNOWLEDGE.facts.length);
});

test('cards do not sit on top of each other', () => {
  for (const a of SUBJECTS) {
    for (const b of SUBJECTS) {
      if (a === b) continue;
      const apart = Math.abs(a.x - b.x) >= 14 || Math.abs(a.y - b.y) >= 20;
      assert.ok(apart, `${a.id} and ${b.id} overlap`);
    }
  }
});

test('the first morning shows where to go: the other hand, and a rumour of the stele', () => {
  const map = chronicleMap((id) => id === 'other_hand');
  const state = (id: string) => map.cards.find((c) => c.subject.id === id)!.state;
  assert.equal(state('hand'), 'complete');
  assert.equal(state('stele'), 'rumour');
  assert.ok(map.arrows.some((a) => a.from === 'hand' && a.to === 'stele'));
});

test('learning everything explores every card; along the way an open card always says where to look', () => {
  const { reachable } = validateGraph(KNOWLEDGE);
  const known = new Set<string>();
  for (const f of reachable) {
    known.add(f);
    const knows = (id: string) => known.has(id);
    for (const card of chronicleMap(knows).cards) {
      if (card.state !== 'explored') continue;
      // A card may wait on another (its next fact needs something from elsewhere), but never forever.
      const next = nextOnCard(card.subject, knows);
      if (next) assert.ok(next.clue.length > 10, `${card.subject.id}: empty clue`);
    }
  }
  const end = chronicleMap((id) => known.has(id));
  for (const c of end.cards) assert.equal(c.state, 'complete', `${c.subject.id} never completes`);
});

test('every conclusion sits on a real card, needs real facts, and has one word list per gap', async () => {
  const { DEDUCTIONS, isRight } = await import('../src/content/deductions.ts');
  const facts = new Set(KNOWLEDGE.facts.map((f) => f.id));
  const { reachable } = validateGraph(KNOWLEDGE);
  for (const d of DEDUCTIONS) {
    assert.ok(SUBJECTS.some((s) => s.id === d.subject), `${d.id}: no card ${d.subject}`);
    for (const f of d.requires) assert.ok(facts.has(f) && reachable.includes(f), `${d.id}: ${f}`);
    assert.equal(d.sentence.split('___').length - 1, d.blanks.length, `${d.id}: gaps`);
    for (const words of d.blanks) assert.equal(new Set(words).size, words.length, `${d.id}: repeated word`);
    assert.ok(isRight(d, d.blanks.map((w) => w[0]!)));
    assert.ok(!isRight(d, d.blanks.map((w) => w[1]!)));
  }
});
