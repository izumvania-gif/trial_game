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
