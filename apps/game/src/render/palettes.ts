// Each stage speaks its own visual language (docs/concept.md §2). Colors are sRGB,
// ordered dark → light; the dither shader walks this ramp by luminance.

export type PaletteId = 'marble' | 'vase' | 'board' | 'none';

export interface Palette {
  id: PaletteId;
  /** null = no dithering: full color. Only the sea gets this. */
  colors: string[] | null;
  /** Brightness / contrast applied before quantizing, to taste per stage. */
  exposure: number;
  contrast: number;
  /** Width of the dithered transition between two colors (1 = classic full dithering, smaller = flatter). */
  band: number;
  /** Draw object outlines in the darkest color: incised lines on the vase, chisel lines in the marble. */
  outline: boolean;
}

export const PALETTES: Record<PaletteId, Palette> = {
  // Stage I, the Hall of Anamnesis: strict 1-bit, marble and shadow.
  marble: { id: 'marble', colors: ['#0d0b09', '#e8e2d0'], exposure: 1.1, contrast: 1.35, band: 0.8, outline: true },
  // Stage II, the town: black-figure vase — lacquer, added red, terracotta, bone.
  vase: { id: 'vase', colors: ['#0d0b09', '#6e2a1c', '#b5532a', '#e8e2d0'], exposure: 1.32, contrast: 1.1, band: 0.35, outline: true },
  // The night plan: the vase colors, but its painted map is unlit and must land on them as painted.
  board: { id: 'board', colors: ['#0d0b09', '#6e2a1c', '#b5532a', '#e8e2d0'], exposure: 1.0, contrast: 1.15, band: 0.45, outline: true },
  none: { id: 'none', colors: null, exposure: 1, contrast: 1, band: 1, outline: false },
};

export const MAX_PALETTE = 4;
