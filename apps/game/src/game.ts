// The game orchestrator: owns the save, the day clock, knowledge, the ink story and the stages,
// and runs the loop of the loop — dawn, the day, midnight (or an ending), the reset, dawn again.
import { fetchStele, reportReset, scratchLine } from './api.ts';
import { ENDINGS } from './content/endings.ts';
import { KNOWLEDGE } from './content/knowledge.ts';
import { pickHint } from './content/hints.ts';
import { LEXICON } from './content/lexicon.ts';
import { MASKS } from './content/masks.ts';
import { PAST_LEONTS } from './content/leonts.ts';
import { DayClock, endMinuteForWind } from './core/clock.ts';
import { Knowledge } from './core/knowledge.ts';
import {
  browserStorage, freshCycle, hashContent, loadSave, writeSave, type KeyValueStorage, type SaveFile,
} from './core/save.ts';
import type { Mechanic, StageId } from './core/types.ts';
import { Input } from './engine/input.ts';
import { StoryEngine, type StoryLine } from './engine/story.ts';
import { DitherRenderer } from './render/DitherRenderer.ts';
import { BoardStage } from './stages/board/BoardStage.ts';
import { DeskStage } from './stages/desk/DeskStage.ts';
import { ReliefStage } from './stages/relief/ReliefStage.ts';
import { SeaStage } from './stages/sea/SeaStage.ts';
import { SpiralStage } from './stages/spiral/SpiralStage.ts';
import { StrikesStage } from './stages/strikes/StrikesStage.ts';
import { TownStage } from './stages/town/TownStage.ts';
import type { Stage, StageHost } from './stages/types.ts';
import { bookOfStrangers, chronicle } from './ui/Book.ts';
import { Dialogue } from './ui/Dialogue.ts';
import { h } from './ui/dom.ts';
import { Hud } from './ui/Hud.ts';
import { Lyre } from './ui/Lyre.ts';
import { button, Modal } from './ui/Modal.ts';
import { ResetScreen } from './ui/ResetScreen.ts';

type Phase = 'playing' | 'midnight' | 'reset';

const AUTOSAVE_SECONDS = 10;

export class Game {
  readonly input: Input;
  readonly clock = new DayClock();
  readonly knowledge: Knowledge;
  save: SaveFile;
  cycleRun: number | null = null;
  /** Set once the save could not be written; shown in the debug panel. */
  saveBlocked = false;

  private storage: KeyValueStorage | null = browserStorage();
  private contentVersion: string;
  private renderer: DitherRenderer;
  private hud: Hud;
  private dialogue: Dialogue;
  private modal: Modal;
  private lyre: Lyre;
  private resetScreen: ResetScreen;
  private story!: StoryEngine;
  private stages!: Record<StageId, Stage>;
  private current!: Stage;
  private pendingStage: { id: StageId; entry?: string } | null = null;
  private pendingActions: string[] = [];
  private phase: Phase = 'playing';
  private sinceSave = 0;
  private lastTime = 0;
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private storyJson: string;
  /** Déjà vu results of this cycle, read by ink through dejavu_ok(). */
  private dejavuResults = new Map<string, boolean>();

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, storyJson: string) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.storyJson = storyJson;
    this.contentVersion = hashContent(storyJson);
    const loaded = loadSave(this.storage, this.contentVersion);
    this.save = loaded.save;
    this.saveBlocked = loaded.status === 'unavailable';
    this.cycleRun = this.save.memory.lastCycleRun;

    this.input = new Input(canvas);
    this.renderer = new DitherRenderer(canvas);
    this.hud = new Hud(overlay);
    this.dialogue = new Dialogue(overlay);
    this.lyre = new Lyre(overlay);
    this.modal = new Modal(overlay);
    this.resetScreen = new ResetScreen(overlay);
    this.knowledge = new Knowledge(KNOWLEDGE, this.save.memory.facts, (fact) => {
      this.save.memory.facts.push(fact.id);
      if (!this.lost('chronicle')) this.hud.factLearned(fact);
      this.persist();
    });

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.current?.onResize?.();
    });
  }

  /** Called from the title screen. Resumes the saved day, or starts at dawn. */
  start(): void {
    this.beginCycle(this.save.cycle.minute === 0 && this.save.cycle.storyState === null);
    requestAnimationFrame((t) => {
      this.lastTime = t;
      this.frame(t);
    });
  }

  // ─── State helpers ────────────────────────────────────────────────────────

  get memory() {
    return this.save.memory;
  }

  /** Patches decided on the Desk in earlier cycles. */
  patches(): string[] {
    return Object.values(this.memory.tickets)
      .filter((t) => t.decision === 'patch' && t.patch && t.cycle < this.memory.cycle)
      .map((t) => t.patch!);
  }

  lost(m: Mechanic): boolean {
    return this.save.cycle.lost.includes(m);
  }

  notice(anomaly: string, wind: number): void {
    if (!this.memory.anomalies.some((a) => a.id === anomaly)) this.memory.anomalies.push({ id: anomaly, cycle: this.memory.cycle });
    this.save.cycle.wind = Math.min(1, this.save.cycle.wind + wind);
  }

  private host(): StageHost {
    return {
      input: this.input,
      clock: this.clock,
      knowledge: this.knowledge,
      memory: this.memory,
      cycle: this.save.cycle,
      overlay: this.overlay,
      aspect: () => this.renderer.aspect,
      interact: (knot) => this.interact(knot),
      switchStage: (id, entry) => this.switchStage(id, entry),
      prompt: (label) => this.hud.prompt(this.dialogue.open ? null : label),
      patches: () => this.patches(),
      notice: (a, w) => this.notice(a, w),
      lost: (m) => this.lost(m),
      loseMechanic: (m) => this.loseMechanic(m),
      ending: (id) => this.ending(id),
      persist: () => this.persist(),
    };
  }

  // ─── The cycle ────────────────────────────────────────────────────────────

  /** Builds a fresh world for the current CycleState. Loop memory is untouched. */
  private beginCycle(atDawn: boolean): void {
    const cycle = this.save.cycle;
    this.clock.minute = cycle.minute;
    this.dejavuResults.clear();
    this.story = new StoryEngine(this.storyJson, {
      knowledge: this.knowledge,
      cycle: () => this.memory.cycle,
      hour: () => this.clock.hour,
      functions: this.inkFunctions(),
    }, cycle.storyState);
    for (const stage of Object.values(this.stages ?? {})) {
      stage.exit();
      stage.dispose?.();
    }
    const host = this.host();
    this.stages = {
      town: new TownStage(host, cycle.player),
      spiral: new SpiralStage(host),
      relief: new ReliefStage(host),
      desk: new DeskStage(host),
      board: new BoardStage(host),
      strikes: new StrikesStage(host),
      sea: new SeaStage(host),
    };
    this.current = undefined as unknown as Stage;
    this.phase = 'playing';
    this.hud.setCycle(this.cycleRun, this.memory.cycle);
    this.activate(cycle.stage);
    if (atDawn) this.interact('dawn');
  }

  /** ink EXTERNALs beyond learn/knows/cycle/hour (see story/main.ink). */
  private inkFunctions(): Record<string, (...args: never[]) => unknown> {
    return {
      dejavu_ok: (id: string) => this.dejavuResults.get(id) === true,
      wearing: () => this.save.cycle.wornMask ?? '',
      has_mask: (id: string) => this.memory.masks.includes(id),
      give_mask: (id: string) => {
        if (!this.memory.masks.includes(id)) this.memory.masks.push(id);
        return true;
      },
      stele_word: () => this.memory.steleWords[this.memory.steleWords.length - 1] ?? '',
      patched: (id: string) => this.patches().includes(id),
      notice: (id: string, wind: number) => {
        this.notice(id, wind);
        return true;
      },
      seen_ending: (id: string) => this.memory.endingsSeen.includes(id),
      heard: (id: string) => this.memory.heard.includes(id),
      dawn_hint: () => pickHint((f) => this.knowledge.knows(f)) ?? '',
      ended_last_cycle: (id: string) => this.memory.lastEnding?.id === id && this.memory.lastEnding.cycle === this.memory.cycle - 1,
      wind: () => Math.round(this.save.cycle.wind * 100),
      sprint: () => this.memory.sprint,
      registry_locked: () => Object.values(this.memory.registry).filter((e) => e.locked).length,
      identified: (id: string) => this.memory.registry[id]?.locked === true,
      night: (key: string) => {
        const n = this.save.cycle.night;
        return n ? n[key as keyof typeof n] === true : false;
      },
    };
  }

  private activate(id: StageId, entry?: string): void {
    this.current?.exit();
    this.current = this.stages[id];
    const palette = this.current.palette;
    this.canvas.hidden = palette === null;
    if (palette) this.renderer.setPalette(palette);
    this.hud.setVisible(!this.current.hideHud);
    this.save.cycle.stage = id;
    this.current.enter(entry);
  }

  switchStage(id: StageId, entry?: string): void {
    if (this.dialogue.open) {
      this.pendingStage = { id, entry };
      return;
    }
    this.activate(id, entry);
    this.persist();
  }

  interact(knot: string): void {
    if (this.dialogue.open || this.phase !== 'playing') return;
    if (!this.story.hasKnot(knot)) {
      console.warn(`No ink knot "${knot}"`);
      return;
    }
    this.hud.prompt(null);
    this.story.enter(knot);
    this.dialogue.run(this.story, (line) => this.onLine(line), () => this.afterDialogue(), {
      quiet: this.current?.id === 'sea',
      dejavu: {
        canFinish: (id) => this.memory.heard.includes(id) && !this.lost('dejavu'),
        heard: (id) => {
          if (!this.memory.heard.includes(id)) this.memory.heard.push(id);
        },
        result: (id, ok) => this.dejavuResults.set(id, ok),
      },
    });
  }

  private onLine(line: StoryLine): void {
    if (line.spendMinutes) this.clock.spend(line.spendMinutes);
    if (line.stage) this.pendingStage = { id: line.stage };
    if (line.action) this.pendingActions.push(line.action);
  }

  private afterDialogue(): void {
    this.input.flush();
    if (this.phase === 'midnight') return void this.resetCycle('midnight');
    const next = this.pendingStage;
    this.pendingStage = null;
    if (next) this.activate(next.id, next.entry);
    this.current.afterDialogue?.();
    this.persist();
    const actions = this.pendingActions.splice(0);
    for (const action of actions) this.runAction(action);
  }

  private runAction(action: string): void {
    if (action === 'carve') this.openCarving();
    else if (action === 'stele_lines') void this.openSteleLines();
    else if (action === 'board') this.switchStage('board');
    else if (action.startsWith('ending:')) this.ending(action.slice('ending:'.length));
  }

  private frame = (t: number): void => {
    const dt = Math.min(0.1, (t - this.lastTime) / 1000);
    this.lastTime = t;
    const blocked = this.dialogue.open || this.hud.panelOpen || this.modal.open || this.lyre.open || this.phase !== 'playing';
    this.input.enabled = !blocked;

    if (this.phase === 'playing') {
      this.handleKeys();
      this.clock.endMinute = endMinuteForWind(this.save.cycle.wind);
      if (this.current.clockRuns && !blocked && this.clock.tick(dt)) this.midnight();
      this.current.update(dt);
    }
    if (this.current.scene && this.current.camera) this.renderer.render(this.current.scene, this.current.camera);
    this.hud.updateClock(this.clock);
    this.hud.setClockVisible(!this.lost('clock'));
    this.hud.setWind(this.save.cycle.wind, this.lost('clock'));
    this.hud.setMask(this.save.cycle.wornMask);

    this.sinceSave += dt;
    if (this.sinceSave > AUTOSAVE_SECONDS && this.phase === 'playing') this.persist();
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  private handleKeys(): void {
    const i = this.input;
    if (this.hud.panelOpen && (i.wasPressedRaw('Escape') || i.wasPressedRaw('KeyC') || i.wasPressedRaw('KeyB'))) {
      const which = i.wasPressedRaw('KeyC') ? 'chronicle' : i.wasPressedRaw('KeyB') ? 'book' : null;
      this.hud.closePanel();
      if (!which) return;
    }
    if (this.dialogue.open || this.modal.open || this.lyre.open) return;
    const inWorld = this.current.id === 'town' || this.current.id === 'spiral';
    if (i.wasPressedRaw('KeyC') && inWorld) {
      this.hud.togglePanel('chronicle', 'Chronicle', () =>
        this.lost('chronicle') ? [h('p', {}, 'Ash. The wax has run into the cracks of the floor.')] : chronicle(this.knowledge, KNOWLEDGE.facts));
    }
    if (i.wasPressedRaw('KeyB') && inWorld) {
      this.hud.togglePanel('book', 'Book of Strangers', () =>
        this.lost('schedules') ? [h('p', {}, 'The pages are blank. They were always blank.')] : bookOfStrangers(this.memory, this.knowledge, this.patches()));
    }
    if (i.wasPressed('KeyM') && this.current.id === 'town') this.toggleMask();
    if (i.wasPressed('KeyR') && this.current.id === 'town') {
      if (!this.knowledge.knows('song_of_return')) this.hud.toast('You have no lyre, and no song to play on it.');
      else this.lyre.show(true, () => this.playSongOfReturn());
    }
  }

  /** M cycles through the masks freed from the spiral, then back to Leont's own face. */
  private toggleMask(): void {
    const c = this.save.cycle;
    const masks = this.memory.masks;
    if (this.lost('masks') || !masks.length) return;
    const i = c.wornMask ? masks.indexOf(c.wornMask) : -1;
    c.wornMask = i + 1 < masks.length ? masks[i + 1]! : null;
    if (c.wornMask) {
      this.notice('mask_worn', 0.03);
      this.hud.toast(`${c.wornMask}: ${MASKS[c.wornMask]?.effect ?? ''}`);
    }
  }

  loseMechanic(m: Mechanic): void {
    if (this.lost(m)) return;
    this.save.cycle.lost.push(m);
    if (m === 'masks') this.save.cycle.wornMask = null;
    this.persist();
  }

  // ─── Carving and the stele ────────────────────────────────────────────────

  private openCarving(): void {
    const words = LEXICON.filter((w) => this.knowledge.knows(w.fact));
    if (!words.length) return;
    const current = this.memory.steleWords[this.memory.steleWords.length - 1];
    this.modal.show('carve', [
      h('h2', {}, 'Before the city wakes'),
      h('p', {}, 'The stele survives the flood. One word, cut before dawn, will still be there tomorrow.'),
      current ? h('p', { className: 'desk-note' }, `Already in the stone: ${current}`) : '',
      h('div', { className: 'carve-words' }, ...words.map((w) => button(w.word, () => {
        this.memory.steleWords.push(w.word);
        this.notice('stele_carved', 0.05);
        this.modal.close();
        this.persist();
      }), )),
      h('p', { className: 'desk-note' }, words.map((w) => `${w.word}: ${w.gloss}`).join(' · ')),
      button('Carve nothing', () => this.modal.close(), 'ghost'),
    ]);
  }

  /** Lines other players scratched into the cracks, and a line of your own. */
  private async openSteleLines(): Promise<void> {
    const data = await fetchStele();
    if (!data) {
      this.modal.show('stele', [h('h2', {}, 'The cracks'), h('p', {}, 'The cracks are silent today.'), button('Step back', () => this.modal.close(), 'ghost')]);
      return;
    }
    const line: string[] = [];
    const preview = h('p', { className: 'stele-preview' });
    const status = h('p', { className: 'desk-note' });
    const renderPreview = () => (preview.textContent = line.length ? line.join(' ') : '…');
    renderPreview();
    const scratch = button('Scratch it into the stone', async () => {
      if (!line.length) return;
      const res = await scratchLine(line);
      status.textContent = res === 'ok' ? 'Someone, some other time, will read it.' : res === 'wait' ? 'Your hand is tired. Later.' : 'The stone will not take it.';
      if (res === 'ok') scratch.disabled = true;
    });
    this.modal.show('stele', [
      h('h2', {}, 'The cracks'),
      h('p', {}, 'Other hands have scratched lines into the cracks of the stele. Different hands. All of them yours.'),
      h('ul', { className: 'stele-lines' }, ...(data.lines.length ? data.lines.map((l) => h('li', {}, l.join(' '))) : [h('li', {}, 'Nothing yet. You are the first. Or the first to be read.')])),
      h('h3', {}, 'Your line'),
      preview,
      h('div', { className: 'stele-words' }, ...data.words.map((w) => button(w, () => {
        if (line.length < data.maxWords) line.push(w);
        renderPreview();
      }, 'ghost'))),
      h('div', {}, button('Erase', () => {
        line.length = 0;
        renderPreview();
      }, 'ghost'), scratch),
      status,
      button('Step back', () => this.modal.close(), 'ghost'),
    ]);
  }

  // ─── Midnight, endings, resets ────────────────────────────────────────────

  private midnight(): void {
    this.phase = 'midnight';
    this.pendingStage = null;
    this.pendingActions = [];
    this.modal.close();
    this.lyre.close();
    this.hud.closePanel();
    if (this.current.id !== 'town') this.activate('town', this.current.id === 'sea' ? 'shore' : 'temple');
    this.overlay.classList.add('raining');
    this.story.enter('midnight');
    this.dialogue.run(this.story, () => {}, () => void this.resetCycle('midnight'));
  }

  private playSongOfReturn(): void {
    this.notice('song_played', 0);
    this.phase = 'midnight';
    this.persist();
    void this.resetCycle('song');
  }

  ending(id: string): void {
    const card = ENDINGS[id];
    if (!card) return;
    if (!this.memory.endingsSeen.includes(id)) this.memory.endingsSeen.push(id);
    this.memory.lastEnding = { id, cycle: this.memory.cycle };
    this.phase = 'midnight';
    this.persist();
    this.modal.show('ending', [
      h('p', { className: 'ending-kicker' }, 'Ending'),
      h('h2', {}, card.title),
      ...card.lines.map((l) => h('p', {}, l)),
      h('div', { className: 'ending-log' }, ...card.log.map((l) => h('p', { className: 'log' }, l))),
      button('Wake', () => this.modal.close()),
    ], { dismissable: false, onClose: () => void this.resetCycle('ending') });
  }

  private async resetCycle(reason: 'midnight' | 'song' | 'ending'): Promise<void> {
    this.phase = 'reset';
    this.overlay.classList.remove('raining');
    for (const stage of Object.values(this.stages)) stage.exit();
    // The cycle state dies here; only loop memory survives.
    this.memory.cycle += 1;
    this.save.cycle = freshCycle();
    this.persist(false);
    const quiet = reason === 'song' ? 'You play the song. The world folds along a crease it already had.' : undefined;
    this.resetScreen.show(null, undefined, quiet);
    const run = await reportReset();
    if (run !== null) {
      this.cycleRun = run;
      this.memory.lastCycleRun = run;
      this.persist(false);
    }
    this.resetScreen.show(this.cycleRun, () => this.beginCycle(true), quiet);
  }

  /** Saves memory + current cycle. `captureCycle` false when the cycle was just replaced. */
  persist(captureCycle = true): void {
    this.sinceSave = 0;
    if (captureCycle && this.stages) {
      const c = this.save.cycle;
      c.minute = this.clock.minute;
      c.storyState = this.story.saveState();
      const snap = this.stages.town.snapshot?.();
      if (snap) c.player = snap;
    }
    this.saveBlocked = !writeSave(this.storage, this.save);
  }

  // ─── Debug hooks ──────────────────────────────────────────────────────────

  debugSetSpeed(speed: number): void {
    this.clock.speed = speed;
  }

  debugJump(minute: number): void {
    this.clock.minute = minute;
  }

  debugStage(id: StageId): void {
    if (!this.dialogue.open && this.phase === 'playing') this.switchStage(id);
  }

  /** Learn everything the demo's night needs, to test the board and strikes quickly. */
  debugPrepareNight(): void {
    for (const f of ['name_in_stone', 'hall_key', 'aristion_phyllis', 'kora_ally', 'eion_song', 'last_line', 'past_attempts', 'sea_absent', 'rain_at_midnight', 'spiral_repeats', 'registry_three', 'mask_extinguisher']) {
      if (KNOWLEDGE.facts.some((x) => x.id === f)) this.knowledge.learn(f);
    }
    for (const l of PAST_LEONTS) this.memory.registry[l.id] = { attempt: l.attempt, ending: l.fate, locked: true };
    if (!this.memory.masks.includes('Extinguisher')) this.memory.masks.push('Extinguisher');
    this.persist();
  }
}
