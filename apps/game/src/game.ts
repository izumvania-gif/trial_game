// The game orchestrator: owns the save, the day clock, knowledge, the ink story and the stages,
// and runs the loop of the loop — dawn, the day, midnight (or an ending), the reset, dawn again.
import { fetchStele, reportReset, scratchLine } from './api.ts';
import { ENDINGS } from './content/endings.ts';
import { KNOWLEDGE } from './content/knowledge.ts';
import { pickHint } from './content/hints.ts';
import { LEXICON } from './content/lexicon.ts';
import { MASKS } from './content/masks.ts';
import { SHARD_WORDS, SHARDS } from './content/shards.ts';
import { VOICES } from './content/voices.ts';
import { PAST_LEONTS } from './content/leonts.ts';
import { DayClock, endMinuteForWind } from './core/clock.ts';
import { Knowledge } from './core/knowledge.ts';
import {
  browserStorage, clearSave, freshCycle, hashContent, importTablet, loadSave, readShard, writeSave, writeShard,
  type BreakShard, type KeyValueStorage, type SaveFile,
} from './core/save.ts';
import type { Mechanic, StageId } from './core/types.ts';
import { AudioEngine } from './engine/audio.ts';
import { Input } from './engine/input.ts';
import { StoryEngine, type StoryLine } from './engine/story.ts';
import { DitherRenderer } from './render/DitherRenderer.ts';
import { BoardStage } from './stages/board/BoardStage.ts';
import { DiaryStage } from './stages/diary/DiaryStage.ts';
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
import { updateMeta } from './ui/meta.ts';
import { ResetScreen } from './ui/ResetScreen.ts';
import { SettingsPanel } from './ui/SettingsPanel.ts';
import type { SettingsStore } from './core/settings.ts';

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
  /** What survived the last "Forget everything" after a true ending. */
  readonly breakShard: BreakShard | null;
  /** Set when an imported wax tablet was carved during the Night of Anamnesis. */
  private backupDetected = false;

  readonly settings: SettingsStore;
  private settingsPanel: SettingsPanel;
  readonly audio: AudioEngine;
  private raining = false;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, storyJson: string, settings: SettingsStore) {
    this.settings = settings;
    this.audio = new AudioEngine(settings, (text) => this.hud?.caption(text));
    this.canvas = canvas;
    this.overlay = overlay;
    this.storyJson = storyJson;
    this.contentVersion = hashContent(storyJson);
    const loaded = loadSave(this.storage, this.contentVersion);
    this.save = loaded.save;
    this.saveBlocked = loaded.status === 'unavailable';
    this.cycleRun = this.save.memory.lastCycleRun;
    this.breakShard = readShard(this.storage);

    this.input = new Input(canvas);
    this.renderer = new DitherRenderer(canvas);
    this.hud = new Hud(overlay);
    this.dialogue = new Dialogue(overlay);
    this.lyre = new Lyre(overlay, (note) => this.audio.pluck(note, 0.7));
    this.modal = new Modal(overlay);
    this.resetScreen = new ResetScreen(overlay);
    this.settingsPanel = new SettingsPanel(overlay, settings);
    settings.subscribe((s) => {
      this.clock.secondsPerMinute = s.dayMinutes / 18;
      this.renderer.setQuality(s.quality);
    });
    this.knowledge = new Knowledge(KNOWLEDGE, this.save.memory.facts, (fact) => {
      this.save.memory.facts.push(fact.id);
      if (!this.lost('chronicle')) this.hud.factLearned(fact);
      this.audio.play(fact.id.startsWith('shard_') ? 'shard' : 'fact');
      if (fact.id.startsWith('shard_')) this.countShards();
      this.persist();
    });

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.current?.onResize?.();
    });
  }

  /** Called from the title screen. Resumes the saved day, or starts at dawn. */
  start(): void {
    this.audio.unlock();
    if (this.memory.epilogue) {
      this.beginCycle(false);
      this.activate('diary');
    } else {
      this.beginCycle(this.save.cycle.minute === 0 && this.save.cycle.storyState === null);
      if (this.backupDetected) {
        this.memory.damaged = true;
        this.ending('intermediate');
      }
    }
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
      forget: () => this.forget(),
      breakShard: () => this.breakShard,
      reducedMotion: () => this.settings.value.reducedMotion,
      sound: (id) => this.audio.play(id),
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
      diary: new DiaryStage(host),
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
      curator_note: () => this.memory.curatorNote ?? '',
      true_night: () => this.trueNightMissing().length === 0,
      damaged: () => this.memory.damaged,
      shard_line: () => (this.breakShard && this.memory.cycle <= 3 ? this.breakShard.lines[this.memory.cycle - 1] ?? '' : ''),
      voice: () => this.voiceLine(),
      shard_count: () => SHARDS.filter((s) => this.knowledge.knows(s.fact)).length,
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
    if (knot === 'spiral_seam' || knot === 'desk_profile') this.audio.play('seam');
    this.story.enter(knot);
    this.dialogue.run(this.story, (line) => this.onLine(line), () => this.afterDialogue(), {
      quiet: this.current?.id === 'sea',
      dejavu: {
        canFinish: (id) => this.memory.heard.includes(id) && !this.lost('dejavu'),
        heard: (id) => {
          if (!this.memory.heard.includes(id)) this.memory.heard.push(id);
        },
        result: (id, ok) => {
          this.dejavuResults.set(id, ok);
          if (ok) this.audio.play('dejavu');
        },
        noRhythm: () => this.settings.value.noRhythm,
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
    if (action.startsWith('wake_test:')) this.wakeTest(action.endsWith('prophet') ? 'prophet' : 'true');
    else if (action === 'carve') this.openCarving();
    else if (action === 'carve_now') this.openCarving(true);
    else if (action === 'stele_lines') void this.openSteleLines();
    else if (action === 'board') this.switchStage('board');
    else if (action.startsWith('ending:')) this.ending(action.slice('ending:'.length));
  }

  private frame = (t: number): void => {
    const dt = Math.min(0.1, (t - this.lastTime) / 1000);
    this.lastTime = t;
    const blocked = this.dialogue.open || this.hud.panelOpen || this.modal.open || this.lyre.open || this.settingsPanel.open || this.phase !== 'playing';
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
    const town = this.stages.town.snapshot?.();
    this.audio.update({
      stage: this.phase === 'reset' ? 'reset' : this.current.id,
      progress: this.clock.progress,
      wind: this.save.cycle.wind,
      raining: this.raining,
      sea: this.current.id === 'sea' || this.current.id === 'diary' ? 1 : this.current.id === 'town' && town ? Math.max(0, Math.min(1, (town.z - 4) / 16)) : 0,
    });

    updateMeta({
      lessMeta: this.settings.value.lessMeta,
      stage: this.current.id,
      cycleRun: this.cycleRun,
      knowsOtherHand: this.knowledge.knows('other_hand'),
      knowsSeam: this.knowledge.knows('seam_symbol'),
    });

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
    if (i.wasPressedRaw('KeyO') && !this.settingsPanel.open && !this.dialogue.open) {
      this.settingsPanel.show();
      return;
    }
    if (this.dialogue.open || this.modal.open || this.lyre.open || this.settingsPanel.open) return;
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

  /** Every four shards of the spiral teach a new stele word. */
  private countShards(): void {
    const n = SHARDS.filter((s) => this.knowledge.knows(s.fact)).length;
    for (const w of SHARD_WORDS) if (n >= w.count) this.knowledge.learn(w.fact);
  }

  loseMechanic(m: Mechanic): void {
    if (this.lost(m)) return;
    this.save.cycle.lost.push(m);
    if (m === 'masks') this.save.cycle.wornMask = null;
    this.persist();
  }

  // ─── Carving and the stele ────────────────────────────────────────────────

  /** At dawn, only when a new word has been learned; at the stele before the first hour, always. */
  private openCarving(force = false): void {
    const words = LEXICON.filter((w) => this.knowledge.knows(w.fact));
    if (!words.length) return;
    const fresh = words.filter((w) => !this.memory.lexicon.includes(w.word));
    if (!force && !fresh.length) return;
    for (const w of fresh) this.memory.lexicon.push(w.word);
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
    this.raining = true;
    this.audio.play('thunder');
    this.audio.caption('rain');
    this.story.enter('midnight');
    this.dialogue.run(this.story, () => {}, () => void this.resetCycle('midnight'));
  }

  private playSongOfReturn(): void {
    this.notice('song_played', 0);
    this.phase = 'midnight';
    this.persist();
    void this.resetCycle('song');
  }

  /** What the true night still lacks; also shown as log lines when the night fails. */
  trueNightMissing(): string[] {
    const k = this.knowledge;
    const n = this.save.cycle.night;
    const read = Object.values(this.memory.registry).filter((e) => e.locked).length;
    const missing: string[] = [];
    if (!k.knows('registry_all')) missing.push(`ARCHIVE: ${PAST_LEONTS.length - read} LEONTS UNREAD`);
    if (this.memory.steleWords[this.memory.steleWords.length - 1] !== 'FIRST') missing.push("STELE: 'FIRST' NOT CARVED");
    if (!k.knows('debts_settled')) missing.push('PORT: DEBTS OUTSTANDING');
    if (!n?.citySilent) missing.push('MOUNTAIN: THE CITY ANSWERED YES');
    if (!n?.hallClear) missing.push('HALL: ARCHIVE MENDED BY GUARDS');
    if (!k.knows('curator_awake')) missing.push('CURATOR_P7: NOT AWAKE');
    else if (!n?.rollbackAvoided) missing.push('ROLLBACK: APPROVED BY Minotaur_ops');
    return missing;
  }

  /** Dawn voice of one identified past Leont, chosen by the cycle number. */
  private voiceLine(): string {
    if (this.lost('masks')) return '';
    const heard = PAST_LEONTS.filter((l) => this.memory.registry[l.id]?.locked).map((l) => VOICES[l.attempt]).filter(Boolean);
    const unique = [...new Set(heard)] as string[];
    return unique.length ? unique[this.memory.cycle % unique.length]! : '';
  }

  /** The last test: everything is done, and a button says Wake. Do not press it. */
  private wakeTest(mode: 'true' | 'prophet'): void {
    const seconds = 45;
    let left = seconds;
    const label = h('p', { className: 'log' }, '');
    const wake = button('Wake', () => {
      window.clearInterval(timer);
      this.modal.close();
      this.ending('wake_pressed');
    });
    const tick = () => {
      label.textContent = left > 0 ? `AUTO-RESET: DISABLED · MODE: FREE EVOLUTION · ${left}` : '';
      if (left-- <= 0) {
        window.clearInterval(timer);
        this.modal.close();
        this.beginEpilogue(mode);
      }
    };
    const timer = window.setInterval(tick, 1000);
    this.modal.show('ending wake-test', [
      h('p', {}, 'The wind does not come. Nothing comes. It is very quiet.'),
      h('p', {}, 'Somewhere a button is waiting for you, the way it always has.'),
      label,
      wake,
    ], { dismissable: false });
    tick();
  }

  private beginEpilogue(mode: 'true' | 'prophet'): void {
    const id = mode === 'true' ? 'diary_without_dates' : 'prophet_path';
    if (mode === 'true' && !this.memory.endingsSeen.includes('diary_without_dates')) this.memory.endingsSeen.push('diary_without_dates');
    this.memory.epilogue = { mode, start: Date.now(), entries: [] };
    this.memory.lastEnding = { id, cycle: this.memory.cycle };
    this.persist();
    this.activate('diary');
  }

  /** Forget everything — except the shard. A new Leont will find it. */
  forget(): void {
    const lines = (this.memory.epilogue?.entries ?? []).slice(-3).map((e) => e.text);
    if (this.memory.epilogue) writeShard(this.storage, { lines, at: Date.now() });
    clearSave(this.storage);
    location.reload();
  }

  /** Restores a wax tablet. Returns false if the code is not a save. */
  loadTablet(code: string): boolean {
    const save = importTablet(code, this.contentVersion);
    if (!save) return false;
    // A tablet carved during the Night of Anamnesis carries the night with it.
    this.backupDetected = save.cycle.night !== null;
    if (this.backupDetected) save.cycle = freshCycle();
    this.save = save;
    this.knowledge.reset(save.memory.facts);
    this.cycleRun = save.memory.lastCycleRun;
    this.persist(false);
    return true;
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
      h('div', { className: 'ending-log' }, ...[...card.log, ...(id === 'curator_missing' ? this.trueNightMissing() : [])]
        .map((l) => h('p', { className: 'log' }, l))),
      button('Wake', () => this.modal.close()),
    ], { dismissable: false, onClose: () => (id === 'prophet' ? this.forget() : void this.resetCycle('ending')) });
  }

  private async resetCycle(reason: 'midnight' | 'song' | 'ending'): Promise<void> {
    this.phase = 'reset';
    this.overlay.classList.remove('raining');
    this.raining = false;
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

  get qualityLabel(): string {
    return this.renderer.qualityLabel;
  }

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

  /** Everything the true night needs except playing it: registry, shards, the Curator, debts, FIRST. */
  debugPrepareTrue(): void {
    this.debugPrepareNight();
    for (const f of ['kora_ally', 'aristion_trust', 'talia_friend', 'kora_debts', 'debts_settled', 'desk_agent_id', 'human_notes_seen',
      'curator_chair', 'board_of_directors', 'curator_awake', 'registry_all', ...SHARDS.map((s) => s.fact)]) this.knowledge.learn(f);
    this.memory.curatorNote ??= 'Leave the sea alone.';
    this.memory.steleWords.push('FIRST');
    this.persist();
  }
}
