// How a line is said, for the speaker's portrait. Set in ink with #mood:<mood>; a line without
// the tag gets a guess from its words, and most lines are simply neutral.
export const MOODS = ['neutral', 'joy', 'anger', 'sorrow', 'fear', 'wonder'] as const;
export type Mood = (typeof MOODS)[number];

export function isMood(value: string): value is Mood {
  return (MOODS as readonly string[]).includes(value);
}

const GUESSES: [Mood, RegExp][] = [
  ['fear', /\b(afraid|fear|please|help me|who are you|what are you)\b/i],
  ['sorrow', /\b(dead|died|grave|alone|tired|weep|mourn|sorry|lost)\b/i],
  ['anger', /\b(get out|go away|how dare|liar|fool|enough|never again)\b/i],
  ['joy', /\b(ha|haha|glad|welcome|laugh|wonderful)\b/i],
];

export function guessMood(text: string): Mood {
  for (const [mood, re] of GUESSES) if (re.test(text)) return mood;
  if (/!\s*$/.test(text)) return 'anger';
  if (/\?\s*$/.test(text)) return 'wonder';
  return 'neutral';
}
