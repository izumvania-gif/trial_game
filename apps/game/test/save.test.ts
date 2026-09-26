import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  exportTablet, importTablet, loadSave, newSave, SAVE_KEY, writeSave, type KeyValueStorage,
} from '../src/core/save.ts';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

test('save round-trips through storage', () => {
  const storage = memoryStorage();
  const save = newSave('v1');
  save.memory.facts.push('other_hand');
  save.cycle.minute = 300;
  assert.equal(writeSave(storage, save), true);
  const { save: loaded, status } = loadSave(storage, 'v1');
  assert.equal(status, 'loaded');
  assert.deepEqual(loaded, save);
});

test('a story change drops the cycle but keeps loop memory', () => {
  const storage = memoryStorage();
  const save = newSave('v1');
  save.memory.facts.push('name_in_stone');
  save.cycle.minute = 500;
  save.cycle.storyState = '{"old":true}';
  writeSave(storage, save);
  const { save: loaded, status } = loadSave(storage, 'v2');
  assert.equal(status, 'cycle-reset');
  assert.deepEqual(loaded.memory.facts, ['name_in_stone']);
  assert.equal(loaded.cycle.minute, 0);
  assert.equal(loaded.cycle.storyState, null);
});

test('corrupt or blocked storage never throws', () => {
  const storage = memoryStorage();
  storage.data.set(SAVE_KEY, '{not json');
  assert.equal(loadSave(storage, 'v1').status, 'corrupt');
  const blocked: KeyValueStorage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceeded'); },
    removeItem: () => {},
  };
  assert.equal(loadSave(blocked, 'v1').status, 'unavailable');
  assert.equal(writeSave(blocked, newSave('v1')), false);
  assert.equal(loadSave(null, 'v1').status, 'unavailable');
});

test('wax tablet export/import', () => {
  const save = newSave('v1');
  save.memory.steleWords.push('ΦΙΛΛΙΣ');
  const code = exportTablet(save);
  assert.match(code, /^EFERON1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(importTablet(code, 'v1'), save);
  assert.equal(importTablet('garbage', 'v1'), null);
});
