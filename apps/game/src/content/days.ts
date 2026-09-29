// The player's own days, carved (after Inscryption's death cards: a failed run comes back as a
// card made of you). Every reset leaves a record of what this Leont did before the day came back:
// which subjects he looked into, the word he cut, and how the day ended. It is shown on the reset
// screen as the relief sinks, and in the registry, after the thirty-six, as the player's own ring.
import { mischiefWords } from './barks.ts';
import { trialById } from './trials.ts';
import { ENDINGS } from './endings.ts';
import { SUBJECTS, subjectOfFact } from './subjects.ts';

export interface DayRecord {
  cycle: number;
  summary: string;
  /** The carved last frame, small, as an image URL. */
  relief?: string;
}

/** How many of the player's days the stone keeps. */
export const DAYS_KEPT = 8;

export interface DayFacts {
  /** Facts first learned this day. */
  learned: string[];
  /** The word cut into the stele this day, if any. */
  carved: string | null;
  reason: 'midnight' | 'song' | 'ending';
  /** The ending that closed the day, when reason is 'ending'. */
  ending: string | null;
  /** Mischief done in the street, by kind (content/barks.ts). */
  mischief?: Record<string, number>;
  /** What the day noticed (CycleState.noticed): the levers pulled among them are carved too. */
  noticed?: string[];
  /** The trainer's trials won that day. */
  trials?: string[];
}

/** Levers: the fixed day changed by the scribe's hand (see stages/town/places.ts and TownStage.lever). */
const LEVERS: [string, string][] = [
  ['cleon_silent', 'kept Cleon from his speech'],
  ['runner_fell', 'tripped the third runner'],
  ['press_stopped', 'stopped the olive press'],
];

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The day's deeds worth carving, most telling first: the day is remembered by what was done in it,
 * not by the first things it happened to learn.
 */
const DEEDS: [string, string][] = [
  ['curator_awake', 'woke the Curator'],
  ['registry_all', 'named all thirty-six'],
  ['shards_12', 'found the last chip'],
  ['board_played', "played the night out on the singer's table"],
  ['desk_agent_id', 'went up to the Desk'],
  ['debts_settled', 'freed the port of its debts'],
  ['past_attempts', 'named the scribes on the spiral'],
  ['sea_absent', 'saw there is no sea on the spiral'],
  ['kora_ally', 'won Kora over'],
  ['last_line', "heard the singer's new verse"],
  ['song_of_return', 'learned the Song of Return'],
  ['hall_key', 'got the key to the Hall'],
];

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** One line for a day: what it did, what it looked into, what it cut, how it ended. */
export function daySummary(day: DayFacts): string {
  const deeds = DEEDS.filter(([fact]) => day.learned.includes(fact)).slice(0, 3).map(([, text]) => text);
  // Subjects by how much the day learned about them; a tie goes to the one looked into first.
  const count = new Map<string, number>();
  for (const f of day.learned) {
    const sub = subjectOfFact(f);
    if (sub) count.set(sub, (count.get(sub) ?? 0) + 1);
  }
  const subjects = [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, deeds.length ? 2 : 3)
    .map(([id]) => SUBJECTS.find((s) => s.id === id)!.name.replace(/^The /, 'the '));
  const parts: string[] = [];
  if (deeds.length) parts.push(`${capital(list(deeds))}.`);
  const mischief = [
    ...(day.trials ?? []).map((id) => trialById(id)?.won).filter((t): t is string => !!t),
    ...LEVERS.filter(([id]) => day.noticed?.includes(id)).map(([, t]) => t),
    ...mischiefWords(day.mischief ?? {}),
  ];
  if (subjects.length) parts.push(`Looked into ${list(subjects)}.`);
  else if (!deeds.length && !mischief.length) parts.push('Learned nothing new.');
  if (mischief.length) parts.push(`${capital(list(mischief))}.`);
  if (day.carved) parts.push(`Cut ${day.carved} into the stele.`);
  if (day.reason === 'song') parts.push('Folded the day shut with the Song.');
  else if (day.reason === 'ending' && day.ending === 'wake_pressed') parts.push('Everything was done, and you pressed Wake.');
  else if (day.reason === 'ending' && day.ending) parts.push(`It ended: ${ENDINGS[day.ending]?.title ?? day.ending}.`);
  else parts.push('At midnight the city said Yes.');
  return parts.join(' ');
}
