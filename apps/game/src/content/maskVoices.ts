// The masks talk (after Inscryption's talking cards): a face taken off the stone is still the
// Leont who wore it, and it has been here before. Worn, it says a word under its breath before
// some conversations and at some places — once a day each — and what it says is what that Leont
// learned the hard way. They are hints in a voice, not in a margin.

export const MASK_VOICES: Record<string, Record<string, string>> = {
  Extinguisher: {
    eion: 'The blind one knows this face. Let him touch it. He taught me something once, in a tavern like this.',
    mountain_path: 'I put it out once, up there. The water hissed, they looked at me, and the rain came anyway, at its hour.',
    aristion: 'The old man was kind to me. He is kind to all of us. It never helps.',
    maskseller: 'He sold me back to you. He sells everyone back to someone.',
    stele: 'My name is under the moss too. Under yours.',
  },
  Orator: {
    cleon: 'Listen to him. Those are my words, and he says them worse every time.',
    council_steps: 'They listen to this face at the eleventh hour. Say it plainly and sit down before they wake up.',
    kora: 'She will believe the words, not you. I found that out the loud way.',
    mountain_path: 'I shouted the next line before the priest. They called me possessed. They were not wrong, exactly.',
  },
  Killer: {
    hierocles: 'He remembers the knife in his sleep. Let him look at me. He will tell you who pays him.',
    temple_door: 'Guards step aside for this face. Their hands remember before they do.',
    mountain_path: 'Not the knife again. It is on the stone already. Everything is.',
    lysimachus: 'He is only a merchant. The priest is the one who is afraid.',
  },
  Blank: {
    xenos: 'He will take us for one of his. We could be. I was.',
    stele: 'I said yes to the stranger. I am on no later ring. Think about what that means.',
    desk_boot: 'Upstairs is another desk. Mine had a window too.',
  },
};

/** What the worn mask says before this knot, if anything. */
export function maskVoice(mask: string | null, knot: string): string | null {
  if (!mask) return null;
  return MASK_VOICES[mask]?.[knot] ?? null;
}
