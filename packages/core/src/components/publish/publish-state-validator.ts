/**
 * Runtime sanitiser for `PublishState` values that arrive from outside the modal:
 * parquet bundles, localStorage, hand-edited JSON. Drops malformed overlays/insets
 * and clamps out-of-range coordinates rather than crashing the compositor.
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

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isString = (s: unknown): s is string => typeof s === 'string';
const isObject = (o: unknown): o is Record<string, unknown> =>
  typeof o === 'object' && o !== null && !Array.isArray(o);

function sanitizeOverlay(raw: unknown): Overlay | null {
  if (!isObject(raw)) return null;
  const type = raw.type;
  if (type === 'circle') {
    if (
      !isFiniteNumber(raw.cx) ||
      !isFiniteNumber(raw.cy) ||
      !isFiniteNumber(raw.rx) ||
      !isFiniteNumber(raw.ry)
    ) {
      return null;
    }
    return {
      type: 'circle',
      cx: clamp01(raw.cx),
      cy: clamp01(raw.cy),
      rx: clamp01(raw.rx),
      ry: clamp01(raw.ry),
      rotation: isFiniteNumber(raw.rotation) ? raw.rotation : 0,
      color: isString(raw.color) ? raw.color : '#000000',
      strokeWidth: isFiniteNumber(raw.strokeWidth) ? raw.strokeWidth : 2,
    };
  }
  if (type === 'arrow') {
    if (
      !isFiniteNumber(raw.x1) ||
      !isFiniteNumber(raw.y1) ||
      !isFiniteNumber(raw.x2) ||
      !isFiniteNumber(raw.y2)
    ) {
      return null;
    }
    return {
      type: 'arrow',
      x1: clamp01(raw.x1),
      y1: clamp01(raw.y1),
      x2: clamp01(raw.x2),
      y2: clamp01(raw.y2),
      color: isString(raw.color) ? raw.color : '#000000',
      width: isFiniteNumber(raw.width) ? raw.width : 2,
    };
  }
  if (type === 'label') {
    if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null;
    return {
      type: 'label',
      x: clamp01(raw.x),
      y: clamp01(raw.y),
      text: isString(raw.text) ? raw.text : 'Label',
      fontSize: isFiniteNumber(raw.fontSize) ? raw.fontSize : 16,
      rotation: isFiniteNumber(raw.rotation) ? raw.rotation : 0,
      color: isString(raw.color) ? raw.color : '#000000',
    };
  }
  return null;
}

function sanitizeNormRect(raw: unknown): NormRect | null {
  if (!isObject(raw)) return null;
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isFiniteNumber(raw.w) ||
    !isFiniteNumber(raw.h)
  ) {
    return null;
  }
  return { x: clamp01(raw.x), y: clamp01(raw.y), w: clamp01(raw.w), h: clamp01(raw.h) };
}

function sanitizeInset(raw: unknown): Inset | null {
  if (!isObject(raw)) return null;
  const source = sanitizeNormRect(raw.sourceRect);
  const target = sanitizeNormRect(raw.targetRect);
  if (!source || !target) return null;
  return {
    sourceRect: source,
    targetRect: target,
    border: isFiniteNumber(raw.border) ? raw.border : 1,
    connector: raw.connector === 'none' ? 'none' : 'lines',
  };
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
    widthPercent: isFiniteNumber(raw.widthPercent) ? raw.widthPercent : fallback.widthPercent,
    fontSizePx: isFiniteNumber(raw.fontSizePx) ? raw.fontSizePx : fallback.fontSizePx,
    columns: isFiniteNumber(raw.columns) ? Math.max(1, Math.round(raw.columns)) : fallback.columns,
    overflow:
      raw.overflow === 'scale' || raw.overflow === 'truncate' || raw.overflow === 'multi-column'
        ? raw.overflow
        : fallback.overflow,
    freePos:
      isObject(raw.freePos) && isFiniteNumber(raw.freePos.nx) && isFiniteNumber(raw.freePos.ny)
        ? { nx: clamp01(raw.freePos.nx), ny: clamp01(raw.freePos.ny) }
        : fallback.freePos,
  };
}

/**
 * Take an unknown blob and return a fully-valid `PublishState`.
 * Unknown overlay types and out-of-range coords are dropped/clamped silently.
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
    preset: isString(input.preset) ? (input.preset as PublishState['preset']) : defaults.preset,
    sizeMode:
      input.sizeMode === '1-column' ||
      input.sizeMode === '2-column' ||
      input.sizeMode === 'flexible'
        ? input.sizeMode
        : defaults.sizeMode,
    widthPx: isFiniteNumber(input.widthPx) ? input.widthPx : defaults.widthPx,
    heightPx: isFiniteNumber(input.heightPx) ? input.heightPx : defaults.heightPx,
    dpi: isFiniteNumber(input.dpi) ? input.dpi : defaults.dpi,
    format: input.format === 'pdf' ? 'pdf' : 'png',
    legend: sanitizeLegend(input.legend, defaults.legend),
    background: input.background === 'transparent' ? 'transparent' : 'white',
    overlays,
    insets,
    referenceWidth: isFiniteNumber(input.referenceWidth)
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
