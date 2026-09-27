import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daySummary } from '../src/content/days.ts';

test("a day's carving says what it looked into, what it cut, and how it ended", () => {
  assert.equal(
    daySummary({ learned: ['name_in_stone', 'hall_key', 'aristion_phyllis', 'spiral_repeats'], carved: 'PHYLLIS', reason: 'midnight', ending: null }),
    'Looked into the Star Stele, Aristion and the Hall of Anamnesis. Cut PHYLLIS into the stele. At midnight the city said Yes.',
  );
  assert.equal(daySummary({ learned: [], carved: null, reason: 'song', ending: null }), 'Learned nothing new. Walked the city. Folded the day shut with the Song.');
  assert.equal(daySummary({ learned: ['board_played'], carved: null, reason: 'ending', ending: 'sisyphus' }), 'Looked into the Night of Anamnesis. It ended: Sisyphus.');
});
