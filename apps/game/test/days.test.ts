import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daySummary } from '../src/content/days.ts';

test("a day's carving says what it did, what it looked into, what it cut, and how it ended", () => {
  assert.equal(
    daySummary({ learned: ['name_in_stone', 'hall_key', 'aristion_phyllis', 'spiral_repeats'], carved: 'PHYLLIS', reason: 'midnight', ending: null }),
    'Got the key to the Hall. Looked into Aristion and the Star Stele. Cut PHYLLIS into the stele. At midnight the city said Yes.',
  );
  // The big deeds come first, whatever order the day learned things in.
  assert.equal(
    daySummary({ learned: ['name_in_stone', 'kora_debts', 'lysimachus_pays', 'debts_settled', 'registry_three', 'past_attempts', 'desk_agent_id'], carved: null, reason: 'midnight', ending: null }),
    'Went up to the Desk, freed the port of its debts and named the scribes on the spiral. Looked into the Debts of the Port and the Carved Scribes. At midnight the city said Yes.',
  );
  assert.equal(daySummary({ learned: [], carved: null, reason: 'song', ending: null }), 'Learned nothing new. Folded the day shut with the Song.');
  assert.equal(daySummary({ learned: ['board_played'], carved: null, reason: 'ending', ending: 'sisyphus' }), "Played the night out on the singer's table. Looked into the Night of Anamnesis. It ended: Sisyphus.");
  assert.equal(daySummary({ learned: [], carved: null, reason: 'ending', ending: 'wake_pressed' }), 'Learned nothing new. Everything was done, and you pressed Wake.');
  // Mischief is carved too, and a day of nothing but trouble is not a day that learned nothing.
  assert.equal(
    daySummary({ learned: [], carved: null, reason: 'midnight', ending: null, mischief: { pot: 2, fish: 1, escaped: 1 } }),
    'Broke two amphorae, stole a fish and ran from the watch. At midnight the city said Yes.',
  );
});
