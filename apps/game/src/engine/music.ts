// The town's music, composed rather than looped. Each place has a piece: sections of chord
// progressions played in a form (A A B A C …), a melody built bar by bar from motifs sung
// on the current chord, a bass on the strong beats, and a cadence at the end of each phrase.
// Every time a section comes round again some bars take a different motif, so the piece keeps
// changing without ever leaving its tune. Pure and deterministic: the same day sounds the same.

/** A chord: root in semitones above A3, and its quality. */
export interface Chord {
  root: number;
  q: 'm' | 'M' | 'sus' | 'dim' | 'm7' | 'M7';
}

/** Chord tones by quality; a melody degree indexes into these (and octaves beyond). */
const TONES: Record<Chord['q'], number[]> = {
  m: [0, 3, 7, 10],
  m7: [0, 3, 7, 10],
  M: [0, 4, 7, 9],
  M7: [0, 4, 7, 11],
  sus: [0, 5, 7, 10],
  dim: [0, 3, 6, 9],
};

export interface Piece {
  /** Seconds per step. */
  step: number;
  stepsPerBar: number;
  /** Octave shift of the melody, in semitones. */
  register: number;
  volume: number;
  sections: Record<string, Chord[]>;
  form: string[];
  /** Melody motifs, one bar long: chord-tone degrees (0 root, 1 third, 2 fifth, 3 seventh, 4 octave…), null = rest. */
  motifs: (number | null)[][];
  /** Cadence motifs for the last bar of a section. */
  cadences: (number | null)[][];
  /** Bass per step: a chord degree (played two octaves down), null = silence. */
  bass: (number | null)[];
  /** Hand drum per step (the agora). */
  drum?: boolean[];
  echo?: boolean;
}

const c = (root: number, q: Chord['q'] = 'm'): Chord => ({ root, q });
// Roots, in semitones above A: A 0, Bb 1, B 2, C 3, D 5, E 7, F 8, G 10.
const [A, Bb, C, D, E, F, G] = [0, 1, 3, 5, 7, 8, 10];

export const PIECES: Record<string, Piece> = {
  // The streets: a walking tune in A minor that drifts to C and back.
  streets: {
    step: 0.3, stepsPerBar: 8, register: 0, volume: 0.28,
    sections: {
      A: [c(A), c(F, 'M'), c(C, 'M'), c(G, 'M')],
      B: [c(D), c(A), c(E, 'M'), c(A)],
      C: [c(F, 'M'), c(G, 'M'), c(E), c(A)],
      D: [c(C, 'M'), c(G, 'M'), c(D), c(E, 'sus')],
    },
    form: ['A', 'A', 'B', 'A', 'C', 'D', 'B', 'A', 'C', 'C'],
    motifs: [
      [0, null, 1, 2, null, 1, 0, null],
      [2, 1, 0, null, 1, null, 2, 3],
      [4, null, 3, 2, 1, null, 2, null],
      [0, 1, 2, 4, null, 2, 1, null],
      [2, null, null, 1, 2, 3, 2, null],
      [1, 0, -1, 0, null, null, 1, 2],
    ],
    cadences: [[2, null, 1, null, 0, null, null, null], [4, 3, 2, 1, 0, null, null, null]],
    bass: [0, null, null, null, 2, null, null, null],
  },
  // The agora: a quick dance in three over a hand drum, with a bright bridge in C.
  agora: {
    step: 0.19, stepsPerBar: 6, register: 12, volume: 0.22,
    sections: {
      A: [c(A), c(G, 'M'), c(A), c(G, 'M')],
      B: [c(F, 'M'), c(G, 'M'), c(A), c(A)],
      C: [c(D), c(A), c(E, 'M'), c(A)],
      D: [c(C, 'M'), c(G, 'M'), c(A), c(E)],
      E: [c(F, 'M'), c(C, 'M'), c(D), c(E, 'M')],
      F: [c(D), c(G, 'M'), c(C, 'M'), c(E, 'M')],
    },
    form: ['A', 'B', 'A', 'C', 'D', 'E', 'A', 'B', 'F', 'D', 'C', 'E', 'A', 'B'],
    motifs: [
      [0, 1, 2, 4, 2, 1],
      [2, null, 2, 3, 2, 1],
      [4, 3, 2, 1, 2, null],
      [0, null, 2, 1, 0, -1],
      [1, 2, 4, null, 4, 2],
      [2, 1, 2, 3, 4, null],
      [4, null, 5, 4, 3, 2],
    ],
    cadences: [[2, 1, 0, null, 0, null], [4, 2, 0, null, null, null]],
    bass: [0, null, null, 2, null, null],
    drum: [true, false, false, true, false, true],
  },
  // The port: low and slow, with long rests like the swell; a sadder turn through B-flat.
  port: {
    step: 0.42, stepsPerBar: 8, register: -12, volume: 0.32,
    sections: {
      A: [c(A), c(E), c(F, 'M'), c(C, 'M')],
      B: [c(D), c(A), c(Bb, 'M'), c(E, 'M')],
      C: [c(F, 'M'), c(C, 'M'), c(D), c(A)],
      D: [c(A, 'sus'), c(A), c(G, 'M'), c(A)],
    },
    form: ['A', 'B', 'A', 'C', 'D', 'B', 'C', 'A'],
    motifs: [
      [0, null, null, 2, 1, null, null, null],
      [2, null, 1, null, 0, null, null, -1],
      [null, null, 4, null, 2, 1, null, null],
      [0, null, 1, 2, null, null, 1, null],
      [2, null, null, null, 3, 2, null, null],
    ],
    cadences: [[1, null, null, 0, null, null, null, null], [2, null, 1, null, 0, null, null, null]],
    bass: [0, null, null, null, null, null, 2, null],
  },
  // The Hall: Phrygian, sparse and high, a half step that never resolves; the stone answers.
  hall: {
    step: 0.55, stepsPerBar: 8, register: 12, volume: 0.24, echo: true,
    sections: {
      A: [c(A), c(Bb, 'M'), c(A), c(G)],
      B: [c(D), c(Bb, 'M'), c(A, 'sus'), c(A)],
      C: [c(F, 'M'), c(E, 'dim'), c(D), c(A)],
    },
    form: ['A', 'A', 'B', 'A', 'C', 'B'],
    motifs: [
      [2, null, null, null, null, 3, null, null],
      [null, null, 4, null, null, null, null, null],
      [0, null, null, 1, null, null, null, null],
      [null, null, null, null, 2, null, 1, null],
      [4, null, null, null, null, null, null, null],
    ],
    cadences: [[1, null, null, null, 0, null, null, null], [null, null, null, null, null, null, null, null]],
    bass: [0, null, null, null, null, null, null, null],
  },
};

export interface Note {
  /** Semitones above A3, or null. */
  melody: number | null;
  bass: number | null;
  drum: boolean;
  /** First step of a bar: play it a little louder. */
  accent: boolean;
}

/** Small integer hash: picks motifs so the choice depends on where we are, not on chance. */
function hash(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) {
    h ^= x + 0x9e3779b9;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

function tone(chord: Chord, degree: number): number {
  const tones = TONES[chord.q];
  const oct = Math.floor(degree / tones.length);
  const i = ((degree % tones.length) + tones.length) % tones.length;
  return chord.root + tones[i]! + 12 * oct;
}

/**
 * The note at a given step of a piece, counting from its first step. `step` grows without end:
 * after the form finishes it starts again, and each pass through the form varies the motifs.
 */
export function noteAt(piece: Piece, step: number): Note {
  const barLen = piece.stepsPerBar;
  const sectionBars = piece.sections[piece.form[0]!]!.length;
  const formBars = piece.form.length * sectionBars;
  const bar = Math.floor(step / barLen);
  const inBar = step % barLen;
  const pass = Math.floor(bar / formBars);
  const barInForm = bar % formBars;
  const formIndex = Math.floor(barInForm / sectionBars);
  const barInSection = barInForm % sectionBars;
  const name = piece.form[formIndex]!;
  const chords = piece.sections[name]!;
  const chord = chords[barInSection % chords.length]!;
  // How many times this section has already sounded, counting earlier passes of the form.
  const seenBefore = piece.form.slice(0, formIndex).filter((n) => n === name).length + pass * piece.form.filter((n) => n === name).length;
  const last = barInSection === chords.length - 1;
  let motif: (number | null)[];
  if (last) motif = piece.cadences[hash(name.charCodeAt(0), seenBefore) % piece.cadences.length]!;
  else {
    // The first time through, a section keeps its own motifs; later, some bars answer differently.
    const variation = seenBefore === 0 ? 0 : hash(name.charCodeAt(0), barInSection, seenBefore) % 3 === 0 ? seenBefore : 0;
    motif = piece.motifs[hash(name.charCodeAt(0), barInSection, variation) % piece.motifs.length]!;
  }
  const degree = motif[inBar % motif.length];
  const b = piece.bass[inBar % piece.bass.length];
  return {
    melody: degree === null || degree === undefined ? null : tone(chord, degree) + piece.register,
    bass: b === null || b === undefined ? null : tone(chord, b) - 24,
    drum: piece.drum?.[inBar % piece.drum.length] ?? false,
    accent: inBar === 0,
  };
}

/** Length of one pass through a piece's form, in seconds. */
export function pieceSeconds(piece: Piece): number {
  const sectionBars = piece.sections[piece.form[0]!]!.length;
  return piece.form.length * sectionBars * piece.stepsPerBar * piece.step;
}
