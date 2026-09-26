export interface EndingCard {
  id: string;
  title: string;
  lines: string[];
  log: string[];
}

export const ENDINGS: Record<string, EndingCard> = {
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
