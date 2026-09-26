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

test('notes: premoderated — nothing is visible until approved', async () => {
  const app = await buildApp({ store: openStore(':memory:'), steleCooldownMs: 0, adminToken: 'secret' });
  assert.equal((await app.inject({ method: 'POST', url: '/api/notes', payload: { text: 'The sea took my name and gave back a better one.' } })).statusCode, 200);
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/notes' })).json().notes, []);

  const unauth = await app.inject({ method: 'GET', url: '/api/admin/notes' });
  assert.equal(unauth.statusCode, 401);
  const auth = { authorization: 'Bearer secret' };
  const pending = (await app.inject({ method: 'GET', url: '/api/admin/notes', headers: auth })).json().notes;
  assert.equal(pending.length, 1);
  const approve = await app.inject({ method: 'POST', url: `/api/admin/notes/${pending[0].id}`, headers: auth, payload: { status: 'approved' } });
  assert.equal(approve.statusCode, 200);
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/notes' })).json().notes, ['The sea took my name and gave back a better one.']);
  await app.close();
});

test('notes: links, other scripts, the forbidden words and over-long notes are refused', async () => {
  const { cleanNote } = await import('../src/notes.ts');
  assert.equal(cleanNote('see https://spam.example'), null);
  assert.equal(cleanNote('Привет'), null);
  assert.equal(cleanNote('the golden age returns'), null);
  assert.equal(cleanNote('x'.repeat(141)), null);
  assert.equal(cleanNote('  today   the fisherman did not come back  '), 'today the fisherman did not come back');
});

test('admin endpoints do not exist without ADMIN_TOKEN', async () => {
  const app = await buildApp({ store: openStore(':memory:') });
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/notes' })).statusCode, 404);
  await app.close();
});
