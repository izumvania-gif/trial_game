import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.ts';
import { CYCLE_RUN_FIRST, openStore } from '../src/db.ts';

test('counter starts at the prologue cycle and increments on reset', async () => {
  const app = await buildApp({ store: openStore(':memory:'), resetCooldownMs: 0 });
  const first = await app.inject({ method: 'GET', url: '/api/counter' });
  assert.equal(first.json().cycleRun, CYCLE_RUN_FIRST);

  const reset = await app.inject({ method: 'POST', url: '/api/counter/reset' });
  assert.equal(reset.json().cycleRun, CYCLE_RUN_FIRST + 1);
  await app.close();
});

test('resets from one IP are rate limited', async () => {
  const app = await buildApp({ store: openStore(':memory:'), resetCooldownMs: 60_000 });
  assert.equal((await app.inject({ method: 'POST', url: '/api/counter/reset' })).statusCode, 200);
  const second = await app.inject({ method: 'POST', url: '/api/counter/reset' });
  assert.equal(second.statusCode, 429);
  assert.equal(second.json().cycleRun, CYCLE_RUN_FIRST + 1);
  await app.close();
});

test('health check', async () => {
  const app = await buildApp({ store: openStore(':memory:') });
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/health' })).json(), { ok: true });
  await app.close();
});

test('stele: vocabulary-only lines are stored and sampled back', async () => {
  const app = await buildApp({ store: openStore(':memory:'), steleCooldownMs: 0 });
  const empty = (await app.inject({ method: 'GET', url: '/api/stele' })).json();
  assert.ok(empty.words.includes('the sea'));
  assert.deepEqual(empty.lines, []);

  const ok = await app.inject({ method: 'POST', url: '/api/stele', payload: { words: ["don't", 'trust', 'the sky'] } });
  assert.equal(ok.statusCode, 200);
  const bad = await app.inject({ method: 'POST', url: '/api/stele', payload: { words: ['buy', 'crypto'] } });
  assert.equal(bad.statusCode, 400);
  const tooLong = await app.inject({ method: 'POST', url: '/api/stele', payload: { words: Array(7).fill('no') } });
  assert.equal(tooLong.statusCode, 400);

  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/stele' })).json().lines, [["don't", 'trust', 'the sky']]);
  await app.close();
});

test('stele: one line per IP per cooldown', async () => {
  const app = await buildApp({ store: openStore(':memory:'), steleCooldownMs: 60_000 });
  const post = () => app.inject({ method: 'POST', url: '/api/stele', payload: { words: ['wake'] } });
  assert.equal((await post()).statusCode, 200);
  assert.equal((await post()).statusCode, 429);
  await app.close();
});
