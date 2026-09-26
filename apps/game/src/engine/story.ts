// Thin wrapper over inkjs. Knots are entered directly (ChoosePathString) from game events;
// the ink state is part of CycleState and is thrown away by every reset.
import { Story } from 'inkjs';
import type { Knowledge } from '../core/knowledge.ts';
import type { StageId } from '../core/types.ts';

export type LineStyle = 'narration' | 'hand' | 'log' | 'hint';

export interface StoryLine {
  text: string;
  speaker: string | null;
  style: LineStyle;
  /** Stage to switch to once this line has been shown. */
  stage: StageId | null;
  spendMinutes: number;
}

export interface StoryChoice {
  index: number;
  text: string;
}

export interface StoryHost {
  knowledge: Knowledge;
  cycle(): number;
  hour(): number;
}

const STAGES: StageId[] = ['town', 'spiral', 'desk', 'sea'];

export class StoryEngine {
  private story: Story;

  constructor(json: string, host: StoryHost, savedState: string | null) {
    this.story = new Story(json);
    this.story.BindExternalFunction('learn', (id: string) => {
      host.knowledge.learn(id);
      return true;
    }, false);
    this.story.BindExternalFunction('knows', (id: string) => host.knowledge.knows(id), true);
    this.story.BindExternalFunction('cycle', () => host.cycle(), true);
    this.story.BindExternalFunction('hour', () => host.hour(), true);
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

  enter(knot: string): void {
    this.story.ChoosePathString(knot);
  }

  /** Next line, or null when the story waits for a choice or has ended. */
  next(): StoryLine | null {
    while (this.story.canContinue) {
      const raw = (this.story.Continue() ?? '').trim();
      const line = parseLine(raw, this.story.currentTags ?? []);
      if (line.text) return line;
      // A tag-only line still carries effects (e.g. #stage) that must not be lost.
      if (line.stage || line.spendMinutes) return line;
    }
    return null;
  }

  canContinue(): boolean {
    return this.story.canContinue;
  }

  choices(): StoryChoice[] {
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
  const line: StoryLine = { text, speaker: null, style: 'narration', stage: null, spendMinutes: 0 };
  for (const tag of tags) {
    const [key = '', value = ''] = tag.split(':').map((s) => s.trim());
    if (key === 'speaker') line.speaker = value;
    else if (key === 'hand' || key === 'log' || key === 'hint') line.style = key;
    else if (key === 'stage' && (STAGES as string[]).includes(value)) line.stage = value as StageId;
    else if (key === 'spend') line.spendMinutes = Number(value) || 0;
  }
  return line;
}
