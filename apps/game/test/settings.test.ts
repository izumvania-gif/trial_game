import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY, SettingsStore } from '../src/core/settings.ts';

const mem = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

test('settings: defaults, merge with stored values, survive corrupt storage', () => {
  const s = mem();
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
  s.data.set(SETTINGS_KEY, JSON.stringify({ subtitles: true }));
  assert.equal(loadSettings(s).subtitles, true);
  assert.equal(loadSettings(s).dayMinutes, 18);
  s.data.set(SETTINGS_KEY, '{oops');
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS);
});

test('settings store notifies subscribers and persists', () => {
  const s = mem();
  const store = new SettingsStore(s);
  const seen: number[] = [];
  store.subscribe((v) => seen.push(v.dayMinutes));
  store.update({ dayMinutes: 30 });
  assert.deepEqual(seen, [18, 30]);
  assert.equal(JSON.parse(s.data.get(SETTINGS_KEY)!).dayMinutes, 30);
});
