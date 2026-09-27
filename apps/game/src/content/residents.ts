// Who lives the last day, where and when. The Book of Strangers is built from these entries.
import { at } from '../core/clock.ts';
import type { Place } from '../core/streets.ts';

export type ResidentId =
  | 'aristion' | 'kora' | 'cleon' | 'eion' | 'lysimachus' | 'hierocles' | 'glaucus' | 'maskseller' | 'xenos' | 'talia';

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
  /** Only present in the world once this is true (Xenos appears to those who have seen the seam). */
  appears?: (knows: (fact: string) => boolean) => boolean;
  /** Stands somewhere different along the shore every cycle: the one resident the seed does not decide. */
  seaSpot?: boolean;
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
      { from: at(13, 30), place: 'shrine', note: '13:30 · back at the shrine, counting something.' },
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
        { from: speech + 75, place: 'center', note: 'After the speech · shakes hands in the square.' },
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
  {
    id: 'lysimachus',
    name: 'Lysimachus',
    epithet: 'merchant, lender',
    color: '#241410',
    knot: 'lysimachus',
    trouble: { fact: 'lysimachus_pays', text: 'He pays the priest of Zeus to keep the ritual on time. Every Silver Age he is the first man in Eferon to own anything.' },
    schedule: () => [
      { from: 0, place: 'villa', note: '06:00 · counts his ledgers on the porch of his villa.' },
      { from: at(10), place: 'agora', note: '10:00 · buys up the stallholders\' stock at the agora, cheap. Nobody will need it tomorrow.' },
      { from: at(13), place: 'port', note: '13:00 · at the port, writing down which boats did not sail.' },
      { from: at(18), place: 'villa', note: '18:00 · hosts a dinner for the archons at his villa. The counting room is empty.' },
      { from: at(22), place: 'mountain', note: '22:00 · climbs the mountain in a litter.' },
    ],
  },
  {
    id: 'hierocles',
    name: 'Hierocles',
    epithet: 'priest of Zeus',
    color: '#0f0b09',
    knot: 'hierocles',
    trouble: { fact: 'hierocles_paid', text: 'He takes Lysimachus\' silver to read the formula on time. He would read it anyway. That is what frightens him.' },
    schedule: () => [
      { from: 0, place: 'zeus', note: '06:00 · sharpens the sacrificial knife in the temple of Zeus.' },
      { from: at(11), place: 'council', note: '11:00 · speaks quietly with Cleon on the council steps.' },
      { from: at(15), place: 'port', note: '15:00 · visits Lysimachus at the port. Leaves heavier than he came.' },
      { from: at(18), place: 'zeus', note: '18:00 · back at the temple of Zeus, rehearsing the formula.' },
      { from: at(21), place: 'mountain', note: '21:00 · goes up the mountain ahead of the procession.' },
    ],
  },
  {
    id: 'glaucus',
    name: 'Glaucus',
    epithet: 'priest of Poseidon, keeps no calendar',
    color: '#16201f',
    knot: 'glaucus',
    seaSpot: true,
    trouble: { fact: 'glaucus_no_calendar', text: 'He keeps no calendar. He never stands in the same place twice. Nobody else in Eferon can say that.' },
    schedule: () => [{ from: 0, place: 'shore', note: 'All day · somewhere along the shore, up to his knees in the water. Never the same place.' }],
  },
  {
    id: 'maskseller',
    name: 'The mask seller',
    epithet: 'a stall nobody remembers setting up',
    color: '#2b1a12',
    knot: 'maskseller',
    trouble: { fact: 'masks_explained', text: 'He sells faces nobody in Eferon has. He says every one of them is mine.' },
    schedule: () => [
      { from: 0, place: 'stall', note: '06:00 · sets out his masks at a stall by the agora.' },
      { from: at(20), place: 'tavern', note: '20:00 · drinks alone at the tavern, the masks in a sack at his feet.' },
    ],
  },
  {
    id: 'xenos',
    name: 'Xenos',
    epithet: 'a stranger in a smooth mask',
    color: '#050505',
    knot: 'xenos',
    appears: (knows) => knows('seam_symbol'),
    trouble: { fact: 'xenos_offer', text: 'He offers a room where the reset does not reach. He says nobody has ever said no.' },
    schedule: () => [
      { from: 0, place: 'stele', note: 'Until 14:00 · reads the stele, very slowly, as if proofreading it.' },
      { from: at(14), place: 'agora', note: '14:00 · watches the agora from the edge, taking notes.' },
      { from: at(18), place: 'tavern', note: '18:00 · at the tavern, a cup in front of him he never drinks.' },
      { from: at(22), place: 'mountain', note: '22:00 · on the mountain, a little apart from everyone.' },
    ],
  },
  {
    id: 'talia',
    name: 'Talia',
    epithet: 'fisherman\'s daughter',
    color: '#2f1b10',
    knot: 'talia',
    trouble: { fact: 'talia_boat', text: 'Her father\'s boat, the Pelagia, always comes back late. Never by the same minutes.' },
    schedule: () => [
      { from: 0, place: 'shoreWest', note: '06:00 · mends a net on the beach. Nobody sails on the last day. Her father did.' },
      { from: at(12), place: 'port', note: '12:00 · waits at the port for the Pelagia.' },
      { from: at(20), place: 'tavern', note: '20:00 · at the tavern with her father, both of them quiet.' },
    ],
  },
];

/** Game units a resident walks per game minute. */
export const WALK_SPEED = 0.5;
