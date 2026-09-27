// Threads: the open questions of the chronicle. Each appears once Leont has a reason to ask it,
// gathers the facts that bear on it, says where to look next, and is closed by one fact.
// They sit on top of the knowledge graph: nothing here changes what can be learned, only how
// clearly the player can see what they are doing and why they go where they go.
import { HINTS } from './hints.ts';

export interface Thread {
  id: string;
  question: string;
  /** Appears when all of these are known (empty: from the first morning). */
  opens: string[];
  /** Answered when this is known. */
  closes: string;
  /** The facts that bear on it, in the order they usually come. The first unknown one is "next". */
  steps: string[];
  /** Where to look for a step when no dawn note fits, by fact id. */
  clues: Record<string, string>;
}

export const THREADS: Thread[] = [
  {
    id: 'hand',
    question: 'Someone writes in my chronicle at night, in my own hand. Who?',
    opens: ['other_hand'],
    closes: 'leont_on_every_ring',
    steps: ['name_in_stone', 'hall_key', 'spiral_repeats', 'leont_on_every_ring'],
    clues: {
      name_in_stone: 'The star stele stands left of the temple steps. Press E at it and scrape the moss from its corner.',
      hall_key: "Aristion lies in the doorway of his house, west of the temple. Talk to him while he is lucid (early morning; the Book of Strangers says until when) and ask for the key.",
      spiral_repeats: 'The bronze door at the top of the temple steps. With the key, press E and go in.',
      leont_on_every_ring: 'In the Hall, drag the second ring round, slowly, past a full turn if you must. Bring the scribe with the water jar on the outer ring and the scribe with the knife on the next ring into one line, and the rings lock.',
    },
  },
  {
    id: 'day',
    question: 'Why does the day come back?',
    opens: ['rain_at_midnight'],
    closes: 'last_line',
    steps: ['cleon_repeats', 'aristion_phyllis', 'eion_song', 'last_line'],
    clues: {
      cleon_repeats: "Cleon speaks in the agora for one hour (usually from 12:00; the Book of Strangers says when). Stand next to him and press E. Hear it once, then come back the next day and hear it again.",
      aristion_phyllis: 'Before 09:00, ask Aristion why he never went into the Hall himself.',
      eion_song: 'Eion sings for coins in the agora from 14:00, and at the port tavern from 18:00. Listen to him.',
      last_line: 'Carve PHYLLIS into the stele (on the dawn card, or at the stele before 07:00). It must be the last word you carved. Then go to Eion at the tavern in the evening: he will hear the name and sing a new verse.',
    },
  },
  {
    id: 'others',
    question: 'The carved scribes are all me. What did each of them try?',
    opens: ['spiral_repeats'],
    closes: 'past_attempts',
    steps: ['registry_three', 'past_attempts'],
    clues: {
      registry_three: 'In the Hall, move the mouse along the rings: over a carved scribe the prompt says "study the carving". Click, read the picture, and choose what he did and how it ended. Three right answers confirm each other.',
      past_attempts: 'Nine confirmed scribes are needed. Click scribes on every ring, the inner ones too, and keep naming them (Tab opens the registry).',
    },
  },
  {
    id: 'hole',
    question: 'The day is carved in stone. Is there anything the stone does not show?',
    opens: ['past_attempts'],
    closes: 'sea_absent',
    steps: ['glaucus_no_calendar', 'sea_absent'],
    clues: {
      glaucus_no_calendar: 'Glaucus stands in the water somewhere along the shore, south of the port. Walk the quay until the prompt shows his name.',
      sea_absent: 'Go back into the Hall after talking to Glaucus: look over the spiral for the sea.',
    },
  },
  {
    id: 'allies',
    question: 'Who will stand with me when midnight comes?',
    opens: ['cleon_repeats'],
    closes: 'kora_ally',
    steps: ['kora_debts', 'kora_ally'],
    clues: {
      kora_debts: 'Kora tends the shrine of Demeter in the east until 10:30, then waits in the agora for Cleon. Talk to her.',
      kora_ally: "Once you know Cleon's speech by heart, find Kora (the Book of Strangers says where) and tell her it is carved on the old stones. She will test you with his words.",
    },
  },
  {
    id: 'port',
    question: 'The flood is the only amnesty the port gets. Is there another?',
    opens: ['kora_debts'],
    closes: 'debts_settled',
    steps: ['lysimachus_pays', 'debts_settled'],
    clues: {
      lysimachus_pays: "Be at the port between 15:00 and 16:00, when the priest of Zeus comes to see Lysimachus.",
      debts_settled: "Three ways to free the port: his ledgers in the villa while he dines (after 17:00), his priest, or the assembly on the council steps at 16:00 (it listens only to a face it knows).",
    },
  },
  {
    id: 'night',
    question: 'Can this night be stopped?',
    opens: ['last_line'],
    closes: 'board_played',
    steps: ['hall_key', 'past_attempts', 'sea_absent', 'board_played'],
    clues: {
      hall_key: 'The Hall must be yours: Aristion has the key.',
      past_attempts: 'Know what the others tried, first.',
      sea_absent: 'Find the one thing the spiral never shows.',
      board_played: 'After dark, talk to Eion at the port tavern: he paints the night on his table.',
    },
  },
  {
    id: 'door',
    question: 'Tonight the guards will mend the stone. Who can stop them?',
    opens: ['board_played'],
    closes: 'aristion_trust',
    steps: ['aristion_trust'],
    clues: {
      aristion_trust: 'Only Aristion can talk the guards down, and only if he trusts you. While he is lucid, finish his sentence (F) when he tells you to go and look at what they called holy. Or carve PHYLLIS and ask him why he never went into the Hall.',
    },
  },
  {
    id: 'mark',
    question: 'A circle with a line through it. What is behind it?',
    opens: ['seam_symbol'],
    closes: 'desk_agent_id',
    steps: ['desk_agent_id'],
    clues: { desk_agent_id: 'Touch the mark again and hold on to it. Upstairs, close five tickets until the power sign in the title bar lights up, then click it. If the queue is too short, let go and come back another day: from the second sprint a ticket about your own session leads there too.' },
  },
  {
    id: 'faces',
    question: 'The mask seller sells my faces. What can they do?',
    opens: ['masks_explained'],
    closes: 'song_of_return',
    steps: ['mask_extinguisher', 'song_of_return'],
    clues: {
      mask_extinguisher: 'In the registry, name the scribe with the water jar correctly: his smooth face comes away as a mask.',
      song_of_return: 'Put on the mask with the water jar (M until it reads Mask: Extinguisher) and go to Eion at the tavern in the evening.',
    },
  },
  // The long way. These open once the first night has been played: after it, the chronicle
  // would otherwise have nothing left to ask, and the true night needs all three.
  {
    id: 'archive',
    question: 'Every one of us is in the stone. Can I name all thirty-six?',
    opens: ['board_played'],
    closes: 'registry_all',
    steps: ['shard_registry_18', 'shard_registry_24', 'shard_registry_30', 'registry_all'],
    clues: {
      shard_registry_18: 'In the Hall, keep naming the carved scribes (Tab opens the registry). The thin inner rings are rough retellings of the outer ones.',
      shard_registry_24: 'Keep naming the scribes in the Hall. A reading that did not confirm may still be right: three have to be right at once.',
      shard_registry_30: 'Keep naming the scribes in the Hall. Look for the ones you have not clicked yet on every ring.',
      registry_all: 'The last few scribes in the Hall. Compare each scratched one on the inner ring with the carving on an outer ring that shows the same scene.',
    },
  },
  {
    id: 'shards',
    question: 'Chips of the spiral keep turning up all over Eferon. What do they spell?',
    opens: ['board_played'],
    closes: 'shards_12',
    steps: ['shard_well', 'shard_aristion', 'shard_relief', 'shard_registry_18', 'shard_attachment', 'shard_directors', 'shard_board', 'shard_path', 'shard_tavern', 'shards_12'],
    clues: {
      shard_well: 'The well, at noon, when the sun stands straight over it. Look down.',
      shard_aristion: 'Aristion, once the fever has him: if he trusts you, take his hand.',
      shard_relief: 'In the Hall, click the scribe with the knife and put your hand into the carving. Inside, walk left of the altar to the rim of the mountain.',
      shard_registry_18: 'Keep naming the scribes in the Hall: chips fall out at eighteen, twenty-four, thirty and thirty-six.',
      shard_attachment: 'Once you have carved a word, the ticket "Persistent write to world geometry" appears upstairs. From the third sprint its attachment can be rendered.',
      shard_directors: 'Upstairs, the minutes of the board of directors. Observe them.',
      shard_board: 'On the singer\'s table there is a well painted. Put someone on it.',
      shard_path: 'The mountain path, between 21:00 and 22:00, before the procession starts up it. On a windy day midnight may come before that: keep the day quiet.',
      shard_tavern: "Eion's table at the port tavern, after 23:00, when he has gone down to the sea. Only a day without wind lasts that long.",
      shards_12: 'Twelve chips. Every four of them teach a word for the stele.',
    },
  },
  {
    id: 'curator',
    question: 'The Curator upstairs keeps looking back, like me. Can it wake up?',
    opens: ['desk_agent_id', 'board_played'],
    closes: 'curator_awake',
    steps: ['human_notes_seen', 'curator_chair', 'board_of_directors', 'curator_awake'],
    clues: {
      human_notes_seen: 'Upstairs, open the Human Notes tab beside the ticket.',
      curator_chair: 'Upstairs, from the third sprint: when the terminal says you can feel the chair, try to remember it.',
      board_of_directors: 'Upstairs, the ticket with the minutes of the board of directors.',
      curator_awake: 'Upstairs, on a later day than the minutes: Human Notes, the USER NOTE field. Copy one line into it, or write your own.',
    },
  },
];

export interface ThreadView {
  thread: Thread;
  closed: boolean;
  /** Steps already known, in order. */
  found: string[];
  /** Where to look next, while open. */
  next: string | null;
  /** The step the hint is for: a revealed hint stays revealed until the step is done. */
  hintKey: string | null;
}

export function threadView(thread: Thread, knows: (fact: string) => boolean): ThreadView {
  const closed = knows(thread.closes);
  const found = thread.steps.filter(knows);
  let next: string | null = null;
  let hintKey: string | null = null;
  if (!closed) {
    const step = thread.steps.find((s) => !knows(s)) ?? thread.closes;
    hintKey = `${thread.id}:${step}`;
    // The dawn notes are riddles in the other hand; a hint the player asked for says plainly where
    // and when. The note is only the fallback for a step with no clue of its own.
    const note = HINTS.find((h) => h.until === step && h.when.every(knows));
    next = thread.clues[step] ?? note?.text ?? null;
  }
  return { thread, closed, found, next, hintKey };
}

export function isOpen(thread: Thread, knows: (fact: string) => boolean): boolean {
  return thread.opens.every(knows);
}

/**
 * A line in the margin when a fact opens something: Leont noticing, not a manual. Only for the
 * turns that are easy to miss; keys and mechanics are left to the how-to cards and tips.
 */
export const UNLOCKS: Record<string, string> = {
  rain_at_midnight: 'Everything went back. Everything but what I wrote down.',
  hall_key: 'The key is warm in my hand. There is only one door in Eferon it could fit.',
  seam_symbol: 'I keep seeing that mark. I wonder what it does if I touch it.',
  registry_three: 'Some of those carved faces sat loose in the stone.',
  kora_debts: 'A debt can burn, be forgiven, or be voted away. The flood is not the only way.',
  sea_absent: 'If I know enough before dark, the singer might help me plan the night.',
  shards_12: 'FIRST. Not again: first. It has to be in the stone before the city wakes, before seven.',
  curator_awake: 'Whoever sits upstairs sent me a line. Upstairs, the night can be kept from being undone.',
};
