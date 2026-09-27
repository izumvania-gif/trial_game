// The player's own days, carved (after Inscryption's death cards: a failed run comes back as a
// card made of you). Every reset leaves a record of what this Leont did before the day came back:
// which subjects he looked into, the word he cut, and how the day ended. It is shown on the reset
// screen as the relief sinks, and in the registry, after the thirty-six, as the player's own ring.
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
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One line for a day: what it looked into, what it cut, how it ended. */
export function daySummary(day: DayFacts): string {
  const subjects = [...new Set(day.learned.map(subjectOfFact).filter((s): s is string => !!s))]
    .map((id) => SUBJECTS.find((s) => s.id === id)!.name.replace(/^The /, 'the '))
    .slice(0, 3);
  const parts: string[] = [];
  parts.push(subjects.length ? `Looked into ${list(subjects)}.` : 'Learned nothing new.');
  if (day.carved) parts.push(`Cut ${day.carved} into the stele.`);
  if (day.reason === 'song') parts.push('Folded the day shut with the Song.');
  else if (day.reason === 'ending' && day.ending === 'wake_pressed') parts.push('Everything was done, and you pressed Wake.');
  else if (day.reason === 'ending' && day.ending) parts.push(`It ended: ${ENDINGS[day.ending]?.title ?? day.ending}.`);
  else parts.push('At midnight the city said Yes.');
  return parts.join(' ');
}
