/**
 * Runtime validator for `PublishState` loaded from untrusted sources
 * (localStorage, parquet bundle). Returns a `Partial<PublishState>` containing
 * only fields that pass shape checks; bad overlays/insets are dropped.
 *
 * Centralises the parsing decisions so a corrupt or pre-migration save can't
 * silently merge garbage into the modal's state via spread + cast.
 */

import type {
  PublishState,
  Overlay,
  CircleOverlay,
  ArrowOverlay,
  LabelOverlay,
  Inset,
  NormRect,
  LegendLayout,
  LegendPosition,
  LegendOverflow,
  LegendFreePosition,
} from './publish-state';
import { getPreset } from './journal-presets';

const LEGEND_POSITIONS: ReadonlySet<LegendPosition> = new Set([
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
]);
const LEGEND_OVERFLOWS: ReadonlySet<LegendOverflow> = new Set([
  'scale',
  'truncate',
  'multi-column',
]);
const SIZE_MODES = new Set<PublishState['sizeMode']>(['1-column', '2-column', 'flexible']);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Numbers in `[0, 1]`. NaN/Infinity rejected. */
function inUnit(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0 && v <= 1;
}

function asNormRect(v: unknown): NormRect | null {
  if (!isObject(v)) return null;
  if (!inUnit(v.x) || !inUnit(v.y)) return null;
  if (!isFiniteNumber(v.w) || !isFiniteNumber(v.h)) return null;
  if (v.w <= 0 || v.h <= 0) return null;
  if (v.x + v.w > 1.001 || v.y + v.h > 1.001) return null;
  return { x: v.x, y: v.y, w: v.w, h: v.h };
}

function asCircleOverlay(v: Record<string, unknown>): CircleOverlay | null {
  if (!inUnit(v.cx) || !inUnit(v.cy)) return null;
  if (!isFiniteNumber(v.rx) || !isFiniteNumber(v.ry) || v.rx <= 0 || v.ry <= 0) return null;
  if (!isString(v.color)) return null;
  if (!isFiniteNumber(v.strokeWidth) || v.strokeWidth <= 0) return null;
  return {
    type: 'circle',
    cx: v.cx,
    cy: v.cy,
    rx: v.rx,
    ry: v.ry,
    rotation: isFiniteNumber(v.rotation) ? v.rotation : 0,
    color: v.color,
    strokeWidth: v.strokeWidth,
  };
}

function asArrowOverlay(v: Record<string, unknown>): ArrowOverlay | null {
  if (!inUnit(v.x1) || !inUnit(v.y1) || !inUnit(v.x2) || !inUnit(v.y2)) return null;
  if (!isString(v.color)) return null;
  if (!isFiniteNumber(v.width) || v.width <= 0) return null;
  return { type: 'arrow', x1: v.x1, y1: v.y1, x2: v.x2, y2: v.y2, color: v.color, width: v.width };
}

function asLabelOverlay(v: Record<string, unknown>): LabelOverlay | null {
  if (!inUnit(v.x) || !inUnit(v.y)) return null;
  if (!isString(v.text)) return null;
  if (!isFiniteNumber(v.fontSize) || v.fontSize <= 0) return null;
  if (!isString(v.color)) return null;
  return {
    type: 'label',
    x: v.x,
    y: v.y,
    text: v.text,
    fontSize: v.fontSize,
    rotation: isFiniteNumber(v.rotation) ? v.rotation : 0,
    color: v.color,
  };
}

function asOverlay(v: unknown): Overlay | null {
  if (!isObject(v)) return null;
  switch (v.type) {
    case 'circle':
      return asCircleOverlay(v);
    case 'arrow':
      return asArrowOverlay(v);
    case 'label':
      return asLabelOverlay(v);
    default:
      return null;
  }
}

function asInset(v: unknown): Inset | null {
  if (!isObject(v)) return null;
  const sourceRect = asNormRect(v.sourceRect);
  const targetRect = asNormRect(v.targetRect);
  if (!sourceRect || !targetRect) return null;
  if (!isFiniteNumber(v.border) || v.border < 0) return null;
  if (v.connector !== 'lines' && v.connector !== 'none') return null;
  return { sourceRect, targetRect, border: v.border, connector: v.connector };
}

function asLegendFreePos(v: unknown): LegendFreePosition | undefined {
  if (!isObject(v)) return undefined;
  if (!inUnit(v.nx) || !inUnit(v.ny)) return undefined;
  return { nx: v.nx, ny: v.ny };
}

function asLegendLayout(v: unknown): Partial<LegendLayout> {
  if (!isObject(v)) return {};
  const out: Partial<LegendLayout> = {};
  if (typeof v.visible === 'boolean') out.visible = v.visible;
  if (isString(v.position) && LEGEND_POSITIONS.has(v.position as LegendPosition)) {
    out.position = v.position as LegendPosition;
  }
  if (isFiniteNumber(v.widthPercent) && v.widthPercent > 0 && v.widthPercent <= 100) {
    out.widthPercent = v.widthPercent;
  }
  if (isFiniteNumber(v.fontSizePx) && v.fontSizePx > 0) out.fontSizePx = v.fontSizePx;
  if (isFiniteNumber(v.columns) && Number.isInteger(v.columns) && v.columns > 0) {
    out.columns = v.columns;
  }
  if (isString(v.overflow) && LEGEND_OVERFLOWS.has(v.overflow as LegendOverflow)) {
    out.overflow = v.overflow as LegendOverflow;
  }
  const free = asLegendFreePos(v.freePos);
  if (free) out.freePos = free;
  return out;
}

/**
 * Parse arbitrary `unknown` input into a `Partial<PublishState>` containing
 * only fields that pass type/range checks. Bad overlays/insets are silently
 * dropped; the caller spreads this over a default state to fill the rest.
 */
export function validatePublishState(raw: unknown): Partial<PublishState> {
  if (!isObject(raw)) return {};

  const out: Partial<PublishState> = {};

  if (isString(raw.preset)) {
    if (raw.preset === 'custom' || getPreset(raw.preset)) {
      out.preset = raw.preset as PublishState['preset'];
    }
  }
  if (isString(raw.sizeMode) && SIZE_MODES.has(raw.sizeMode as PublishState['sizeMode'])) {
    out.sizeMode = raw.sizeMode as PublishState['sizeMode'];
  }
  if (isFiniteNumber(raw.widthPx) && raw.widthPx > 0) out.widthPx = raw.widthPx;
  if (isFiniteNumber(raw.heightPx) && raw.heightPx > 0) out.heightPx = raw.heightPx;
  if (isFiniteNumber(raw.dpi) && raw.dpi > 0) out.dpi = raw.dpi;
  if (raw.format === 'png' || raw.format === 'pdf') out.format = raw.format;
  if (raw.background === 'white' || raw.background === 'transparent')
    out.background = raw.background;
  if (isFiniteNumber(raw.referenceWidth) && raw.referenceWidth > 0) {
    out.referenceWidth = raw.referenceWidth;
  }

  const legend = asLegendLayout(raw.legend);
  if (Object.keys(legend).length > 0) out.legend = legend as LegendLayout;

  if (Array.isArray(raw.overlays)) {
    out.overlays = raw.overlays.map(asOverlay).filter((o): o is Overlay => o !== null);
  }
  if (Array.isArray(raw.insets)) {
    out.insets = raw.insets.map(asInset).filter((i): i is Inset => i !== null);
  }

  if (isObject(raw.viewFingerprint)) {
    if (
      isString(raw.viewFingerprint.projection) &&
      isFiniteNumber(raw.viewFingerprint.dimensionality)
    ) {
      out.viewFingerprint = {
        projection: raw.viewFingerprint.projection,
        dimensionality: raw.viewFingerprint.dimensionality,
      };
    }
  }

  return out;
}
