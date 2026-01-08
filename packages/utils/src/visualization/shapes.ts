import type { PointShape } from '../types.js';

/**
 * Shape utilities for consistent rendering across WebGL, Canvas, and SVG
 * This module provides both index-based access (for WebGL shaders) and
 * SVG path generation (for Canvas/legend rendering)
 */

// ============================================================================
// Shape Index Mapping (for WebGL shaders)
// ============================================================================

/**
 * Map shape names to WebGL shader indices
 * 0=circle, 1=square, 2=diamond, 3=triangle-up, 4=triangle-down, 5=plus
 */
export const SHAPE_INDEX_MAPPING: Record<PointShape, number> = {
  circle: 0,
  square: 1,
  diamond: 2,
  'triangle-up': 3,
  'triangle-down': 4,
  plus: 5,
} as const;

export function getShapeIndex(shape: string): number {
  return SHAPE_INDEX_MAPPING[shape as PointShape] ?? 0; // default to circle
}

export function normalizeShapeName(shape: string | null | undefined): PointShape {
  const normalized = (shape || 'circle').toLowerCase() as PointShape;
  return SHAPE_INDEX_MAPPING[normalized] !== undefined ? normalized : 'circle';
}

// ============================================================================
// SVG Path Generators (for Canvas/Legend rendering)
// ============================================================================

/**
 * Custom SVG path generators that match WebGL shader geometry exactly.
 * These replicate the fragment shader math from webgl-renderer.ts for visual consistency.
 *
 * All paths are centered at origin and sized to fit within the given size.
 * Used by both the legend component and export utilities for consistency.
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

/**
 * Parse an SVG path string and render it on a canvas context
 * Centered at the given (cx, cy) position
 */
export function renderPathOnCanvas(
  ctx: CanvasRenderingContext2D,
  pathString: string,
  cx: number,
  cy: number,
  fillColor: string,
  strokeColor: string = '#394150',
  strokeWidth: number = 1,
): void {
  ctx.save();
  ctx.translate(cx, cy);

  const path = new Path2D(pathString);
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  ctx.fill(path);
  ctx.stroke(path);

  ctx.restore();
}
