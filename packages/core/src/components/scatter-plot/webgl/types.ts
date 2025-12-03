import * as d3 from 'd3';
import type { PlotDataPoint } from '@protspace/utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WebGLStyleGetters {
  getColors: (point: PlotDataPoint) => string[];
  getPointSize: (point: PlotDataPoint) => number;
  getOpacity: (point: PlotDataPoint) => number;
  getStrokeColor: (point: PlotDataPoint) => string;
  getStrokeWidth: (point: PlotDataPoint) => number;
  getShape: (point: PlotDataPoint) => d3.SymbolType;
}

export type ScalePair = {
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
};

export type RenderMode = 'points' | 'density' | 'hybrid';

// ============================================================================
// Configuration Constants
// ============================================================================

/** Threshold for switching between density and point rendering */
export const DENSITY_MODE_THRESHOLD = 10_000;

/** Points per pixel threshold - if higher, use density rendering */
export const DENSITY_PER_PIXEL_THRESHOLD = 0.3;

/** Density grid resolution */
export const DENSITY_GRID_SIZE = 200;

/** Kernel radius for density estimation (in grid cells) */
export const KERNEL_RADIUS = 2;

/** Zoom level at which to fully transition to point rendering */
export const POINT_MODE_ZOOM_THRESHOLD = 5;

/** Maximum points to render in point mode */
export const MAX_POINTS_DIRECT_RENDER = 200_000;

