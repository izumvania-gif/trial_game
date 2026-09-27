import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOOKS } from '../src/content/looks.ts';
import { RESIDENTS } from '../src/content/residents.ts';

test('the scribe and every named resident have a look of their own, and no two look alike', () => {
  for (const id of ['leont', ...RESIDENTS.map((r) => r.id)]) assert.ok(LOOKS[id], `${id} has no look`);
  const seen = new Map<string, string>();
  for (const [id, look] of Object.entries(LOOKS)) {
    const key = JSON.stringify(look);
    assert.ok(!seen.has(key), `${id} looks like ${seen.get(key)}`);
    seen.set(key, id);
  }
});
