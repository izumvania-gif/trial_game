// The Curator's side of the Night of Anamnesis (the "double board"). While the night plays out
// in Eferon, a colleague agent pushes the rollback ticket towards approval one lane per turn.
// Each turn the Curator may do one thing. If the ticket reaches ROLLBACK, the night is undone.

export const LANES = ['DETECTED', 'REVIEW', 'APPROVAL', 'ROLLBACK'] as const;
export type CuratorAction = 'wait' | 'defer' | 'reply' | 'noise';

export const ACTION_LABELS: Record<CuratorAction, string> = {
  wait: 'Do nothing',
  defer: 'Defer the ticket (back one lane)',
  reply: 'Answer Minotaur in chat (he skips his next move)',
  noise: 'Classify the sea event as noise (back to DETECTED)',
};

/** How many times each action can be used in one night. */
export const ACTION_USES: Record<CuratorAction, number> = { wait: Infinity, defer: 2, reply: 2, noise: 1 };

export interface SprintState {
  lane: number;
  /** Minotaur skips his next advance. */
  distracted: boolean;
  used: Record<CuratorAction, number>;
}

export function initialSprint(): SprintState {
  return { lane: 0, distracted: false, used: { wait: 0, defer: 0, reply: 0, noise: 0 } };
}

export function canUse(state: SprintState, action: CuratorAction): boolean {
  return state.used[action] < ACTION_USES[action] && state.lane < LANES.length - 1;
}

/** One night turn: the Curator acts, then Minotaur advances the ticket unless distracted. */
export function sprintTurn(state: SprintState, action: CuratorAction): SprintState {
  if (state.lane >= LANES.length - 1) return state;
  const s: SprintState = { lane: state.lane, distracted: state.distracted, used: { ...state.used } };
  if (!canUse(state, action)) action = 'wait';
  s.used[action] += 1;
  if (action === 'defer') s.lane = Math.max(0, s.lane - 1);
  if (action === 'noise') s.lane = 0;
  if (action === 'reply') s.distracted = true;
  if (s.distracted && action !== 'reply') s.distracted = false;
  else if (!s.distracted) s.lane = Math.min(LANES.length - 1, s.lane + 1);
  return s;
}

export function rolledBack(state: SprintState): boolean {
  return state.lane >= LANES.length - 1;
}
