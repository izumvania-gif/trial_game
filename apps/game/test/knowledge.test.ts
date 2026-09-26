import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KNOWLEDGE } from '../src/content/knowledge.ts';
import { Knowledge, validateGraph } from '../src/core/knowledge.ts';

test('knowledge graph: no dangling ids, every fact and ending reachable', () => {
  assert.deepEqual(validateGraph(KNOWLEDGE).errors, []);
});

test('validator catches an unreachable ending', () => {
  const report = validateGraph({
    facts: [{ id: 'a', text: '' }, { id: 'b', text: '' }],
    sources: [{ id: 's', stage: 'town', requires: ['b'], gives: ['a'] }],
    endings: [{ id: 'e', title: '', requires: ['a'] }],
  });
  assert.ok(report.errors.some((e) => e.includes('ending "e" is unreachable')));
  assert.ok(report.errors.some((e) => e.includes('fact "b" is unreachable')));
});

test('Knowledge.learn reports new facts once and rejects unknown ids', () => {
  const learned: string[] = [];
  const k = new Knowledge(KNOWLEDGE, [], (f) => learned.push(f.id));
  assert.equal(k.learn('other_hand'), true);
  assert.equal(k.learn('other_hand'), false);
  assert.deepEqual(learned, ['other_hand']);
  assert.throws(() => k.learn('nope'));
});

test('dawn hints only mention real facts, and there is always one for a new player', async () => {
  const { HINTS, pickHint } = await import('../src/content/hints.ts');
  const ids = new Set(KNOWLEDGE.facts.map((f) => f.id));
  for (const h of HINTS) for (const f of [...h.when, h.until]) assert.ok(ids.has(f), `hint uses unknown fact ${f}`);
  assert.ok(pickHint(() => false));
});

test('every mask comes from a Leont who carries it', async () => {
  const { MASKS } = await import('../src/content/masks.ts');
  const { PAST_LEONTS } = await import('../src/content/leonts.ts');
  for (const [name, m] of Object.entries(MASKS)) assert.equal(PAST_LEONTS.find((l) => l.id === m.from)?.mask, name);
});

test('every ending in the graph has a card, except the true ending (the epilogue replaces it)', async () => {
  const { ENDINGS } = await import('../src/content/endings.ts');
  for (const e of KNOWLEDGE.endings) {
    if (e.trueEnding) continue;
    assert.ok(ENDINGS[e.id], `no ending card for ${e.id}`);
  }
  for (const id of Object.keys(ENDINGS)) assert.ok(KNOWLEDGE.endings.some((e) => e.id === id), `card ${id} missing from graph`);
});
