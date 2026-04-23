/**
 * State types for the Publish (figure editor) modal.
 *
 * All annotation/inset coordinates are normalised to 0–1 over the
 * scatterplot area so they survive resolution and preset changes.
 */

import type { PresetId } from './journal-presets';
import type { SizeMode } from './dimension-utils';

// ── Annotation primitives ────────────────────────────────

export interface CircleAnnotation {
  type: 'circle';
  /** Centre X, normalised 0–1 */
  cx: number;
  /** Centre Y, normalised 0–1 */
  cy: number;
  /** Horizontal radius, normalised 0–1 */
  rx: number;
  /** Vertical radius, normalised 0–1 */
  ry: number;
  /** Rotation in radians */
  rotation: number;
  color: string;
  strokeWidth: number;
}

export interface ArrowAnnotation {
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface LabelAnnotation {
  type: 'label';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

export type Annotation = CircleAnnotation | ArrowAnnotation | LabelAnnotation;

// ── Zoom inset ───────────────────────────────────────────

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Inset {
  sourceRect: NormRect;
  targetRect: NormRect;
  border: number;
  connector: 'lines' | 'none';
  /** Zoom level — controls how much the source rect is magnified. Default 2. */
  magnification: number;
}

// ── Legend layout ────────────────────────────────────────

export type LegendPosition =
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'tr'
  | 'tl'
  | 'br'
  | 'bl'
  | 'free'
  | 'none';

export type LegendOverflow = 'scale' | 'truncate' | 'multi-column';

/** Normalised position for free-floating legend. */
export interface LegendFreePosition {
  /** X position, normalised 0–1 over entire canvas */
  nx: number;
  /** Y position, normalised 0–1 over entire canvas */
  ny: number;
}

export interface LegendLayout {
  visible: boolean;
  position: LegendPosition;
  widthPercent: number;
  fontSizePx: number;
  columns: number;
  overflow: LegendOverflow;
  /** Position when legend.position === 'free'. */
  freePos?: LegendFreePosition;
}

// ── Top-level publish state ─────────────────────────────

export interface PublishState {
  preset: PresetId | 'custom';
  sizeMode: SizeMode;
  widthPx: number;
  heightPx: number;
  dpi: number;
  format: 'png' | 'pdf';
  legend: LegendLayout;
  background: 'white' | 'transparent';
  annotations: Annotation[];
  insets: Inset[];
  /** Width in px when annotations were authored. Used to scale pixel properties proportionally. */
  referenceWidth: number;
}

/** Tool currently active on the overlay */
export type OverlayTool = 'select' | 'circle' | 'arrow' | 'label' | 'inset-source' | 'inset-target';

export function createDefaultPublishState(base?: {
  imageWidth?: number;
  imageHeight?: number;
  legendWidthPercent?: number;
  legendFontSizePx?: number;
}): PublishState {
  return {
    preset: 'flexible',
    sizeMode: 'flexible',
    widthPx: base?.imageWidth ?? 2048,
    heightPx: base?.imageHeight ?? 1024,
    dpi: 300,
    format: 'png',
    legend: {
      visible: true,
      position: 'right',
      widthPercent: base?.legendWidthPercent ?? 20,
      fontSizePx: base?.legendFontSizePx ?? 15,
      columns: 1,
      overflow: 'multi-column',
    },
    background: 'white',
    annotations: [],
    insets: [],
    referenceWidth: base?.imageWidth ?? 2048,
  };
}
