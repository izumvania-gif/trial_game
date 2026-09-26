import assert from 'node:assert/strict';
import { test } from 'node:test';
import { at } from '../src/core/clock.ts';
import { glitchesFor, wearLevel } from '../src/core/wear.ts';

test('the first days are clean, and the day wears more every loop', () => {
  assert.equal(glitchesFor(1).length, 0);
  assert.equal(glitchesFor(2).length, 0);
  assert.ok(glitchesFor(3).length >= 1);
  assert.ok(glitchesFor(20).length > glitchesFor(5).length);
  assert.ok(wearLevel(40) === 1 && wearLevel(1) === 0);
});

test('glitches are fixed by the cycle, in order, inside the waking day', () => {
  assert.deepEqual(glitchesFor(12), glitchesFor(12));
  assert.notDeepEqual(glitchesFor(12), glitchesFor(13));
  const g = glitchesFor(30);
  for (let i = 1; i < g.length; i++) assert.ok(g[i]!.minute >= g[i - 1]!.minute);
  for (const x of g) assert.ok(x.minute >= at(7) && x.minute < at(23));
});

test('the strong glitches only come once the day is worn', () => {
  for (let c = 3; c < 6; c++) assert.ok(glitchesFor(c).every((x) => x.kind === 'stutter' || x.kind === 'freeze'));
  const late = Array.from({ length: 20 }, (_, i) => glitchesFor(20 + i)).flat();
  assert.ok(late.some((x) => x.kind === 'hitch') && late.some((x) => x.kind === 'mark'));
});
