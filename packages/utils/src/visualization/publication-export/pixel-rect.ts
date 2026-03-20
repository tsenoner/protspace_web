import type { MmRect } from './layout';
import { mmToPx } from './typography';

export interface PxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mmRectToPx(rect: MmRect, dpi: number): PxRect {
  return {
    x: mmToPx(rect.x, dpi),
    y: mmToPx(rect.y, dpi),
    width: mmToPx(rect.width, dpi),
    height: mmToPx(rect.height, dpi),
  };
}

export function rectToDrawImageArgs(rect: PxRect): [number, number, number, number] {
  return [rect.x, rect.y, rect.width, rect.height];
}
