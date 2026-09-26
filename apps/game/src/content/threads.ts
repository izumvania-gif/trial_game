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
      name_in_stone: 'The star stele by the temple. Read all of it, even the corner.',
      hall_key: 'Aristion, early, while he is still lucid.',
      spiral_repeats: 'The bronze door of the temple, with the key.',
      leont_on_every_ring: 'Turn the rings of the spiral until they line up.',
    },
  },
  {
    id: 'day',
    question: 'Why does the day come back?',
    opens: ['rain_at_midnight'],
    closes: 'last_line',
    steps: ['cleon_repeats', 'aristion_phyllis', 'eion_song', 'last_line'],
    clues: {
      cleon_repeats: "Cleon's speech in the agora, at noon.",
      aristion_phyllis: 'Ask Aristion about the well.',
      eion_song: 'Eion sings in the evening, at the tavern.',
      last_line: 'Eion knows a verse about Phyllis and a scribe.',
    },
  },
  {
    id: 'others',
    question: 'The carved scribes are all me. What did each of them try?',
    opens: ['spiral_repeats'],
    closes: 'past_attempts',
    steps: ['registry_three', 'past_attempts'],
    clues: {
      registry_three: 'Study the carved scribes on the spiral and name what each one did. Three true names confirm each other.',
      past_attempts: 'Keep naming them in the registry: nine at least.',
    },
  },
  {
    id: 'hole',
    question: 'The day is carved in stone. Is there anything the stone does not show?',
    opens: ['past_attempts'],
    closes: 'sea_absent',
    steps: ['glaucus_no_calendar', 'sea_absent'],
    clues: {
      glaucus_no_calendar: 'Glaucus, on the shore. He never stands in the same place.',
      sea_absent: 'Look for the sea on the spiral.',
    },
  },
  {
    id: 'allies',
    question: 'Who will stand with me when midnight comes?',
    opens: ['cleon_repeats'],
    closes: 'kora_ally',
    steps: ['kora_debts', 'kora_ally'],
    clues: {
      kora_debts: 'Kora, at the shrine of Demeter.',
      kora_ally: "Tell Kora what Cleon will say, before he says it.",
    },
  },
  {
    id: 'port',
    question: 'The flood is the only amnesty the port gets. Is there another?',
    opens: ['kora_debts'],
    closes: 'debts_settled',
    steps: ['lysimachus_pays', 'debts_settled'],
    clues: {
      lysimachus_pays: 'Follow Lysimachus through his day.',
      debts_settled: 'His ledgers, his priest, or the assembly: three ways to free the port.',
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
      board_played: 'Eion, at his table, after dark.',
    },
  },
  {
    id: 'mark',
    question: 'A circle with a line through it. What is behind it?',
    opens: ['seam_symbol'],
    closes: 'desk_agent_id',
    steps: ['desk_agent_id'],
    clues: { desk_agent_id: 'Where you see the mark, touch it. Stay there longer.' },
  },
  {
    id: 'faces',
    question: 'The mask seller sells my faces. What can they do?',
    opens: ['masks_explained'],
    closes: 'song_of_return',
    steps: ['mask_extinguisher', 'song_of_return'],
    clues: {
      mask_extinguisher: 'The registry: a Leont whose face was chiselled smooth.',
      song_of_return: 'Wear the smooth face to the blind singer in the evening.',
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
}

export function threadView(thread: Thread, knows: (fact: string) => boolean): ThreadView {
  const closed = knows(thread.closes);
  const found = thread.steps.filter(knows);
  let next: string | null = null;
  if (!closed) {
    const step = thread.steps.find((s) => !knows(s)) ?? thread.closes;
    // Prefer the dawn note written for exactly this step, if the player already qualifies for it.
    const note = HINTS.find((h) => h.until === step && h.when.every(knows));
    next = note?.text ?? thread.clues[step] ?? null;
  }
  return { thread, closed, found, next };
}

export function isOpen(thread: Thread, knows: (fact: string) => boolean): boolean {
  return thread.opens.every(knows);
}

/** What a newly learned fact makes possible, said plainly. Keyed by the fact that unlocks it. */
export const UNLOCKS: Record<string, string> = {
  hall_key: 'The bronze door of the temple will open for you.',
  spiral_repeats: 'You can come back to the Hall any day: the door stays yours.',
  seam_symbol: 'Where you see the mark, you can touch it.',
  registry_three: 'Name a carved Leont rightly and his face may come away from the stone as a mask.',
  mask_extinguisher: 'A smooth face came off the stone. M puts on a mask.',
  masks_explained: 'Masks you free from the registry can be worn: M.',
  song_of_return: 'R raises the lyre. The song ends the day early, whenever you choose.',
  kora_debts: 'The port\'s debts can be settled three ways: the ledgers, the priest, the assembly.',
  last_line: 'Once you know what the others tried and what the stone lacks, Eion will plan the night with you.',
  sea_absent: 'Eion will paint the night on his table after dark, if you also know the rest.',
  desk_agent_id: 'Upstairs is open to you now: the mark leads to the Desk.',
  rain_at_midnight: 'What you learn is kept. Everything else starts over at dawn.',
};
