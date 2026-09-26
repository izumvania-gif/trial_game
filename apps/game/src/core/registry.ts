import { CONFIRM_IN, PAST_LEONTS } from '../content/leonts.ts';
import type { RegistryEntry } from './types.ts';

/**
 * Obra Dinn's rule: once CONFIRM_IN unlocked entries are fully correct at the same time,
 * all correct entries lock. Returns the ids that just locked (empty = no confirmation).
 * Wrong entries are never revealed as wrong.
 */
export function confirmEntries(registry: Record<string, RegistryEntry>): string[] {
  const correct = PAST_LEONTS.filter((l) => {
    const e = registry[l.id];
    return e && !e.locked && e.attempt === l.attempt && e.ending === l.fate;
  });
  if (correct.length < CONFIRM_IN) return [];
  for (const l of correct) registry[l.id]!.locked = true;
  return correct.map((l) => l.id);
}

export function lockedCount(registry: Record<string, RegistryEntry>): number {
  return Object.values(registry).filter((e) => e.locked).length;
}
