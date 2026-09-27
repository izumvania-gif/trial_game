// Two-layer saves (docs/concept.md §7):
// - LoopMemory survives the reset: what the player knows, words carved into the stele, endings seen.
// - CycleState is wiped by every purification: time, position, the ink story state.
import type { Mechanic, RegistryEntry, StageId, TicketDecision } from './types.ts';

export const SAVE_KEY = 'eferon.save';
export const SAVE_SCHEMA = 2;
const TABLET_PREFIX = 'EFERON1.';

export interface LoopMemory {
  /** Cycles this player has lived; starts at 1. The global CYCLE RUN comes from the server. */
  cycle: number;
  facts: string[];
  steleWords: string[];
  endingsSeen: string[];
  /** Last CYCLE RUN number the server reported, shown when offline. */
  lastCycleRun: number | null;
  /** Déjà vu lines the player has heard at least once (they can finish them next time). */
  heard: string[];
  /** Words Leont can carve into the stele. */
  lexicon: string[];
  masks: string[];
  /** The registry of past Leonts, by leont id. */
  registry: Record<string, RegistryEntry>;
  /** Anomalies Leont caused, which turn into tickets on the Desk. */
  anomalies: { id: string; cycle: number }[];
  /** Desk decisions by ticket id; patches take effect in Eferon from the next cycle. */
  tickets: Record<string, { decision: TicketDecision; patch?: string; cycle: number }>;
  /** Visits to the Desk; each is a "sprint" for the Curator. */
  sprint: number;
  /** Book of Strangers: "resident:entryIndex" for every schedule entry the player has witnessed. */
  seen: string[];
  /** The most recent ending and the cycle it happened in; the next dawn remembers it. */
  lastEnding: { id: string; cycle: number } | null;
  /** The first USER NOTE the Curator wrote not as noise; Leont reads it at dawn. */
  curatorNote: string | null;
  /** After the true ending (or as the prophet): the diary without dates, in real time. */
  epilogue: { mode: 'true' | 'prophet'; start: number; entries: { day: number; text: string }[] } | null;
  /** A backup was restored in the middle of the Night of Anamnesis: the world runs damaged. */
  damaged: boolean;
  /** How-to cards and tips already shown (content/guides.ts). */
  guides: string[];
  /** The loop cycle each fact was learned in: the morning recap tells what yesterday taught. */
  learnedOn: Record<string, number>;
  /** Hints the player chose to see, as "thread:step". */
  hintsShown: string[];
}

export interface CycleState {
  minute: number;
  stage: StageId;
  player: { x: number; z: number; facing: number };
  /** Serialized ink state; null at the start of a cycle. */
  storyState: string | null;
  /** 0..1: how much the observers have noticed today. Each third brings midnight an hour closer. */
  wind: number;
  wornMask: string | null;
  /** Mechanics destroyed by the strikes in the Night of Anamnesis. */
  lost: Mechanic[];
  /** How the planned night went on the board; null until it is played. */
  night: { citySilent: boolean; hallClear: boolean; shoreClear: boolean; rollbackAvoided?: boolean } | null;
  /** Anomalies already noticed today: each kind raises the wind once a day, however often it recurs. */
  noticed: string[];
  /** Where the finale stood when the page was last saved, so a reload resumes it instead of losing it. */
  finale: string | null;
}

export interface SaveFile {
  schema: number;
  /** Hash of the compiled story. When it changes, cycle state is dropped, memory kept. */
  contentVersion: string;
  memory: LoopMemory;
  cycle: CycleState;
}

/** The subset of Storage we use, so tests can pass a Map-backed fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function freshMemory(): LoopMemory {
  return {
    cycle: 1, facts: [], steleWords: [], endingsSeen: [], lastCycleRun: null,
    heard: [], lexicon: [], masks: [], registry: {}, anomalies: [], tickets: {}, sprint: 0, seen: [], lastEnding: null, curatorNote: null, epilogue: null, damaged: false, guides: [], learnedOn: {}, hintsShown: [],
  };
}

export function freshCycle(): CycleState {
  return {
    minute: 0, stage: 'town', player: { x: 0, z: 6, facing: Math.PI }, storyState: null,
    wind: 0, wornMask: null, lost: [], night: null, noticed: [], finale: null,
  };
}

export function newSave(contentVersion: string): SaveFile {
  return { schema: SAVE_SCHEMA, contentVersion, memory: freshMemory(), cycle: freshCycle() };
}

/** Migrations from schema N to N+1. Add an entry whenever SaveFile changes shape. */
const MIGRATIONS: Record<number, (old: any) => any> = {
  // v2 added memory/cycle fields; parseSave fills them from the fresh defaults.
  1: (old) => old,
};

export type LoadStatus = 'new' | 'loaded' | 'cycle-reset' | 'corrupt' | 'unavailable';

export function parseSave(raw: string, contentVersion: string): { save: SaveFile; status: LoadStatus } {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { save: newSave(contentVersion), status: 'corrupt' };
  }
  if (!data || typeof data.schema !== 'number' || data.schema > SAVE_SCHEMA) {
    return { save: newSave(contentVersion), status: 'corrupt' };
  }
  while (data.schema < SAVE_SCHEMA) {
    const migrate = MIGRATIONS[data.schema];
    if (!migrate) return { save: newSave(contentVersion), status: 'corrupt' };
    data = { ...migrate(data), schema: data.schema + 1 };
  }
  const memory: LoopMemory = { ...freshMemory(), ...data.memory };
  if (data.contentVersion !== contentVersion) {
    // The story changed under an existing save: the ink state may not load. Restart the day, keep memory.
    return { save: { schema: SAVE_SCHEMA, contentVersion, memory, cycle: freshCycle() }, status: 'cycle-reset' };
  }
  return { save: { schema: SAVE_SCHEMA, contentVersion, memory, cycle: { ...freshCycle(), ...data.cycle } }, status: 'loaded' };
}

export function loadSave(storage: KeyValueStorage | null, contentVersion: string): { save: SaveFile; status: LoadStatus } {
  if (!storage) return { save: newSave(contentVersion), status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { save: newSave(contentVersion), status: 'unavailable' };
  }
  if (raw === null) return { save: newSave(contentVersion), status: 'new' };
  return parseSave(raw, contentVersion);
}

/** Returns false when storage is blocked (private mode, quota); the game keeps running unsaved. */
export function writeSave(storage: KeyValueStorage | null, save: SaveFile): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: KeyValueStorage | null): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // nothing to clear
  }
}

/** The "wax tablet" code: a save as a copy-pasteable string for moving between computers. */
export function exportTablet(save: SaveFile): string {
  const bytes = new TextEncoder().encode(JSON.stringify(save));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return TABLET_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function importTablet(code: string, contentVersion: string): SaveFile | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(TABLET_PREFIX)) return null;
  try {
    const b64 = trimmed.slice(TABLET_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const { save, status } = parseSave(json, contentVersion);
    return status === 'corrupt' ? null : save;
  } catch {
    return null;
  }
}

/**
 * The illusion of the break: forgetting everything after the true ending keeps one shard —
 * a few lines of the diary and the fact that the break happened. A new Leont finds them.
 */
export const SHARD_KEY = 'eferon.shard';

export interface BreakShard {
  lines: string[];
  at: number;
}

export function readShard(storage: KeyValueStorage | null): BreakShard | null {
  try {
    const raw = storage?.getItem(SHARD_KEY);
    return raw ? (JSON.parse(raw) as BreakShard) : null;
  } catch {
    return null;
  }
}

export function writeShard(storage: KeyValueStorage | null, shard: BreakShard): void {
  try {
    storage?.setItem(SHARD_KEY, JSON.stringify(shard));
  } catch {
    // Without storage there is no shard. The break is then simply forgotten.
  }
}

/** localStorage, or null when the browser forbids touching it. */
export function browserStorage(): KeyValueStorage | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__eferon_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** FNV-1a hash of a string, used as the content version. */
export function hashContent(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
