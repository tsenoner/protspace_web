// ============================================================================
// WebGL Module - Main Exports
// ============================================================================

export { WebGLRenderer } from './webgl-renderer';
export type { WebGLStyleGetters, ScalePair, RenderMode } from './types';
export {
  DENSITY_MODE_THRESHOLD,
  DENSITY_PER_PIXEL_THRESHOLD,
  DENSITY_GRID_SIZE,
  KERNEL_RADIUS,
  POINT_MODE_ZOOM_THRESHOLD,
  MAX_POINTS_DIRECT_RENDER,
} from './types';
export { resolveColor, clearColorCache } from './color-utils';
export { getPointShaders, getDensityShaders } from './shaders';
export { createShader, createProgram, createProgramFromSources } from './shader-utils';

