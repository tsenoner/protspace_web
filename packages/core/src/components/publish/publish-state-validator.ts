/**
 * Runtime sanitiser for `PublishState` values that arrive from outside the modal:
 * parquet bundles, localStorage, hand-edited JSON. Drops malformed overlays/insets
 * and out-of-range coordinates rather than crashing the compositor.
 */

import {
  createDefaultPublishState,
  type PublishState,
  type Overlay,
  type Inset,
  type NormRect,
  type LegendLayout,
  type LegendPosition,
} from './publish-state';
import { JOURNAL_PRESETS } from './journal-presets';

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isString = (s: unknown): s is string => typeof s === 'string';
const isObject = (o: unknown): o is Record<string, unknown> =>
  typeof o === 'object' && o !== null && !Array.isArray(o);

function inUnit(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0 && v <= 1;
}

function isValidPreset(value: unknown): value is PublishState['preset'] {
  if (value === 'custom') return true;
  return typeof value === 'string' && JOURNAL_PRESETS.some((p) => p.id === value);
}

function sanitizeOverlay(raw: unknown): Overlay | null {
  if (!isObject(raw)) return null;
  const type = raw.type;
  if (type === 'circle') {
    if (!inUnit(raw.cx) || !inUnit(raw.cy)) return null;
    if (!isFiniteNumber(raw.rx) || !isFiniteNumber(raw.ry) || raw.rx <= 0 || raw.ry <= 0)
      return null;
    if (!isString(raw.color)) return null;
    if (!isFiniteNumber(raw.strokeWidth) || raw.strokeWidth <= 0) return null;
    return {
      type: 'circle',
      cx: raw.cx,
      cy: raw.cy,
      rx: raw.rx,
      ry: raw.ry,
      rotation: isFiniteNumber(raw.rotation) ? raw.rotation : 0,
      color: raw.color,
      strokeWidth: raw.strokeWidth,
    };
  }
  if (type === 'arrow') {
    if (!inUnit(raw.x1) || !inUnit(raw.y1) || !inUnit(raw.x2) || !inUnit(raw.y2)) return null;
    if (!isString(raw.color)) return null;
    if (!isFiniteNumber(raw.width) || raw.width <= 0) return null;
    return {
      type: 'arrow',
      x1: raw.x1,
      y1: raw.y1,
      x2: raw.x2,
      y2: raw.y2,
      color: raw.color,
      width: raw.width,
    };
  }
  if (type === 'label') {
    if (!inUnit(raw.x) || !inUnit(raw.y)) return null;
    if (!isString(raw.text)) return null;
    if (!isFiniteNumber(raw.fontSize) || raw.fontSize <= 0) return null;
    if (!isString(raw.color)) return null;
    return {
      type: 'label',
      x: raw.x,
      y: raw.y,
      text: raw.text,
      fontSize: raw.fontSize,
      rotation: isFiniteNumber(raw.rotation) ? raw.rotation : 0,
      color: raw.color,
    };
  }
  return null;
}

function sanitizeNormRect(raw: unknown): NormRect | null {
  if (!isObject(raw)) return null;
  if (!inUnit(raw.x) || !inUnit(raw.y)) return null;
  if (!isFiniteNumber(raw.w) || !isFiniteNumber(raw.h)) return null;
  if (raw.w <= 0 || raw.h <= 0) return null;
  if (raw.x + raw.w > 1.001 || raw.y + raw.h > 1.001) return null;
  return { x: raw.x, y: raw.y, w: raw.w, h: raw.h };
}

function sanitizeInset(raw: unknown): Inset | null {
  if (!isObject(raw)) return null;
  const sourceRect = sanitizeNormRect(raw.sourceRect);
  const targetRect = sanitizeNormRect(raw.targetRect);
  if (!sourceRect || !targetRect) return null;
  if (!isFiniteNumber(raw.border) || raw.border < 0) return null;
  if (raw.connector !== 'lines' && raw.connector !== 'none') return null;
  return { sourceRect, targetRect, border: raw.border, connector: raw.connector };
}

const VALID_LEGEND_POSITIONS: LegendPosition[] = [
  'right',
  'left',
  'top',
  'bottom',
  'tr',
  'tl',
  'br',
  'bl',
  'free',
  'none',
];

function sanitizeLegend(raw: unknown, fallback: LegendLayout): LegendLayout {
  if (!isObject(raw)) return fallback;
  const position = VALID_LEGEND_POSITIONS.includes(raw.position as LegendPosition)
    ? (raw.position as LegendPosition)
    : fallback.position;
  return {
    visible: typeof raw.visible === 'boolean' ? raw.visible : fallback.visible,
    position,
    widthPercent:
      isFiniteNumber(raw.widthPercent) && raw.widthPercent > 0 && raw.widthPercent <= 100
        ? raw.widthPercent
        : fallback.widthPercent,
    fontSizePx:
      isFiniteNumber(raw.fontSizePx) && raw.fontSizePx > 0 ? raw.fontSizePx : fallback.fontSizePx,
    columns:
      isFiniteNumber(raw.columns) && Number.isInteger(raw.columns) && raw.columns > 0
        ? raw.columns
        : fallback.columns,
    overflow:
      raw.overflow === 'scale' || raw.overflow === 'truncate' || raw.overflow === 'multi-column'
        ? raw.overflow
        : fallback.overflow,
    freePos:
      isObject(raw.freePos) && inUnit(raw.freePos.nx) && inUnit(raw.freePos.ny)
        ? { nx: raw.freePos.nx, ny: raw.freePos.ny }
        : fallback.freePos,
  };
}

/**
 * Take an unknown blob and return a fully-valid `PublishState`.
 * Unknown overlay types and out-of-range coords are dropped silently.
 */
export function sanitizePublishState(input: unknown): PublishState {
  const defaults = createDefaultPublishState();
  if (!isObject(input)) return defaults;

  const overlays = Array.isArray(input.overlays)
    ? input.overlays.map(sanitizeOverlay).filter((a): a is Overlay => a !== null)
    : defaults.overlays;

  const insets = Array.isArray(input.insets)
    ? input.insets.map(sanitizeInset).filter((i): i is Inset => i !== null)
    : defaults.insets;

  return {
    preset: isValidPreset(input.preset) ? input.preset : defaults.preset,
    sizeMode:
      input.sizeMode === '1-column' ||
      input.sizeMode === '2-column' ||
      input.sizeMode === 'flexible'
        ? input.sizeMode
        : defaults.sizeMode,
    widthPx: isFiniteNumber(input.widthPx) && input.widthPx > 0 ? input.widthPx : defaults.widthPx,
    heightPx:
      isFiniteNumber(input.heightPx) && input.heightPx > 0 ? input.heightPx : defaults.heightPx,
    dpi: isFiniteNumber(input.dpi) && input.dpi > 0 ? input.dpi : defaults.dpi,
    format: input.format === 'pdf' ? 'pdf' : 'png',
    legend: sanitizeLegend(input.legend, defaults.legend),
    background: input.background === 'transparent' ? 'transparent' : 'white',
    overlays,
    insets,
    referenceWidth:
      isFiniteNumber(input.referenceWidth) && input.referenceWidth > 0
        ? input.referenceWidth
        : defaults.referenceWidth,
    viewFingerprint:
      isObject(input.viewFingerprint) &&
      isString(input.viewFingerprint.projection) &&
      isFiniteNumber(input.viewFingerprint.dimensionality)
        ? {
            projection: input.viewFingerprint.projection,
            dimensionality: input.viewFingerprint.dimensionality,
          }
        : undefined,
  };
}
