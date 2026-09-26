import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Story } from 'inkjs';
import { ENDINGS } from '../src/content/endings.ts';
import { KNOWLEDGE } from '../src/content/knowledge.ts';
import { compileInkFile } from '../tools/ink.ts';

const storyDir = resolve(import.meta.dirname, '../../../story');

test('story compiles', () => {
  const { json } = compileInkFile(resolve(storyDir, 'main.ink'));
  assert.ok(new Story(json));
});

test('every fact the story uses exists in the knowledge graph', () => {
  const ids = new Set(KNOWLEDGE.facts.map((f) => f.id));
  for (const file of readdirSync(storyDir).filter((f) => f.endsWith('.ink'))) {
    const src = readFileSync(resolve(storyDir, file), 'utf8');
    for (const m of src.matchAll(/\b(?:learn|knows)\("([^"]+)"\)/g)) {
      assert.ok(ids.has(m[1]!), `${file} uses unknown fact "${m[1]}"`);
    }
  }
});

test('StoryEngine: knots, choices, learning and stage tags', async () => {
  const { StoryEngine } = await import('../src/engine/story.ts');
  const { Knowledge } = await import('../src/core/knowledge.ts');
  const { json } = compileInkFile(resolve(storyDir, 'main.ink'));
  const knowledge = new Knowledge(KNOWLEDGE, []);
  const engine = new StoryEngine(json, { knowledge, cycle: () => 1, hour: () => 6 }, null);

  engine.enter('stele');
  assert.match(engine.next()!.text, /star stele/);
  assert.equal(engine.canContinue(), false);
  assert.deepEqual(engine.choices().map((c) => c.text), ['Scrape the moss from the corner', 'Run your fingers along the cracks', 'Leave it']);
  engine.choose(0);
  const lines = [];
  for (let l = engine.next(); l; l = engine.next()) lines.push(l);
  assert.ok(knowledge.knows('name_in_stone'));
  assert.equal(lines[0]!.spendMinutes, 10);

  knowledge.learn('hall_key');
  engine.enter('temple_door');
  engine.next();
  engine.choose(0);
  const goIn = engine.next()!;
  assert.equal(goIn.stage, 'spiral');

  // State survives serialization (it is part of the cycle save).
  const restored = new StoryEngine(json, { knowledge, cycle: () => 1, hour: () => 6 }, engine.saveState());
  assert.ok(restored.hasKnot('midnight'));
});

test('déjà vu lines: cue marker is parsed and removed; host functions drive branches', async () => {
  const { StoryEngine } = await import('../src/engine/story.ts');
  const { Knowledge } = await import('../src/core/knowledge.ts');
  const { json } = compileInkFile(resolve(storyDir, 'main.ink'));
  const knowledge = new Knowledge(KNOWLEDGE, ['rain_at_midnight']);
  let finished = false;
  const engine = new StoryEngine(json, {
    knowledge, cycle: () => 2, hour: () => 7,
    functions: { dejavu_ok: () => finished, notice: () => true },
  }, null);
  engine.enter('aristion');
  engine.next();
  const line = engine.next()!;
  assert.equal(line.dejavu, 'aristion_restless');
  assert.ok(!line.text.includes('^'));
  assert.equal(line.text.split(/\s+/)[line.cue], 'Go');
  finished = true; // the player beat him to it
  const lines = [];
  for (let l = engine.next(); l; l = engine.next()) lines.push(l.text);
  assert.ok(knowledge.knows('hall_key'));
  assert.ok(knowledge.knows('aristion_trust'));
});

test('every action tag in the story is one the game handles', () => {
  const known = new RegExp(`^(carve|stele_lines|board|ending:(${Object.keys(ENDINGS).join('|')}))$`);
  for (const file of readdirSync(storyDir).filter((f) => f.endsWith('.ink'))) {
    const src = readFileSync(resolve(storyDir, file), 'utf8');
    for (const m of src.matchAll(/#action:(\S+)/g)) assert.match(m[1]!, known, `${file}: #action:${m[1]}`);
  }
});
