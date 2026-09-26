// Who lives the last day, where and when. The Book of Strangers is built from these entries.
import { at } from '../core/clock.ts';
import type { Place } from '../core/streets.ts';

export type ResidentId = 'aristion' | 'kora' | 'cleon' | 'eion';

export interface ScheduleEntry {
  /** Game minute this entry starts; the resident then walks to `place`. */
  from: number;
  place: Place;
  /** What the Book of Strangers records once the player has seen it. */
  note: string;
  /** Lying down (Aristion's fever), hidden (gone up the mountain). */
  pose?: 'standing' | 'lying';
}

export interface Resident {
  id: ResidentId;
  name: string;
  epithet: string;
  color: string;
  /** Ink knot run when the player talks to them. */
  knot: string;
  /** Fact that reveals their trouble in the Book, and how it reads. */
  trouble: { fact: string; text: string };
  schedule(patches: string[]): ScheduleEntry[];
}

export const RESIDENTS: Resident[] = [
  {
    id: 'aristion',
    name: 'Aristion',
    epithet: 'old priest of Apollo, sick',
    color: '#2a1c14',
    knot: 'aristion',
    trouble: { fact: 'aristion_phyllis', text: 'Every Golden Age his dead wife Phyllis comes back to the well. He needs the circle.' },
    schedule: (patches) => {
      const fever = patches.includes('aristion_sleep') ? 8 : 9;
      return [
        { from: 0, place: 'aristion', note: `06:00–0${fever}:00 · lucid, in the doorway of his house.`, pose: 'lying' },
        { from: at(fever), place: 'aristion', note: `From 0${fever}:00 · fever. He talks to someone who is not there.`, pose: 'lying' },
      ];
    },
  },
  {
    id: 'kora',
    name: 'Kora',
    epithet: 'priestess of Demeter, agitator',
    color: '#3b1a10',
    knot: 'kora',
    trouble: { fact: 'kora_debts', text: 'The purification burns the rich men\'s debts. It also frees her dockworkers. She hates it and needs it.' },
    schedule: () => [
      { from: 0, place: 'shrine', note: '06:00 · tends the shrine of Demeter.' },
      { from: at(10, 30), place: 'agora', note: '10:30 · waits for Cleon\'s speech with her arms crossed.' },
      { from: at(13), place: 'shrine', note: '13:00 · back at the shrine, counting something.' },
      { from: at(18), place: 'tavern', note: '18:00 · drinks with the dockworkers at the port tavern.' },
      { from: at(22), place: 'mountain', note: '22:00 · walks up the mountain with the procession.' },
    ],
  },
  {
    id: 'cleon',
    name: 'Cleon',
    epithet: 'demagogue',
    color: '#120c0a',
    knot: 'cleon',
    trouble: { fact: 'cleon_repeats', text: 'His great speech is word for word the one on the old chronicle. He has never read it.' },
    schedule: (patches) => {
      const speech = patches.includes('cleon_early') ? at(11) : at(12);
      return [
        { from: 0, place: 'council', note: '06:00 · rehearses on the council house steps.' },
        { from: speech, place: 'agora', note: `${String(6 + speech / 60).padStart(2, '0')}:00 · the speech to the people, in the agora.` },
        { from: speech + 60, place: 'center', note: 'After the speech · shakes hands in the square.' },
        { from: at(20), place: 'mountain', note: '20:00 · goes up the mountain early, to be seen.' },
      ];
    },
  },
  {
    id: 'eion',
    name: 'Eion',
    epithet: 'blind singer',
    color: '#1f1612',
    knot: 'eion',
    trouble: { fact: 'eion_was_leont', text: 'He knows things he has never seen. He was a scribe once. He was me.' },
    schedule: () => [
      { from: 0, place: 'tavern', note: 'Until 14:00 · asleep under a table at the port tavern.', pose: 'lying' },
      { from: at(14), place: 'agora', note: '14:00 · sings for coins in the agora.' },
      { from: at(18), place: 'tavern', note: '18:00 · sings the old songs at the tavern.' },
      { from: at(23), place: 'shore', note: '23:00 · goes down to the water alone.' },
    ],
  },
];

/** Game units a resident walks per game minute. */
export const WALK_SPEED = 0.5;
