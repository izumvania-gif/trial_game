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

/**
 * When someone sets off for an entry of their day. A schedule says when they are *there* (the
 * Book, the script and the clues all speak of arrivals), so they leave early enough to arrive on
 * time — but never before they have arrived at the place before.
 */
export function departures(entries: ScheduleEntry[]): number[] {
  return entries.map((e, i) => {
    if (i === 0) return e.from;
    const walk = Math.ceil(pathLength(route(entries[i - 1]!.place, e.place)) / WALK_SPEED);
    return Math.max(entries[i - 1]!.from + 1, e.from - walk);
  });
}

/** Where a resident is at a given minute: deterministic, so every cycle replays the same day. */
export function residentAt(resident: Resident, minute: number, patches: string[]): ResidentState {
  const entries = resident.schedule(patches);
  const leave = departures(entries);
  let i = 0;
  while (i + 1 < entries.length && leave[i + 1]! <= minute) i++;
  const entry = entries[i]!;
  const origin = i > 0 ? entries[i - 1]!.place : entry.place;
  const path = route(origin, entry.place);
  const walked = (minute - leave[i]!) * WALK_SPEED;
  const pos = alongPath(path, walked);
  return { ...pos, entryIndex: i, entry, walking: walked < pathLength(path) };
}
