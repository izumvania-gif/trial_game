import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { STAGE_CONTROLS, STAGE_GUIDES, TIPS } from '../src/content/guides.ts';
import { PORTRAIT_IDS, portraitFor } from '../src/ui/portraits.ts';

const storyDir = new URL('../../../story/', import.meta.url);

test('every ink speaker has a portrait and a nameplate', () => {
  const speakers = new Set<string>();
  for (const file of readdirSync(storyDir).filter((f) => f.endsWith('.ink'))) {
    const lines = readFileSync(new URL(file, storyDir), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//'));
    for (const m of lines.join('\n').matchAll(/#speaker:([^#\n]+)/g)) speakers.add(m[1]!.trim());
  }
  assert.ok(speakers.size > 10);
  for (const s of speakers) {
    const info = portraitFor(s);
    assert.ok(info, `no portrait for #speaker:${s}`);
    assert.ok(PORTRAIT_IDS.includes(info.id), `portrait id ${info.id} is not drawn`);
    assert.ok(info.name.length > 0);
  }
});

test('narration has no portrait', () => {
  assert.equal(portraitFor(null), null);
  assert.equal(portraitFor('Nobody in particular'), null);
});

test('guides have steps and unique ids', () => {
  const ids = [...Object.values(STAGE_GUIDES), ...Object.values(TIPS)].map((g) => g!.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const g of Object.values(STAGE_GUIDES)) assert.ok(g!.steps.length >= 2, g!.id);
  for (const line of Object.values(STAGE_CONTROLS)) for (const part of line!.split(' · ')) assert.match(part, / — /);
});
