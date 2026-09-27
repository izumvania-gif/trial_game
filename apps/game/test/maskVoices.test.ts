import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { MASKS } from '../src/content/masks.ts';
import { MASK_VOICES } from '../src/content/maskVoices.ts';

test('the masks that talk are real masks, and speak before knots that exist', () => {
  const dir = resolve(import.meta.dirname, '../../../story');
  const knots = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ink'))) {
    for (const m of readFileSync(resolve(dir, f), 'utf8').matchAll(/^===\s*(\w+)/gm)) knots.add(m[1]!);
  }
  for (const [mask, lines] of Object.entries(MASK_VOICES)) {
    assert.ok(MASKS[mask], `no mask ${mask}`);
    for (const knot of Object.keys(lines)) assert.ok(knots.has(knot), `${mask}: no knot ${knot}`);
  }
});
