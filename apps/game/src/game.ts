// The game orchestrator: owns the save, the day clock, knowledge, the ink story and the stages,
// and runs the loop of the loop — dawn, the day, midnight, the reset, dawn again.
import { reportReset } from './api.ts';
import { DayClock } from './core/clock.ts';
import { Knowledge } from './core/knowledge.ts';
import {
  browserStorage, freshCycle, hashContent, loadSave, writeSave, type KeyValueStorage, type SaveFile,
} from './core/save.ts';
import type { StageId } from './core/types.ts';
import { KNOWLEDGE } from './content/knowledge.ts';
import { Input } from './engine/input.ts';
import { StoryEngine } from './engine/story.ts';
import { DitherRenderer } from './render/DitherRenderer.ts';
import { DeskStage } from './stages/desk/DeskStage.ts';
import { SeaStage } from './stages/sea/SeaStage.ts';
import { SpiralStage } from './stages/spiral/SpiralStage.ts';
import { TownStage } from './stages/town/TownStage.ts';
import type { Stage, StageHost } from './stages/types.ts';
import { Dialogue } from './ui/Dialogue.ts';
import { Hud } from './ui/Hud.ts';
import { ResetScreen } from './ui/ResetScreen.ts';

type Phase = 'playing' | 'midnight' | 'reset';

const AUTOSAVE_SECONDS = 10;

export class Game {
  readonly input: Input;
  readonly clock = new DayClock();
  readonly knowledge: Knowledge;
  save: SaveFile;
  cycleRun: number | null = null;

  private storage: KeyValueStorage | null = browserStorage();
  private contentVersion: string;
  private renderer: DitherRenderer;
  private hud: Hud;
  private dialogue: Dialogue;
  private resetScreen: ResetScreen;
  private story!: StoryEngine;
  private stages!: Record<StageId, Stage>;
  private current!: Stage;
  private pendingStage: { id: StageId; entry?: string } | null = null;
  private phase: Phase = 'playing';
  private sinceSave = 0;
  private lastTime = 0;
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private storyJson: string;
  /** Set once the save could not be written; shown in the debug panel. */
  saveBlocked = false;

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
    this.resetScreen = new ResetScreen(overlay);
    this.knowledge = new Knowledge(KNOWLEDGE, this.save.memory.facts, (fact) => {
      this.save.memory.facts.push(fact.id);
      this.hud.factLearned(fact);
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

  private host(): StageHost {
    return {
      input: this.input,
      clock: this.clock,
      knowledge: this.knowledge,
      aspect: () => this.renderer.aspect,
      interact: (knot) => this.interact(knot),
      switchStage: (id, entry) => this.switchStage(id, entry),
      prompt: (label) => this.hud.prompt(this.dialogue.open ? null : label),
    };
  }

  /** Builds a fresh world for the current CycleState. Loop memory is untouched. */
  private beginCycle(atDawn: boolean): void {
    const cycle = this.save.cycle;
    this.clock.minute = cycle.minute;
    this.story = new StoryEngine(this.storyJson, {
      knowledge: this.knowledge,
      cycle: () => this.save.memory.cycle,
      hour: () => this.clock.hour,
    }, cycle.storyState);
    for (const stage of Object.values(this.stages ?? {})) {
      stage.exit();
      stage.dispose?.();
    }
    const host = this.host();
    this.stages = {
      town: new TownStage(host, cycle.player),
      spiral: new SpiralStage(host),
      desk: new DeskStage(host, this.overlay),
      sea: new SeaStage(host),
    };
    this.phase = 'playing';
    this.hud.setCycle(this.cycleRun, this.save.memory.cycle);
    this.activate(cycle.stage);
    if (atDawn) this.interact('dawn');
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
    if (this.dialogue.open) return;
    if (!this.story.hasKnot(knot)) {
      console.warn(`No ink knot "${knot}"`);
      return;
    }
    this.hud.prompt(null);
    this.story.enter(knot);
    this.dialogue.run(
      this.story,
      (line) => {
        if (line.spendMinutes) this.clock.spend(line.spendMinutes);
        if (line.stage) this.pendingStage = { id: line.stage };
      },
      () => {
        this.input.flush();
        const next = this.pendingStage;
        this.pendingStage = null;
        if (this.phase === 'midnight') return this.afterMidnight();
        if (next) this.activate(next.id, next.entry);
        this.persist();
      },
      this.current?.id === 'sea',
    );
  }

  private frame = (t: number): void => {
    const dt = Math.min(0.1, (t - this.lastTime) / 1000);
    this.lastTime = t;
    const blocked = this.dialogue.open || this.hud.chronicleOpen || this.phase !== 'playing';
    this.input.enabled = !blocked;

    if (this.phase === 'playing') {
      const closeChronicle = this.hud.chronicleOpen && this.input.wasPressedRaw('Escape');
      if ((this.input.wasPressedRaw('KeyC') && !this.dialogue.open) || closeChronicle) {
        this.hud.toggleChronicle(this.knowledge.list().map((id) => KNOWLEDGE.facts.find((f) => f.id === id)!).filter(Boolean));
      }
      if (this.current.clockRuns && !blocked && this.clock.tick(dt)) this.midnight();
      this.current.update(dt);
    }
    if (this.current.scene && this.current.camera) this.renderer.render(this.current.scene, this.current.camera);
    this.hud.updateClock(this.clock);

    this.sinceSave += dt;
    if (this.sinceSave > AUTOSAVE_SECONDS && this.phase === 'playing') this.persist();
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  private midnight(): void {
    this.phase = 'midnight';
    this.pendingStage = null;
    if (this.current.id !== 'town') this.activate('town', this.current.id === 'sea' ? 'shore' : 'temple');
    this.overlay.classList.add('raining');
    this.story.enter('midnight');
    this.dialogue.run(this.story, () => {}, () => this.afterMidnight());
  }

  private async afterMidnight(): Promise<void> {
    this.phase = 'reset';
    this.overlay.classList.remove('raining');
    // The cycle state dies here; only loop memory survives.
    this.save.memory.cycle += 1;
    this.save.cycle = freshCycle();
    this.persist(false);
    this.resetScreen.show(null);
    const run = await reportReset();
    if (run !== null) {
      this.cycleRun = run;
      this.save.memory.lastCycleRun = run;
      this.persist(false);
    }
    this.resetScreen.show(this.cycleRun, () => this.beginCycle(true));
  }

  /** Saves memory + current cycle. `captureCycle` false when the cycle was just replaced. */
  persist(captureCycle = true): void {
    this.sinceSave = 0;
    if (captureCycle) {
      const c = this.save.cycle;
      c.minute = this.clock.minute;
      c.storyState = this.story.saveState();
      const snap = this.stages.town.snapshot?.();
      if (snap) c.player = snap;
    }
    this.saveBlocked = !writeSave(this.storage, this.save);
  }

  /** Debug hooks. */
  debugSetSpeed(speed: number): void {
    this.clock.speed = speed;
  }

  debugJump(minute: number): void {
    this.clock.minute = minute;
  }

  debugStage(id: StageId): void {
    if (!this.dialogue.open && this.phase === 'playing') this.switchStage(id);
  }
}
