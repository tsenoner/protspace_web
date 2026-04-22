/**
 * Publish Compositor
 *
 * Single rendering pipeline used by both the live preview and final export.
 * Captures the scatterplot, renders the legend, draws annotations and insets,
 * and composites everything onto a single output canvas.
 */

import type { Annotation, Inset, LegendLayout, PublishState } from './publish-state';

// ── Legend item type (mirrors export-utils LegendExportItem) ─────────

export interface LegendItem {
  value: string;
  displayValue?: string;
  color: string;
  shape: string;
  count: number;
  isVisible: boolean;
}

// ── Scatterplot capture ──────────────────────────────────────────────

interface CaptureOptions {
  width: number;
  height: number;
  backgroundColor: string;
}

/**
 * Capture the scatterplot to an off-screen canvas at the requested size.
 * Delegates to the element's `captureAtResolution` if available.
 */
export function capturePlotCanvas(
  plotEl: HTMLElement & {
    captureAtResolution?: (
      w: number,
      h: number,
      opts: { dpr?: number; backgroundColor?: string },
    ) => HTMLCanvasElement;
  },
  opts: CaptureOptions,
): HTMLCanvasElement {
  if (typeof plotEl.captureAtResolution === 'function') {
    return plotEl.captureAtResolution(opts.width, opts.height, {
      dpr: 1,
      backgroundColor: opts.backgroundColor,
    });
  }
  // Fallback: grab whatever canvas the component has
  const existing = plotEl.querySelector('canvas') as HTMLCanvasElement | null;
  if (existing) {
    const out = document.createElement('canvas');
    out.width = opts.width;
    out.height = opts.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, opts.width, opts.height);
    ctx.drawImage(existing, 0, 0, opts.width, opts.height);
    return out;
  }
  // Last resort: blank canvas
  const blank = document.createElement('canvas');
  blank.width = opts.width;
  blank.height = opts.height;
  const ctx = blank.getContext('2d')!;
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, opts.width, opts.height);
  return blank;
}

// ── Legend rendering ─────────────────────────────────────────────────

interface LegendRenderOptions {
  width: number;
  height: number;
  fontSizePx: number;
  columns: number;
  overflow: 'scale' | 'truncate' | 'multi-column';
  annotationName: string;
  includeShapes: boolean;
  backgroundColor: string;
}

/**
 * Render legend items to an off-screen canvas.
 * Supports multi-column layout, truncation, and legacy Y-scale mode.
 */
function renderLegendCanvas(items: LegendItem[], opts: LegendRenderOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(100, Math.floor(opts.width));
  canvas.height = Math.max(100, Math.floor(opts.height));
  const ctx = canvas.getContext('2d')!;

  const scale = opts.fontSizePx / 24;
  const padding = 24 * scale;
  const headerHeight = 60 * scale;
  const itemHeight = 56 * scale;
  const symbolSize = 28 * scale;
  const headerFontSize = 28 * scale;
  const itemFontSize = 24 * scale;

  // Background
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const visibleItems = items.filter((it) => it.isVisible);

  // Resolve columns for multi-column overflow
  let columns = Math.max(1, opts.columns);
  const availableHeight = canvas.height - padding * 2 - headerHeight;

  if (opts.overflow === 'multi-column' && columns === 1) {
    // Auto-compute columns so tallest column fits
    const singleColHeight = visibleItems.length * itemHeight;
    if (singleColHeight > availableHeight && availableHeight > 0) {
      columns = Math.ceil(singleColHeight / availableHeight);
    }
  }

  // Decide how many items to render
  let renderItems = visibleItems;
  let truncatedCount = 0;
  if (opts.overflow === 'truncate') {
    const maxPerCol = Math.max(1, Math.floor(availableHeight / itemHeight));
    const maxItems = maxPerCol * columns;
    if (visibleItems.length > maxItems) {
      truncatedCount = visibleItems.length - maxItems;
      renderItems = visibleItems.slice(0, maxItems);
    }
  }

  // For legacy scale mode, apply Y-scale to fit
  let scaleY = 1;
  if (opts.overflow === 'scale') {
    const requiredHeight = padding + headerHeight + visibleItems.length * itemHeight + padding;
    scaleY = Math.min(1, canvas.height / requiredHeight);
  }

  ctx.save();
  if (scaleY < 1) ctx.scale(1, scaleY);

  // Header
  ctx.fillStyle = '#1f2937';
  ctx.font = `600 ${headerFontSize}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(opts.annotationName || 'Legend', padding, padding + headerHeight / 2);

  // Items — distribute across columns
  const colWidth = (canvas.width - padding * 2) / columns;
  const itemsPerCol = Math.ceil(renderItems.length / columns);

  for (let i = 0; i < renderItems.length; i++) {
    const col = Math.floor(i / itemsPerCol);
    const row = i % itemsPerCol;
    const it = renderItems[i];

    const xBase = padding + col * colWidth;
    const y = padding + headerHeight + row * itemHeight;
    const cx = xBase + symbolSize / 2;
    const cy = y + itemHeight / 2;

    // Symbol
    if (opts.includeShapes) {
      drawColoredCircle(ctx, it.color, cx, cy, symbolSize / 2);
    } else {
      drawColoredCircle(ctx, it.color, cx, cy, symbolSize / 2);
    }

    // Label
    ctx.fillStyle = '#1f2937';
    ctx.font = `500 ${itemFontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const textOffset = 8 * scale;
    const maxTextWidth = colWidth - symbolSize - textOffset - padding;
    const label = it.displayValue ?? it.value;
    ctx.fillText(
      label,
      xBase + symbolSize + textOffset,
      cy,
      maxTextWidth > 0 ? maxTextWidth : undefined,
    );

    // Count (only in single-column or first column gets count)
    if (columns === 1) {
      ctx.font = `500 ${itemFontSize}px Arial, sans-serif`;
      ctx.fillStyle = '#4b5563';
      ctx.textAlign = 'right';
      ctx.fillText(String(it.count), canvas.width - padding, cy);
    }
  }

  // Truncation notice
  if (truncatedCount > 0) {
    const lastRow = Math.min(itemsPerCol, renderItems.length);
    const y = padding + headerHeight + lastRow * itemHeight + itemHeight / 2;
    ctx.fillStyle = '#6b7280';
    ctx.font = `italic 500 ${itemFontSize * 0.85}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`+ ${truncatedCount} more`, padding, y);
  }

  ctx.restore();
  return canvas;
}

function drawColoredCircle(
  ctx: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.save();
  ctx.fillStyle = color || '#888';
  ctx.strokeStyle = '#394150';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ── Layout helpers ───────────────────────────────────────────────────

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Compute where the plot and legend go on the output canvas given a legend position.
 *
 * Side positions (left/right/top/bottom) split the canvas.
 * Corner positions (tl/tr/bl/br) overlay the legend on the plot.
 * 'none' gives the full canvas to the plot.
 */
export function computeLayout(
  totalW: number,
  totalH: number,
  legend: LegendLayout,
): { plotRect: LayoutRect; legendRect: LayoutRect | null } {
  if (!legend.visible || legend.position === 'none') {
    return { plotRect: { x: 0, y: 0, w: totalW, h: totalH }, legendRect: null };
  }

  const pos = legend.position;
  const pct = legend.widthPercent / 100;

  // Side positions split the canvas
  if (pos === 'right') {
    const lw = Math.round(totalW * pct);
    return {
      plotRect: { x: 0, y: 0, w: totalW - lw, h: totalH },
      legendRect: { x: totalW - lw, y: 0, w: lw, h: totalH },
    };
  }
  if (pos === 'left') {
    const lw = Math.round(totalW * pct);
    return {
      plotRect: { x: lw, y: 0, w: totalW - lw, h: totalH },
      legendRect: { x: 0, y: 0, w: lw, h: totalH },
    };
  }
  if (pos === 'top') {
    const lh = Math.round(totalH * pct);
    return {
      plotRect: { x: 0, y: lh, w: totalW, h: totalH - lh },
      legendRect: { x: 0, y: 0, w: totalW, h: lh },
    };
  }
  if (pos === 'bottom') {
    const lh = Math.round(totalH * pct);
    return {
      plotRect: { x: 0, y: 0, w: totalW, h: totalH - lh },
      legendRect: { x: 0, y: totalH - lh, w: totalW, h: lh },
    };
  }

  // Corner positions overlay on the plot
  const cornerW = Math.round(totalW * pct);
  const cornerH = Math.round(totalH * 0.5); // Half-height for corners
  const plotRect: LayoutRect = { x: 0, y: 0, w: totalW, h: totalH };

  const cornerRects: Record<string, LayoutRect> = {
    tl: { x: 0, y: 0, w: cornerW, h: cornerH },
    tr: { x: totalW - cornerW, y: 0, w: cornerW, h: cornerH },
    bl: { x: 0, y: totalH - cornerH, w: cornerW, h: cornerH },
    br: { x: totalW - cornerW, y: totalH - cornerH, w: cornerW, h: cornerH },
  };

  return { plotRect, legendRect: cornerRects[pos] ?? null };
}

// ── Inset rendering ──────────────────────────────────────────────────

/**
 * Render a zoom inset: crop `srcCanvas` by `sourceRect`, draw into
 * `targetRect` on `ctx`, optionally with border and connector lines.
 */
function renderInset(
  ctx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  inset: Inset,
  plotRect: LayoutRect,
) {
  const sr = inset.sourceRect;
  const tr = inset.targetRect;

  // Convert normalised coords to plot-space pixels
  const sx = plotRect.x + sr.x * plotRect.w;
  const sy = plotRect.y + sr.y * plotRect.h;
  const sw = sr.w * plotRect.w;
  const sh = sr.h * plotRect.h;

  const tx = plotRect.x + tr.x * plotRect.w;
  const ty = plotRect.y + tr.y * plotRect.h;
  const tw = tr.w * plotRect.w;
  const th = tr.h * plotRect.h;

  // Draw cropped source into target rect
  ctx.drawImage(srcCanvas, sx, sy, sw, sh, tx, ty, tw, th);

  // Border
  if (inset.border > 0) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = inset.border;
    ctx.strokeRect(tx, ty, tw, th);

    // Also outline source rect
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
  }

  // Connector lines
  if (inset.connector === 'lines') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Connect bottom-left of source to top-left of target
    ctx.moveTo(sx, sy + sh);
    ctx.lineTo(tx, ty);
    ctx.moveTo(sx + sw, sy + sh);
    ctx.lineTo(tx + tw, ty);
    ctx.stroke();
  }
}

// ── Annotation rendering ─────────────────────────────────────────────

/**
 * Draw a single annotation onto the canvas context.
 * Coordinates are normalised 0–1 within the plot area.
 */
function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  plotRect: LayoutRect,
) {
  switch (annotation.type) {
    case 'circle':
      drawCircleAnnotation(ctx, annotation, plotRect);
      break;
    case 'arrow':
      drawArrowAnnotation(ctx, annotation, plotRect);
      break;
    case 'label':
      drawLabelAnnotation(ctx, annotation, plotRect);
      break;
  }
}

function drawCircleAnnotation(
  ctx: CanvasRenderingContext2D,
  a: { cx: number; cy: number; r: number; color: string; strokeWidth: number },
  pr: LayoutRect,
) {
  const cx = pr.x + a.cx * pr.w;
  const cy = pr.y + a.cy * pr.h;
  const rx = a.r * pr.w;
  const ry = a.r * pr.h;
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.lineWidth = a.strokeWidth;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawArrowAnnotation(
  ctx: CanvasRenderingContext2D,
  a: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    width: number;
    headSize: number;
  },
  pr: LayoutRect,
) {
  const x1 = pr.x + a.x1 * pr.w;
  const y1 = pr.y + a.y1 * pr.h;
  const x2 = pr.x + a.x2 * pr.w;
  const y2 = pr.y + a.y2 * pr.h;

  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.width;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hs = a.headSize;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hs * Math.cos(angle - Math.PI / 6), y2 - hs * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - hs * Math.cos(angle + Math.PI / 6), y2 - hs * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabelAnnotation(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number; text: string; fontSize: number; color: string },
  pr: LayoutRect,
) {
  const x = pr.x + a.x * pr.w;
  const y = pr.y + a.y * pr.h;
  ctx.save();
  ctx.fillStyle = a.color;
  ctx.font = `600 ${a.fontSize}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(a.text, x, y);
  ctx.restore();
}

// ── Main compositor ──────────────────────────────────────────────────

interface CompositeOptions {
  state: PublishState;
  plotCanvas: HTMLCanvasElement;
  legendItems: LegendItem[];
  annotationName: string;
  includeShapes: boolean;
}

/**
 * Compose a publication figure onto the provided output canvas.
 * This is the **single renderer** used by both the live preview and final export.
 */
export function composeFigure(outCanvas: HTMLCanvasElement, opts: CompositeOptions): void {
  const { state, plotCanvas, legendItems, annotationName, includeShapes } = opts;
  const ctx = outCanvas.getContext('2d')!;
  const W = outCanvas.width;
  const H = outCanvas.height;

  const bg = state.background === 'white' ? '#ffffff' : 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, W, H);
  if (state.background === 'white') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  const { plotRect, legendRect } = computeLayout(W, H, state.legend);

  // Draw scatterplot into its area
  ctx.drawImage(plotCanvas, plotRect.x, plotRect.y, plotRect.w, plotRect.h);

  // Legend
  if (legendRect && state.legend.visible && state.legend.position !== 'none') {
    const isCorner = ['tl', 'tr', 'bl', 'br'].includes(state.legend.position);
    const legendCanvas = renderLegendCanvas(legendItems, {
      width: legendRect.w,
      height: legendRect.h,
      fontSizePx: state.legend.fontSizePx,
      columns: state.legend.columns,
      overflow: state.legend.overflow,
      annotationName,
      includeShapes,
      backgroundColor: isCorner
        ? 'rgba(255,255,255,0.85)'
        : state.background === 'white'
          ? '#ffffff'
          : 'rgba(0,0,0,0)',
    });

    if (isCorner) {
      // Draw semi-transparent backdrop for corner overlays
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(legendRect.x, legendRect.y, legendRect.w, legendRect.h);
      ctx.globalAlpha = 1;
      ctx.drawImage(legendCanvas, legendRect.x, legendRect.y, legendRect.w, legendRect.h);
      ctx.restore();
    } else {
      ctx.drawImage(legendCanvas, legendRect.x, legendRect.y, legendRect.w, legendRect.h);
    }
  }

  // Insets
  for (const inset of state.insets) {
    renderInset(ctx, plotCanvas, inset, plotRect);
  }

  // Annotations
  for (const annotation of state.annotations) {
    drawAnnotation(ctx, annotation, plotRect);
  }
}
