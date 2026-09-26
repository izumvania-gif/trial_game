import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAST_LEONTS } from '../src/content/leonts.ts';
import { confirmEntries, lockedCount } from '../src/core/registry.ts';
import type { RegistryEntry } from '../src/core/types.ts';

const right = (id: string): RegistryEntry => {
  const l = PAST_LEONTS.find((x) => x.id === id)!;
  return { attempt: l.attempt, ending: l.fate, locked: false };
};

test('two correct entries confirm nothing; the third locks all three', () => {
  const reg: Record<string, RegistryEntry> = { l1: right('l1'), l2: right('l2') };
  assert.deepEqual(confirmEntries(reg), []);
  reg.l3 = right('l3');
  assert.deepEqual(confirmEntries(reg).sort(), ['l1', 'l2', 'l3']);
  assert.equal(lockedCount(reg), 3);
});

test('a wrong entry is not revealed and does not lock', () => {
  const reg: Record<string, RegistryEntry> = {
    l1: right('l1'), l2: right('l2'), l3: { attempt: 'moved_date', ending: 'stoned', locked: false },
  };
  assert.deepEqual(confirmEntries(reg), []);
  assert.equal(reg.l3!.locked, false);
});

test('twelve Leonts, four per ring, spaced apart, each attempt unique', () => {
  assert.equal(PAST_LEONTS.length, 12);
  assert.equal(new Set(PAST_LEONTS.map((l) => l.attempt)).size, PAST_LEONTS.length);
  for (let ring = 0; ring < 3; ring++) {
    const angles = PAST_LEONTS.filter((l) => l.ring === ring).map((l) => l.angle).sort((a, b) => a - b);
    assert.equal(angles.length, 4);
    for (let i = 0; i < angles.length; i++) {
      const next: number = i + 1 < angles.length ? angles[i + 1]! : angles[0]! + Math.PI * 2;
      assert.ok(next - angles[i]! > 0.9, `ring ${ring}: scribes too close together`);
    }
  }
});
