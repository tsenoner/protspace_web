import type { ScatterplotConfig } from '@protspace/utils';

// Centralized default configuration for the scatterplot component
export const DEFAULT_CONFIG: Required<ScatterplotConfig> = {
  width: 800,
  height: 600,
  margin: { top: 40, right: 40, bottom: 40, left: 40 },
  pointSize: 240,
  highlightedPointSize: 120,
  selectedPointSize: 150,
  zoomExtent: [0.1, 10],
  baseOpacity: 0.8,
  selectedOpacity: 1.0,
  fadedOpacity: 0.2,
  transitionDuration: 250,
  largeDatasetThreshold: 5000,
  fastRenderingThreshold: 10000,
  enableTransitions: false,
  useSimpleShapes: false,
  maxPointsForComplexShapes: 2000,
  zoomSizeScaleExponent: 1.0,
};

export const NEUTRAL_VALUE_COLOR = '#888888';
