import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Story } from 'inkjs';
import { ENDINGS } from '../src/content/endings.ts';
import { KNOWLEDGE } from '../src/content/knowledge.ts';
import { TRIALS } from '../src/content/trials.ts';
import { compileInkFile } from '../tools/ink.ts';

const storyDir = resolve(import.meta.dirname, '../../../story');


/** Knots that take parameters, and what to enter them with. */
const KNOT_ARGS: Record<string, string[]> = { still: ['Kora'], caught_by_watch: ['2'], dog: ['hungry'] };
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
  assert.deepEqual(engine.choices().map((c) => c.text), ['Scrape the moss from the corner', 'Carve a word while nobody is watching', 'Run your fingers along the cracks', 'Leave it']);
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
  const known = new RegExp(`^(carve|carve_now|stele_lines|board|epilogue|wake_test:(true|prophet)|ending:(${Object.keys(ENDINGS).join("|")})|trial:(${TRIALS.map((t) => t.id).join('|')}))$`);
  for (const file of readdirSync(storyDir).filter((f) => f.endsWith('.ink'))) {
    const src = readFileSync(resolve(storyDir, file), 'utf8');
    for (const m of src.matchAll(/#action:(\S+)/g)) assert.match(m[1]!, known, `${file}: #action:${m[1]}`);
  }
});

test('no knot runs out of content, however often it is entered in one day', () => {
  // Once-only choices (*) vanish after they are taken; a knot the player can come back to must
  // always keep something to choose or end in DONE, or ink throws and the dialogue hangs.
  const { json } = compileInkFile(resolve(storyDir, 'main.ink'));
  const allFacts = KNOWLEDGE.facts.map((f) => f.id);
  const functions = new Set<string>();
  for (const file of readdirSync(storyDir).filter((f) => f.endsWith('.ink'))) {
    for (const m of readFileSync(resolve(storyDir, file), 'utf8').matchAll(/^===\s*function\s+(\w+)/gm)) functions.add(m[1]!);
  }
  const knots = [...new Story(json).mainContentContainer.namedContent.keys()].filter((k) => !k.startsWith('global ') && !functions.has(k));
  const problems = new Set<string>();
  for (const facts of [[] as string[], allFacts]) {
    for (const hour of [6, 8, 12, 15, 19, 23]) {
      const story = new Story(json);
      story.allowExternalFunctionFallbacks = true;
      const known = new Set(facts);
      story.BindExternalFunction('knows', (id: string) => known.has(id), true);
      story.BindExternalFunction('learn', (id: string) => { known.add(id); }, false);
      story.BindExternalFunction('hour', () => hour, true);
      let error = '';
      story.onError = (m: string) => { error = m; };
      for (const knot of knots) {
        for (let visit = 0; visit < 5; visit++) {
          error = '';
          story.ChoosePathString(knot, true, KNOT_ARGS[knot] ?? []);
          for (let steps = 0; steps < 200 && !error; steps++) {
            while (story.canContinue && !error) story.Continue();
            const choices = story.currentChoices;
            if (!choices.length || error) break;
            story.ChooseChoiceIndex((visit + steps) % choices.length);
          }
          if (error && ![...problems].some((p) => p.startsWith(`${knot} `))) problems.add(`${knot} (visit ${visit + 1}, ${hour}:00, ${facts.length ? 'all facts' : 'no facts'}): ${error.slice(0, 60)}`);
        }
      }
    }
  }
  assert.deepEqual([...problems], []);
});

test('narration does not wear a speaker nameplate', () => {
  // "Cleon sees your face…" or "His face is…" are the narrator's, not the speaker's: a line tagged
  // with a speaker must not describe that speaker in the third person.
  const problems: string[] = [];
  for (const file of readdirSync(storyDir).filter((f) => f.endsWith('.ink'))) {
    for (const line of readFileSync(resolve(storyDir, file), 'utf8').split('\n')) {
      const m = /#speaker:(\w+)/.exec(line);
      if (!m) continue;
      const text = line.replace(/#.*$/, '').replace(/^[\s\-*+]*(\[[^\]]*\])?\s*/, '').trim();
      const name = m[1]!;
      if (new RegExp(`^${name} [a-z]`).test(text) || /^(His|Her) [a-z]+ (is|are|was)\b/.test(text) || /^(He|She) (relaxes|laughs|looks|takes|stands|sees|is quiet)\b/.test(text)) {
        problems.push(`${file}: ${text.slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

/** Runs a knot to its end with the given facts, always taking the first choice; returns the facts it taught. */
function runKnot(knot: string, facts: string[], env: Record<string, unknown> = {}): { learned: string[]; text: string; choices: string[] } {
  const { json } = compileInkFile(resolve(storyDir, 'main.ink'));
  const story = new Story(json);
  story.allowExternalFunctionFallbacks = true;
  const known = new Set(facts);
  const learned: string[] = [];
  story.BindExternalFunction('knows', (id: string) => known.has(id), true);
  story.BindExternalFunction('learn', (id: string) => { known.add(id); learned.push(id); }, false);
  for (const [name, value] of Object.entries(env)) story.BindExternalFunction(name, () => value, true);
  story.ChoosePathString(knot, true, []);
  let text = '';
  const choices: string[] = [];
  for (let steps = 0; steps < 50; steps++) {
    while (story.canContinue) text += story.Continue();
    if (!story.currentChoices.length) break;
    choices.push(...story.currentChoices.map((c) => c.text));
    story.ChooseChoiceIndex(0);
  }
  return { learned, text, choices };
}

test('Aristion gives the key to someone he already trusts', () => {
  const r = runKnot('aristion', ['aristion_trust'], { hour: 7 });
  assert.ok(r.learned.includes('hall_key'), r.text);
});

test('the mountain endings are there in the last hour, however early the wind made it', () => {
  const r = runKnot('mountain_path', ['rain_at_midnight'], { hour: 20, last_hour: true });
  assert.ok(r.choices.some((c) => c.includes('Put out the sacred fire')), r.text);
  const early = runKnot('mountain_path', ['rain_at_midnight'], { hour: 20, last_hour: false });
  assert.ok(!early.choices.length, early.text);
});

test('the Curator quotes the note the player sent', () => {
  const r = runKnot('curator_meeting', ['curator_awake'], { curator_note: 'Leave the sea alone.' });
  assert.ok(r.text.includes('Leave the sea alone.'), r.text);
});
