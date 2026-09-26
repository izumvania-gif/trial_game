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
  /** Run an ink knot in the dialogue box. */
  interact(knot: string): void;
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
  /** Sound effects and their captions (the audio engine). */
  sound(id: string): void;
  persist(): void;
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
}
