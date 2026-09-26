import type * as THREE from 'three';
import type { DayClock } from '../core/clock.ts';
import type { Knowledge } from '../core/knowledge.ts';
import type { StageId } from '../core/types.ts';
import type { Input } from '../engine/input.ts';
import type { PaletteId } from '../render/palettes.ts';

/** What a stage may ask of the game. */
export interface StageHost {
  input: Input;
  clock: DayClock;
  knowledge: Knowledge;
  aspect(): number;
  /** Run an ink knot in the dialogue box. */
  interact(knot: string): void;
  switchStage(id: StageId, entry?: string): void;
  /** Show or hide the interaction prompt, e.g. "E — Star stele". */
  prompt(label: string | null): void;
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
  /** Player position to persist, for stages that have one. */
  snapshot?(): { x: number; z: number; facing: number };
}
