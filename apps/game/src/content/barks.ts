// What the city says out loud when the scribe misbehaves. Nothing here changes the story: the day
// forgives everything at midnight. Until then people see, shout, stare, and the watch comes running.

/** The kinds of mischief the day keeps count of (CycleState.mischief), for the carving and the barks. */
export type Mischief = 'pot' | 'fish' | 'hit' | 'shove' | 'roof' | 'table' | 'caught' | 'escaped';

/** How much a seen misdeed heats the city; at 2 the watch comes after him. */
export const HEAT: Partial<Record<Mischief, number>> = { pot: 1, fish: 1.5, hit: 1.2, shove: 0.5 };

/** Lines from whoever is nearest when it happens. */
export const BARKS: Record<Mischief | 'watch' | 'watch_wait' | 'watch_lost', string[]> = {
  pot: ['My amphora!', "That was good oil, scribe!", 'Have you gone mad?', 'Clumsy fool!', "Who's paying for that?"],
  fish: ['Thief! My mullet!', 'Put that back!', 'He took a fish!', 'The scribe is stealing fish!'],
  hit: ['Ow!', 'Who threw that?', 'My head!', 'Are you trying to kill someone?'],
  shove: ['Watch where you run!', 'Hey!', 'The scribe is drunk.', 'Mind yourself!'],
  roof: ['Get down from there, Leont!', 'The scribe is on the roofs!', 'Mind the tiles!', 'Has he lost his wits?'],
  table: ['Dance, scribe!', 'On the table!', 'Another verse!', 'Look at him go!'],
  caught: [],
  escaped: [],
  watch: ['You! Stop!', 'In the name of the archons!', 'Stop that man!', 'Halt, scribe!'],
  watch_wait: ['Come down.', 'We can wait all day.', 'You have to come down some time.', 'We will be here.'],
  watch_lost: ['Gone. Let him be.', 'Where did he go?', "He'll turn up."],
};

/**
 * Named residents, once a day each, when the scribe passes them after some mischief: they have
 * heard. A line each, in their own voice.
 */
export const HEARD: Record<string, string> = {
  aristion: 'Even the gods do not break what they cannot mend, boy.',
  kora: "Breaking pots won't break the day, scribe. I've tried.",
  cleon: 'There is a watch in this city, Leont. And laws!',
  eion: 'I heard something break. It sounded like yesterday.',
  lysimachus: 'Whatever it was, I am not paying for it.',
  hierocles: 'Zeus sees what you do in the streets, scribe.',
  glaucus: 'The sea takes it all back by morning.',
  maskseller: 'A new face for the troublemaker? I have just the one.',
  xenos: 'In my city they cut off your hand. Here they only forget.',
  talia: 'You scared the gulls off my net, you know.',
};

/** For the day's carving: how the mischief reads, a few words each. */
export function mischiefWords(m: Partial<Record<Mischief, number>>): string[] {
  const n = (k: Mischief) => m[k] ?? 0;
  const out: string[] = [];
  if (n('pot') === 1) out.push('broke an amphora');
  else if (n('pot') > 1) out.push(`broke ${n('pot') === 2 ? 'two' : n('pot') === 3 ? 'three' : 'a heap of'} amphorae`);
  if (n('fish')) out.push(n('fish') === 1 ? 'stole a fish' : 'stole fish');
  if (n('hit')) out.push('hit someone with what he threw');
  if (n('shove')) out.push('knocked people over');
  if (n('table')) out.push('danced on the tavern table');
  if (n('roof')) out.push('walked the roofs');
  if (n('caught')) out.push(n('caught') === 1 ? 'was taken by the watch' : 'was taken by the watch, again');
  else if (n('escaped')) out.push('ran from the watch');
  return out;
}
