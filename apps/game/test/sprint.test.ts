import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialSprint, rolledBack, SPRINT_TURNS, sprintTurn, type CuratorAction } from '../src/core/sprint.ts';

const play = (actions: CuratorAction[]) => actions.reduce(sprintTurn, initialSprint());

test('doing nothing lets Minotaur roll the night back in three turns', () => {
  assert.equal(rolledBack(play(['wait', 'wait', 'wait'])), true);
});

test('a careful Curator survives the whole night', () => {
  const s = play(['wait', 'wait', 'defer', 'reply', 'wait', 'noise', 'reply', 'defer']);
  assert.equal(s.used.wait + s.used.defer + s.used.reply + s.used.noise, SPRINT_TURNS);
  assert.equal(rolledBack(s), false);
});

test('Minotaur does not fall for the same chat twice running', () => {
  const s = play(['wait', 'wait', 'reply', 'reply']);
  assert.equal(s.used.reply, 1);
  // Stalling twice and then resetting is not enough for eight turns.
  assert.equal(rolledBack(play(['wait', 'wait', 'reply', 'reply', 'noise', 'wait', 'wait', 'wait'])), true);
});

test('using noise too early wastes it', () => {
  assert.equal(rolledBack(play(['noise', 'wait', 'wait', 'wait', 'defer', 'defer', 'reply'])), true);
});

test('each action has a limited number of uses', () => {
  const s = play(['defer', 'defer', 'defer']);
  assert.equal(s.used.defer, 2);
  assert.equal(s.used.wait, 1);
});
