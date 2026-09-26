// The registry of past Leonts (Obra Dinn's ledger): who tried what, and how it ended.
// Each is a figure carved on the spiral; the player deduces both answers from the carving.

export const ATTEMPTS: Record<string, string> = {
  moved_date: 'moved the day of the ritual',
  refused_sacrifice: 'refused the sacrifice',
  killed_priest: 'killed the priest at the altar',
  quenched_fire: 'put out the sacred fire',
  spoke_first: "spoke Cleon's speech before him",
  carried_tablets: 'carried the tablets out of the fire',
};

export const FATES: Record<string, string> = {
  flood: 'the flood came at midnight',
  fire: 'the fire came at its hour',
  earthquake: 'the earth opened',
  judged_possessed: 'the crowd judged him possessed',
  stoned: 'stoned on the mountain',
  made_singer: 'left alive, blind, a singer',
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
  /** Only one relief in the demo can be entered. */
  enterable?: boolean;
  /** Identifying him gives a mask. */
  mask?: string;
}

export const PAST_LEONTS: PastLeont[] = [
  {
    id: 'l1', ring: 0, angle: 0.6, attempt: 'quenched_fire', fate: 'flood', mask: 'Extinguisher',
    carving: 'A scribe tips a jug over a tripod. The carver hacked the flames away. In the next panel the same crowd stands in water to the knees, then to the chest. The scribe has no face; someone chiselled it smooth, like a mask.',
  },
  {
    id: 'l2', ring: 0, angle: 3.9, attempt: 'spoke_first', fate: 'judged_possessed',
    carving: 'A scribe on the council steps, mouth open, one arm raised. Beside him a tall man with the same arm raised, his mouth closed. The crowd turns away from both. One woman makes the sign against the evil eye at the scribe.',
  },
  {
    id: 'l3', ring: 1, angle: 2.3, attempt: 'killed_priest', fate: 'stoned', enterable: true,
    carving: 'An altar on the mountain. The priest falls backwards; the knife is in the scribe\'s hand, not his. The carving is deep here. You could put your hand into it.',
  },
  {
    id: 'l4', ring: 1, angle: 5.2, attempt: 'moved_date', fate: 'fire',
    carving: 'A scribe scrapes a number off a calendar stone and cuts a later one. Above him the carver filled the sky with flames, and next to the flames, very small, the old number, uncut.',
  },
  {
    id: 'l5', ring: 2, angle: 1.4, attempt: 'refused_sacrifice', fate: 'earthquake',
    carving: 'Coarse figures: a bull, an altar, a scribe between them with his arms spread wide. A deliberate crack runs through the whole panel, through the bull and the altar and the man.',
  },
  {
    id: 'l6', ring: 2, angle: 4.4, attempt: 'carried_tablets', fate: 'made_singer',
    carving: 'A scribe walks out of a burning hall with tablets stacked in his arms. In the next panel the same man, older, his eyes carved shut, holds a lyre.',
  },
];

/** Three correct identifications confirm each other (Obra Dinn's rule). */
export const CONFIRM_IN = 3;
