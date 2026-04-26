/**
 * Journal & presentation presets for publication-ready figure export.
 *
 * Width/height values come from official artwork guidelines:
 *   Nature, Science, Cell Press, PNAS, PLOS ONE.
 * Slide presets use standard presentation resolutions.
 */

import { mmToPx } from './dimension-utils';

export interface JournalPreset {
  readonly id: string;
  readonly label: string;
  /** Width in millimetres (mutually exclusive with widthPx) */
  readonly widthMm?: number;
  /** Width in pixels (for screen-targeted presets) */
  readonly widthPx?: number;
  /** Fixed height in pixels (for screen-targeted presets) */
  readonly heightPx?: number;
  /** Maximum page height in mm (optional guideline) */
  readonly maxHeightMm?: number;
  /** Target DPI — 300 for print, 96 for screen */
  readonly dpi: number;
}

export type PresetId = (typeof JOURNAL_PRESETS)[number]['id'];

export const JOURNAL_PRESETS = [
  // ── Nature ──────────────────────────────────────────────
  { id: 'nature-1col', label: 'Nature \u00b7 1 col', widthMm: 89, dpi: 300, maxHeightMm: 247 },
  { id: 'nature-2col', label: 'Nature \u00b7 2 col', widthMm: 183, dpi: 300, maxHeightMm: 247 },

  // ── Science ─────────────────────────────────────────────
  { id: 'science-1col', label: 'Science \u00b7 1 col', widthMm: 57, dpi: 300 },
  { id: 'science-2col', label: 'Science \u00b7 2 col', widthMm: 121, dpi: 300 },

  // ── Cell Press ──────────────────────────────────────────
  { id: 'cell-1col', label: 'Cell \u00b7 1 col', widthMm: 85, dpi: 300, maxHeightMm: 225 },
  { id: 'cell-1p5col', label: 'Cell \u00b7 1.5 col', widthMm: 114, dpi: 300, maxHeightMm: 225 },
  { id: 'cell-2col', label: 'Cell \u00b7 2 col', widthMm: 174, dpi: 300, maxHeightMm: 225 },

  // ── PNAS ────────────────────────────────────────────────
  { id: 'pnas-1col', label: 'PNAS \u00b7 1 col', widthMm: 87, dpi: 300, maxHeightMm: 225 },
  { id: 'pnas-2col', label: 'PNAS \u00b7 2 col', widthMm: 178, dpi: 300, maxHeightMm: 225 },

  // ── PLOS ONE ────────────────────────────────────────────
  { id: 'plos-1col', label: 'PLOS \u00b7 1 col', widthMm: 132, dpi: 300, maxHeightMm: 222 },
  { id: 'plos-2col', label: 'PLOS \u00b7 2 col', widthMm: 190, dpi: 300, maxHeightMm: 222 },

  // ── Presentation ────────────────────────────────────────
  { id: 'slide-16-9', label: 'Slide \u00b7 16:9', widthPx: 1920, heightPx: 1080, dpi: 96 },
  { id: 'slide-4-3', label: 'Slide \u00b7 4:3', widthPx: 1440, heightPx: 1080, dpi: 96 },

  // ── Flexible ─────────────────────────────────────────────
  { id: 'flexible', label: 'Flexible', widthPx: 2048, heightPx: 1024, dpi: 300 },
] as const;

/** Look up a preset by its id. Returns `undefined` for unknown ids. */
export function getPreset(id: string): JournalPreset | undefined {
  return JOURNAL_PRESETS.find((p) => p.id === id);
}

/** Resolve a preset to concrete pixel width and optional pixel height. */
export function resolvePresetDimensions(preset: JournalPreset): {
  widthPx: number;
  heightPx: number | undefined;
} {
  if (preset.widthPx !== undefined) {
    return { widthPx: preset.widthPx, heightPx: preset.heightPx };
  }
  const widthPx = mmToPx(preset.widthMm!, preset.dpi);
  const heightPx = preset.maxHeightMm ? mmToPx(preset.maxHeightMm, preset.dpi) : undefined;
  return { widthPx, heightPx };
}
