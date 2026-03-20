import { validateCanvasDimensions } from '../canvas-limits';
import type { PublicationLayout } from './layout';
import type { PxRect } from './pixel-rect';
import { mmRectToPx, rectToDrawImageArgs } from './pixel-rect';
import { mmToPx } from './typography';

export function composePublicationFigureRaster(options: {
  layout: PublicationLayout;
  scatterCanvas: HTMLCanvasElement;
  legendDrawer: (ctx: CanvasRenderingContext2D, rect: PxRect) => void;
  dpi: number;
  backgroundColor: string;
}): HTMLCanvasElement {
  const { layout, scatterCanvas, legendDrawer, dpi, backgroundColor } = options;
  const W = Math.round(mmToPx(layout.figureMm.width, dpi));
  const H = Math.round(mmToPx(layout.figureMm.height, dpi));
  const figCheck = validateCanvasDimensions(W, H);
  if (!figCheck.isValid) {
    throw new Error(figCheck.reason ?? 'Figure dimensions exceed browser limits');
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context for publication export');
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, W, H);

  const scatterPx = mmRectToPx(layout.scatterMm, dpi);
  const legendPx = mmRectToPx(layout.legendMm, dpi);
  const [dx, dy, dw, dh] = rectToDrawImageArgs(scatterPx);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scatterCanvas, 0, 0, scatterCanvas.width, scatterCanvas.height, dx, dy, dw, dh);

  ctx.save();
  ctx.beginPath();
  ctx.rect(legendPx.x, legendPx.y, legendPx.width, legendPx.height);
  ctx.clip();
  legendDrawer(ctx, legendPx);
  ctx.restore();

  return canvas;
}
