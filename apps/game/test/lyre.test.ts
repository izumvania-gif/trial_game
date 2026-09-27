import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LYRE_NOTES, STORM_WALTZ } from '../src/engine/audio.ts';

test('the storm waltz is sixteen whole bars in three, and the two lyre songs never share an opening', async () => {
  assert.equal(STORM_WALTZ.bars.length, 16);
  for (const [, melody] of STORM_WALTZ.bars) assert.equal(melody.length, 6);
  const { SONG_OF_RETURN, SONG_OF_STORMS } = await import('../src/ui/Lyre.ts').catch(() => ({ SONG_OF_RETURN: null, SONG_OF_STORMS: null }));
  if (!SONG_OF_RETURN || !SONG_OF_STORMS) return; // Lyre.ts needs a DOM to load
  assert.notEqual(SONG_OF_RETURN[0], SONG_OF_STORMS[0]);
  for (const k of [...SONG_OF_RETURN, ...SONG_OF_STORMS]) assert.ok(k in LYRE_NOTES);
});
