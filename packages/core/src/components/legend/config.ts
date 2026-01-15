import { DEFAULT_CONFIG } from '../scatter-plot/config';

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
  OTHER: 'Other',
  /** Used for visual encoding special color lookup */
  OTHERS: 'Others',
  NULL_STRING: 'null',
  NA_DISPLAY: 'N/A',
} as const;

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
