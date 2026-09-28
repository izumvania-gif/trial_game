// Agent mode (`?agent`): the game in words, for an AI agent (or any program) to play.
//
// observe() says what the player perceives: the stage and the hour, what is around, the line being
// spoken and its choices, whatever card or panel is open, and what happened since the last look
// (facts written in the chronicle, news, sounds). act(id, arg) does one thing from the list of
// actions and lets the game run until it settles (a line written, a passage walked, a night played)
// before it answers. Time only moves when the agent acts: the page runs on a virtual clock.
//
// Actions come from three places: the dialogue (continue, say:<n>, finish), the stage itself
// (`Stage.agent()`: walking to people and places, turning rings, placing allies, striking ages…)
// and every button, word box and text field on screen (ui:/choose:/type:), so DOM stages such as
// the Desk and the diary need nothing special.
import type { Game } from '../game.ts';
import { KNOWLEDGE } from '../content/knowledge.ts';
import { bookOfStrangers, chronicle } from '../ui/Book.ts';
import { exportTablet } from '../core/save.ts';
import type { AgentAction, Stage } from '../stages/types.ts';
import type { VirtualTime } from './virtualTime.ts';

/** The parts of the game the bridge reaches into (private in TypeScript, plain fields at runtime). */
interface Inside {
  phase: 'playing' | 'midnight' | 'reset';
  current: Stage;
  dialogue: {
    open: boolean;
    agentView: { speaker: string; text: string; choices: string[]; dejavu: boolean } | null;
    agentContinue(): void;
    agentChoose(n: number): boolean;
    agentFinish(): boolean;
  };
  hud: { toast(text: string, kicker?: string, quiet?: boolean): void; caption(text: string): void; panelOpen: boolean; closePanel(): void };
  lyre: { open: boolean; close(): void };
  knowledge: { knows(id: string): boolean; list(): string[] };
  memory: { cycle: number; masks: string[]; hintsShown: string[]; guides: string[] };
  save: { cycle: { wind: number; wornMask: string | null } };
  clock: { minute: number; endMinute: number; label(): string };
  lost(m: string): boolean;
  patches(): string[];
  toggleMask(): void;
  playSongOfReturn(): void;
  playSongOfStorms(): void;
}

export interface Observation {
  /** Everything below, as one text for a language model to read. */
  text: string;
  stage: string;
  time: string | null;
  day: number;
  dialogue: { speaker: string; text: string; choices: string[]; dejavu: boolean } | null;
  screen: string[];
  events: string[];
  actions: AgentAction[];
}

const SCREENS = ['.cold-open', '.hud-coach', '.hud-goal', '.prologue-skip', '#title', '.modal-card', '.guide', '.spiral-card', '.reset', '.desk', '.diary', '.board-panel', '.sprint-panel', '.relief-caption', '.strike-caption', '.chronicle', '.lyre', '.carry', '#tablet-panel'];
const STEP = 1000 / 24;
/** The game's own text names keys; here is what each one is as an action. */
const KEYS = 'In agent mode the keys the game mentions are actions: E (talk, look) = talk:<who or what> or the "Right here" action; F (finish their sentence) = finish; C = chronicle; B = book; M = mask; R = lyre; Tab (registry) = registry; Esc = leave, or a card\'s close button; digits = say:<n>; Space = continue. Walking is go:<place> or meet:<person>; waiting is wait / wait_until.';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
const visible = (el: Element) => el instanceof HTMLElement && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

export class AgentBridge {
  private g: Inside;
  private events: string[] = [];
  private controls = new Map<string, HTMLElement>();

  private time: VirtualTime;

  constructor(game: Game, time: VirtualTime) {
    this.time = time;
    this.g = game as unknown as Inside;
    // Everything the HUD would have shown in passing is kept for the next look.
    const hud = this.g.hud;
    const toast = hud.toast.bind(hud);
    hud.toast = (text, kicker, quiet) => {
      this.events.push(kicker ? `${kicker}: ${text}` : text);
      toast(text, kicker, quiet);
    };
    const caption = hud.caption.bind(hud);
    hud.caption = (text) => {
      this.events.push(`(sound) ${text}`);
      caption(text);
    };
  }

  /** Let the game run until nothing is in motion (or `max` seconds of game time pass). */
  async settle(min = 0.4, max = 30): Promise<void> {
    let t = 0;
    let n = 0;
    while (t < min || (this.busy() && t < max)) {
      this.time.advance(STEP);
      t += STEP / 1000;
      // Promises and the network move on real time: give them a moment every few frames.
      if (++n % 4 === 0) await this.time.yieldReal();
    }
  }

  /** Let `seconds` of game time pass, frame by frame. */
  private async pass(seconds: number, until?: () => boolean): Promise<void> {
    for (let t = 0, n = 0; t < seconds * 1000 && !until?.(); t += STEP) {
      this.time.advance(STEP);
      if (++n % 4 === 0) await this.time.yieldReal();
    }
  }

  private busy(): boolean {
    const g = this.g;
    // A déjà vu line waits for the agent: finish it, or let them say it.
    if (g.dialogue.agentView?.dejavu) return false;
    const reset = document.querySelector<HTMLElement>('.reset');
    if (g.phase === 'reset') return !(reset && !reset.hidden && reset.querySelector('button:not([disabled])'));
    if (g.phase === 'midnight' && !g.dialogue.open) return true;
    if (document.querySelector('.passage:not([hidden]), .cold-open:not([hidden])')) return true;
    if ((g.current as unknown as { agentBusy?: boolean } | undefined)?.agentBusy) return true;
    return false;
  }

  observe(): Observation {
    const g = this.g;
    const titleUp = !!document.querySelector('#title') || !g.current;
    const stage = titleUp ? 'title' : g.current.id;
    const lines: string[] = [];
    const clockShown = !titleUp && g.current.clockRuns && !g.lost('clock');
    const time = clockShown ? g.clock.label() : null;
    if (!titleUp) {
      const end = Math.floor(g.clock.endMinute / 60) + 6;
      lines.push(`[${stage}] day ${g.memory.cycle}${time ? ` · ${time} · midnight comes at ${String(end % 24).padStart(2, '0')}:${String(Math.floor(g.clock.endMinute % 60)).padStart(2, '0')}` : ''}${g.save.cycle.wornMask ? ` · wearing the ${g.save.cycle.wornMask} mask` : ''}`);
      const agent = g.current.agent?.();
      if (agent && !g.dialogue.open) lines.push(...agent.describe());
    }
    const dialogue = g.dialogue.agentView;
    if (dialogue) {
      lines.push('', `${dialogue.speaker ? `${dialogue.speaker}: ` : ''}${dialogue.text}`);
      if (dialogue.dejavu) lines.push('(Déjà vu: you know how this sentence ends. "finish" says it before them; "continue" lets them.)');
      dialogue.choices.forEach((c, i) => lines.push(`  ${i + 1}) ${c}`));
    }
    const screen = this.screens();
    if (screen.length) lines.push('', ...screen);
    const events = this.events.splice(0);
    if (events.length) lines.push('', 'Since you last looked:', ...events.map((e) => `- ${e}`));
    const actions = this.actions();
    lines.push('', 'Actions:', ...actions.map((a) => `- ${a.id}${a.arg ? ` <${a.arg}>` : ''}: ${a.label}`));
    return { text: lines.join('\n'), stage, time, day: g.memory.cycle, dialogue, screen, events, actions };
  }

  /** The text of every card, panel and caption on screen. */
  private screens(): string[] {
    const out: string[] = [];
    for (const sel of SCREENS) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (!visible(el)) continue;
        if (sel === '#title' && this.g.dialogue.open) continue;
        let text = el.innerText;
        // The keys on the title are for hands; the agent gets its own list below.
        for (const legend of el.querySelectorAll<HTMLElement>('.title-legend')) text = text.replace(legend.innerText, KEYS);
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        if (text) out.push(text.length > 4000 ? `${text.slice(0, 4000)}…` : text);
      }
    }
    return out;
  }

  actions(): AgentAction[] {
    const g = this.g;
    const out: AgentAction[] = [];
    const titleUp = !!document.querySelector('#title');
    const view = g.dialogue.agentView;
    const blocked = !!view || [...document.querySelectorAll('.modal, .guide, .spiral-card')].some(visible);
    if (view) {
      if (view.dejavu) out.push({ id: 'finish', label: 'Finish the sentence before they do' });
      if (!view.choices.length) out.push({ id: 'continue', label: 'Next line' });
      view.choices.forEach((c, i) => out.push({ id: `say:${i + 1}`, label: c }));
    }
    // Buttons, word boxes and text fields on screen, named by what they say.
    this.controls.clear();
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll<HTMLElement>('button, select, input, textarea')) {
      if (!visible(el) || (el as HTMLButtonElement).disabled) continue;
      if (el.closest('.dialogue, .debug, .controls-bar, .hud, .lyre')) continue;
      if (titleUp && el.closest('.settings')) continue;
      const label = (el.getAttribute('aria-label') || (el as HTMLInputElement).placeholder || el.innerText || el.title || el.id || el.tagName).replace(/\s+/g, ' ').trim();
      let key = slug(label);
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n > 1) key += `-${n}`;
      const verb = el instanceof HTMLSelectElement ? 'choose' : el instanceof HTMLButtonElement ? 'ui' : 'type';
      this.controls.set(`${verb}:${key}`, el);
      if (el instanceof HTMLSelectElement) {
        const opts = [...el.options].filter((o) => o.value).map((o) => o.text);
        out.push({ id: `choose:${key}`, label: `${label}${el.value ? ` (now: ${el.selectedOptions[0]?.text})` : ''}`, arg: `one of: ${opts.join(' | ')}` });
      } else if (verb === 'type') out.push({ id: `type:${key}`, label, arg: 'text' });
      else out.push({ id: `ui:${key}`, label });
    }
    if (titleUp || blocked || g.phase !== 'playing') return out;
    const agent = g.current.agent?.();
    if (agent) out.push(...agent.actions());
    if (g.current.id === 'town' || g.current.id === 'spiral') {
      if (!g.lost('chronicle')) out.push({ id: 'chronicle', label: 'Read your chronicle: what you know, and the questions still open' });
      if (!g.lost('chronicle')) out.push({ id: 'hint', label: 'Reveal where to look next for an open question', arg: 'question number from the chronicle' });
      if (!g.lost('schedules')) out.push({ id: 'book', label: 'Read the Book of Strangers: where people are, hour by hour' });
      if (g.current.id === 'town' && g.memory.masks.length && !g.lost('masks')) out.push({ id: 'mask', label: `Put on the next mask (${g.memory.masks.join(', ')}; again to take it off)` });
      if (g.current.id === 'town' && g.knowledge.knows('song_of_return')) out.push({ id: 'lyre', label: 'Play a song on the lyre', arg: 'return (fold the day shut and wake at dawn) or storms' });
    }
    if (!out.some((a) => a.id === 'wait')) out.push({ id: 'wait', label: 'Let a few seconds pass', arg: 'seconds (default 3)' });
    out.push({ id: 'save', label: 'Get the wax tablet: a code of the whole save' });
    return out;
  }

  async act(id: string, arg?: string): Promise<Observation & { result: string }> {
    const result = await this.perform(id.trim(), arg?.trim());
    await this.settle();
    return { ...this.observe(), result };
  }

  private async perform(id: string, arg?: string): Promise<string> {
    const g = this.g;
    if (!this.controls.size) this.actions();
    const [verb, rest] = id.split(/:(.*)/s) as [string, string | undefined];
    const control = this.controls.get(id);
    if (control) {
      if (control instanceof HTMLSelectElement) {
        const want = (arg ?? '').toLowerCase();
        const opt = [...control.options].find((o) => o.value && (o.text.toLowerCase() === want || o.value.toLowerCase() === want))
          ?? [...control.options].find((o) => o.value && o.text.toLowerCase().includes(want));
        if (!opt || !want) return `No such choice. Options: ${[...control.options].filter((o) => o.value).map((o) => o.text).join(' | ')}`;
        control.value = opt.value;
        control.dispatchEvent(new Event('change', { bubbles: true }));
        control.dispatchEvent(new Event('input', { bubbles: true }));
        return `Chosen: ${opt.text}.`;
      }
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
        control.value = arg ?? '';
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
        return 'Written.';
      }
      control.click();
      return `Pressed: ${control.innerText.replace(/\s+/g, ' ').trim() || id}.`;
    }
    if (verb === 'continue' && g.dialogue.open) {
      if (g.dialogue.agentView?.dejavu) {
        // Let them say it: the line runs out on its own.
        await this.pass(8, () => !g.dialogue.agentView?.dejavu);
        return 'They say it, as always.';
      }
      g.dialogue.agentContinue();
      return 'Next.';
    }
    if (verb === 'say') return g.dialogue.agentChoose(Number(rest) - 1) ? 'You answer.' : 'No such choice.';
    if (verb === 'finish') return g.dialogue.agentFinish() ? 'You say it first.' : 'Nothing to finish.';
    if (verb === 'wait' && g.current.id !== 'town') {
      const s = Math.min(120, Number(arg) || 3);
      await this.pass(s);
      return `${s} seconds pass.`;
    }
    if (verb === 'save') return `Wax tablet (import it on the title screen to continue from here):\n${exportTablet((g as unknown as { save: Parameters<typeof exportTablet>[0] }).save)}`;
    if (verb === 'chronicle') return this.readChronicle();
    if (verb === 'hint') return this.revealHint(Number(arg ?? rest));
    if (verb === 'book') return this.readBook();
    if (verb === 'mask') {
      g.toggleMask();
      return g.save.cycle.wornMask ? `You wear the ${g.save.cycle.wornMask} mask.` : 'You take the mask off.';
    }
    if (verb === 'lyre') {
      if (!g.knowledge.knows('song_of_return')) return 'You have no lyre, and no song to play on it.';
      if (/storm/i.test(arg ?? rest ?? '')) g.playSongOfStorms();
      else g.playSongOfReturn();
      return 'You play.';
    }
    const agent = g.current.agent?.();
    const done = agent?.perform(id, arg);
    if (done != null) return done;
    return `Unknown action "${id}". Pick one from the list.`;
  }

  private readChronicle(): string {
    const g = this.g;
    const facts = KNOWLEDGE.facts;
    const known = facts.filter((f) => g.knowledge.knows(f.id));
    const root = document.createElement('div');
    root.append(...chronicle(g.knowledge as never, facts, g.memory.hintsShown));
    const questions = [...root.querySelectorAll('.thread')].map((t, i) => {
      const q = t.querySelector('.thread-question')?.textContent ?? '';
      const found = [...t.querySelectorAll('.thread-found li')].map((li) => `    · ${li.textContent}`);
      const next = t.querySelector('.thread-next');
      const clue = next ? (next.querySelector('button') ? '    (a hint is hidden: action "hint" with this number)' : `    Next: ${next.textContent?.replace(/^Next/, '').trim()}`) : '';
      return [`${i + 1}. ${q}${t.classList.contains('closed') ? ' (answered)' : ''}`, ...found, clue].filter(Boolean).join('\n');
    });
    return [`Written in the chronicle (${known.length} facts):`, ...known.map((f) => `- ${f.text}`), '', 'Questions:', ...questions].join('\n');
  }

  private revealHint(n: number): string {
    const g = this.g;
    const root = document.createElement('div');
    root.append(...chronicle(g.knowledge as never, KNOWLEDGE.facts, g.memory.hintsShown));
    const thread = [...root.querySelectorAll('.thread')][n - 1];
    const btn = thread?.querySelector<HTMLButtonElement>('.thread-next button');
    if (!thread) return 'No such question.';
    btn?.click();
    return `${thread.querySelector('.thread-question')?.textContent}\nNext: ${thread.querySelector('.thread-next')?.textContent?.replace(/^Next/, '').trim() ?? 'nothing to add'}`;
  }

  private readBook(): string {
    const g = this.g;
    const root = document.createElement('div');
    root.append(...bookOfStrangers(g.memory as never, g.knowledge as never, g.patches(), g.clock.minute));
    root.querySelectorAll('.book-strip, .book-scale, canvas').forEach((e) => e.remove());
    document.body.append(root);
    const text = root.innerText.replace(/\n{3,}/g, '\n\n').trim();
    root.remove();
    return `The Book of Strangers:\n${text}`;
  }
}
