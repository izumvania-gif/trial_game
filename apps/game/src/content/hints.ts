// Dawn notes in the slanted hand. When the player is stuck, the chronicle already holds a line
// "they" wrote last night — picked from what the player knows, first rule that applies wins.
export interface Hint {
  /** All of these must be known... */
  when: string[];
  /** ...and this must not be, or the hint is stale. */
  until: string;
  text: string;
}

export const HINTS: Hint[] = [
  { when: [], until: 'name_in_stone', text: "Don't look at the sky. Look into the stone." },
  { when: ['name_in_stone'], until: 'hall_key', text: 'The old priest keeps the key. He is lucid only until the fourth hour.' },
  { when: ['hall_key'], until: 'spiral_repeats', text: 'The door was never the hard part.' },
  { when: ['spiral_repeats'], until: 'registry_three', text: 'Read the carvings the way you read the stars: all of them, twice. Three true names confirm each other.' },
  { when: ['rain_at_midnight'], until: 'cleon_repeats', text: 'Listen to Cleon at the seventh hour. Then listen again tomorrow.' },
  { when: ['mask_extinguisher'], until: 'song_of_return', text: 'Wear the smooth face to the blind man in the evening.' },
  { when: ['seam_symbol'], until: 'desk_agent_id', text: 'Hold on to the mark longer. Read your own profile.' },
  { when: ['kora_debts'], until: 'debts_settled', text: 'The flood is the only amnesty the poor get. Find them another one before you take the flood away.' },
  { when: ['cleon_repeats'], until: 'kora_ally', text: 'Kora will believe the words, not you. Give her Cleon\'s words before he says them.' },
  { when: ['registry_three'], until: 'past_attempts', text: 'Nine of them, at least, before you plan anything. Learn from us.' },
  { when: ['aristion_phyllis', 'eion_song'], until: 'last_line', text: 'Carve her name, and let the singer see it.' },
  { when: ['glaucus_no_calendar'], until: 'sea_absent', text: 'Look for the sea on the spiral.' },
  { when: ['sea_differs'], until: 'talia_friend', text: 'The fisherman\'s girl waits for a boat nobody can predict. Tell her the truth about that.' },
  { when: ['last_line', 'past_attempts', 'sea_absent', 'hall_key'], until: 'board_played', text: 'The singer will paint the night on a table. Go to him after dark.' },
];

export function pickHint(knows: (fact: string) => boolean): string | null {
  const hint = HINTS.find((h) => h.when.every(knows) && !knows(h.until));
  return hint?.text ?? null;
}
