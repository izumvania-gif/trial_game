// The people of Eferon who have no names: they are not in the Book of Strangers and nobody
// talks to them, but they live the same last day every time. Morning at the market and the
// port, noon around Cleon, evening indoors, and at night the procession with torches through
// the gate and up the holy mountain.
import { at } from '../core/clock.ts';
import { daySeed, seededRng } from '../core/rng.ts';
import { alongPath, pathLength, PLACES, route, type Place, type Point } from '../core/streets.ts';

export type Role = 'merchant' | 'porter' | 'water' | 'child' | 'elder' | 'acolyte';

interface Step {
  from: number;
  place: Place;
  /** Once there: go indoors (not drawn). */
  indoors?: boolean;
  /** The night walk: through the gate, up the mountain, then out of sight. */
  procession?: boolean;
}

export interface Extra {
  id: string;
  role: Role;
  color: string;
  height: number;
  /** Where they stand around a place, so a crowd is a crowd and not one point. */
  offset: Point;
  steps: Step[];
}

export interface ExtraState {
  x: number;
  z: number;
  heading: number;
  walking: boolean;
  visible: boolean;
  torch: boolean;
}

/** Game units walked per game minute: a little slower than the named residents. */
const PACE = 0.42;
/** Past the gate, the path the procession takes towards the mountain. */
const BEYOND_GATE: Point[] = [{ x: 10, z: -30 }, { x: 9, z: -40 }];
/** The procession walks faster: it has somewhere to be by midnight. */
const PROCESSION_PACE = 0.62;

const COUNTS: Record<Role, number> = { merchant: 6, porter: 5, water: 5, child: 5, elder: 3, acolyte: 4 };
const COLORS: Record<Role, string[]> = {
  merchant: ['#2a1a12', '#3a2216', '#1d130e'],
  porter: ['#140e0b', '#221610'],
  water: ['#e6dcc6', '#d9cdb4', '#efe6d2'],
  child: ['#2e1c12', '#3b2417'],
  elder: ['#cfc3a8', '#1a120d'],
  acolyte: ['#ece2c8'],
};
const HOMES: Place[] = ['westLane', 'eastLane', 'aristion', 'south', 'port', 'tavern', 'villa', 'eastRoad', 'shoreWest', 'shoreEast'];

function day(role: Role, home: Place, pick: () => number, speech: number): Step[] {
  const jitter = (m: number) => m + Math.floor(pick() * 25);
  // Everyone sets out for the agora in good time: nobody wants to miss it.
  const listen: Step = { from: speech - 95 + Math.floor(pick() * 15), place: 'agora' };
  const night = (h: number, m = 0) => ({ from: jitter(at(h, m)), place: 'mountain' as Place, procession: true });
  switch (role) {
    case 'merchant':
      return [{ from: 0, place: home }, { from: jitter(at(6, 20)), place: pick() < 0.5 ? 'agora' : 'stall' }, listen,
        { from: speech + 70, place: pick() < 0.5 ? 'stall' : 'center' }, { from: jitter(at(18)), place: home, indoors: true }, night(21)];
    case 'porter':
      return [{ from: 0, place: 'port' }, { from: jitter(at(8, 30)), place: pick() < 0.5 ? 'shoreWest' : 'shoreEast' }, listen,
        { from: speech + 60, place: 'port' }, { from: jitter(at(18, 30)), place: 'tavern' }, night(21, 15)];
    case 'water':
      return [{ from: 0, place: home, indoors: true }, { from: jitter(at(7)), place: 'center' }, { from: jitter(at(9)), place: home }, listen,
        { from: speech + 50, place: home, indoors: true }, night(20, 50)];
    case 'child':
      return [{ from: 0, place: home, indoors: true }, { from: jitter(at(7, 30)), place: 'center' }, { from: jitter(at(9)), place: 'south' },
        { from: jitter(at(10)), place: 'shore' }, listen, { from: speech + 40, place: 'stall' }, { from: jitter(at(15)), place: 'shoreEast' },
        { from: jitter(at(17, 30)), place: home, indoors: true }, night(21, 5)];
    case 'elder':
      return [{ from: 0, place: home, indoors: true }, { from: jitter(at(8)), place: 'council' }, listen, { from: speech + 60, place: 'stele' },
        { from: jitter(at(17)), place: home, indoors: true }, night(20, 40)];
    case 'acolyte':
      return [{ from: 0, place: 'temple' }, { from: jitter(at(10)), place: 'stele' }, { from: jitter(at(13)), place: 'temple' },
        { from: jitter(at(16)), place: 'northEast' }, { from: jitter(at(19)), place: 'temple' }, night(20, 40)];
  }
}

/** The same crowd every cycle. `patches` matter: an earlier speech moves the listeners too. */
export function makeCrowd(patches: string[]): Extra[] {
  const pick = seededRng(daySeed('eferon/crowd/v1'));
  const speech = patches.includes('cleon_early') ? at(11) : at(12);
  const crowd: Extra[] = [];
  for (const role of Object.keys(COUNTS) as Role[]) {
    for (let i = 0; i < COUNTS[role]; i++) {
      const home = HOMES[Math.floor(pick() * HOMES.length)]!;
      const colors = COLORS[role];
      const angle = pick() * Math.PI * 2;
      const r = 0.8 + pick() * 1.6;
      crowd.push({
        id: `${role}${i}`,
        role,
        color: colors[Math.floor(pick() * colors.length)]!,
        height: role === 'child' ? 1.05 + pick() * 0.2 : 1.55 + pick() * 0.25,
        offset: { x: Math.cos(angle) * r, z: Math.sin(angle) * r },
        // Sorted: with an earlier speech the walk to the agora can come before a morning errand.
        steps: day(role, home, pick, speech).sort((a, b) => a.from - b.from),
      });
    }
  }
  return crowd;
}

/** Where an extra is at a minute of the day; a pure function, like the residents' schedules. */
export function extraAt(extra: Extra, minute: number): ExtraState {
  const steps = extra.steps;
  let i = 0;
  while (i + 1 < steps.length && steps[i + 1]!.from <= minute) i++;
  const step = steps[i]!;
  const origin = i > 0 ? steps[i - 1]!.place : step.place;
  const path = route(origin, step.place);
  if (step.procession) path.push(...BEYOND_GATE);
  const length = pathLength(path);
  const walked = Math.max(0, (minute - step.from) * (step.procession ? PROCESSION_PACE : PACE));
  const walking = walked < length;
  const pos = alongPath(path, walked);
  // In a crowd, people stand apart; on the road, nearly in single file.
  const spread = walking ? 0.25 : 1;
  const x = pos.x + extra.offset.x * spread;
  const z = pos.z + extra.offset.z * spread;
  let heading = pos.heading;
  if (!walking && step.place === 'agora') heading = Math.atan2(PLACES.council.x - x, PLACES.council.z - z);
  const arrivedIndoors = !walking && !!step.indoors;
  const gone = !!step.procession && !walking;
  return { x, z, heading, walking, visible: !arrivedIndoors && !gone, torch: !!step.procession };
}
