// "Diary Without Dates": after the true ending, one real day at a time. Each real day something
// happens in Eferon that has never happened before, and Leont may write one entry. There is no
// field for a date. The words "age" and "cycle" are not accepted.

/** What happens on the n-th real day after the break. After the list runs out, the sea decides. */
export const EPILOGUE_DAYS: string[] = [
  'Nothing happened today that has happened before. You notice it mostly as a quiet, like a noise that has stopped.',
  'A fisherman did not come back. Talia\'s father. The Pelagia was seen far out at noon and then not seen. There is no tomorrow in which he comes in late. There is only this.',
  'Cleon gave a speech nobody has heard before. It was worse than the old one. People listened anyway, because they did not know how it ended.',
  'Kora came down to the hut with bread and did not say why. She stayed until dark, arguing with you about nothing.',
  'Aristion walked to the well. Nobody was standing there. He stood there himself for a long time, and then he went home and slept, and the next morning he got up.',
  'A child was born in the port and given a name that is not on any list. The midwife had to invent it. She was very pleased with herself.',
  'It rained in the afternoon, an ordinary rain, and half the city ran into the temples, and then out again, embarrassed.',
  'Glaucus waded in from the sea and sat on your step. Where will you be tomorrow, you asked him. Here, he said. I think I will stay here.',
  'Eion sang a song with a verse you had never heard. He had not heard it either. He sang it twice to be sure it was real.',
  'The mask seller\'s stall was gone. Where it stood, in the dust, someone had drawn a straight line.',
  'Talia asked you to tell her the five ages. You tried. You could not remember the third. She said good, and went fishing.',
  'Nothing happened. A whole day of nothing, that had never happened before.',
];

export const FALLBACK_DAYS: string[] = [
  'The sea brought in something nobody could name.',
  'Somebody laughed in the agora at something new.',
  'A stranger arrived by the road and was a stranger, nothing more.',
  'The wind came from a direction the stele has no word for.',
  'A roof fell in. Nobody had expected it. They are rebuilding it differently.',
];

export function dayEvent(day: number, seaIndex: number): string {
  return EPILOGUE_DAYS[day] ?? FALLBACK_DAYS[seaIndex % FALLBACK_DAYS.length]!;
}

/** The diary refuses these words, like the sea. */
export const FORBIDDEN = /\b(age|ages|cycle|cycles|again)\b/i;

/** Real days the prophet has before the dates creep back and CYCLE RUN #1 begins. */
export const PROPHET_DAYS = 3;

export function daysSince(start: number, now: number): number {
  return Math.max(0, Math.floor((now - start) / 86_400_000));
}
