// The dialogue box: shows ink lines one at a time, then choices. The speaker's portrait sits in
// its own tondo beside the box, with a nameplate; narration has no portrait.
// Space / Enter / E / click advances (the first press finishes a line still being written);
// number keys pick choices.
// Déjà vu: a line the player has heard before shows its ghost. Press F just before the
// speaker reaches the cue word and Leont finishes the sentence for them.
import type { Mood } from '../content/moods.ts';
import type { StoryChoice, StoryLine } from '../engine/story.ts';
import { h } from './dom.ts';
import { portrait, portraitFor, type PortraitTheme } from './portraits.ts';

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
  /** Accessibility: no timing window, any press while the line is spoken counts. */
  noRhythm(): boolean;
}

export interface DialogueOptions {
  /** Drop the box chrome (used at the sea). */
  quiet?: boolean;
  dejavu?: DejaVuHooks;
  /** Palette the portraits are painted in: the stage's own. */
  theme?: PortraitTheme;
  /** Write lines out letter by letter (off with reduced motion). */
  typewriter?: boolean;
  /** Called the first time a déjà vu line can be finished, to explain F. */
  onFirstDejaVu?: () => void;
}

/** Milliseconds per spoken word in a déjà vu line. */
const WORD_MS = 380;
/** The press counts if it lands while the word before the cue is spoken, or just after. */
const LATE_MS = 180;
/** Letters per second for the typewriter. */
const LETTERS_PER_SECOND = 70;
const MOUTH_MS = 110;

export class Dialogue {
  private root = h('div', { className: 'dialogue', hidden: true });
  private portraitBox = h('div', { className: 'dialogue-portrait' });
  private plate = h('div', { className: 'dialogue-plate' });
  private body = h('div', { className: 'dialogue-body' });
  private choiceList = h('ol', { className: 'dialogue-choices' });
  private more = h('div', { className: 'dialogue-more' });
  private source: DialogueSource | null = null;
  private onLine: (line: StoryLine) => void = () => {};
  private onDone: () => void = () => {};
  private dejavu: DejaVuHooks | null = null;
  private opts: DialogueOptions = {};
  /** A déjà vu line is being spoken; advancing waits for it. */
  private speaking: { finish: () => void } | null = null;
  /** A line is being written out; the next press completes it. */
  private writing: { complete: () => void } | null = null;
  private speakerId: string | null = null;
  private mood: Mood = 'neutral';
  private mouthTimer = 0;
  private mouthOpen = false;

  constructor(parent: HTMLElement) {
    const box = h('div', { className: 'dialogue-box' }, this.plate, this.body, this.choiceList, this.more);
    this.root.append(this.portraitBox, box);
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

  run(source: DialogueSource, onLine: (line: StoryLine) => void, onDone: () => void, opts: DialogueOptions = {}): void {
    this.source = source;
    this.onLine = onLine;
    this.onDone = onDone;
    this.opts = opts;
    this.dejavu = opts.dejavu ?? null;
    this.root.classList.toggle('quiet', !!opts.quiet);
    this.root.hidden = false;
    this.speakerId = null;
    this.advance();
  }

  private advance(): void {
    if (this.writing) return this.writing.complete();
    if (!this.source || this.speaking || this.choiceList.childElementCount > 0) return;
    const line = this.source.next();
    if (line) {
      this.onLine(line);
      if (!line.text) return this.advance();
      this.setSpeaker(line);
      if (line.dejavu && this.dejavu?.canFinish(line.dejavu) && line.cue > 0) {
        this.opts.onFirstDejaVu?.();
        this.speak(line);
      } else {
        this.show(line);
        if (line.dejavu) this.dejavu?.heard(line.dejavu);
      }
      return;
    }
    if (!this.showChoices()) this.close();
  }

  /** Offer the choices together with the line that asks the question. */
  private afterLine(): void {
    if (this.source && !this.source.canContinue() && this.showChoices()) {
      this.more.hidden = true;
      return;
    }
    this.more.hidden = false;
  }

  private showChoices(): boolean {
    const choices = this.source?.choices() ?? [];
    if (!choices.length) return false;
    this.choiceList.replaceChildren(
      ...choices.map((c, i) => {
        const btn = h('button', { type: 'button' }, h('kbd', {}, String(i + 1)), h('span', {}, c.text));
        btn.addEventListener('click', () => this.pick(i));
        return h('li', {}, btn);
      }),
    );
    this.more.hidden = true;
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

  // ─── Speaker ──────────────────────────────────────────────────────────────

  private setSpeaker(line: StoryLine): void {
    const info = line.style === 'log' || line.style === 'hint' ? null : portraitFor(line.speaker);
    this.root.classList.toggle('has-portrait', !!info && !this.opts.quiet);
    this.plate.replaceChildren();
    this.plate.hidden = !line.speaker;
    if (line.speaker) {
      this.plate.append(h('span', { className: 'dialogue-name' }, info?.name ?? line.speaker.trim()));
      if (info?.epithet) this.plate.append(h('span', { className: 'dialogue-epithet' }, info.epithet));
    }
    if (!info) {
      this.speakerId = null;
      this.portraitBox.replaceChildren();
      return;
    }
    const moodChanged = line.mood !== this.mood;
    this.mood = line.mood;
    if (info.id !== this.speakerId) {
      this.speakerId = info.id;
      this.mouthOpen = false;
      this.drawPortrait();
      this.portraitBox.classList.remove('enter');
      void this.portraitBox.offsetWidth;
      this.portraitBox.classList.add('enter');
    } else if (moodChanged) this.drawPortrait();
  }

  private drawPortrait(): void {
    if (!this.speakerId) return;
    const canvas = portrait(this.speakerId, this.opts.theme ?? 'vase', this.mouthOpen, this.mood);
    const img = this.portraitBox.querySelector('canvas') ?? h('canvas', { width: canvas.width, height: canvas.height });
    img.getContext('2d')!.drawImage(canvas, 0, 0);
    if (!img.isConnected) this.portraitBox.replaceChildren(img);
  }

  /** The portrait's mouth moves while the line is being said. */
  private talk(on: boolean): void {
    window.clearInterval(this.mouthTimer);
    if (on && this.speakerId) {
      this.mouthTimer = window.setInterval(() => {
        this.mouthOpen = !this.mouthOpen;
        this.drawPortrait();
      }, MOUTH_MS);
    } else if (this.mouthOpen) {
      this.mouthOpen = false;
      this.drawPortrait();
    }
  }

  // ─── Lines ────────────────────────────────────────────────────────────────

  private show(line: StoryLine): void {
    const text = h('p', { className: `line line-${line.style}` });
    this.body.replaceChildren(text);
    this.more.hidden = true;
    if (!this.opts.typewriter || this.opts.quiet) {
      text.textContent = line.text;
      this.afterLine();
      return;
    }
    // Write the line out; the whole text is laid out invisibly first so nothing reflows.
    const shown = h('span', {});
    const rest = h('span', { className: 'unwritten' }, line.text);
    text.append(shown, rest);
    const start = performance.now();
    let timer = 0;
    const complete = () => {
      window.cancelAnimationFrame(timer);
      shown.textContent = line.text;
      rest.textContent = '';
      this.writing = null;
      this.talk(false);
      this.afterLine();
    };
    const step = () => {
      const n = Math.floor(((performance.now() - start) / 1000) * LETTERS_PER_SECOND);
      if (n >= line.text.length) return complete();
      shown.textContent = line.text.slice(0, n);
      rest.textContent = line.text.slice(n);
      timer = window.requestAnimationFrame(step);
    };
    this.writing = { complete };
    this.talk(true);
    timer = window.requestAnimationFrame(step);
  }

  /** The déjà vu minigame: words arrive on a beat; the ghost of the whole line is already there. */
  private speak(line: StoryLine): void {
    const id = line.dejavu!;
    const words = line.text.split(/\s+/);
    const spans = words.map((w, i) => h('span', { className: i === line.cue ? 'word cue' : 'word' }, w + ' '));
    const relaxed = this.dejavu?.noRhythm() ?? false;
    const hint = h('p', { className: 'dejavu-hint' },
      'You have heard this before. ', h('kbd', {}, 'F'), relaxed ? ' finish the sentence (any time)' : ' finish the sentence just before the underlined word');
    this.body.replaceChildren(h('p', { className: `line line-${line.style} dejavu` }, ...spans), hint);
    this.more.hidden = true;
    this.talk(true);

    const start = performance.now();
    const cueAt = line.cue * WORD_MS;
    let spoken = 0;
    let done = false;
    const end = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      this.speaking = null;
      this.talk(false);
      this.dejavu?.result(id, ok);
      spans.forEach((s, i) => {
        s.classList.add('said');
        if (ok && i >= line.cue) s.classList.add('finished');
      });
      hint.textContent = ok ? 'They stop. You said it first.' : 'Too late. Or too early. They say it, as always.';
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
        end(relaxed || (t >= cueAt - WORD_MS && t <= cueAt + LATE_MS));
      },
    };
  }

  private close(): void {
    this.source = null;
    this.speaking = null;
    this.writing = null;
    this.talk(false);
    this.speakerId = null;
    this.mood = 'neutral';
    this.root.hidden = true;
    this.root.classList.remove('has-portrait');
    this.body.replaceChildren();
    this.portraitBox.replaceChildren();
    this.onDone();
  }
}
