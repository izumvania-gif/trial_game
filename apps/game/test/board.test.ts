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
