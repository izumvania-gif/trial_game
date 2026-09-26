// Notes in the waves: short free text from players' epilogues. Premoderated — nothing is shown
// to anyone until an admin approves it. The Curator reads approved ones as "Human Notes".

export const MAX_NOTE_LENGTH = 140;

// Deliberately small; moderation is the real filter. This only stops the obvious before it queues.
const BLOCKED = [/https?:\/\//i, /www\./i, /\.(com|ru|net|org|io)\b/i, /@\w/, /\b(fuck|shit|cunt|nigg|fag)/i];

/** Returns the cleaned note, or null if it cannot be accepted at all. */
export function cleanNote(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > MAX_NOTE_LENGTH) return null;
  // English only for now: letters, digits, basic punctuation.
  if (!/^[A-Za-z0-9 .,;:!?'"()\-—–…]+$/.test(t)) return null;
  if (BLOCKED.some((re) => re.test(t))) return null;
  // The epilogue does not accept these words; neither does the sea.
  if (/\b(age|ages|cycle|cycles)\b/i.test(t)) return null;
  return t;
}

export type NoteStatus = 'pending' | 'approved' | 'rejected';
