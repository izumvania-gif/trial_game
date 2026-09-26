// The simulation wears. The first days are clean; then, a little more every loop, the day
// catches on itself: someone takes the same step twice, the smoke stops in the air, the mark
// shows for a frame on a wall, the whole city hitches. Nothing here is chance: the glitches of
// a given cycle are fixed by its number, like everything else that is not the sea.
import { at } from './clock.ts';
import { daySeed, seededRng } from './rng.ts';

export type GlitchKind = 'stutter' | 'freeze' | 'mark' | 'hitch';

export interface Glitch {
  /** Game minute (since dawn) when it happens. */
  minute: number;
  kind: GlitchKind;
  /** Real seconds it lasts. */
  seconds: number;
  /** 0..1, for choosing where (which side of the street the mark shows on). */
  pick: number;
}

/** The first two days are clean. */
const CLEAN_CYCLES = 2;
const MAX_GLITCHES = 16;

/** How worn the day is, 0..1: reaches 1 around the twentieth loop. */
export function wearLevel(cycle: number): number {
  return Math.max(0, Math.min(1, (cycle - CLEAN_CYCLES) / 18));
}

export function glitchesFor(cycle: number): Glitch[] {
  if (cycle <= CLEAN_CYCLES) return [];
  const rand = seededRng(daySeed(`eferon/wear/${cycle}`));
  const count = Math.min(MAX_GLITCHES, Math.floor((cycle - CLEAN_CYCLES) * 0.9) + 1);
  const wear = wearLevel(cycle);
  // Hitches and the mark are the strongest: they come in only once the day is well worn.
  const kinds: GlitchKind[] = wear < 0.25 ? ['stutter', 'freeze'] : wear < 0.5 ? ['stutter', 'freeze', 'mark'] : ['stutter', 'freeze', 'mark', 'hitch'];
  const out: Glitch[] = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)]!;
    const seconds = kind === 'mark' ? 0.14 : kind === 'hitch' ? 0.2 + wear * 0.25 : 0.8 + wear * 1.6;
    out.push({ minute: Math.floor(at(7) + rand() * (at(23) - at(7))), kind, seconds, pick: rand() });
  }
  return out.sort((a, b) => a.minute - b.minute);
}
