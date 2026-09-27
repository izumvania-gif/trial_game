// How the scribe and the named people of Eferon look in the town, so each can be told from the
// crowd at a glance: one silhouette each, after their portraits (`ui/portraits.ts`). The crowd
// stays plain black figures.
import type { FigureLook } from '../stages/figures.ts';

export const LOOKS: Record<string, FigureLook> = {
  // The player: a red cloak on the back (what the camera sees most) and the wax tablets.
  leont: { cape: true, props: ['tablet'] },
  aristion: { bent: true, beard: 'white', head: 'laurel', himation: true, props: ['staff'] },
  kora: { whiteFace: true, head: 'veil', props: ['wheat'] },
  cleon: { beard: 'dark', head: 'fillet', arm: 'raised' },
  eion: { head: 'blindfold', beard: 'dark', props: ['lyre'] },
  lysimachus: { robe: 'red', wide: true, beard: 'dark', props: ['purse'] },
  hierocles: { robe: 'bone', head: 'oak', beard: 'dark' },
  glaucus: { hair: 'wild', beard: 'dark', props: ['trident'] },
  maskseller: { head: 'hood', props: ['masks'] },
  xenos: { head: 'hood' },
  talia: { whiteFace: true, hair: 'bun', head: 'fillet', props: ['net', 'basket'] },
  crier: { head: 'petasos', props: ['kerykeion'] },
};

/** Heights of the named, in metres (everyone else is 1.7). */
export const HEIGHTS: Record<string, number> = { cleon: 1.85, hierocles: 1.8, talia: 1.45, crier: 1.8, glaucus: 1.85 };
