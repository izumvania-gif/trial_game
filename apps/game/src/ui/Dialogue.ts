// The dialogue box: shows ink lines one at a time, then choices.
// Space / Enter / click advances; number keys pick choices.
import type { StoryChoice, StoryLine } from '../engine/story.ts';
import { h } from './dom.ts';

export interface DialogueSource {
  next(): StoryLine | null;
  /** False when the next step is a choice (or the end). */
  canContinue(): boolean;
  choices(): StoryChoice[];
  choose(index: number): void;
}

export class Dialogue {
  private root = h('div', { className: 'dialogue', hidden: true });
  private body = h('div', { className: 'dialogue-body' });
  private choiceList = h('ol', { className: 'dialogue-choices' });
  private source: DialogueSource | null = null;
  private onLine: (line: StoryLine) => void = () => {};
  private onDone: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.root.append(this.body, this.choiceList);
    parent.append(this.root);
    this.root.addEventListener('click', (e) => {
      if (!(e.target instanceof HTMLButtonElement)) this.advance();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.source) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        this.advance();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 9) this.pick(n - 1);
    });
  }

  get open(): boolean {
    return this.source !== null;
  }

  /** `quiet` drops the box chrome (used at the sea). */
  run(source: DialogueSource, onLine: (line: StoryLine) => void, onDone: () => void, quiet = false): void {
    this.source = source;
    this.onLine = onLine;
    this.onDone = onDone;
    this.root.classList.toggle('quiet', quiet);
    this.root.hidden = false;
    this.advance();
  }

  private advance(): void {
    if (!this.source || this.choiceList.childElementCount > 0) return;
    const line = this.source.next();
    if (line) {
      this.onLine(line);
      if (!line.text) return this.advance();
      this.show(line);
      // Offer the choices together with the line that asks the question.
      if (!this.source.canContinue()) this.showChoices();
      return;
    }
    if (!this.showChoices()) this.close();
  }

  private showChoices(): boolean {
    const choices = this.source?.choices() ?? [];
    if (!choices.length) return false;
    this.choiceList.replaceChildren(
      ...choices.map((c, i) => {
        const btn = h('button', { type: 'button' }, `${i + 1}. ${c.text}`);
        btn.addEventListener('click', () => this.pick(i));
        return h('li', {}, btn);
      }),
    );
    return true;
  }

  private pick(i: number): void {
    const choices = this.source?.choices() ?? [];
    const choice = choices[i];
    if (!this.source || !choice || this.choiceList.childElementCount === 0) return;
    this.choiceList.replaceChildren();
    this.source.choose(choice.index);
    this.advance();
  }

  private show(line: StoryLine): void {
    const text = h('p', { className: `line line-${line.style}` });
    if (line.speaker) text.append(h('span', { className: 'speaker' }, `${line.speaker}. `));
    text.append(line.text);
    this.body.replaceChildren(text);
  }

  private close(): void {
    this.source = null;
    this.root.hidden = true;
    this.body.replaceChildren();
    this.onDone();
  }
}
