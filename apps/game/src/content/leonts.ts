// The registry of past Leonts (Obra Dinn's ledger): who tried what, and how it ended.
// Each is a figure carved on the spiral; the player deduces both answers from the carving.
// Attempts are unique; fates repeat — the day has fewer endings than there are ways to fight it.

export const ATTEMPTS: Record<string, string> = {
  quenched_fire: 'put out the sacred fire',
  spoke_first: "spoke Cleon's speech before him",
  warned_city: 'warned the whole city in the agora',
  fled_city: 'fled Eferon over the hills',
  killed_priest: 'killed the priest at the altar',
  moved_date: 'moved the day of the ritual',
  burned_stele: 'broke the star stele',
  wrote_other_line: 'wrote a different last line',
  refused_sacrifice: 'refused the sacrifice',
  carried_tablets: 'carried the tablets out of the fire',
  sang_early: 'played the Song of Return before midnight',
  took_the_offer: 'accepted the stranger\'s offer',
};

export const FATES: Record<string, string> = {
  flood: 'the flood came at midnight',
  fire: 'the fire came at its hour',
  earthquake: 'the earth opened',
  judged_possessed: 'the crowd judged him possessed',
  stoned: 'stoned on the mountain',
  laughed_at: 'the city laughed, and the day ended as always',
  walked_back: 'walked all day and came back through the other gate',
  made_singer: 'left alive, blind, a singer',
  woke_again: 'woke at dawn, on the same morning',
  vanished: 'is not on the next ring at all',
};

export interface PastLeont {
  id: string;
  /** Ring 0 is the outer ring (the most recent cycles). */
  ring: number;
  /** Angle on the ring, in ring-local radians. */
  angle: number;
  attempt: keyof typeof ATTEMPTS;
  fate: keyof typeof FATES;
  /** What the carving shows. Fair clues, never the answer in words. */
  carving: string;
  /** The one relief in the game that can be entered (so far). */
  enterable?: boolean;
  /** Identifying him frees a mask from the stone. */
  mask?: string;
}

export const PAST_LEONTS: PastLeont[] = [
  // Ring I — the most recent cycles. Fine carving, many details.
  {
    id: 'l1', ring: 0, angle: 0.6, attempt: 'quenched_fire', fate: 'flood', mask: 'Extinguisher',
    carving: 'A scribe tips a jug over a tripod. The carver hacked the flames away. In the next panel the same crowd stands in water to the knees, then to the chest. The scribe has no face; someone chiselled it smooth, like a mask.',
  },
  {
    id: 'l2', ring: 0, angle: 2.2, attempt: 'spoke_first', fate: 'judged_possessed', mask: 'Orator',
    carving: 'A scribe on the council steps, mouth open, one arm raised. Beside him a tall man with the same arm raised, his mouth closed. The crowd turns away from both. One woman makes the sign against the evil eye at the scribe. The scribe\'s face is carved separately, set into the stone like an inlay.',
  },
  {
    id: 'l7', ring: 0, angle: 3.9, attempt: 'warned_city', fate: 'laughed_at',
    carving: 'A scribe stands on an upturned basket in the agora, pointing at the sky with both hands. Around him every carved mouth is open in the same wide curve. Above the crowd, in the corner, a thin line of rain, and under it the same crowd, the same mouths, no longer laughing.',
  },
  {
    id: 'l8', ring: 0, angle: 5.3, attempt: 'fled_city', fate: 'walked_back',
    carving: 'A scribe with a bundle on a stick walks out of a gate, into hills carved as a ring of bumps. The hills curve round. At the far side of the panel the same scribe, dustier, walks into the city through a gate — the only other gate on the ring.',
  },
  // Ring II — older, coarser.
  {
    id: 'l3', ring: 1, angle: 2.3, attempt: 'killed_priest', fate: 'stoned', enterable: true, mask: 'Killer',
    carving: 'An altar on the mountain. The priest falls backwards; the knife is in the scribe\'s hand, not his. The carving is deep here. You could put your hand into it.',
  },
  {
    id: 'l4', ring: 1, angle: 3.9, attempt: 'moved_date', fate: 'fire',
    carving: 'A scribe scrapes a number off a calendar stone and cuts a later one. Above him the carver filled the sky with flames, and next to the flames, very small, the old number, uncut.',
  },
  {
    id: 'l9', ring: 1, angle: 5.4, attempt: 'burned_stele', fate: 'woke_again',
    carving: 'A scribe swings a hammer at a tall slab, and the slab is in pieces at his feet. The next panel shows the same slab, whole, beside a man asleep over tablets. The sleeping man has the scribe\'s hammer hand, empty.',
  },
  {
    id: 'l10', ring: 1, angle: 0.8, attempt: 'wrote_other_line', fate: 'flood',
    carving: 'A scribe hunched over a tablet by lamplight, writing with his whole arm. On the mountain above, a priest reads from a tablet of his own, not the scribe\'s. Below both of them the carver cut long horizontal lines, waves on land, all the way to the rim.',
  },
  // Ring III — the oldest. Nearly pictograms.
  {
    id: 'l5', ring: 2, angle: 1.4, attempt: 'refused_sacrifice', fate: 'earthquake',
    carving: 'Coarse figures: a bull, an altar, a scribe between them with his arms spread wide. A deliberate crack runs through the whole panel, through the bull and the altar and the man.',
  },
  {
    id: 'l6', ring: 2, angle: 4.4, attempt: 'carried_tablets', fate: 'made_singer',
    carving: 'A scribe walks out of a burning hall with tablets stacked in his arms. In the next panel the same man, older, his eyes carved shut, holds a lyre.',
  },
  {
    id: 'l11', ring: 2, angle: 2.9, attempt: 'sang_early', fate: 'woke_again',
    carving: 'Six notches cut above a scribe\'s head: low, lower, high, low, lower, high. He holds a small harp. The sun on his left is half risen; the sun on his right is half risen too, the same sun.',
  },
  {
    id: 'l12', ring: 2, angle: 6.0, attempt: 'took_the_offer', fate: 'vanished', mask: 'Blank',
    carving: 'A scribe clasps hands with a figure whose face is a smooth oval. That is all. The rings inside this one have a scribe in this place; this ring\'s next panel has nobody. Where he would stand, a small circle with a line through it.',
  },
];

/** Three correct identifications confirm each other (Obra Dinn's rule). */
export const CONFIRM_IN = 3;

/** How many confirmed identifications reveal what all the attempts have in common. */
export const PAST_ATTEMPTS_AT = 9;
