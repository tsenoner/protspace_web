import * as d3 from 'd3';
import { NEUTRAL_VALUE_COLOR, DEFAULT_CONFIG } from '../scatter-plot/config';

/**
 * Legend configuration constants
 */

// Define the same SHAPE_MAPPING as in ImprovedScatterplot.tsx for consistency
export const SHAPE_MAPPING = {
  asterisk: d3.symbolAsterisk,
  circle: d3.symbolCircle,
  cross: d3.symbolCross,
  diamond: d3.symbolDiamond,
  plus: d3.symbolPlus,
  square: d3.symbolSquare,
  star: d3.symbolStar,
  triangle: d3.symbolTriangle,
  wye: d3.symbolWye,
  times: d3.symbolTimes,
} as const;

// Default styles for special cases
export const DEFAULT_STYLES = {
  other: {
    color: NEUTRAL_VALUE_COLOR,
    shape: 'circle',
  },
  null: {
    color: NEUTRAL_VALUE_COLOR,
    shape: 'circle',
  },
} as const;

/**
 * Legend component default configuration
 */
const SYMBOL_SIZE_MULTIPLIER = 8; // For D3 symbol size calculation

export const LEGEND_DEFAULTS = {
  maxVisibleValues: 10,
  symbolSize: DEFAULT_CONFIG.pointSize / SYMBOL_SIZE_MULTIPLIER,
  symbolSizeMultiplier: SYMBOL_SIZE_MULTIPLIER,
  dragTimeout: 100,
  scatterplotSelector: 'protspace-scatterplot',
  autoSyncDelay: 100,
  includeOthers: true,
  includeShapes: false,
} as const;

/**
 * Legend styling constants
 */
export const LEGEND_STYLES = {
  strokeWidth: {
    default: 1,
    selected: 2,
    outline: 2,
  },
  colors: {
    defaultStroke: '#394150',
    selectedStroke: '#00A3E0',
    fallback: NEUTRAL_VALUE_COLOR,
  },
  outlineShapes: new Set(['plus', 'asterisk', 'cross', 'times']),
  legendDisplaySize: 16, // legend symbols size (independent of canvas point size)
} as const;

/**
 * Features that should be sorted by the first number present in the label
 * instead of by feature size (count).
 */
export const FIRST_NUMBER_SORT_FEATURES = new Set<string>(['length_fixed', 'length_quantile']);
