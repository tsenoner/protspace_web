import { DEFAULT_CONFIG } from '../scatter-plot/config';
import {
  LEGEND_VALUES,
  toDisplayValue,
  toInternalValue,
  SHAPE_PATH_GENERATORS,
} from '@protspace/utils';

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

// Re-export legend utilities from utils package
export { LEGEND_VALUES, toDisplayValue, toInternalValue, SHAPE_PATH_GENERATORS };

/**
 * Check if an internal legend value is N/A.
 * Use this when working with LegendItem.value.
 */
export function isNAValue(value: string): boolean {
  return value === LEGEND_VALUES.NA_VALUE;
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
