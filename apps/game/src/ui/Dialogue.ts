// The dialogue box: shows ink lines one at a time, then choices.
// Space / Enter / click advances; number keys pick choices.
// Déjà vu: a line the player has heard before shows its ghost. Press F just before the
// speaker reaches the cue word and Leont finishes the sentence for them.
import type { StoryChoice, StoryLine } from '../engine/story.ts';
import { h } from './dom.ts';

export interface DialogueSource {
  next(): StoryLine | null;
  /** False when the next step is a choice (or the end). */
  canContinue(): boolean;
  choices(): StoryChoice[];
  choose(index: number): void;
}

export interface DejaVuHooks {
  /** May this line be finished (heard before, mechanic not lost)? */
  canFinish(id: string): boolean;
  heard(id: string): void;
  result(id: string, ok: boolean): void;
}

/** Milliseconds per spoken word in a déjà vu line. */
const WORD_MS = 380;
/** The press counts if it lands while the word before the cue is spoken, or just after. */
const LATE_MS = 120;

export class Dialogue {
  private root = h('div', { className: 'dialogue', hidden: true });
  private body = h('div', { className: 'dialogue-body' });
  private choiceList = h('ol', { className: 'dialogue-choices' });
  private source: DialogueSource | null = null;
  private onLine: (line: StoryLine) => void = () => {};
  private onDone: () => void = () => {};
  private dejavu: DejaVuHooks | null = null;
  /** A déjà vu line is being spoken; advancing waits for it. */
  private speaking: { finish: () => void } | null = null;

  constructor(parent: HTMLElement) {
    this.root.append(this.body, this.choiceList);
    parent.append(this.root);
    this.root.addEventListener('click', (e) => {
      if (!(e.target instanceof HTMLButtonElement)) this.advance();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.source || e.repeat) return;
      if (e.code === 'KeyF' && this.speaking) {
        e.preventDefault();
        this.speaking.finish();
        return;
      }
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
  run(source: DialogueSource, onLine: (line: StoryLine) => void, onDone: () => void, opts: { quiet?: boolean; dejavu?: DejaVuHooks } = {}): void {
    this.source = source;
    this.onLine = onLine;
    this.onDone = onDone;
    this.dejavu = opts.dejavu ?? null;
    this.root.classList.toggle('quiet', !!opts.quiet);
    this.root.hidden = false;
    this.advance();
  }

  private advance(): void {
    if (!this.source || this.speaking || this.choiceList.childElementCount > 0) return;
    const line = this.source.next();
    if (line) {
      this.onLine(line);
      if (!line.text) return this.advance();
      if (line.dejavu && this.dejavu?.canFinish(line.dejavu) && line.cue > 0) {
        this.speak(line);
      } else {
        this.show(line);
        if (line.dejavu) this.dejavu?.heard(line.dejavu);
        this.afterLine();
      }
      return;
    }
    if (!this.showChoices()) this.close();
  }

  /** Offer the choices together with the line that asks the question. */
  private afterLine(): void {
    if (this.source && !this.source.canContinue()) this.showChoices();
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

  private speakerTag(line: StoryLine): (Node | string)[] {
    return line.speaker ? [h('span', { className: 'speaker' }, `${line.speaker}. `)] : [];
  }

  private show(line: StoryLine): void {
    const text = h('p', { className: `line line-${line.style}` }, ...this.speakerTag(line), line.text);
    this.body.replaceChildren(text);
  }

  /** The déjà vu minigame: words arrive on a beat; the ghost of the whole line is already there. */
  private speak(line: StoryLine): void {
    const id = line.dejavu!;
    const words = line.text.split(/\s+/);
    const spans = words.map((w, i) => h('span', { className: i === line.cue ? 'word cue' : 'word' }, w + ' '));
    const hint = h('p', { className: 'dejavu-hint' }, 'You have heard this before. F — finish the sentence');
    this.body.replaceChildren(h('p', { className: `line line-${line.style} dejavu` }, ...this.speakerTag(line), ...spans), hint);

    const start = performance.now();
    const cueAt = line.cue * WORD_MS;
    let spoken = 0;
    let done = false;
    const end = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      this.speaking = null;
      this.dejavu?.result(id, ok);
      spans.forEach((s, i) => {
        s.classList.add('said');
        if (ok && i >= line.cue) s.classList.add('finished');
      });
      hint.textContent = ok ? 'He stops. You said it first.' : 'Too late. Or too early. He says it, as always.';
      hint.classList.toggle('ok', ok);
      this.afterLine();
    };
    const timer = window.setInterval(() => {
      const t = performance.now() - start;
      while (spoken < words.length && t >= spoken * WORD_MS) spans[spoken++]!.classList.add('said');
      if (t > cueAt + LATE_MS && spoken > line.cue) {
        // Missed the window: the speaker finishes as always.
        if (spoken >= words.length) end(false);
      }
    }, 30);
    this.speaking = {
      finish: () => {
        const t = performance.now() - start;
        end(t >= cueAt - WORD_MS && t <= cueAt + LATE_MS);
      },
    };
  }

  private close(): void {
    this.source = null;
    this.speaking = null;
    this.root.hidden = true;
    this.body.replaceChildren();
    this.onDone();
  }
}
