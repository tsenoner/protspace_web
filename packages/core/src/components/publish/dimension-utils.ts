/**
 * Dimension conversion utilities for the publish editor.
 *
 * Handles bidirectional mm ↔ px ↔ DPI conversions and
 * provides size mode constraints for journal figure widths.
 */

const MM_PER_INCH = 25.4;
const MM_PER_CM = 10;

/** Convert inches to millimetres. */
export function inToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

/** Convert millimetres to inches. */
export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

/** Convert centimetres to millimetres. */
export function cmToMm(cm: number): number {
  return cm * MM_PER_CM;
}

/** Convert millimetres to centimetres. */
export function mmToCm(mm: number): number {
  return mm / MM_PER_CM;
}

/** Convert pixels to millimetres at the given DPI. */
export function pxToMm(px: number, dpi: number): number {
  return (px * MM_PER_INCH) / dpi;
}

/** Convert millimetres to pixels at the given DPI. */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / MM_PER_INCH);
}

/** Calculate the DPI required for a given width in pixels to equal widthMm. */
export function adjustDpiForWidthMm(widthPx: number, widthMm: number): number {
  return Math.round((widthPx * MM_PER_INCH) / widthMm);
}

/** Calculate the pixel width for a given mm width at a specific DPI. */
export function adjustWidthPxForDpi(widthMm: number, dpi: number): number {
  return mmToPx(widthMm, dpi);
}

/**
 * Clamp a height in pixels so it does not exceed maxMm at the given DPI.
 * Returns the original height if maxMm is undefined.
 */
export function clampHeight(heightPx: number, dpi: number, maxMm: number | undefined): number {
  if (maxMm === undefined) return heightPx;
  const maxPx = mmToPx(maxMm, dpi);
  return Math.min(heightPx, maxPx);
}

/** The three dimension modes for the publish editor. */
export type SizeMode = '1-column' | '2-column' | 'flexible';

/** Fixed width in mm for constrained size modes, undefined for flexible. */
export const SIZE_MODE_WIDTH_MM: Record<SizeMode, number | undefined> = {
  '1-column': 89,
  '2-column': 183,
  flexible: undefined,
};

/** Max height for constrained modes (mm). */
export const MAX_HEIGHT_MM = 170;
