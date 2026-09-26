// The registry of past Leonts (Obra Dinn's ledger): who tried what, and how it ended.
// Each is a figure carved on the spiral; the player deduces both answers from the carving.
// Attempts and fates both repeat on the older rings: the same fights, carved cruder each time.

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
  hid_in_hall: 'hid in the Hall of Anamnesis through the night',
  bribed_priest: 'paid the priest to skip the formula',
  burned_tables: 'burned the star tables',
  blinded_himself: 'put out his own eyes',
  freed_bull: 'set the sacrificial bull free',
  taught_children: 'taught the children a different myth',
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
  forgotten: 'nobody remembered him at dawn, not even himself',
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

/** Nine scribes per ring, evenly spaced; slot k sits at k * 40° plus a small per-ring twist. */
const slot = (ring: number, k: number) => (k * Math.PI * 2) / 9 + ring * 0.21 + 0.3;

export const PAST_LEONTS: PastLeont[] = [
  // Ring I — the most recent cycles. Fine carving, many details.
  {
    id: 'l1', ring: 0, angle: slot(0, 0), attempt: 'quenched_fire', fate: 'flood', mask: 'Extinguisher',
    carving: 'A scribe tips a jug over a tripod. The carver hacked the flames away. In the next panel the same crowd stands in water to the knees, then to the chest. The scribe has no face; someone chiselled it smooth, like a mask.',
  },
  {
    id: 'l2', ring: 0, angle: slot(0, 2), attempt: 'spoke_first', fate: 'judged_possessed', mask: 'Orator',
    carving: 'A scribe on the council steps, mouth open, one arm raised. Beside him a tall man with the same arm raised, his mouth closed. The crowd turns away from both. One woman makes the sign against the evil eye at the scribe. The scribe\'s face is carved separately, set into the stone like an inlay.',
  },
  {
    id: 'l7', ring: 0, angle: slot(0, 4), attempt: 'warned_city', fate: 'laughed_at',
    carving: 'A scribe stands on an upturned basket in the agora, pointing at the sky with both hands. Around him every carved mouth is open in the same wide curve. Above the crowd, in the corner, a thin line of rain, and under it the same crowd, the same mouths, no longer laughing.',
  },
  {
    id: 'l8', ring: 0, angle: slot(0, 6), attempt: 'fled_city', fate: 'walked_back',
    carving: 'A scribe with a bundle on a stick walks out of a gate, into hills carved as a ring of bumps. The hills curve round. At the far side of the panel the same scribe, dustier, walks into the city through a gate — the only other gate on the ring.',
  },
  {
    id: 'l13', ring: 0, angle: slot(0, 1), attempt: 'hid_in_hall', fate: 'flood',
    carving: 'A scribe curled up behind a great white disk, a lamp beside him, the lamp out. Water comes in under the bronze door in carved ripples. The disk behind him is carved very small, and on it, smaller still, a scribe curled up behind a disk.',
  },
  {
    id: 'l14', ring: 0, angle: slot(0, 3), attempt: 'bribed_priest', fate: 'fire',
    carving: 'A scribe presses a purse into a priest\'s hand. The priest\'s mouth is shut tight. Behind them, on the mountain, a second priest, identical, reads from a tablet, and the sky over both is carved in tongues of flame.',
  },
  {
    id: 'l15', ring: 0, angle: slot(0, 5), attempt: 'burned_tables', fate: 'forgotten',
    carving: 'A scribe feeds star tables into a brazier, one after another. In the next panel the same room at dawn: the tables stacked on the shelf, whole, and at the desk a young scribe looking at an older man he does not know.',
  },
  {
    id: 'l16', ring: 0, angle: slot(0, 7), attempt: 'freed_bull', fate: 'earthquake',
    carving: 'A bull running down the mountain path with a cut rope trailing from its horns. A scribe at the top holds the other end. The panel is split top to bottom by a jagged line; the bull is on one side of it and the city on the other.',
  },
  {
    id: 'l17', ring: 0, angle: slot(0, 8), attempt: 'taught_children', fate: 'laughed_at',
    carving: 'A scribe sitting on a step with five small children, drawing a straight line in the dust with a stick instead of a circle. Their parents stand behind them, heads thrown back, shoulders shaking. The rain in the corner is carved the same as always.',
  },
  // Ring II — older, coarser.
  {
    id: 'l3', ring: 1, angle: slot(1, 0), attempt: 'killed_priest', fate: 'stoned', enterable: true, mask: 'Killer',
    carving: 'An altar on the mountain. The priest falls backwards; the knife is in the scribe\'s hand, not his. The carving is deep here. You could put your hand into it.',
  },
  {
    id: 'l4', ring: 1, angle: slot(1, 2), attempt: 'moved_date', fate: 'fire',
    carving: 'A scribe scrapes a number off a calendar stone and cuts a later one. Above him the carver filled the sky with flames, and next to the flames, very small, the old number, uncut.',
  },
  {
    id: 'l9', ring: 1, angle: slot(1, 4), attempt: 'burned_stele', fate: 'woke_again',
    carving: 'A scribe swings a hammer at a tall slab, and the slab is in pieces at his feet. The next panel shows the same slab, whole, beside a man asleep over tablets. The sleeping man has the scribe\'s hammer hand, empty.',
  },
  {
    id: 'l10', ring: 1, angle: slot(1, 6), attempt: 'wrote_other_line', fate: 'flood',
    carving: 'A scribe hunched over a tablet by lamplight, writing with his whole arm. On the mountain above, a priest reads from a tablet of his own, not the scribe\'s. Below both of them the carver cut long horizontal lines, waves on land, all the way to the rim.',
  },
  {
    id: 'l18', ring: 1, angle: slot(1, 1), attempt: 'blinded_himself', fate: 'made_singer',
    carving: 'A scribe with his hands over his eyes and two dark lines running down from under the fingers. A table of stars lies face down beside him. The next panel: the same man with a lyre, sitting on steps, a bowl for coins at his feet.',
  },
  {
    id: 'l19', ring: 1, angle: slot(1, 3), attempt: 'quenched_fire', fate: 'stoned',
    carving: 'Coarser than the one on the outer ring: a scribe, a jug, a tripod with no flames. But here the crowd does not look at the sky. Every arm in the crowd is raised, and every hand is a round lump of stone.',
  },
  {
    id: 'l20', ring: 1, angle: slot(1, 5), attempt: 'warned_city', fate: 'judged_possessed',
    carving: 'A scribe on a basket, pointing up. Nobody laughs on this ring. A woman in the front makes the sign against the evil eye, and two men hold the scribe\'s arms behind his back.',
  },
  {
    id: 'l21', ring: 1, angle: slot(1, 7), attempt: 'hid_in_hall', fate: 'woke_again',
    carving: 'A scribe asleep behind the white disk, lamp out. No water under the door on this one. The next panel: the same scribe waking at a desk, over tablets, in grey light, rubbing his eyes.',
  },
  {
    id: 'l22', ring: 1, angle: slot(1, 8), attempt: 'fled_city', fate: 'forgotten',
    carving: 'A scribe on a hill with a bundle, looking back at the city. The city in the next panel has no scribe in it: the carver left an empty space at the desk in the temple, and a young man is walking towards the empty space.',
  },
  // Ring III — older still. Nearly pictograms.
  {
    id: 'l5', ring: 2, angle: slot(2, 0), attempt: 'refused_sacrifice', fate: 'earthquake',
    carving: 'Coarse figures: a bull, an altar, a scribe between them with his arms spread wide. A deliberate crack runs through the whole panel, through the bull and the altar and the man.',
  },
  {
    id: 'l6', ring: 2, angle: slot(2, 2), attempt: 'carried_tablets', fate: 'made_singer',
    carving: 'A scribe walks out of a burning hall with tablets stacked in his arms. In the next panel the same man, older, his eyes carved shut, holds a lyre.',
  },
  {
    id: 'l11', ring: 2, angle: slot(2, 4), attempt: 'sang_early', fate: 'woke_again',
    carving: 'Six notches cut above a scribe\'s head: low, lower, high, low, lower, high. He holds a small harp. The sun on his left is half risen; the sun on his right is half risen too, the same sun.',
  },
  {
    id: 'l12', ring: 2, angle: slot(2, 6), attempt: 'took_the_offer', fate: 'vanished', mask: 'Blank',
    carving: 'A scribe clasps hands with a figure whose face is a smooth oval. That is all. The rings inside this one have a scribe in this place; this ring\'s next panel has nobody. Where he would stand, a small circle with a line through it.',
  },
  {
    id: 'l23', ring: 2, angle: slot(2, 1), attempt: 'bribed_priest', fate: 'stoned',
    carving: 'Pictogram: a man, a purse, a priest. The priest points at the man. Many small round marks fly at the man from every side.',
  },
  {
    id: 'l24', ring: 2, angle: slot(2, 3), attempt: 'burned_tables', fate: 'fire',
    carving: 'Pictogram: a man, a square of lines (a table of stars), fire under the square. Above the whole panel, more fire, much more, the same shape as the small fire, only enormous.',
  },
  {
    id: 'l25', ring: 2, angle: slot(2, 5), attempt: 'spoke_first', fate: 'laughed_at',
    carving: 'Pictogram: two men on steps, both with open mouths — the first time the carver shows the tall one speaking at the same moment. The crowd is a row of open curves. Rain in the corner.',
  },
  {
    id: 'l26', ring: 2, angle: slot(2, 7), attempt: 'freed_bull', fate: 'flood',
    carving: 'Pictogram: a bull with no rope, running. Wavy lines rise from the bottom of the panel over the bull\'s legs, over its back.',
  },
  {
    id: 'l27', ring: 2, angle: slot(2, 8), attempt: 'moved_date', fate: 'woke_again',
    carving: 'Pictogram: a man scratching at a round stone with marks on it. Next to it, a sun rising. Next to that, the same man scratching at the same stone, the same marks.',
  },
  // Ring IV — the oldest. Scratches rather than carvings.
  {
    id: 'l28', ring: 3, angle: slot(3, 0), attempt: 'killed_priest', fate: 'earthquake',
    carving: 'Scratches: a stick man, a stick knife, a stick man lying down. Through all of it a single deep groove, as if the carver had struck the stone once, hard.',
  },
  {
    id: 'l29', ring: 3, angle: slot(3, 1), attempt: 'refused_sacrifice', fate: 'stoned',
    carving: 'Scratches: a stick man between an altar and a four-legged shape. Around him, dozens of dots, each dot with a short line behind it, all pointing at him.',
  },
  {
    id: 'l30', ring: 3, angle: slot(3, 2), attempt: 'carried_tablets', fate: 'fire',
    carving: 'Scratches: a stick man holding a stack of rectangles, walking out of a shape full of flames — and the next shape, where he walks to, is full of flames too.',
  },
  {
    id: 'l31', ring: 3, angle: slot(3, 3), attempt: 'blinded_himself', fate: 'forgotten',
    carving: 'Scratches: a stick man with two crosses for eyes. The next panel is the same panel with the stick man rubbed out, carefully, so that only a faint shadow of him remains.',
  },
  {
    id: 'l32', ring: 3, angle: slot(3, 4), attempt: 'taught_children', fate: 'woke_again',
    carving: 'Scratches: a stick man and five smaller ones in a row, and a straight line in the dust between them. A rising sun. The same stick man, alone, the line gone.',
  },
  {
    id: 'l33', ring: 3, angle: slot(3, 5), attempt: 'sang_early', fate: 'forgotten',
    carving: 'Scratches: six notches, a stick man with a harp. A rising sun. A stick man at a desk who has no harp and does not look up.',
  },
  {
    id: 'l34', ring: 3, angle: slot(3, 6), attempt: 'wrote_other_line', fate: 'judged_possessed',
    carving: 'Scratches: a stick man with a rectangle full of marks, holding it up to many stick people. The stick people have their arms around him from behind; one makes a hooked sign with two fingers.',
  },
  {
    id: 'l35', ring: 3, angle: slot(3, 7), attempt: 'burned_stele', fate: 'stoned',
    carving: 'Scratches: a tall rectangle broken in two. A stick man next to it, and dots flying at him from every side, like the other stonings on this ring.',
  },
  {
    id: 'l36', ring: 3, angle: slot(3, 8), attempt: 'took_the_offer', fate: 'vanished',
    carving: 'Scratches: a stick man and an oval. The oval has no marks at all. On the next rings, in this place, there is always somebody. On this one there is only the small circle with a line through it — scratched first, before everything else on the ring.',
  },
];

/** Three correct identifications confirm each other (Obra Dinn's rule). */
export const CONFIRM_IN = 3;

/** How many confirmed identifications reveal what all the attempts have in common. */
export const PAST_ATTEMPTS_AT = 9;

/** Confirmations that free a shard of the spiral (four of the twelve shards live in the registry). */
export const REGISTRY_SHARDS_AT = [18, 24, 30, 36];
