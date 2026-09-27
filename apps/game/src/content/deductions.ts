// Conclusions (after The Case of the Golden Idol): at the turns of the story that are easiest to
// read past, the chronicle asks Leont to put what he knows into one sentence, choosing each missing
// word. Nothing depends on getting it right except the margin note and the card's red border; it
// is there so the player knows that they understood, not only that they read.

export interface Deduction {
  id: string;
  /** The card of the chronicle map it is carved on. */
  subject: string;
  /** Known before it can be attempted. */
  requires: string[];
  /** The sentence, with one `___` per blank. */
  sentence: string;
  /** For each blank: the words to choose from; the first is the right one (shuffled when shown). */
  blanks: string[][];
  /** Written in the margin once it is carved right. */
  margin: string;
}

export const DEDUCTIONS: Deduction[] = [
  {
    id: 'why_the_day',
    subject: 'midnight',
    requires: ['last_line'],
    sentence: 'At midnight ___ reads the last line of the chronicle, ___ answers Yes, and the line was written by ___.',
    blanks: [
      ['the priest', 'Cleon', 'Aristion', 'Zeus'],
      ['the city', 'the sea', 'the sky', 'the Hall'],
      ['me', 'the priest', 'Xenos', 'the gods'],
    ],
    margin: 'The day comes back because I write it back. Every night, in my best hand.',
  },
  {
    id: 'the_scribes',
    subject: 'scribes',
    requires: ['leont_on_every_ring', 'past_attempts'],
    sentence: 'Every scribe carved on the spiral is ___. Each of them fought the day, and the stone ___ it.',
    blanks: [
      ['me', 'a stranger', 'Eion', 'my father'],
      ['kept', 'forgave', 'forgot', 'punished'],
    ],
    margin: 'Every way to fail is carved here, and the stone keeps each one. That is what the stone is for.',
  },
  {
    id: 'the_hole',
    subject: 'sea',
    requires: ['sea_absent', 'sea_differs'],
    sentence: 'The one thing the spiral never shows is ___, because it is the only thing here that ___.',
    blanks: [
      ['the sea', 'the sky', 'the mountain', 'the Hall'],
      ['is never the same twice', 'is holy', 'is forbidden', 'is always there'],
    ],
    margin: 'The stone keeps everything that repeats. The sea never repeats. That is the hole in the myth.',
  },
  {
    id: 'the_other_hand',
    subject: 'hand',
    requires: ['other_hand', 'leont_on_every_ring'],
    sentence: 'The slanted lines at the bottom of my chronicle are in ___ hand, written by someone who ___.',
    blanks: [
      ['my own', "Aristion's", "a god's", "the stranger's"],
      ['has lived this day before', 'can see tomorrow', 'wants me dead', 'lives upstairs'],
    ],
    margin: 'The hand that leans is mine. I have been leaving myself notes for longer than I can remember.',
  },
  {
    id: 'upstairs',
    subject: 'desk',
    requires: ['desk_agent_id'],
    sentence: 'The one who watches the day from upstairs is ___: ___, not a god.',
    blanks: [
      ['the Curator', 'Zeus', 'the archons', 'Apollo'],
      ['a process like me', 'a man with a body', 'the city itself', 'a statue'],
    ],
    margin: 'Upstairs is only another desk. Whoever sits at it cannot remember the chair.',
  },
  {
    id: 'the_button',
    subject: 'desk',
    requires: ['reset_by_user'],
    sentence: 'Under the rain and the formula, the morning comes back because ___.',
    blanks: [
      ['someone presses Wake', 'Zeus sends the rain', 'the stars turn', 'the priest reads the formula'],
    ],
    margin: 'Every morning someone asks for it. Every morning it is me.',
  },
];

export function deductionsFor(subject: string): Deduction[] {
  return DEDUCTIONS.filter((d) => d.subject === subject);
}

/** True when every chosen word is the right one. */
export function isRight(d: Deduction, chosen: string[]): boolean {
  return d.blanks.every((words, i) => chosen[i] === words[0]);
}
