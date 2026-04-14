import { validateCanvasDimensions } from '../canvas-limits';
import type { MmRect } from './layout';
import { mmToPx } from './typography';

export interface ScatterCaptureOptions {
  backgroundColor: string;
  desaturateUnselected?: boolean;
}

export type ScatterplotCaptureFn = (
  width: number,
  height: number,
  opts: ScatterCaptureOptions,
) => HTMLCanvasElement;

export interface ScatterplotCaptureElement extends HTMLElement {
  captureAtResolution?: (
    width: number,
    height: number,
    options?: { dpr?: number; backgroundColor?: string; desaturateUnselected?: boolean },
  ) => HTMLCanvasElement;
}

export function scatterTargetPixels(
  scatterMm: MmRect,
  dpi: number,
): { width: number; height: number } {
  return {
    width: Math.round(mmToPx(scatterMm.width, dpi)),
    height: Math.round(mmToPx(scatterMm.height, dpi)),
  };
}

export function captureScatterForLayout(
  scatterMm: MmRect,
  dpi: number,
  capture: ScatterplotCaptureFn,
  backgroundColor: string,
): HTMLCanvasElement {
  const { width, height } = scatterTargetPixels(scatterMm, dpi);
  const validation = validateCanvasDimensions(width, height);
  if (!validation.isValid) {
    throw new Error(validation.reason ?? 'Export dimensions exceed browser limits');
  }
  return capture(width, height, { backgroundColor, desaturateUnselected: true });
}

export function createScatterCaptureFromElement(
  el: ScatterplotCaptureElement,
): ScatterplotCaptureFn {
  return (w, h, opts) => {
    if (typeof el.captureAtResolution === 'function') {
      return el.captureAtResolution(w, h, {
        dpr: 1,
        backgroundColor: opts.backgroundColor,
        desaturateUnselected: opts.desaturateUnselected,
      });
    }
    throw new Error(
      'Scatterplot does not support captureAtResolution; publication export requires native WebGL capture.',
    );
  };
}
