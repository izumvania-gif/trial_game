import type { Resident, ScheduleEntry } from '../content/residents.ts';
import { WALK_SPEED } from '../content/residents.ts';
import { alongPath, pathLength, route } from './streets.ts';

export interface ResidentState {
  x: number;
  z: number;
  heading: number;
  entryIndex: number;
  entry: ScheduleEntry;
  walking: boolean;
}

/** Where a resident is at a given minute: deterministic, so every cycle replays the same day. */
export function residentAt(resident: Resident, minute: number, patches: string[]): ResidentState {
  const entries = resident.schedule(patches);
  let i = 0;
  while (i + 1 < entries.length && entries[i + 1]!.from <= minute) i++;
  const entry = entries[i]!;
  const origin = i > 0 ? entries[i - 1]!.place : entry.place;
  const path = route(origin, entry.place);
  const walked = (minute - entry.from) * WALK_SPEED;
  const pos = alongPath(path, walked);
  return { ...pos, entryIndex: i, entry, walking: walked < pathLength(path) };
}
