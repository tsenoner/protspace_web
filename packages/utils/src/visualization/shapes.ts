import * as d3 from 'd3';
import type { PointShape } from '../types.js';

export const SHAPE_MAPPING: Record<PointShape, d3.SymbolType> = {
  circle: d3.symbolCircle,
  square: d3.symbolSquare,
  diamond: d3.symbolDiamond,
  'triangle-up': d3.symbolTriangle,
  'triangle-down': d3.symbolTriangle2, // D3's triangle2 points down
  plus: d3.symbolPlus,
} as const;

export function getSymbolType(shape: string): d3.SymbolType {
  return SHAPE_MAPPING[shape as PointShape] || d3.symbolCircle;
}
