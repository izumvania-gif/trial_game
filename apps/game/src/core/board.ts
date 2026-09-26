// The Night of Anamnesis, planned on a painted board (Into the Breach style: every enemy's
// route is shown before the night starts). Pure logic; BoardStage draws it.

export type Tile = [number, number]; // [column, row], row 0 = north
export type AllyId = 'kora' | 'aristion' | 'eion' | 'talia';
export type EnemyId = 'priest' | 'guardA' | 'guardB' | 'guardC' | 'lysimachus';

export const COLS = 7;
export const ROWS = 5;

export const LANDMARKS: Record<string, Tile> = {
  mountain: [6, 0],
  hall: [3, 0],
  shore: [3, 4],
  tavern: [0, 4],
};

export interface Enemy {
  id: EnemyId;
  name: string;
  /** First tile is the start; last is the goal. */
  path: Tile[];
  goal: 'mountain' | 'hall' | 'shore';
  /** Allies who can talk this enemy into stopping. */
  stoppedBy: AllyId[];
}

export const ENEMIES: Enemy[] = [
  {
    id: 'priest', name: 'Priest of Zeus', goal: 'mountain', stoppedBy: ['kora', 'aristion'],
    path: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [6, 0]],
  },
  {
    id: 'guardA', name: 'Temple guard', goal: 'hall', stoppedBy: ['aristion'],
    path: [[6, 3], [5, 3], [4, 3], [4, 2], [3, 2], [3, 1], [3, 0]],
  },
  {
    id: 'guardB', name: 'Temple guard', goal: 'hall', stoppedBy: ['aristion'],
    path: [[6, 2], [5, 2], [4, 2], [3, 2], [3, 1], [3, 0]],
  },
  {
    id: 'lysimachus', name: 'Lysimachus the merchant', goal: 'shore', stoppedBy: ['kora', 'aristion', 'eion', 'talia'],
    path: [[1, 0], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 4]],
  },
];

/** The counterplan: if the day was loud (a strong wind by evening), a third guard comes up from the port. */
export const EXTRA_GUARD: Enemy = {
  id: 'guardC', name: 'Temple guard', goal: 'hall', stoppedBy: ['aristion'],
  path: [[5, 4], [4, 4], [4, 3], [4, 2], [3, 2], [3, 1], [3, 0]],
};

export function enemiesFor(wind: number): Enemy[] {
  return wind >= 0.66 ? [...ENEMIES, EXTRA_GUARD] : ENEMIES;
}

export const ALLY_NAMES: Record<AllyId, string> = { kora: 'Kora', aristion: 'Aristion', eion: 'Eion', talia: 'Talia' };

export const sameTile = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1];

/** Tiles where an ally may stand: not a landmark, not an enemy's starting tile. */
export function canPlace(tile: Tile, enemies: Enemy[] = ENEMIES): boolean {
  const [c, r] = tile;
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  if (Object.values(LANDMARKS).some((t) => sameTile(t, tile))) return false;
  return !enemies.some((e) => sameTile(e.path[0]!, tile));
}

export interface EnemyState {
  id: EnemyId;
  step: number;
  held: boolean;
  /** Who held them, for the report. */
  heldBy: AllyId | null;
}

export interface NightOutcome {
  /** No priest reached the mountain: nobody leads the city's "Yes". */
  citySilent: boolean;
  /** No guard reached the Hall: the spiral is unguarded for the strikes. */
  hallClear: boolean;
  /** Lysimachus did not reach the shore to see what Leont does there. */
  shoreClear: boolean;
}

/** One turn: every enemy that is still moving steps forward unless an ally who can stop them stands there. */
export function step(states: EnemyState[], allies: Partial<Record<AllyId, Tile>>, enemies: Enemy[] = ENEMIES): EnemyState[] {
  return states.map((s) => {
    const enemy = enemies.find((e) => e.id === s.id)!;
    if (s.held || s.step >= enemy.path.length - 1) return s;
    const next = enemy.path[s.step + 1]!;
    const blocker = (Object.entries(allies) as [AllyId, Tile][]).find(([id, t]) => sameTile(t, next) && enemy.stoppedBy.includes(id));
    if (blocker) return { ...s, held: true, heldBy: blocker[0] };
    return { ...s, step: s.step + 1 };
  });
}

export function initialStates(enemies: Enemy[] = ENEMIES): EnemyState[] {
  return enemies.map((e) => ({ id: e.id, step: 0, held: false, heldBy: null }));
}

export function finished(states: EnemyState[], enemies: Enemy[] = ENEMIES): boolean {
  return states.every((s) => s.held || s.step >= enemies.find((e) => e.id === s.id)!.path.length - 1);
}

export function simulate(allies: Partial<Record<AllyId, Tile>>, enemies: Enemy[] = ENEMIES): { turns: EnemyState[][]; outcome: NightOutcome } {
  const turns = [initialStates(enemies)];
  while (!finished(turns[turns.length - 1]!, enemies) && turns.length < 20) turns.push(step(turns[turns.length - 1]!, allies, enemies));
  return { turns, outcome: outcomeOf(turns[turns.length - 1]!, enemies) };
}

export function outcomeOf(states: EnemyState[], enemies: Enemy[] = ENEMIES): NightOutcome {
  const reached = (goal: Enemy['goal']) =>
    states.some((s) => {
      const e = enemies.find((x) => x.id === s.id)!;
      return e.goal === goal && !s.held && s.step >= e.path.length - 1;
    });
  return { citySilent: !reached('mountain'), hallClear: !reached('hall'), shoreClear: !reached('shore') };
}
