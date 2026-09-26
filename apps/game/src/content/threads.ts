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
      hall_key: "Aristion lies in the doorway of his house, west of the temple. Talk to him before 09:00, while he is lucid, and ask for the key.",
      spiral_repeats: 'The bronze door at the top of the temple steps. With the key, press E and go in.',
      leont_on_every_ring: 'In the Hall, drag the outer ring round, slowly. On the outer ring and the one inside it the same small scribe with a stylus is carved, looking up. Bring the two into one line and the rings lock.',
    },
  },
  {
    id: 'day',
    question: 'Why does the day come back?',
    opens: ['rain_at_midnight'],
    closes: 'last_line',
    steps: ['cleon_repeats', 'aristion_phyllis', 'eion_song', 'last_line'],
    clues: {
      cleon_repeats: "Cleon speaks in the agora between 12:00 and 13:00. Stand next to him and press E. Hear it once, then come back the next day and hear it again.",
      aristion_phyllis: 'Before 09:00, ask Aristion why he never went into the Hall himself.',
      eion_song: 'Eion sings for coins in the agora from 14:00, and at the port tavern from 18:00. Listen to him.',
      last_line: 'At dawn, carve PHYLLIS into the stele. Then go to Eion at the tavern after 18:00: he will hear the name and sing a new verse.',
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
      past_attempts: 'Nine confirmed scribes are needed. Turn the rings to bring more of them into view, the thin inner ring too, and keep naming them (Tab opens the registry).',
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
      kora_ally: "Once you know Cleon's speech by heart, find Kora before noon and tell her it is carved on the old stones. She will test you with his words.",
    },
  },
  {
    id: 'port',
    question: 'The flood is the only amnesty the port gets. Is there another?',
    opens: ['kora_debts'],
    closes: 'debts_settled',
    steps: ['lysimachus_pays', 'debts_settled'],
    clues: {
      lysimachus_pays: "Be at the port around 15:00, when the priest of Zeus comes to see Lysimachus.",
      debts_settled: "Three ways to free the port: his ledgers in the villa, his priest, or the assembly on the council steps at 16:00 (it listens only to a face it knows).",
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
    id: 'mark',
    question: 'A circle with a line through it. What is behind it?',
    opens: ['seam_symbol'],
    closes: 'desk_agent_id',
    steps: ['desk_agent_id'],
    clues: { desk_agent_id: 'Touch the mark again and hold on to it. Upstairs, close five tickets until the power sign in the title bar lights up, then click it.' },
  },
  {
    id: 'faces',
    question: 'The mask seller sells my faces. What can they do?',
    opens: ['masks_explained'],
    closes: 'song_of_return',
    steps: ['mask_extinguisher', 'song_of_return'],
    clues: {
      mask_extinguisher: 'In the registry, name the scribe with the water jar correctly: his smooth face comes away as a mask.',
      song_of_return: 'Put on the smooth mask (M) and go to Eion at the tavern after 18:00.',
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
};
