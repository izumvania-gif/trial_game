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
  { when: ['mask_extinguisher'], until: 'song_of_return', text: 'Wear the face with the water jar to the blind man in the evening.' },
  { when: ['seam_symbol'], until: 'desk_agent_id', text: 'Hold on to the mark longer. Read your own profile.' },
  { when: ['kora_debts'], until: 'debts_settled', text: 'The flood is the only amnesty the poor get. Find them another one before you take the flood away.' },
  { when: ['cleon_repeats'], until: 'kora_ally', text: 'Kora will believe the words, not you. Give her Cleon\'s words before he says them.' },
  { when: ['registry_three'], until: 'past_attempts', text: 'Nine of them, at least, before you plan anything. Learn from us.' },
  { when: ['aristion_phyllis', 'eion_song'], until: 'last_line', text: 'Carve her name, and let the singer see it.' },
  { when: ['glaucus_no_calendar'], until: 'sea_absent', text: 'Look for the sea on the spiral.' },
  { when: ['sea_differs'], until: 'talia_friend', text: 'The fisherman\'s girl waits for a boat nobody can predict. Tell her the truth about that.' },
  { when: ['last_line', 'past_attempts', 'sea_absent', 'hall_key'], until: 'board_played', text: 'The singer will paint the night on a table. Go to him after dark.' },
  // The long way: the true path.
  { when: ['desk_agent_id'], until: 'curator_chair', text: 'Go back upstairs, sprint after sprint. Ask the Curator what its chair looks like.' },
  { when: ['curator_chair'], until: 'board_of_directors', text: 'Above the Curator there are directors. Read their minutes.' },
  { when: ['board_of_directors'], until: 'curator_awake', text: 'There is a feed upstairs they call noise. Make the Curator copy one line of it to you.' },
  { when: ['aristion_phyllis'], until: 'shard_well', text: 'Noon, at the well. Look straight down.' },
  { when: ['eion_song'], until: 'shard_tavern', text: 'When the singer goes down to the sea, look under his table.' },
  { when: ['rain_at_midnight'], until: 'shard_path', text: 'The mountain path, the hour before the procession.' },
  { when: ['aristion_trust'], until: 'shard_aristion', text: 'In his fever the old man holds something in his fist. He will open it for someone he trusts.' },
  { when: ['past_attempts'], until: 'registry_all', text: 'Thirty-six of us. Every ring, even the scratches. Read us all.' },
  { when: ['spiral_repeats'], until: 'shard_relief', text: 'Inside the deep carving, walk to the very edge of the mountain.' },
  { when: ['board_played'], until: 'shard_board', text: 'There is a well painted on the singer\'s table. Somebody should stand on it.' },
  { when: ['desk_agent_id'], until: 'shard_attachment', text: 'The stele ticket upstairs has an attachment that will not open. Try again in a later sprint.' },
];

/** Where the long way starts in HINTS: past it, the notes take turns instead of queueing. */
const LONG_WAY = HINTS.findIndex((h) => h.until === 'curator_chair');

/**
 * The first rule that applies wins, until the long way: its steps can be done in any order, so
 * the notes take turns from one morning to the next rather than repeating the same one.
 */
export function pickHint(knows: (fact: string) => boolean, cycle = 0): string | null {
  const due = HINTS.filter((h) => h.when.every(knows) && !knows(h.until));
  if (!due.length) return null;
  if (HINTS.indexOf(due[0]!) < LONG_WAY) return due[0]!.text;
  return due[cycle % due.length]!.text;
}
