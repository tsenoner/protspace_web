/**
 * Pure helper functions extracted from the publish modal component.
 *
 * Each function takes state as input and returns a partial state patch —
 * no DOM access, no side effects, fully testable.
 */

import type { PublishState } from './publish-state';
import { getPreset, resolvePresetDimensions, type PresetId } from './journal-presets';
import { adjustDpiForWidthMm, mmToPx } from './dimension-utils';

type ViewFingerprint = { projection: string; dimensionality: number };

/** Return the active preset's mm constraints, or null for px-based / custom presets. */
export function getActivePresetConstraints(
  state: PublishState,
): { widthMm: number; maxHeightMm: number | undefined } | null {
  const preset = getPreset(state.preset);
  if (!preset || preset.widthMm === undefined) return null;
  return { widthMm: preset.widthMm, maxHeightMm: preset.maxHeightMm };
}

/** Compute state patch for a width change. Adjusts DPI for constrained presets. */
export function computeWidthUpdate(state: PublishState, widthPx: number): Partial<PublishState> {
  const c = getActivePresetConstraints(state);
  if (c) {
    const dpi = adjustDpiForWidthMm(widthPx, c.widthMm);
    const heightPx = c.maxHeightMm
      ? Math.min(state.heightPx, mmToPx(c.maxHeightMm, dpi))
      : state.heightPx;
    return { widthPx, dpi, heightPx };
  }
  return { widthPx, preset: 'custom' };
}

/** Compute state patch for a height change. Clamps to maxHeightMm if constrained. */
export function computeHeightUpdate(state: PublishState, heightPx: number): Partial<PublishState> {
  const c = getActivePresetConstraints(state);
  if (c?.maxHeightMm) {
    const maxPx = mmToPx(c.maxHeightMm, state.dpi);
    heightPx = Math.min(heightPx, maxPx);
  }
  return { heightPx };
}

/** Compute state patch for a DPI change. Recalculates px for constrained presets. */
export function computeDpiUpdate(state: PublishState, dpi: number): Partial<PublishState> {
  const c = getActivePresetConstraints(state);
  if (c) {
    const widthPx = mmToPx(c.widthMm, dpi);
    const heightPx = c.maxHeightMm
      ? Math.min(state.heightPx, mmToPx(c.maxHeightMm, dpi))
      : state.heightPx;
    return { dpi, widthPx, heightPx };
  }
  return { dpi, preset: 'custom' };
}

/** Compute state patch for applying a journal preset. Returns null if preset not found. */
export function computePresetApplication(
  presetId: string,
): { preset: PresetId; widthPx: number; heightPx: number | undefined; dpi: number } | null {
  const preset = getPreset(presetId);
  if (!preset) return null;
  const dims = resolvePresetDimensions(preset);
  return {
    preset: presetId as PresetId,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
    dpi: preset.dpi,
  };
}

/** Check whether saved overlays may be stale due to a projection change. */
export function shouldShowFingerprintWarning(
  saved: ViewFingerprint | undefined,
  current: ViewFingerprint | null,
): boolean {
  if (!saved || !current) return false;
  return saved.projection !== current.projection || saved.dimensionality !== current.dimensionality;
}
