// Per-viewer settings (accessibility, sound, performance). Stored in localStorage apart from the
// save: forgetting everything in the game does not forget how the player needs it to be played.
import type { KeyValueStorage } from './save.ts';

export const SETTINGS_KEY = 'eferon.settings';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  /** Captions for sounds ("[the wind rises]"). */
  subtitles: boolean;
  largeText: boolean;
  /** Déjà vu without timing: F at any moment while the line is spoken finishes it. */
  noRhythm: boolean;
  reducedMotion: boolean;
  /** Real minutes in one Eferon day. */
  dayMinutes: 18 | 24 | 30;
  quality: 'auto' | 'high' | 'low';
  /** Keeps the service layer inside the game: no tab-title or favicon tricks, no console notes. */
  lessMeta: boolean;
  /** How-to cards the first time in each place, and tips for new mechanics. */
  tips: boolean;
  /** Pilgrim: nothing points the way. No goal under the clock, no marks over places, no "Where next?", no hints. */
  pilgrim: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  subtitles: false,
  largeText: false,
  noRhythm: false,
  reducedMotion: false,
  dayMinutes: 18,
  quality: 'auto',
  lessMeta: false,
  tips: true,
  pilgrim: false,
};

export function loadSettings(storage: KeyValueStorage | null): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings then last for this session only.
  }
}

/** A tiny observable holder so audio, renderer and UI all follow changes live. */
export class SettingsStore {
  value: Settings;
  private listeners = new Set<(s: Settings) => void>();
  private storage: KeyValueStorage | null;

  constructor(storage: KeyValueStorage | null) {
    this.storage = storage;
    this.value = loadSettings(storage);
  }

  update(patch: Partial<Settings>): void {
    this.value = { ...this.value, ...patch };
    saveSettings(this.storage, this.value);
    for (const l of this.listeners) l(this.value);
  }

  subscribe(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    fn(this.value);
    return () => this.listeners.delete(fn);
  }
}
