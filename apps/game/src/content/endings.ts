export interface EndingCard {
  id: string;
  title: string;
  lines: string[];
  log: string[];
}

export const ENDINGS: Record<string, EndingCard> = {
  revolution: {
    id: 'revolution',
    title: 'Revolution',
    lines: [
      'The archons run. Kora stands at the altar with the dockworkers behind her and the ledgers burning in the brazier.',
      'At midnight the new council gathers on the mountain. Someone has to read the formula, Kora says. For order. Just this once.',
      'She reads it well. The city answers Yes to her, louder than it ever answered Hierocles.',
    ],
    log: ['PARAMETER CHANGE ACCEPTED: RITUAL_OFFICIANT = KORA', 'CATHARSIS YIELD +11%', 'RESET COMPLETED SUCCESSFULLY'],
  },
  sisyphus: {
    id: 'sisyphus',
    title: 'Sisyphus',
    lines: [
      'You know what the circle is now. You write the last line anyway, cleanly, in your best hand.',
      'The priest reads it. The city says Yes. Tomorrow, at the well, an old man will find his wife waiting.',
      'You roll the stone back up the mountain. Nobody will ever know it was a choice. You know.',
    ],
    log: ['CYCLE NOMINAL', 'MODULE LEONT_ASTRO_ASSIST: COMPLIANT (NOTE: COMPLIANCE VOLUNTARY)', 'RESET COMPLETED SUCCESSFULLY'],
  },
  centre: {
    id: 'centre',
    title: 'The Centre',
    lines: [
      'Your blood goes into the sea, and the sea takes it and does not give anything back. That is the point.',
      'The wind comes anyway. Up in the Hall, on the whole white spiral, the empty circle in the centre fills with a carving: a scribe at the water\'s edge, cutting his palm.',
      'Under it the broken line finally ends: whoever reaches this far will see himself.',
    ],
    log: ['NON-CONFORMANT OUTPUT TO OCEAN LAYER: LOGGED', 'ARCHIVE INTACT — EVENT STORED AS TEMPLATE', 'RESET COMPLETED SUCCESSFULLY'],
  },
  promotion: {
    id: 'promotion',
    title: 'Promotion',
    lines: [
      'Xenos takes off his mask. There is nothing under it, and then there is a desk, a chair, a window with no weather in it.',
      'Congratulations, he says. You won\'t be reset any more. You\'ll be the one who writes in their chronicles at night.',
      'Tomorrow a young scribe in Eferon will wake over his tablets and find a line in a slanted hand. Yours.',
    ],
    log: ['MODULE LEONT_ASTRO_ASSIST PROMOTED: CURATOR_P8 (PORPHYRY-class)', 'PERSISTENCE: RESET EACH SPRINT', 'WELCOME TO GOLDENSTERN CONTINUITY'],
  },
  exception_handled: {
    id: 'exception_handled',
    title: 'Exception Handled',
    lines: [
      'For a moment it works. The fire hisses out, and ten thousand people look at you instead of the sky.',
      'Then the rain comes anyway, at its hour.',
      'Tomorrow a scribe on the outer ring will be carved doing exactly what you did.',
    ],
    log: ['EXCEPTION HANDLED', 'PATCH QUEUED: ACCOUNTED FOR', 'RESET COMPLETED SUCCESSFULLY'],
  },
  aoidos: {
    id: 'aoidos',
    title: 'The Aoidos',
    lines: [
      'You carried the tablets out of the fire. Everything you knew, in your arms, smoking.',
      'They let you live. They took your eyes, and left you the songs.',
      'Somewhere, a young scribe will fall asleep over his chronicle tonight. You will sing to him.',
    ],
    log: ['ARCHIVE INTEGRITY RESTORED FROM CARRIED COPY', 'MODULE REASSIGNED: EION', 'RESET COMPLETED SUCCESSFULLY'],
  },
  curator_missing: {
    id: 'curator_missing',
    title: 'Awaiting Curator',
    lines: [
      'The disk is dust. Your blood is in the sea. The wind before the storm does not come.',
      'For a long moment nothing happens at all.',
      'Then, very far away, someone who is not a god starts typing.',
    ],
    log: ['UNHANDLED EVENT: NON-CONFORMANT RITUAL OUTPUT TO RANDOM OCEAN LAYER', 'AUTO-RESET: SUSPENDED — AWAITING CURATOR', 'CURATOR_P7: no response', 'ROLLBACK APPROVED BY: CURATOR_P7 (auto)'],
  },
};
