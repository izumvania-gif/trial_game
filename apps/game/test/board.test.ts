import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canPlace, simulate } from '../src/core/board.ts';

test('with no allies every enemy reaches its goal', () => {
  assert.deepEqual(simulate({}).outcome, { citySilent: false, hallClear: false, shoreClear: false });
});

test('the crossing: Kora at (1,1) holds both the priest and the merchant; Aristion holds both guards', () => {
  const { outcome } = simulate({ kora: [1, 1], aristion: [3, 2], eion: [3, 3] });
  assert.deepEqual(outcome, { citySilent: true, hallClear: true, shoreClear: true });
});

test('guards push past anyone but Aristion', () => {
  assert.equal(simulate({ kora: [3, 2], eion: [3, 1] }).outcome.hallClear, false);
});

test('nobody listens to a blind singer about the ritual', () => {
  assert.equal(simulate({ eion: [2, 1] }).outcome.citySilent, false);
});

test('allies cannot stand on landmarks or enemy starts', () => {
  assert.equal(canPlace([3, 0]), false);
  assert.equal(canPlace([0, 1]), false);
  assert.equal(canPlace([2, 2]), true);
});

test('counterplan: a loud day adds a third guard, still held by Aristion on the shared corridor', async () => {
  const { enemiesFor } = await import('../src/core/board.ts');
  const loud = enemiesFor(0.7);
  assert.equal(loud.length, 5);
  assert.equal(simulate({ kora: [1, 1], aristion: [3, 2] }, loud).outcome.hallClear, true);
  assert.equal(simulate({ kora: [1, 1], aristion: [5, 2] }, loud).outcome.hallClear, false);
});

test('Talia can stop the merchant but not the priest', () => {
  assert.equal(simulate({ talia: [2, 3] }).outcome.shoreClear, true);
  assert.equal(simulate({ talia: [2, 1] }).outcome.citySilent, false);
});

test('the priest of Zeus does not stop for Aristion: one tile under the Hall no longer solves two goals', () => {
  const { outcome } = simulate({ aristion: [3, 1], eion: [3, 3] });
  assert.deepEqual(outcome, { citySilent: false, hallClear: true, shoreClear: true });
});
