// The game orchestrator: owns the save, the day clock, knowledge, the ink story and the stages,
// and runs the loop of the loop — dawn, the day, midnight (or an ending), the reset, dawn again.
import { fetchStele, reportReset, scratchLine } from './api.ts';
import { ENDINGS } from './content/endings.ts';
import { STAGE_CONTROLS, STAGE_GUIDES, TIPS } from './content/guides.ts';
import { isOpen, threadView, THREADS, UNLOCKS } from './content/threads.ts';
import { KNOWLEDGE } from './content/knowledge.ts';
import { DAYS_KEPT, daySummary, type DayRecord } from './content/days.ts';
import { maskVoice } from './content/maskVoices.ts';
import { dayEvent } from './content/epilogue.ts';
import { pickHint } from './content/hints.ts';
import { LEXICON } from './content/lexicon.ts';
import { MASKS } from './content/masks.ts';
import { SHARD_WORDS, SHARDS } from './content/shards.ts';
import { VOICES } from './content/voices.ts';
import { PAST_LEONTS } from './content/leonts.ts';
import { at, DAWN_HOUR, DayClock, endMinuteForWind } from './core/clock.ts';
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
import { HouseStage } from './stages/house/HouseStage.ts';
import { ColdOpen } from './ui/ColdOpen.ts';
import type { Stage, StageHost } from './stages/types.ts';
import { bookOfStrangers, chronicle, hintLine } from './ui/Book.ts';
import { chronicleMapView, chronicleTabs } from './ui/ChronicleMap.ts';
import { Dialogue, type DialogueOptions } from './ui/Dialogue.ts';
import { Guides } from './ui/Guide.ts';
import { h } from './ui/dom.ts';
import { Hud } from './ui/Hud.ts';
import { Lyre } from './ui/Lyre.ts';
import { button, Modal } from './ui/Modal.ts';
import { updateMeta } from './ui/meta.ts';
import { ResetScreen } from './ui/ResetScreen.ts';
import { Passage } from './ui/Passage.ts';
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
  private passage: Passage;
  /** Déjà vu lines the player had heard when the current conversation began. */
  private heardBefore = new Set<string>();
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
  private guides: Guides;
  private coldOpen = new ColdOpen(document.body);
  readonly audio: AudioEngine;
  private raining = false;
  /** A short shower called down by the storm song (not the midnight rain). */
  private shower = false;
  private showerTimer = 0;
  /** Set at a new dawn: show what yesterday taught once the player is free. */
  private recapDue = false;
  private place = 'streets';

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
    // Saves from before the prologue existed: whoever has already lived a day does not need the house.
    const m = this.save.memory;
    if (!m.prologueDone && (m.cycle > 1 || m.facts.length > 0)) m.prologueDone = true;
    this.breakShard = readShard(this.storage);

    this.input = new Input(canvas);
    this.renderer = new DitherRenderer(canvas);
    this.hud = new Hud(overlay);
    this.dialogue = new Dialogue(overlay);
    this.lyre = new Lyre(overlay, (note) => this.audio.pluck(note, 0.7));
    // The R that lowers the lyre must not raise it again on the next frame.
    this.lyre.onClose = () => {
      this.input.flush();
      window.setTimeout(() => this.input.flush(), 0);
    };
    this.modal = new Modal(overlay);
    this.resetScreen = new ResetScreen(overlay);
    this.passage = new Passage(overlay);
    this.settingsPanel = new SettingsPanel(overlay, settings);
    this.guides = new Guides(overlay, () => this.memory.guides, () => this.settings.value.tips);
    settings.subscribe((s) => {
      this.clock.secondsPerMinute = s.dayMinutes / 18;
      this.renderer.setQuality(s.quality);
    });
    this.knowledge = new Knowledge(KNOWLEDGE, this.save.memory.facts, (fact) => {
      this.save.memory.facts.push(fact.id);
      this.memory.learnedOn[fact.id] = this.memory.cycle;
      if (!this.lost('chronicle')) {
        this.hud.factLearned(fact);
        this.announce(fact.id);
        this.guides.tip(TIPS.chronicle!);
      }
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
    } else if (!this.memory.prologueDone && this.memory.cycle === 1 && !this.save.cycle.finale) {
      // The very first morning: the cold open, then the scribe's house. The dawn knot is the prologue's now.
      this.save.cycle.stage = 'house';
      this.beginCycle(false);
      this.coldOpen.play(() => {}, () => this.audio.play('thunder'));
    } else {
      const finale = this.save.cycle.finale;
      this.beginCycle(!finale && !this.backupDetected && this.save.cycle.minute === 0 && this.save.cycle.storyState === null);
      if (this.backupDetected) {
        this.memory.damaged = true;
        this.ending('intermediate');
      } else if (finale) this.resumeFinale(finale);
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
    // The observers notice a kind of thing once a day; doing it again the same day adds nothing.
    if (this.save.cycle.noticed.includes(anomaly)) return;
    this.save.cycle.noticed.push(anomaly);
    const before = endMinuteForWind(this.save.cycle.wind);
    this.save.cycle.wind = Math.min(1, this.save.cycle.wind + wind);
    const after = endMinuteForWind(this.save.cycle.wind);
    // A gust is easy to miss in the chip: say it, the moment midnight moves.
    if (after < before && !this.lost('clock')) {
      this.hud.toast(`Midnight will come at ${DAWN_HOUR + after / 60}:00 today.`, 'The wind rises');
    }
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
      lowResHeight: () => this.renderer.lowResHeight,
      lastFrame: () => this.feedFrame,
      setControls: (text) => this.hud.setControls(text ?? STAGE_CONTROLS[this.current.id] ?? null),
      openPanel: () => this.hud.panelId,
      coach: (text) => this.hud.coach(text),
      prologueDone: () => this.finishPrologue(),
      interact: (knot, args) => this.interact(knot, args),
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
  /** Out of the house: the tutorial's lessons count as learned, and the first question is on screen. */
  private finishPrologue(): void {
    const m = this.memory;
    if (m.prologueDone) return;
    m.prologueDone = true;
    for (const id of ['house', 'town', 'tip:chronicle', 'tip:book', 'tip:dejavu']) if (!m.guides.includes(id)) m.guides.push(id);
    this.updateGoal();
    this.persist();
  }

  /** The first open question, under the clock: what the player is following now. */
  private updateGoal(): void {
    const knows = (id: string) => this.knowledge.knows(id);
    const hidden = !this.current || this.current.id === 'house' && !knows('other_hand') || this.lost('chronicle') || !!this.memory.epilogue;
    const t = hidden ? null : THREADS.find((x) => isOpen(x, knows) && !threadView(x, knows).closed);
    this.hud.setGoal(t ? `${t.question} · C — where to look` : null);
  }

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
      house: new HouseStage(host),
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
    // Resuming the finale's night at the sea: the shore without its daytime greeting.
    this.activate(cycle.stage, cycle.stage === 'sea' && cycle.finale ? 'after' : undefined);
    if (atDawn) this.interact('dawn');
    this.recapDue = atDawn && this.memory.cycle >= 2 && !this.memory.epilogue;
  }

  /** After a fact: what it made possible, and which question it opened or answered. */
  private announce(factId: string): void {
    this.updateGoal();
    const knows = (id: string) => this.knowledge.knows(id);
    if (UNLOCKS[factId]) this.hud.toast(UNLOCKS[factId]!, 'In the margin', true);
    for (const t of THREADS) {
      if (t.closes === factId && isOpen(t, knows)) this.hud.toast(t.question, 'Answered');
      else if (t.opens.includes(factId) && isOpen(t, knows) && !threadView(t, knows).closed) this.hud.toast(t.question, 'New question · C');
    }
  }

  /** The morning after: what yesterday taught, what it opened, what is still unanswered. */
  private showRecap(): void {
    const m = this.memory;
    const knows = (id: string) => this.knowledge.knows(id);
    const learned = KNOWLEDGE.facts.filter((f) => m.learnedOn[f.id] === m.cycle - 1 && knows(f.id));
    const opened = learned.map((f) => UNLOCKS[f.id]).filter((u): u is string => !!u);
    const open = THREADS.filter((t) => isOpen(t, knows)).map((t) => threadView(t, knows)).filter((v) => !v.closed).slice(0, 3);
    const list = (items: (Node | string)[][]) => h('ul', {}, ...items.map((i) => h('li', {}, ...i)));
    const body: (Node | string)[] = [
      h('h3', {}, 'Yesterday you learned'),
      learned.length ? list(learned.map((f) => [f.text])) : h('p', { className: 'recap-empty' }, 'Nothing new. It was the same day, and you lived it the same way.'),
    ];
    if (opened.length) body.push(h('h3', {}, 'In the margin'), list(opened.map((u) => [u])));
    if (open.length) body.push(h('h3', {}, 'Still unanswered'), list(open.map((v) => [h('strong', {}, v.thread.question), ...(v.next && v.hintKey ? [hintLine(v.next, v.hintKey, m.hintsShown)] : [])])));
    body.push(h('p', { className: 'recap-kept' }, 'Kept: the chronicle, the Book of Strangers, your masks. Gone: everything anyone did yesterday. C opens the chronicle.'));
    this.guides.showCard(`Day ${m.cycle}`, 'The same morning', body, 'Begin the day', undefined, 'recap');
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
      // Heard before this conversation began: hearing a line now does not count as having heard it before.
      heard: (id: string) => this.heardBefore.has(id),
      dawn_hint: () => pickHint((f) => this.knowledge.knows(f), this.memory.cycle) ?? '',
      ended_last_cycle: (id: string) => this.memory.lastEnding?.id === id && this.memory.lastEnding.cycle === this.memory.cycle - 1,
      // Learned in this very cycle: the first time something happens reads differently from every time after.
      learned_today: (id: string) => this.knowledge.knows(id) && this.memory.learnedOn[id] === this.memory.cycle,
      // The last hour of the day, whenever the wind has made it: midnight may come at 21:00.
      last_hour: () => this.clock.minute >= this.clock.endMinute - 60,
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
    // The storm song's shower belongs to the town's sky: the Hall and the Desk have their own weather.
    if (id !== 'town' && this.shower) {
      this.shower = false;
      window.clearTimeout(this.showerTimer);
      if (!this.raining) this.overlay.classList.remove('raining');
      this.audio.stopStorm();
    }
    // Down the steps into the Hall, or back up into the day: the passage covers the seam.
    const from = this.current?.id;
    const passage = from === 'town' && id === 'spiral' ? 'down' : from === 'spiral' && id === 'town' ? 'up' : null;
    // Up to the Desk and back: the city's frame shrinks into the Curator's monitor, or grows out of it.
    const layer = id === 'desk' && (from === 'town' || from === 'spiral') ? 'up' : from === 'desk' && (id === 'town' || id === 'spiral') ? 'down' : null;
    if (layer === 'up' && this.current?.scene && this.current.camera) {
      this.feedFrame = this.renderer.snapshot(this.current.scene, this.current.camera).toDataURL();
    }
    if (passage && this.phase === 'playing') {
      const { scene, camera } = this.current;
      this.passage.play(scene && camera ? this.renderer.snapshot(scene, camera) : null, passage, this.settings.value.reducedMotion);
      this.audio.play(passage === 'down' ? 'descend' : 'ascend');
    }
    const fromHouse = this.current?.id === 'house' && id !== 'house';
    this.current?.exit();
    this.current = this.stages[id];
    if (fromHouse) this.finishPrologue();
    const palette = this.current.palette;
    this.canvas.hidden = palette === null;
    if (palette) this.renderer.setPalette(palette);
    this.hud.setVisible(!this.current.hideHud);
    this.hud.setControls(STAGE_CONTROLS[id] ?? null);
    this.updateGoal();
    this.save.cycle.stage = id;
    if (id === 'sea' && entry === 'final') this.save.cycle.finale = 'sea';
    this.current.enter(entry);
    if (layer && this.feedFrame && !this.settings.value.reducedMotion) this.zoomLayer(layer);
  }

  /** The last frame of Eferon before the Curator's terminal took over the screen. */
  private feedFrame: string | null = null;

  /**
   * The layers, shown (after Inscryption's pull-back from the table): going up, the city's frame
   * shrinks into the feed on the Curator's terminal; coming down, it grows out of it again.
   */
  private zoomLayer(dir: 'up' | 'down'): void {
    const feed = document.querySelector<HTMLElement>('.desk-feed img');
    const live = feed?.getBoundingClientRect();
    const rect = live && live.width > 0 ? live : this.feedRect;
    if (dir === 'up' && rect) this.feedRect = rect;
    if (!rect || !this.feedFrame) return;
    const img = h('img', { className: 'layer-zoom', src: this.feedFrame, alt: '' });
    const full = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const small = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    const [a, b] = dir === 'up' ? [full, small] : [small, full];
    const place = (r: typeof full) => Object.assign(img.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    place(a);
    document.body.append(img);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      img.classList.add(dir);
      place(b);
    }));
    window.setTimeout(() => img.remove(), 1300);
  }

  private feedRect: DOMRect | null = null;

  switchStage(id: StageId, entry?: string): void {
    if (this.dialogue.open) {
      this.pendingStage = { id, entry };
      return;
    }
    this.activate(id, entry);
    this.persist();
  }

  interact(knot: string, args?: string[]): void {
    if (this.dialogue.open || this.phase !== 'playing') return;
    if (!this.story.hasKnot(knot)) {
      console.warn(`No ink knot "${knot}"`);
      return;
    }
    this.hud.prompt(null);
    if (knot === 'spiral_seam' || knot === 'desk_profile') this.audio.play('seam');
    // The worn face has been here before, and says so under its breath: once a day per place.
    // Only where the HUD shows (the Desk and the sea hide it, and a line nobody sees is not used up).
    const mask = this.lost('masks') || this.current.hideHud ? null : this.save.cycle.wornMask;
    const said = `voice:${mask}:${knot}`;
    const voice = maskVoice(mask, knot, { evening: this.clock.minute >= at(18), lastHour: this.clock.minute >= this.clock.endMinute - 60 });
    if (voice && !this.save.cycle.noticed.includes(said)) {
      this.save.cycle.noticed.push(said);
      this.hud.toast(voice, `${mask}, under your breath`, true);
    }
    this.heardBefore = new Set(this.memory.heard);
    this.story.enter(knot, args);
    this.dialogue.run(this.story, (line) => this.onLine(line), () => this.afterDialogue(), {
      ...this.dialogueLook(),
      quiet: this.current?.id === 'sea',
      onFirstDejaVu: () => this.guides.tip(TIPS.dejavu!, true),
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

  /** Portraits in the stage's own palette; lines written out unless motion is reduced. */
  private dialogueLook(): DialogueOptions {
    return { theme: this.current?.palette === 'marble' ? 'marble' : 'vase', typewriter: !this.settings.value.reducedMotion };
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
    else if (action === 'epilogue') this.beginEpilogue('true');
    else if (action.startsWith('ending:')) this.ending(action.slice('ending:'.length));
  }

  /** One frame. Whatever goes wrong inside it, the next frame still comes: the game never freezes. */
  private frame = (t: number): void => {
    try {
      this.tick(t);
    } catch (e) {
      console.error(e);
      this.input.endFrame();
    }
    requestAnimationFrame(this.frame);
  };

  private tick(t: number): void {
    const dt = Math.min(0.1, (t - this.lastTime) / 1000);
    this.lastTime = t;
    const blocked = this.dialogue.open || this.hud.panelOpen || this.modal.open || this.lyre.open || this.settingsPanel.open || this.guides.open || this.coldOpen.open || this.phase !== 'playing';
    this.input.enabled = !blocked;
    this.overlay.classList.toggle('talking', this.dialogue.open);
    if (!blocked) this.offerGuides();

    if (this.phase === 'playing') {
      this.handleKeys();
      this.clock.endMinute = endMinuteForWind(this.save.cycle.wind);
      // Time spent in a jump (a long conversation, a wait) can reach the end without a tick crossing it.
      if (this.current.clockRuns && !blocked && (this.clock.tick(dt) || this.clock.isOver)) this.midnight();
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
      raining: this.raining || (this.shower && this.current.id === 'town'),
      sea: this.current.id === 'sea' || this.current.id === 'diary' ? 1 : this.current.id === 'town' && town ? Math.max(0, Math.min(1, (town.z - 4) / 16)) : 0,
      place: this.musicPlace(town),
    });

    updateMeta({
      lessMeta: this.settings.value.lessMeta,
      stage: this.current.id,
      cycleRun: this.cycleRun,
      knowsOtherHand: this.knowledge.knows('other_hand'),
      knowsSeam: this.knowledge.knows('seam_symbol'),
    });

    this.sinceSave += dt;
    // Not in the middle of a conversation: a reload would resume the story half way through a knot.
    if (this.sinceSave > AUTOSAVE_SECONDS && this.phase === 'playing' && !this.dialogue.open) this.persist();
    this.input.endFrame();
  }

  /** The how-to card for this place the first time the player is free to read it; then tips. */
  private offerGuides(): void {
    if (this.recapDue && this.current.id === 'town') {
      this.recapDue = false;
      this.showRecap();
      return;
    }
    const guide = STAGE_GUIDES[this.current.id];
    if ((guide && this.guides.first(guide)) || this.guides.tipVisible || this.current.id !== 'town') return;
    const due: [boolean, keyof typeof TIPS][] = [
      [this.memory.seen.length > 0, 'book'],
      [this.save.cycle.wind > 0 && !this.lost('clock'), 'wind'],
      [this.memory.masks.length > 0 && !this.lost('masks'), 'mask'],
      [this.knowledge.knows('song_of_return'), 'lyre'],
    ];
    for (const [now, id] of due) if (now && this.guides.tip(TIPS[id]!)) return;
  }

  /** Where in the town the scribe is, for the music; a little slack at the edges so tunes do not flicker. */
  private musicPlace(town: { x: number; z: number } | undefined): string {
    if (!town) return this.place;
    const agora = Math.hypot(town.x - 8, town.z - 1.5);
    if (agora < 7) this.place = 'agora';
    else if (town.z > 11.5) this.place = 'port';
    else if ((this.place === 'agora' && agora > 9) || (this.place === 'port' && town.z < 9.5)) this.place = 'streets';
    return this.place;
  }

  private handleKeys(): void {
    const i = this.input;
    if (i.wasPressedRaw('KeyH') && !this.dialogue.open && !this.modal.open && !this.settingsPanel.open && !this.guides.open) {
      const guide = STAGE_GUIDES[this.current.id];
      if (guide) {
        this.hud.closePanel();
        this.guides.show(guide);
        return;
      }
    }
    if (this.hud.panelOpen && (i.wasPressedRaw('Escape') || i.wasPressedRaw('KeyC') || i.wasPressedRaw('KeyB'))) {
      const which = i.wasPressedRaw('KeyC') ? 'chronicle' : i.wasPressedRaw('KeyB') ? 'book' : null;
      const was = this.hud.panelId;
      this.hud.closePanel();
      // The same key closes its own panel; the other one's key switches to it.
      if (!which || which === was) return;
    }
    if (i.wasPressedRaw('KeyO') && !this.settingsPanel.open && !this.dialogue.open) {
      this.settingsPanel.show();
      return;
    }
    if (this.dialogue.open || this.modal.open || this.lyre.open || this.settingsPanel.open) return;
    const inWorld = this.current.id === 'town' || this.current.id === 'spiral' || this.current.id === 'house';
    if (i.wasPressedRaw('KeyC') && inWorld) {
      const burned = this.lost('chronicle');
      const seen = this.memory.mapSeen.length || this.knowledge.list().length <= 3 ? [...this.memory.mapSeen] : this.knowledge.list();
      this.hud.togglePanel('chronicle', 'Chronicle', () =>
        burned ? [h('p', {}, 'Ash. The wax has run into the cracks of the floor.')]
          : this.knowledge.list().length === 0 ? [h('p', {}, 'The wax is smooth. Nothing written yet.')]
            : [chronicleTabs(
              () => chronicleMapView(this.knowledge, KNOWLEDGE.facts, this.memory, {
                onConclusion: (d) => {
                  this.hud.toast(d.margin, 'Concluded');
                  this.audio.play('fact');
                  this.persist();
                },
                onLayout: () => this.persist(),
                seen,
              }),
              () => chronicle(this.knowledge, KNOWLEDGE.facts, this.memory.hintsShown))], !burned);
    }
    if (i.wasPressedRaw('KeyB') && inWorld) {
      this.hud.togglePanel('book', 'Book of Strangers', () =>
        this.lost('schedules') ? [h('p', {}, 'The pages are blank. They were always blank.')] : bookOfStrangers(this.memory, this.knowledge, this.patches(), this.clock.minute));
    }
    if (i.wasPressed('KeyM') && this.current.id === 'town') this.toggleMask();
    if (i.wasPressed('KeyR') && this.current.id === 'town') {
      if (!this.knowledge.knows('song_of_return')) this.hud.toast('You have no lyre, and no song to play on it.');
      else {
        this.audio.prepareStorm();
        this.lyre.show(true, () => this.playSongOfReturn(), () => this.playSongOfStorms());
      }
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
      this.hud.toast(MASKS[c.wornMask]?.effect ?? '', `Mask: ${c.wornMask}`);
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
    this.hud.shatter(m);
    window.setTimeout(() => this.audio.play('crack'), 550);
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
        this.save.cycle.carved = w.word;
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
    this.shower = false;
    this.audio.stopStorm();
    this.audio.play('thunder');
    this.audio.caption('rain');
    this.story.enter('midnight');
    this.dialogue.run(this.story, () => {}, () => void this.resetCycle('midnight'), this.dialogueLook());
  }

  /**
   * The storm song (a nod to Ocarina of Time): a stormy waltz on the lyre, thunder, and a short
   * shower over the city at whatever hour. Nothing in the day changes; the sky just answers.
   */
  private playSongOfStorms(): void {
    if (this.phase !== 'playing') return;
    if (this.shower) {
      this.hud.toast('The sky is still answering the last time.', undefined, true);
      return;
    }
    const length = this.audio.stormWaltz();
    this.audio.play('thunder');
    this.shower = true;
    this.overlay.classList.add('raining');
    const first = !this.save.cycle.noticed.includes('song:storms');
    if (first) {
      this.save.cycle.noticed.push('song:storms');
      this.hud.toast(this.clock.minute >= at(18)
        ? 'Rain, before midnight. Zeus will want a word with whoever taught Eion that.'
        : 'Rain, in broad daylight. Zeus will want a word with whoever taught Eion that.', 'In the margin', true);
    }
    window.clearTimeout(this.showerTimer);
    this.showerTimer = window.setTimeout(() => {
      this.shower = false;
      if (!this.raining) this.overlay.classList.remove('raining');
      this.audio.stopStorm();
    }, Math.max(12, length + 6) * 1000);
  }

  private playSongOfReturn(): void {
    this.notice('song_played', 0);
    this.phase = 'midnight';
    this.persist();
    void this.resetCycle('song');
  }

  /** What the true night still lacks; also shown as log lines when the night fails. */
  /**
   * The tail of the "Awaiting Curator" log: an asleep Curator approves the rollback itself;
   * an awake one does not, and then the log names only what really was missing.
   */
  private curatorMissingLog(): string[] {
    const missing = this.trueNightMissing();
    if (this.knowledge.knows('curator_awake')) return missing;
    return ['CURATOR_P7: no response', 'ROLLBACK APPROVED BY: CURATOR_P7 (auto)', ...missing.filter((l) => !l.startsWith('CURATOR_P7'))];
  }

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

  /** A reload in the middle of the finale picks it up where it stood, rather than losing the night. */
  private resumeFinale(finale: string): void {
    if (finale.startsWith('ending:')) return this.ending(finale.slice('ending:'.length));
    if (finale === 'sea') return this.activate('sea', 'final');
    this.activate('sea', 'after');
    if (finale.startsWith('wake:')) this.wakeTest(finale.endsWith('prophet') ? 'prophet' : 'true');
    else if (finale === 'curator') this.interact('curator_meeting');
  }

  private setFinale(finale: string | null): void {
    this.save.cycle.finale = finale;
    this.persist();
  }

  /** The last test: everything is done, and a button says Wake. Do not press it. */
  private wakeTest(mode: 'true' | 'prophet'): void {
    this.setFinale(`wake:${mode}`);
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
        // Nobody pressed it. On the true path somebody is waiting in the hut before the diary.
        if (mode === 'true') {
          this.setFinale('curator');
          this.interact('curator_meeting');
        } else this.beginEpilogue(mode);
      }
    };
    const timer = window.setInterval(tick, 1000);
    // Nothing to walk to and nowhere to go back to: the only control left is the button.
    this.hud.setControls(null);
    this.modal.show('ending wake-test', [
      h('p', {}, 'The wind does not come. Nothing comes. It is very quiet.'),
      h('p', {}, 'Somewhere a button is waiting for you, the way it always has.'),
      label,
      wake,
    ], { dismissable: false, autofocus: false });
    tick();
  }

  private beginEpilogue(mode: 'true' | 'prophet'): void {
    const id = mode === 'true' ? 'diary_without_dates' : 'prophet_path';
    if (mode === 'true' && !this.memory.endingsSeen.includes('diary_without_dates')) this.memory.endingsSeen.push('diary_without_dates');
    this.memory.epilogue = { mode, start: Date.now(), entries: [] };
    this.memory.lastEnding = { id, cycle: this.memory.cycle };
    this.save.cycle.finale = null;
    this.activate('diary');
    this.persist();
  }

  /** Forget everything — except the shard. A new Leont will find it. */
  forget(): void {
    const written = (this.memory.epilogue?.entries ?? []).slice(-3).map((e) => e.text);
    // Nothing written: the next Leont still finds something, the first thing that was new.
    const lines = written.length ? written : [dayEvent(0, 0)];
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
    // Until Wake is pressed the ending is only shown, not lived through: a reload shows the card again.
    this.save.cycle.finale = `ending:${id}`;
    this.persist();
    this.modal.show('ending', [
      h('p', { className: 'ending-kicker' }, 'Ending'),
      h('h2', {}, card.title),
      ...card.lines.map((l) => h('p', {}, l)),
      h('div', { className: 'ending-log' }, ...[...card.log, ...(id === 'curator_missing' ? this.curatorMissingLog() : [])]
        .map((l) => h('p', { className: 'log' }, l))),
      button('Wake', () => this.modal.close()),
    ], { dismissable: false, onClose: () => (id === 'prophet' ? this.forget() : void this.resetCycle('ending')) });
  }

  private async resetCycle(reason: 'midnight' | 'song' | 'ending'): Promise<void> {
    // The last frame of the day, before anything is torn down: it becomes the relief.
    const scene = this.current.scene;
    const camera = this.current.camera;
    const frame = scene && camera ? this.renderer.snapshot(scene, camera) : null;
    this.phase = 'reset';
    this.overlay.classList.remove('raining');
    this.audio.stopStorm();
    this.raining = false;
    this.shower = false;
    window.clearTimeout(this.showerTimer);
    this.hud.clearToasts();
    for (const stage of Object.values(this.stages)) stage.exit();
    // Yesterday's view of the city is not today's feed.
    this.feedFrame = null;
    this.feedRect = null;
    // What this Leont did before the day came back, carved with the day's last frame.
    const day = this.memory.cycle;
    const record: DayRecord = {
      cycle: day,
      summary: daySummary({
        learned: Object.entries(this.memory.learnedOn).filter(([, c]) => c === day).map(([f]) => f),
        carved: this.save.cycle.carved,
        reason,
        ending: reason === 'ending' && this.memory.lastEnding?.cycle === day ? this.memory.lastEnding.id : null,
      }),
    };
    this.memory.days = [...this.memory.days.filter((d) => d.cycle !== day), record].slice(-DAYS_KEPT);
    const carvedLine = `Day ${day}. ${record.summary}`;
    // The cycle state dies here; only loop memory survives.
    this.memory.cycle += 1;
    this.save.cycle = freshCycle();
    this.persist(false);
    const quiet = reason === 'song' ? 'You play the song. The world folds along a crease it already had.' : undefined;
    const reported = reportReset();
    await this.resetScreen.freeze(frame, this.settings.value.reducedMotion, () => this.audio.play('freeze'), (url) => {
      record.relief = url;
      this.persist(false);
    });
    this.resetScreen.show(null, undefined, quiet, carvedLine);
    const run = await reported;
    if (run !== null) {
      this.cycleRun = run;
      this.memory.lastCycleRun = run;
      this.persist(false);
    }
    this.resetScreen.show(this.cycleRun, () => this.beginCycle(true), quiet, carvedLine);
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
