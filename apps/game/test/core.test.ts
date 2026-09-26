import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY_MINUTES, DayClock, sundialHour } from '../src/core/clock.ts';
import { seededRng } from '../src/core/rng.ts';

test('the day runs from 06:00 to midnight and reports its end once', () => {
  const clock = new DayClock();
  assert.equal(clock.label(), '06:00');
  assert.equal(clock.tick(DAY_MINUTES - 1), false);
  assert.equal(clock.label(), '23:59');
  assert.equal(clock.tick(5), true);
  assert.equal(clock.tick(5), false, 'already over');
  assert.equal(clock.label(), '00:00');
});

test('paused clock does not move; spend() costs time', () => {
  const clock = new DayClock();
  clock.paused = true;
  clock.tick(100);
  assert.equal(clock.minute, 0);
  clock.spend(90);
  assert.equal(clock.label(), '07:30');
  assert.equal(sundialHour(clock.minute), 'II');
});

test('seeded rng replays the same day', () => {
  const a = seededRng(42);
  const b = seededRng(42);
  const seqA = Array.from({ length: 5 }, a);
  assert.deepEqual(seqA, Array.from({ length: 5 }, b));
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
});
