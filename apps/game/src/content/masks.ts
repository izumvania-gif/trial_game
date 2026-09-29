// Masks freed from the spiral (the face of a past Leont) and what wearing one does.
// Effects live in the ink (wearing() == "Name"); this is what the mask seller and the HUD say.
export const MASKS: Record<string, { from: string; effect: string }> = {
  Extinguisher: { from: 'l1', effect: 'The one who put out the fire. Singers who were scribes know this face.' },
  Orator: { from: 'l2', effect: 'The one who spoke first. With this face a scribe can address the assembly.' },
  Killer: { from: 'l3', effect: 'The one who used the knife. Guards step aside. Priests remember.' },
  Blank: { from: 'l12', effect: 'The one who said yes to the stranger. The stranger will talk to it as a colleague.' },
  Hermes: { from: 'trainer', effect: 'The messenger of the gods, for the one who beat every water-clock. You run faster than anyone in Eferon.' },
};
