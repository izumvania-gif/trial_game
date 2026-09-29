import type * as THREE from 'three';
import type { DayClock } from '../core/clock.ts';
import type { Knowledge } from '../core/knowledge.ts';
import type { BreakShard, CycleState, LoopMemory } from '../core/save.ts';
import type { Mechanic, StageId } from '../core/types.ts';
import type { Input } from '../engine/input.ts';
import type { PaletteId } from '../render/palettes.ts';

/** What a stage may ask of the game. */
export interface StageHost {
  input: Input;
  clock: DayClock;
  knowledge: Knowledge;
  aspect(): number;
  /** Height of the low-resolution image in pixels: stages snap their cameras to it to stop the dither swimming. */
  lowResHeight(): number;
  /** Eferon's last frame before going upstairs, as the Curator's terminal shows it. */
  lastFrame(): string | null;
  /** Replace the keycap bar for a moment of this stage (null: the stage's own again). */
  setControls(text: string | null): void;
  /** The side panel open now ('chronicle', 'book'), if any. */
  openPanel(): string | null;
  /** A teaching line at the bottom of the screen, with its keys (null: none). */
  coach(text: string | null): void;
  /** The prologue is over: the first morning goes on in the town. */
  /** The prologue is over; `skipped` when the player left it with Esc, so its lessons were not taught. */
  prologueDone(skipped?: boolean): void;
  /** Run an ink knot in the dialogue box; `args` for a knot that takes parameters. */
  interact(knot: string, args?: string[]): void;
  switchStage(id: StageId, entry?: string): void;
  /** Show or hide the interaction prompt, e.g. "E — Star stele". */
  prompt(label: string | null): void;
  memory: LoopMemory;
  cycle: CycleState;
  /** Container for DOM-based stages and stage overlays. */
  overlay: HTMLElement;
  /** Patches the Curator applied on the Desk; they change Eferon from the next cycle on. */
  patches(): string[];
  /** The observers noticed something: raise the wind and log an anomaly for the Desk. */
  notice(anomaly: string, wind: number): void;
  /** Mechanics destroyed by the strikes. */
  lost(m: Mechanic): boolean;
  loseMechanic(m: Mechanic): void;
  /** Show an ending card; the game decides what comes after. */
  ending(id: string): void;
  /** Wipe the save, keeping only the shard of the break. */
  forget(): void;
  /** What survived a previous true ending, if anything. */
  breakShard(): BreakShard | null;
  /** Accessibility: no camera shake or other violent motion. */
  reducedMotion(): boolean;
  /** The Pilgrim setting: nothing in the world points the way. */
  pilgrim(): boolean;
  /** Sound effects and their captions (the audio engine). */
  sound(id: string): void;
  persist(): void;
}

/** Something an agent can do here: an id to pass back, and what it means in words. */
export interface AgentAction {
  id: string;
  label: string;
  /** What `arg` means, when the action takes one (a number of degrees, a tile, a time). */
  arg?: string;
}

/** A stage's side of agent mode (`?agent`): what is around, in words, and what can be done. */
export interface StageAgent {
  /** Lines describing what the player perceives here now. */
  describe(): string[];
  actions(): AgentAction[];
  /** Do it; returns a note on what happened, or null if the id is not this stage's. */
  perform(id: string, arg?: string): string | null;
}

export interface Stage {
  readonly id: StageId;
  /** null: a DOM-only stage (the Desk); the 3D canvas is hidden. */
  readonly palette: PaletteId | null;
  /** Hide the HUD (clock, cycle) while this stage is active. */
  readonly hideHud?: boolean;
  /** Does the Eferon day keep running here? */
  readonly clockRuns: boolean;
  scene?: THREE.Scene;
  camera?: THREE.Camera;
  /** `entry` names where the player arrives from, e.g. 'temple' or 'shore'. */
  enter(entry?: string): void;
  exit(): void;
  /** Free GPU/DOM resources; called when the cycle ends and the world is rebuilt. */
  dispose?(): void;
  update(dt: number): void;
  onResize?(): void;
  /** Called when a dialogue started from this stage closes. */
  afterDialogue?(): void;
  /** Player position to persist, for stages that have one. */
  snapshot?(): { x: number; z: number; facing: number };
  /** Agent mode: this stage in words, and its actions beyond buttons on screen. */
  agent?(): StageAgent;
  /** An ink `#action:` the game does not handle itself (the trainer's `trial:<id>`). */
  action?(id: string): void;
}
