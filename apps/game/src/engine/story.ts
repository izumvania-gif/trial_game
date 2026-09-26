// Thin wrapper over inkjs. Knots are entered directly (ChoosePathString) from game events;
// the ink state is part of CycleState and is thrown away by every reset.
import { Story } from 'inkjs';
import type { Knowledge } from '../core/knowledge.ts';
import type { StageId } from '../core/types.ts';
import { guessMood, isMood, type Mood } from '../content/moods.ts';

export type LineStyle = 'narration' | 'hand' | 'log' | 'hint' | 'voice';

export interface StoryLine {
  text: string;
  speaker: string | null;
  /** How it is said: #mood:<mood>, or a guess from the words. Drives the portrait's face. */
  mood: Mood;
  style: LineStyle;
  /** Stage to switch to once this line has been shown. */
  stage: StageId | null;
  spendMinutes: number;
  /** Déjà vu line id: the second time around the player can finish it (ui/Dialogue.ts). */
  dejavu: string | null;
  /** Index of the word the player must beat the speaker to (marked with ^ in ink). */
  cue: number;
  /** UI action requested by the line: board, carve, song, ending:<id>. */
  action: string | null;
}

export interface StoryChoice {
  index: number;
  text: string;
}

export interface StoryHost {
  knowledge: Knowledge;
  cycle(): number;
  hour(): number;
  /** Extra EXTERNAL functions. Bound as not lookahead-safe: ink calls them only when it reaches them. */
  functions?: Record<string, (...args: never[]) => unknown>;
}

import { STAGE_IDS as STAGES } from '../core/types.ts';

export class StoryEngine {
  private story: Story;

  constructor(json: string, host: StoryHost, savedState: string | null) {
    this.story = new Story(json);
    // Unbound EXTERNALs fall back to the ink definitions in main.ink (tests, older hosts).
    this.story.allowExternalFunctionFallbacks = true;
    // A mistake in the script (a knot that runs out of content, say) must end the conversation,
    // never throw out of the game loop and freeze the game.
    this.story.onError = (message: string) => {
      this.errors.push(message);
      console.error(`[ink] ${message}`);
    };
    this.story.BindExternalFunction('learn', (id: string) => {
      host.knowledge.learn(id);
      return true;
    }, false);
    this.story.BindExternalFunction('knows', (id: string) => host.knowledge.knows(id), true);
    this.story.BindExternalFunction('cycle', () => host.cycle(), true);
    this.story.BindExternalFunction('hour', () => host.hour(), true);
    for (const [name, fn] of Object.entries(host.functions ?? {})) {
      this.story.BindExternalFunction(name, fn as (...args: unknown[]) => unknown, false);
    }
    if (savedState) {
      try {
        this.story.state.LoadJson(savedState);
      } catch {
        // Incompatible state: start the knot fresh rather than crash.
      }
    }
  }

  hasKnot(knot: string): boolean {
    return this.story.KnotContainerWithName(knot) !== null;
  }

  /** Script errors since the last knot was entered: the dialogue ends quietly when there are any. */
  errors: string[] = [];

  enter(knot: string, args: string[] = []): void {
    this.errors = [];
    this.story.ChoosePathString(knot, true, args);
  }

  /** Next line, or null when the story waits for a choice or has ended. */
  next(): StoryLine | null {
    while (this.story.canContinue && !this.errors.length) {
      const raw = (this.story.Continue() ?? '').trim();
      if (this.errors.length) break;
      const line = parseLine(raw, this.story.currentTags ?? []);
      if (line.text) return line;
      // A tag-only line still carries effects (e.g. #stage) that must not be lost.
      if (line.stage || line.spendMinutes || line.action) return line;
    }
    return null;
  }

  canContinue(): boolean {
    return this.story.canContinue;
  }

  choices(): StoryChoice[] {
    if (this.errors.length) return [];
    return this.story.currentChoices.map((c) => ({ index: c.index, text: c.text }));
  }

  choose(index: number): void {
    this.story.ChooseChoiceIndex(index);
  }

  saveState(): string {
    return this.story.state.toJson();
  }
}

function parseLine(text: string, tags: string[]): StoryLine {
  const words = text.split(/\s+/);
  const cue = words.findIndex((w) => w.startsWith('^'));
  if (cue >= 0) text = text.replace('^', '');
  const line: StoryLine = {
    text, speaker: null, mood: 'neutral', style: 'narration', stage: null, spendMinutes: 0, dejavu: null, cue, action: null,
  };
  let moodTag: Mood | null = null;
  for (const tag of tags) {
    const [key = '', value = ''] = tag.split(':').map((s) => s.trim());
    if (key === 'speaker') line.speaker = value;
    else if (key === 'mood' && isMood(value)) moodTag = value;
    else if (key === 'hand' || key === 'log' || key === 'hint' || key === 'voice') line.style = key;
    else if (key === 'stage' && (STAGES as string[]).includes(value)) line.stage = value as StageId;
    else if (key === 'spend') line.spendMinutes = Number(value) || 0;
    else if (key === 'dejavu') line.dejavu = value;
    else if (key === 'action') line.action = tag.slice(tag.indexOf(':') + 1).trim();
  }
  // Tagged lines say how; untagged speech gets a guess; narration has no face to show it on.
  line.mood = moodTag ?? (line.speaker ? guessMood(text) : 'neutral');
  return line;
}
