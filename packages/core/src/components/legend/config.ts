import { DEFAULT_CONFIG } from '../scatter-plot/config';

/**
 * Custom SVG path generators that match WebGL shader geometry exactly.
 * These replicate the fragment shader math from webgl-renderer.ts for visual consistency.
 *
 * All paths are centered at origin and sized to fit within the given size.
 */
export const SHAPE_PATH_GENERATORS: Record<string, (size: number) => string> = {
  circle: (size: number) => {
    const r = size / 2;
    return `M ${r},0 A ${r},${r} 0 1,1 ${-r},0 A ${r},${r} 0 1,1 ${r},0`;
  },

  square: (size: number) => {
    const s = size / 2;
    return `M ${-s},${-s} L ${s},${-s} L ${s},${s} L ${-s},${s} Z`;
  },

  diamond: (size: number) => {
    // Match WebGL: abs(x)*SQRT3 + abs(y) <= 1
    // This creates a taller, narrower diamond than D3's default
    const h = size / 2;
    const w = h / Math.sqrt(3);
    return `M 0,${-h} L ${w},0 L 0,${h} L ${-w},0 Z`;
  },

  plus: (size: number) => {
    // Match WebGL: thickness = 0.35 (relative to -1..1 range)
    const s = size / 2;
    const t = s * 0.35; // arm thickness matches shader
    return `M ${-t},${-s} L ${t},${-s} L ${t},${-t} L ${s},${-t} L ${s},${t} L ${t},${t} L ${t},${s} L ${-t},${s} L ${-t},${t} L ${-s},${t} L ${-s},${-t} L ${-t},${-t} Z`;
  },

  'triangle-up': (size: number) => {
    // Match WebGL: y >= -0.5 && abs(x)*SQRT3 <= 1 + y
    const h = size * 0.75;
    const halfW = h / Math.sqrt(3);
    const top = -h / 2;
    const bottom = h / 2;
    return `M 0,${top} L ${halfW},${bottom} L ${-halfW},${bottom} Z`;
  },

  'triangle-down': (size: number) => {
    // Match WebGL: y <= 0.5 && abs(x)*SQRT3 <= 1 - y
    // Flipped version of triangle-up
    const h = size * 0.75;
    const halfW = h / Math.sqrt(3);
    const top = -h / 2;
    const bottom = h / 2;
    return `M 0,${bottom} L ${halfW},${top} L ${-halfW},${top} Z`;
  },
};

const SYMBOL_SIZE_MULTIPLIER = 8;

export const LEGEND_DEFAULTS = {
  maxVisibleValues: 10,
  symbolSize: DEFAULT_CONFIG.pointSize / SYMBOL_SIZE_MULTIPLIER,
  symbolSizeMultiplier: SYMBOL_SIZE_MULTIPLIER,
  dragTimeout: 100,
  scatterplotSelector: 'protspace-scatterplot',
  autoSyncDelay: 100,
  includeShapes: false,
  enableDuplicateStackUI: false,
} as const;

export const LEGEND_STYLES = {
  strokeWidth: {
    default: 1,
    selected: 2,
    outline: 2,
  },
  colors: {
    defaultStroke: '#394150',
    selectedStroke: '#00A3E0',
  },
  outlineShapes: new Set<string>([]),
  legendDisplaySize: 16,
} as const;

export const FIRST_NUMBER_SORT_ANNOTATIONS = new Set<string>(['length_fixed', 'length_quantile']);

/** Magic string constants for legend values */
export const LEGEND_VALUES = {
  /** Synthetic "Other" category that groups items beyond maxVisibleValues */
  OTHER: 'Other',
  /** Used for visual encoding special color lookup */
  OTHERS: 'Others',
  /** Display text for N/A items */
  NA_DISPLAY: 'N/A',
  /** Internal value used to represent N/A items (null, empty string, whitespace) */
  NA_VALUE: '__NA__',
} as const;

/**
 * Check if a raw data value represents N/A (null, empty string, or whitespace only).
 * Use this when processing raw annotation data.
 */
export function isNADataValue(value: string | null | undefined): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Check if an internal legend value is N/A.
 * Use this when working with LegendItem.value.
 */
export function isNAValue(value: string): boolean {
  return value === LEGEND_VALUES.NA_VALUE;
}

/**
 * Convert raw data value to internal legend value.
 * N/A values (null, empty, whitespace) become LEGEND_VALUES.NA_VALUE.
 */
export function toInternalValue(value: string | null | undefined): string {
  return isNADataValue(value) ? LEGEND_VALUES.NA_VALUE : (value as string);
}

/**
 * Convert internal legend value back to raw data value for matching.
 * LEGEND_VALUES.NA_VALUE becomes null for matching against raw annotation data.
 */
export function toDataValue(value: string): string | null {
  return value === LEGEND_VALUES.NA_VALUE ? null : value;
}

/**
 * Get display text for a legend value.
 * N/A values show as "N/A", others show as-is.
 */
export function toDisplayValue(value: string): string {
  return value === LEGEND_VALUES.NA_VALUE ? LEGEND_VALUES.NA_DISPLAY : value;
}

/** Event name constants for legend component */
export const LEGEND_EVENTS = {
  ITEM_CLICK: 'legend-item-click',
  ZORDER_CHANGE: 'legend-zorder-change',
  COLORMAPPING_CHANGE: 'legend-colormapping-change',
  CUSTOMIZE: 'legend-customize',
  DOWNLOAD: 'legend-download',
  ERROR: 'legend-error',
  // External events the legend listens to
  DATA_CHANGE: 'data-change',
  ANNOTATION_CHANGE: 'annotation-change',
} as const;
