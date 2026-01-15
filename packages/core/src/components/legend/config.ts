import { DEFAULT_CONFIG } from '../scatter-plot/config';
import { LEGEND_VALUES, toDisplayValue, SHAPE_PATH_GENERATORS } from '@protspace/utils';

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

// Re-export legend utilities from utils package
export { LEGEND_VALUES, toDisplayValue, SHAPE_PATH_GENERATORS };

/**
 * Check if a raw data value represents N/A (null, empty string, or whitespace only).
 * Use this when processing raw annotation data.
 */
export function isNADataValue(value: string | null | undefined): boolean {
  return (
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
  );
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
