// Short how-to cards: one the first time the player reaches each place (H shows it again),
// and small tips the first time a mechanic appears. They explain controls and rules only —
// never what anything means.
import type { StageId } from '../core/types.ts';

export interface GuideStep {
  /** Keys shown as keycaps before the text, e.g. ['W', 'A', 'S', 'D'] or ['Drag']. */
  keys: string[];
  text: string;
}

export interface Guide {
  id: string;
  kicker: string;
  title: string;
  steps: GuideStep[];
}

export const STAGE_GUIDES: Partial<Record<StageId, Guide>> = {
  town: {
    id: 'town',
    kicker: 'The last day',
    title: 'Eferon',
    steps: [
      { keys: ['W', 'A', 'S', 'D'], text: 'Walk the city. The ring at the bottom is the day: at midnight it runs out.' },
      { keys: ['E'], text: 'Talk to people and look at things when a prompt appears.' },
      { keys: ['C'], text: 'At midnight everything resets. Only what you learn survives: it is written in your chronicle.' },
      { keys: ['B'], text: 'The Book of Strangers keeps who was where, and when. Watch people to fill it.' },
      { keys: ['H'], text: 'This card again, for wherever you are. O opens the settings.' },
    ],
  },
  spiral: {
    id: 'spiral',
    kicker: 'Under the temple',
    title: 'The Hall of Anamnesis',
    steps: [
      { keys: ['Drag'], text: 'Hold the mouse button on a ring of the spiral and move it to turn the ring.' },
      { keys: ['Click'], text: 'Click a carved scribe to study him. The prompt shows what the mouse is over.' },
      { keys: ['Tab'], text: 'The registry: everyone you have studied on the stone.' },
      { keys: ['Esc'], text: 'Climb back up into the city. The day waits for you.' },
    ],
  },
  relief: {
    id: 'relief',
    kicker: 'Hand in the stone',
    title: 'Inside the carving',
    steps: [
      { keys: ['W', 'S'], text: 'Walk through the frozen scene.' },
      { keys: ['A', 'D'], text: 'Turn. Or hold the mouse button and drag.' },
      { keys: [], text: 'Walk up to the figures to hear what they were saying when the stone took them.' },
      { keys: ['Esc'], text: 'Let go of the carving.' },
    ],
  },
  desk: {
    id: 'desk',
    kicker: 'Somewhere else',
    title: 'The Desk',
    steps: [
      { keys: ['Click'], text: 'Open a ticket from the queue on the left.' },
      { keys: [], text: 'Each ticket offers patches. A patch you apply changes Eferon from the next day on.' },
      { keys: [], text: 'The chat on the right is the team. You can answer with the buttons under it.' },
      { keys: ['Esc'], text: 'Let go of the mark and go back.' },
    ],
  },
  board: {
    id: 'board',
    kicker: 'Before the night',
    title: 'The plan',
    steps: [
      { keys: [], text: 'Black lines on the map are where each of them will walk tonight.' },
      { keys: ['Click'], text: 'Choose an ally on the left, then click a tile to place them.' },
      { keys: [], text: 'An ally standing on a route stops whoever they can talk to. The rules are on the left.' },
      { keys: [], text: 'When everyone is placed, let the night come. You can plan again.' },
    ],
  },
  strikes: {
    id: 'strikes',
    kicker: 'The staff in your hands',
    title: 'Five ages',
    steps: [
      { keys: ['Click'], text: 'Strike a sector of the spiral. It may take more than one blow.' },
      { keys: [], text: 'Every age you break takes something from you. Read what it takes.' },
    ],
  },
  sea: {
    id: 'sea',
    kicker: 'Down the path',
    title: 'The shore',
    steps: [
      { keys: ['Mouse'], text: 'Look along the water.' },
      { keys: ['S'], text: 'Go back up to the city. Esc works too.' },
    ],
  },
  diary: {
    id: 'diary',
    kicker: 'Afterwards',
    title: 'The diary',
    steps: [
      { keys: [], text: 'One entry a day — a real day. Come back tomorrow to write the next.' },
      { keys: [], text: 'A line you let go into the sea may reach someone else.' },
    ],
  },
};

/** Tips: shown once, beside whatever is happening, without stopping it. */
export const TIPS: Record<string, Guide> = {
  dejavu: {
    id: 'tip:dejavu',
    kicker: 'Déjà vu',
    title: 'You have heard this before',
    steps: [
      { keys: [], text: 'The pale words are the ones still to come. They light up as they are said.' },
      { keys: ['F'], text: 'Press just before the underlined word to finish the sentence first.' },
      { keys: ['O'], text: 'Too fast? Settings: "Déjà vu without timing".' },
    ],
  },
  chronicle: {
    id: 'tip:chronicle',
    kicker: 'Written down',
    title: 'The chronicle',
    steps: [
      { keys: ['C'], text: 'What you learn is kept here, and survives midnight. It opens new things to say.' },
    ],
  },
  book: {
    id: 'tip:book',
    kicker: 'Noted',
    title: 'The Book of Strangers',
    steps: [
      { keys: ['B'], text: 'You saw where someone is at this hour. The book will remember it tomorrow.' },
    ],
  },
  mask: {
    id: 'tip:mask',
    kicker: 'A new face',
    title: 'Masks',
    steps: [{ keys: ['M'], text: 'Put on a mask you own, or the next one, or your own face again.' }],
  },
  wind: {
    id: 'tip:wind',
    kicker: 'Noticed',
    title: 'The wind',
    steps: [{ keys: [], text: 'The wind rises when something strange is done. Every gust brings midnight an hour closer.' }],
  },
  reset: {
    id: 'tip:reset',
    kicker: 'Again',
    title: 'The same morning',
    steps: [{ keys: [], text: 'Everyone has forgotten yesterday. You have not: your chronicle and the book are as you left them.' }],
  },
};

/** Keys for the place you are in, shown along the bottom-left edge. */
export const STAGE_CONTROLS: Partial<Record<StageId, string>> = {
  town: 'WASD — walk · E — talk · C — chronicle · B — strangers · H — help',
  spiral: 'Drag — turn a ring · Tab — registry · Esc — back · H — help',
  relief: 'W S — walk · A D — turn · Esc — let go · H — help',
  strikes: 'Click — strike · H — help',
  sea: 'S — back to the city · H — help',
};
