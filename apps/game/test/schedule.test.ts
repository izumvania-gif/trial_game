import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESIDENTS } from '../src/content/residents.ts';
import { at } from '../src/core/clock.ts';
import { residentAt } from '../src/core/schedule.ts';
import { PLACES, route } from '../src/core/streets.ts';

const kora = RESIDENTS.find((r) => r.id === 'kora')!;
const cleon = RESIDENTS.find((r) => r.id === 'cleon')!;

test('every place is reachable from every other', () => {
  for (const a of Object.keys(PLACES)) {
    for (const b of Object.keys(PLACES)) {
      const path = route(a as keyof typeof PLACES, b as keyof typeof PLACES);
      assert.deepEqual(path[path.length - 1], PLACES[b as keyof typeof PLACES], `${a} → ${b}`);
    }
  }
});

test('residents follow their schedule and walk between places', () => {
  assert.deepEqual([residentAt(kora, 0, []).x, residentAt(kora, 0, []).z], [PLACES.shrine.x, PLACES.shrine.z]);
  const walking = residentAt(kora, at(10, 15), []);
  assert.equal(walking.walking, true);
  const arrived = residentAt(kora, at(12), []);
  assert.equal(arrived.walking, false);
  assert.deepEqual([arrived.x, arrived.z], [PLACES.agora.x, PLACES.agora.z]);
});

test('a patch changes the day: cleon_early moves the speech to 11:00', () => {
  assert.equal(residentAt(cleon, at(11, 30), []).entryIndex, 0);
  assert.equal(residentAt(cleon, at(11, 30), ['cleon_early']).entryIndex, 1);
});

test('everyone is where the Book says at the time it says: the schedule is of arrivals', () => {
  for (const r of RESIDENTS) {
    const entries = r.schedule([]);
    entries.forEach((e, i) => {
      if (i === 0) return;
      const s = residentAt(r, e.from, []);
      assert.equal(s.entryIndex, i, `${r.id} ${e.place}`);
      assert.equal(s.walking, false, `${r.id} is still walking to ${e.place} at the time the Book gives`);
    });
  }
});
