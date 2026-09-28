// The chronicle as a map of subjects (after Outer Wilds' rumour mode). Every fact belongs to one
// subject; a known fact that leads to a fact of another subject draws an arrow between them. A
// subject nobody has explored yet, but that an arrow points to, is shown as a rumour: a black
// figure with a question mark. Nothing here decides what can be learned — it only draws it.
import { KNOWLEDGE } from './knowledge.ts';
import { THREADS } from './threads.ts';

export interface Subject {
  id: string;
  name: string;
  /** Where the card sits on the map, in percent of its width and height. */
  x: number;
  y: number;
  facts: string[];
  /** The portrait on the card, for a subject that is a person. */
  face?: string;
}

export const SUBJECTS: Subject[] = [
  { id: 'hand', name: 'The Other Hand', x: 9, y: 10, facts: ['other_hand'] },
  { id: 'midnight', name: 'Midnight', x: 27, y: 10, facts: ['rain_at_midnight', 'last_line'] },
  { id: 'stele', name: 'The Star Stele', x: 9, y: 40, facts: ['name_in_stone'] },
  { id: 'aristion', name: 'Aristion', x: 20, y: 70, facts: ['aristion_phyllis', 'hall_key', 'aristion_trust', 'shard_aristion'], face: 'aristion' },
  { id: 'hall', name: 'The Hall of Anamnesis', x: 34, y: 38, facts: ['spiral_repeats', 'leont_on_every_ring', 'seam_symbol', 'sea_absent', 'shard_relief'] },
  { id: 'scribes', name: 'The Carved Scribes', x: 50, y: 12, facts: ['registry_three', 'past_attempts', 'shard_registry_18', 'shard_registry_24', 'shard_registry_30', 'shard_registry_36', 'registry_all'] },
  { id: 'masks', name: 'The Masks', x: 50, y: 40, facts: ['masks_explained', 'mask_extinguisher', 'mask_orator', 'mask_killer', 'mask_blank'], face: 'maskseller' },
  { id: 'cleon', name: 'Cleon', x: 36, y: 66, facts: ['cleon_repeats'], face: 'cleon' },
  { id: 'kora', name: 'Kora', x: 50, y: 70, facts: ['kora_debts', 'kora_ally'], face: 'kora' },
  { id: 'port', name: 'The Debts of the Port', x: 50, y: 92, facts: ['lysimachus_pays', 'hierocles_paid', 'debts_burned', 'debts_released', 'debts_reformed', 'debts_settled'], face: 'lysimachus' },
  { id: 'eion', name: 'Eion', x: 66, y: 66, facts: ['eion_song', 'eion_was_leont', 'song_of_return', 'shard_tavern', 'eion_blessing'], face: 'eion' },
  { id: 'sea', name: 'The Sea', x: 84, y: 90, facts: ['glaucus_no_calendar', 'sea_differs', 'talia_boat', 'talia_friend'], face: 'glaucus' },
  { id: 'night', name: 'The Night of Anamnesis', x: 84, y: 64, facts: ['board_played', 'shard_board'] },
  { id: 'shards', name: 'Chips of the Spiral', x: 22, y: 92, facts: ['shard_well', 'shard_path', 'shards_4', 'shards_8', 'shards_12'] },
  { id: 'desk', name: 'The Desk Upstairs', x: 68, y: 12, facts: ['desk_agent_id', 'reset_by_user', 'human_notes_seen', 'shard_attachment'] },
  { id: 'curator', name: 'The Curator', x: 88, y: 12, facts: ['curator_chair', 'board_of_directors', 'shard_directors', 'curator_awake'], face: 'curator' },
  { id: 'xenos', name: 'Xenos', x: 70, y: 38, facts: ['xenos_offer'], face: 'xenos' },
];

const subjectOf = new Map<string, string>();
for (const s of SUBJECTS) for (const f of s.facts) subjectOf.set(f, s.id);

export function subjectOfFact(fact: string): string | undefined {
  return subjectOf.get(fact);
}

/** A fact that leads to another: from the ways facts are learned, and the order the questions ask them. */
interface Lead {
  from: string;
  to: string;
}

function leads(): Lead[] {
  const out: Lead[] = [];
  // The shard words are a count, not a rumour: every chip would point at them.
  const counts = new Set(['shards_4', 'shards_8', 'shards_12']);
  for (const src of KNOWLEDGE.sources) for (const from of src.requires) for (const to of src.gives) if (!counts.has(to)) out.push({ from, to });
  // A question points at its first step even when nothing needs to be known to take it
  // (the first morning's note points at the stele).
  for (const t of THREADS) for (const from of t.opens) out.push({ from, to: t.steps[0]! });
  return out.filter((l) => subjectOf.get(l.from) !== subjectOf.get(l.to) && subjectOf.has(l.from) && subjectOf.has(l.to));
}

const LEADS = leads();

/** Where to look for a fact, in plain words: the clues of the chronicle's questions. */
const CLUES = new Map<string, string>();
for (const t of THREADS) for (const [fact, text] of Object.entries(t.clues)) if (!CLUES.has(fact)) CLUES.set(fact, text);

export type CardState = 'hidden' | 'rumour' | 'explored' | 'complete';

export interface Card {
  subject: Subject;
  state: CardState;
  found: string[];
  /** Known facts elsewhere that point here. */
  heard: string[];
}

export interface Arrow {
  from: string;
  to: string;
  /** Leads run both ways between these two subjects: one line, a head at each end. */
  both: boolean;
  /** Both ends are done: the lead is history now, drawn faint. */
  settled: boolean;
}

export interface ChronicleMap {
  cards: Card[];
  arrows: Arrow[];
}

/** The shards are a question of the true path: the map keeps quiet about them until the first night is played. */
const quietShard = (fact: string, knows: (fact: string) => boolean) => fact.startsWith('shard_') && !knows('board_played');

export function chronicleMap(knows: (fact: string) => boolean): ChronicleMap {
  const live = LEADS.filter((l) => knows(l.from) && !quietShard(l.to, knows));
  const cards = SUBJECTS.map((subject): Card => {
    const found = subject.facts.filter(knows);
    const heard = [...new Set(live.filter((l) => subjectOf.get(l.to) === subject.id).map((l) => l.from))];
    const state: CardState = found.length === subject.facts.length ? 'complete' : found.length ? 'explored' : heard.length ? 'rumour' : 'hidden';
    return { subject, state, found, heard };
  });
  const shown = new Set(cards.filter((c) => c.state !== 'hidden').map((c) => c.subject.id));
  const arrows: Arrow[] = [];
  for (const l of live) {
    const from = subjectOf.get(l.from)!;
    const to = subjectOf.get(l.to)!;
    if (!shown.has(from) || !shown.has(to) || arrows.some((a) => a.from === from && a.to === to)) continue;
    const back = arrows.find((a) => a.from === to && a.to === from);
    if (back) back.both = true;
    else arrows.push({ from, to, both: false, settled: false });
  }
  const done = new Set(cards.filter((c) => c.state === 'complete').map((c) => c.subject.id));
  for (const a of arrows) a.settled = done.has(a.to) && (done.has(a.from) || !a.both);
  return { cards, arrows };
}

/**
 * Where to look next for a subject: the first fact of it not yet known whose way in is open
 * (everything one of its sources needs is known), with the plain clue for it. Null when nothing
 * here can be found yet, or nothing is left.
 */
export function nextOnCard(subject: Subject, knows: (fact: string) => boolean): { fact: string; clue: string } | null {
  for (const fact of subject.facts) {
    if (knows(fact) || quietShard(fact, knows)) continue;
    const open = KNOWLEDGE.sources.some((s) => s.gives.includes(fact) && s.requires.every(knows));
    const clue = CLUES.get(fact);
    if (open && clue) return { fact, clue };
  }
  return null;
}

/** Something on this card can be found now, though no question points to it (so it is not "blocked"). */
export function openOnCard(subject: Subject, knows: (fact: string) => boolean): boolean {
  return subject.facts.some((fact) => !knows(fact) && !quietShard(fact, knows)
    && KNOWLEDGE.sources.some((s) => s.gives.includes(fact) && s.requires.every(knows)));
}
