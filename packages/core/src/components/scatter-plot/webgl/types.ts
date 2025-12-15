import type * as d3 from 'd3';
import type { PlotDataPoint } from '@protspace/utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WebGLStyleGetters {
  getColors: (point: PlotDataPoint) => string[];
  getPointSize: (point: PlotDataPoint) => number;
  getOpacity: (point: PlotDataPoint) => number;
  getDepth: (point: PlotDataPoint) => number;
  getStrokeColor: (point: PlotDataPoint) => string;
  getStrokeWidth: (point: PlotDataPoint) => number;
  getShape: (point: PlotDataPoint) => d3.SymbolType;
}

export type ScalePair = {
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
};

/**
 * Configuration for gamma-correct rendering pipeline
 */
export interface GammaConfig {
  /** Enable gamma-correct rendering pipeline (default: true for WebGL2) */
  enabled: boolean;
  /** Gamma value for display (standard sRGB is ~2.2) */
  gamma: number;
}

/**
 * Framebuffer resources for offscreen rendering
 */
export interface FramebufferResources {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  depthBuffer: WebGLRenderbuffer;
  width: number;
  height: number;
}

// ============================================================================
// Configuration Constants (tuned for performance)
// ============================================================================

/** Maximum points to render directly */
export const MAX_POINTS_DIRECT_RENDER = 1_000_000;

/** Default gamma value (standard sRGB) */
export const DEFAULT_GAMMA = 2.2;
