import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialSprint, rolledBack, sprintTurn, type CuratorAction } from '../src/core/sprint.ts';

const play = (actions: CuratorAction[]) => actions.reduce(sprintTurn, initialSprint());

test('doing nothing lets Minotaur roll the night back in three turns', () => {
  assert.equal(rolledBack(play(['wait', 'wait', 'wait'])), true);
});

test('a careful Curator survives a seven-turn night', () => {
  const s = play(['reply', 'wait', 'defer', 'reply', 'wait', 'noise', 'defer']);
  assert.equal(rolledBack(s), false);
});

test('using noise too early wastes it', () => {
  assert.equal(rolledBack(play(['noise', 'wait', 'wait', 'wait', 'defer', 'defer', 'reply'])), true);
});

test('each action has a limited number of uses', () => {
  const s = play(['defer', 'defer', 'defer']);
  assert.equal(s.used.defer, 2);
  assert.equal(s.used.wait, 1);
});
