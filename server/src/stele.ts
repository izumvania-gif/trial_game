// Lines other players scratch into the cracks of the star stele. Built only from a fixed
// vocabulary (Dark Souls style), so there is nothing to moderate and nothing to spoil.

export const STELE_WORDS = [
  'look', 'into', 'the stone', 'the sky', 'the sea', 'here', 'again', 'first', 'not', "don't",
  'trust', 'wake', 'sleep', 'yes', 'no', 'the other hand', 'Leont', 'midnight', 'dawn', 'is',
  'was', 'never', 'always', 'me', 'you', 'we', 'remember', 'forget', 'listen', 'the song',
  'the wind', 'the door', 'the key', 'carve', 'burn', 'stay', 'leave', 'and', 'but', 'oh',
] as const;

export const MAX_LINE_WORDS = 6;

/** Returns the canonical line, or null if it uses words outside the vocabulary. */
export function normalizeLine(words: unknown): string[] | null {
  if (!Array.isArray(words) || words.length === 0 || words.length > MAX_LINE_WORDS) return null;
  const vocab = new Set<string>(STELE_WORDS);
  if (!words.every((w) => typeof w === 'string' && vocab.has(w))) return null;
  return words as string[];
}
