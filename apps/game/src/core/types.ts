/** Each stage is a different genre with its own perspective and palette (docs/concept.md §1). */
export type StageId = 'town' | 'spiral' | 'relief' | 'desk' | 'board' | 'strikes' | 'sea' | 'diary';

export const STAGE_IDS: StageId[] = ['town', 'spiral', 'relief', 'desk', 'board', 'strikes', 'sea', 'diary'];

/** Mechanics the five strikes take away, one per age (docs/concept.md §3). */
export type Mechanic = 'schedules' | 'clock' | 'dejavu' | 'masks' | 'chronicle';

/** A player's attempt to identify one past Leont in the registry. */
export interface RegistryEntry {
  attempt: string | null;
  ending: string | null;
  locked: boolean;
}

export type TicketDecision = 'patch' | 'observe' | 'ignore';
