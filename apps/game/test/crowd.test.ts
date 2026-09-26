import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extraAt, makeCrowd } from '../src/content/crowd.ts';
import { at } from '../src/core/clock.ts';
import { PLACES } from '../src/core/streets.ts';

test('the crowd is the same every cycle', () => {
  assert.deepEqual(makeCrowd([]), makeCrowd([]));
});

test('at noon the crowd stands around Cleon; an earlier speech moves them too', () => {
  const near = (patches: string[], minute: number) =>
    makeCrowd(patches).filter((e) => {
      const s = extraAt(e, minute);
      return s.visible && !s.walking && Math.hypot(s.x - PLACES.agora.x, s.z - PLACES.agora.z) < 3;
    }).length;
  assert.ok(near([], at(12)) >= 15, 'most people listen at noon');
  assert.ok(near(['cleon_early'], at(11)) >= 15, 'and at eleven when the speech is patched earlier');
  assert.ok(near([], at(9)) < 10);
});

test('in the evening they are indoors; by midnight the procession is up the mountain and the rest stand watching', () => {
  const crowd = makeCrowd([]);
  const visible = (m: number) => crowd.filter((e) => extraAt(e, m).visible).length;
  assert.ok(visible(at(20)) < crowd.length / 2);
  const torches = crowd.filter((e) => extraAt(e, at(21, 50)).torch && extraAt(e, at(21, 50)).visible).length;
  assert.ok(torches >= 8, `a line of torches at 21:50, got ${torches}`);
  // Nobody with a torch is left in the city at midnight; those who stayed stand still and look at the mountain.
  const left = crowd.map((e) => extraAt(e, at(23, 59))).filter((s) => s.visible);
  assert.ok(left.length >= 8, `watchers at midnight, got ${left.length}`);
  for (const s of left) {
    assert.ok(s.watching && !s.walking && !s.torch);
    assert.ok(Math.abs(Math.abs(s.heading) - Math.PI) < 0.5, 'facing north, towards the mountain');
  }
});
