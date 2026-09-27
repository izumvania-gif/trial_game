// The masks talk (after Inscryption's talking cards): a face taken off the stone is still the
// Leont who wore it, and it has been here before. Worn, it says a word under its breath before
// some conversations and at some places — once a day each — and what it says is what that Leont
// learned the hard way. They are hints in a voice, not in a margin.

/** A line, or a line that only comes at the hour it is about (so a visit at the wrong hour does not use it up). */
export type MaskLine = string | { line: string; when: 'evening' | 'last_hour' };

export const MASK_VOICES: Record<string, Record<string, MaskLine>> = {
  Extinguisher: {
    eion: { line: 'The blind one knows this face. Let him touch it, in the tavern, when he sings at night.', when: 'evening' },
    mountain_path: { line: 'I put it out once, up there. The water hissed, they looked at me, and the rain came anyway, at its hour.', when: 'last_hour' },
    aristion: 'The old man was kind to me. He is kind to all of us. It never helps.',
    maskseller: 'He knew my face before you did. He knows all of ours.',
    stele: 'My name is under the moss too. Under yours.',
  },
  Orator: {
    cleon: 'Listen to him. Those are my words, and he says them worse every time.',
    council_steps: 'They listen to this face at the eleventh hour. Say it plainly and sit down before they wake up.',
    kora: 'She will believe the words, not you. I found that out the loud way.',
    mountain_path: { line: "I said Cleon's words before him once, on the steps. Up here they would be the priest's words, and they would call you possessed all the same.", when: 'last_hour' },
  },
  Killer: {
    hierocles: 'He remembers the knife in his sleep. Let him look at me. He will tell you who pays him.',
    temple_door: 'If they ever put a guard on this door, he will step aside for this face. Their hands remember.',
    mountain_path: { line: 'Not the knife again. It is on the stone already. Everything is.', when: 'last_hour' },
    lysimachus: 'He is only a merchant. The priest is the one who is afraid.',
  },
  Blank: {
    xenos: 'He will take us for one of his. We could be. I was.',
    stele: 'I said yes to the stranger. I am on no later ring. Think about what that means.',
    spiral_seam: 'Through there is another desk. Mine had a window too.',
  },
};

/** What the worn mask says before this knot, if anything, at this hour of the day. */
export function maskVoice(mask: string | null, knot: string, now: { evening: boolean; lastHour: boolean }): string | null {
  if (!mask) return null;
  const l = MASK_VOICES[mask]?.[knot];
  if (!l) return null;
  if (typeof l === 'string') return l;
  return (l.when === 'evening' ? now.evening : now.lastHour) ? l.line : null;
}
