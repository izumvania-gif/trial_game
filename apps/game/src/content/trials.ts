// The trainer's trials at the gymnasium: four courses through Eferon against his water-clock, each a
// test of what the scribe's body can do. The best times are kept in the loop memory (the only record
// in the city that survives midnight is the one in his head); all four won, the trainer gives him the
// mask of Hermes.

export interface Gate {
  x: number;
  z: number;
  /** The height of what the post stands on: he must be up there too. */
  y: number;
  /** How close counts as passing it. */
  r?: number;
}

export interface Trial {
  id: string;
  name: string;
  /** Seconds on the water-clock, from the first post to the last. */
  limit: number;
  gates: Gate[];
  /** Never set foot on the street between the first post and the last. */
  noStreet?: boolean;
  /** For the day's carving. */
  won: string;
}

export const TRIALS: Trial[] = [
  {
    id: 'dromos',
    name: 'The streets',
    limit: 20,
    gates: [{ x: -19.2, z: 11.6, y: 0, r: 1.8 }, { x: 8, z: 1.5, y: 0, r: 2.8 }, { x: 0, z: -13.9, y: 1.02, r: 2.2 }, { x: -19.2, z: 11.6, y: 0, r: 1.8 }],
    won: 'ran the streets against the water-clock',
  },
  {
    id: 'walls',
    name: 'The walls',
    limit: 30,
    noStreet: true,
    gates: [
      { x: -29.5, z: -6, y: 3.64, r: 1.4 }, { x: -29.5, z: -14.5, y: 5.4 }, { x: -29.5, z: -27, y: 5.4 },
      { x: -17, z: -27, y: 5.4 }, { x: -4.5, z: -27, y: 5.4 }, { x: 6.75, z: -27, y: 6.2 },
    ],
    won: 'ran the whole wall walk and never touched the street',
  },
  {
    id: 'swim',
    name: 'The sea',
    limit: 24,
    gates: [{ x: -6, z: 33.4, y: 0.3, r: 1.4 }, { x: 22, z: 38.6, y: 0.9, r: 3.2 }],
    won: "swam from the mole to Poseidon's cape",
  },
  {
    id: 'roof',
    name: "Apollo's roof",
    limit: 18,
    gates: [{ x: 0, z: -13.4, y: 1.02, r: 1.6 }, { x: 0, z: -19, y: 10.1, r: 2.4 }, { x: -4.5, z: -10, y: 0, r: 1.8 }],
    won: "stood on the ridge of Apollo's temple",
  },
];

export const trialById = (id: string) => TRIALS.find((t) => t.id === id);

/** Seconds as the water-clock tells them: "12.4 s". */
export const seconds = (t: number) => `${t.toFixed(1)} s`;
