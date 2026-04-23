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
  annotationName: string;
  includeShapes: boolean;
  backgroundColor: string;
}

/**
 * Count how many lines text would need when wrapped to maxWidth.
 * Uses the current font set on ctx for measurement.
 */
function measureWrappedLineCount(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): number {
  if (maxWidth <= 0 || !text) return 1;
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      line = word;
      lines++;
    } else {
      line = testLine;
    }
  }
  if (line) lines++;
  return Math.max(1, lines);
}

/**
 * Draw text with word wrapping. Returns the number of lines drawn.
 */
function fillTextWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  if (maxWidth <= 0) return 0;
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines++;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines++;
  }
  return lines;
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
  const renderItems = visibleItems;
  const columns = Math.max(1, opts.columns);

  ctx.save();

  // Header
  ctx.fillStyle = '#1f2937';
  ctx.font = `600 ${headerFontSize}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const headerText = (opts.annotationName || 'Legend').replace(/_/g, ' ');
  ctx.fillText(headerText, padding, padding + headerHeight / 2);

  // Items — distribute across columns with variable row heights
  const colWidth = (canvas.width - padding * 2) / columns;
  const itemsPerCol = Math.ceil(renderItems.length / columns);
  const textOffset = 8 * scale;
  const colGap = 16 * scale;
  const countWidth = 48 * scale;
  const lineHeight = itemFontSize * 1.2;
  const itemPadding = 8 * scale; // vertical padding around each item

  // Pre-measure line counts for label wrapping
  ctx.font = `500 ${itemFontSize}px Arial, sans-serif`;
  const labelTexts = renderItems.map((it) => (it.displayValue ?? it.value).replace(/_/g, ' '));
  const lineCounts: number[] = [];
  for (let i = 0; i < renderItems.length; i++) {
    const col = Math.floor(i / itemsPerCol);
    const xBase = padding + col * colWidth;
    const colRight = xBase + colWidth - (col < columns - 1 ? colGap : padding);
    const maxTextWidth = colRight - countWidth - (xBase + symbolSize + textOffset);
    lineCounts.push(
      measureWrappedLineCount(ctx, labelTexts[i], maxTextWidth > 0 ? maxTextWidth : colWidth * 0.5),
    );
  }

  // Compute cumulative Y offsets per column
  const colYOffsets: number[][] = Array.from({ length: columns }, () => []);
  for (let i = 0; i < renderItems.length; i++) {
    const col = Math.floor(i / itemsPerCol);
    const row = i % itemsPerCol;
    const prevY =
      row === 0
        ? 0
        : colYOffsets[col][row - 1] +
          Math.max(itemHeight, lineCounts[i - columns >= 0 ? i : i] * lineHeight + itemPadding * 2);
    colYOffsets[col].push(row === 0 ? 0 : prevY);
  }

  // Recompute properly: accumulate based on previous item's actual height
  for (let col = 0; col < columns; col++) {
    let y = 0;
    for (let row = 0; row < itemsPerCol; row++) {
      const i = col * itemsPerCol + row;
      if (i >= renderItems.length) break;
      colYOffsets[col][row] = y;
      const lines = lineCounts[i];
      const thisItemH = Math.max(itemHeight, lines * lineHeight + itemPadding * 2);
      y += thisItemH;
    }
  }

  // Draw items
  for (let i = 0; i < renderItems.length; i++) {
    const col = Math.floor(i / itemsPerCol);
    const row = i % itemsPerCol;
    const it = renderItems[i];
    const lines = lineCounts[i];

    const xBase = padding + col * colWidth;
    const yOffset = colYOffsets[col][row];
    const y = padding + headerHeight + yOffset;
    const thisItemH = Math.max(itemHeight, lines * lineHeight + itemPadding * 2);
    const cy = y + thisItemH / 2;

    // Symbol — centered vertically in the item
    drawColoredCircle(ctx, it.color, xBase + symbolSize / 2, cy, symbolSize / 2);

    // Label — centered vertically in the item
    ctx.fillStyle = '#1f2937';
    ctx.font = `500 ${itemFontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const colRight = xBase + colWidth - (col < columns - 1 ? colGap : padding);
    const maxTextWidth = colRight - countWidth - (xBase + symbolSize + textOffset);
    const textBlockH = lines * lineHeight;
    const labelY = y + (thisItemH - textBlockH) / 2;
    fillTextWrapped(
      ctx,
      labelTexts[i],
      xBase + symbolSize + textOffset,
      labelY,
      maxTextWidth > 0 ? maxTextWidth : colWidth * 0.5,
      lineHeight,
    );

    // Count — right-aligned, vertically centered
    ctx.font = `500 ${itemFontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(it.count), colRight, cy);
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
 * Compute the tight height the legend needs for its content.
 * Uses the same scale factors as renderLegendCanvas.
 */
function computeLegendContentHeight(
  fontSizePx: number,
  itemCount: number,
  columns: number,
): number {
  const scale = fontSizePx / 24;
  const padding = 24 * scale;
  const headerHeight = 60 * scale;
  const itemHeight = 56 * scale;
  const cols = Math.max(1, columns);
  const itemsPerCol = Math.ceil(itemCount / cols);
  return padding + headerHeight + itemsPerCol * itemHeight + padding;
}

/**
 * Compute where the plot and legend go on the output canvas given a legend position.
 *
 * Side positions (left/right/top/bottom) split the canvas.
 * Corner positions (tl/tr/bl/br) overlay the legend on the plot.
 * 'none' gives the full canvas to the plot.
 *
 * @param visibleItemCount — number of visible legend items; used to compute
 *   tight height for overlay positions (corners + free). Falls back to 50%
 *   canvas height when omitted.
 */
export function computeLayout(
  totalW: number,
  totalH: number,
  legend: LegendLayout,
  visibleItemCount?: number,
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

  // Corner positions overlay on the plot — use tight content height when item count known
  const cornerW = Math.round(totalW * pct);
  const cornerH =
    visibleItemCount !== undefined
      ? Math.min(
          Math.round(
            computeLegendContentHeight(legend.fontSizePx, visibleItemCount, legend.columns),
          ),
          totalH,
        )
      : Math.round(totalH * 0.5);
  const plotRect: LayoutRect = { x: 0, y: 0, w: totalW, h: totalH };

  const cornerRects: Record<string, LayoutRect> = {
    tl: { x: 0, y: 0, w: cornerW, h: cornerH },
    tr: { x: totalW - cornerW, y: 0, w: cornerW, h: cornerH },
    bl: { x: 0, y: totalH - cornerH, w: cornerW, h: cornerH },
    br: { x: totalW - cornerW, y: totalH - cornerH, w: cornerW, h: cornerH },
  };

  // Free-floating position
  if (pos === 'free') {
    const legendW = Math.round(totalW * pct);
    const legendH =
      visibleItemCount !== undefined
        ? Math.min(
            Math.round(
              computeLegendContentHeight(legend.fontSizePx, visibleItemCount, legend.columns),
            ),
            totalH,
          )
        : Math.round(totalH * 0.5);
    const plotRect: LayoutRect = { x: 0, y: 0, w: totalW, h: totalH };
    const freePos = legend.freePos;
    const lx = freePos ? Math.round(totalW * freePos.nx) : Math.round((totalW - legendW) / 2);
    const ly = freePos ? Math.round(totalH * freePos.ny) : Math.round((totalH - legendH) / 2);
    return { plotRect, legendRect: { x: lx, y: ly, w: legendW, h: legendH } };
  }

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
  scale: number,
) {
  const sr = inset.sourceRect;
  const tr = inset.targetRect;
  const mag = inset.magnification ?? 2;

  // Compute magnified source: shrink source rect around its center by 1/mag
  const srcCenterX = sr.x + sr.w / 2;
  const srcCenterY = sr.y + sr.h / 2;
  const magW = sr.w / mag;
  const magH = sr.h / mag;

  // Convert normalised coords to plot-space pixels — full source for outline, magnified for crop
  const sx = plotRect.x + sr.x * plotRect.w;
  const sy = plotRect.y + sr.y * plotRect.h;
  const sw = sr.w * plotRect.w;
  const sh = sr.h * plotRect.h;

  const cropX = plotRect.x + (srcCenterX - magW / 2) * plotRect.w;
  const cropY = plotRect.y + (srcCenterY - magH / 2) * plotRect.h;
  const cropW = magW * plotRect.w;
  const cropH = magH * plotRect.h;

  const tx = plotRect.x + tr.x * plotRect.w;
  const ty = plotRect.y + tr.y * plotRect.h;
  const tw = tr.w * plotRect.w;
  const th = tr.h * plotRect.h;

  // Draw magnified crop into target rect
  ctx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, tx, ty, tw, th);

  // Border
  if (inset.border > 0) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = inset.border * scale;
    ctx.strokeRect(tx, ty, tw, th);

    // Also outline source rect
    ctx.setLineDash([4 * scale, 4 * scale]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
  }

  // Connector lines — auto-detect best pair from all 4 corners
  if (inset.connector === 'lines') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1 * scale;

    // Source corners
    const srcCorners = [
      { x: sx, y: sy }, // top-left
      { x: sx + sw, y: sy }, // top-right
      { x: sx, y: sy + sh }, // bottom-left
      { x: sx + sw, y: sy + sh }, // bottom-right
    ];
    // Target corners
    const tgtCorners = [
      { x: tx, y: ty }, // top-left
      { x: tx + tw, y: ty }, // top-right
      { x: tx, y: ty + th }, // bottom-left
      { x: tx + tw, y: ty + th }, // bottom-right
    ];

    // Determine relative position of target vs source center
    const srcCx = sx + sw / 2;
    const srcCy = sy + sh / 2;
    const tgtCx = tx + tw / 2;
    const tgtCy = ty + th / 2;

    // Pick 2 pairs of corners to connect based on relative position
    let pairs: [number, number][];
    if (Math.abs(tgtCx - srcCx) > Math.abs(tgtCy - srcCy)) {
      if (tgtCx > srcCx) {
        // Target is right of source
        pairs = [
          [1, 0],
          [3, 2],
        ]; // src-TR→tgt-TL, src-BR→tgt-BL
      } else {
        // Target is left of source
        pairs = [
          [0, 1],
          [2, 3],
        ]; // src-TL→tgt-TR, src-BL→tgt-BR
      }
    } else {
      if (tgtCy > srcCy) {
        // Target is below source
        pairs = [
          [2, 0],
          [3, 1],
        ]; // src-BL→tgt-TL, src-BR→tgt-TR
      } else {
        // Target is above source
        pairs = [
          [0, 2],
          [1, 3],
        ]; // src-TL→tgt-BL, src-TR→tgt-BR
      }
    }

    ctx.beginPath();
    for (const [si, ti] of pairs) {
      ctx.moveTo(srcCorners[si].x, srcCorners[si].y);
      ctx.lineTo(tgtCorners[ti].x, tgtCorners[ti].y);
    }
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
  scale: number,
) {
  switch (annotation.type) {
    case 'circle':
      drawCircleAnnotation(ctx, annotation, plotRect, scale);
      break;
    case 'arrow':
      drawArrowAnnotation(ctx, annotation, plotRect, scale);
      break;
    case 'label':
      drawLabelAnnotation(ctx, annotation, plotRect, scale);
      break;
  }
}

function drawCircleAnnotation(
  ctx: CanvasRenderingContext2D,
  a: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    rotation: number;
    color: string;
    strokeWidth: number;
  },
  pr: LayoutRect,
  scale: number,
) {
  const cx = pr.x + a.cx * pr.w;
  const cy = pr.y + a.cy * pr.h;
  const rx = a.rx * pr.w;
  const ry = a.ry * pr.h;
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.lineWidth = a.strokeWidth * scale;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, a.rotation || 0, 0, Math.PI * 2);
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
  },
  pr: LayoutRect,
  scale: number,
) {
  const x1 = pr.x + a.x1 * pr.w;
  const y1 = pr.y + a.y1 * pr.h;
  const x2 = pr.x + a.x2 * pr.w;
  const y2 = pr.y + a.y2 * pr.h;

  const sw = a.width * scale;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Arrowhead sized proportionally to stroke width
  const headLen = sw * 4;
  const headHalfW = sw * 2;
  const headAngle = Math.atan2(headHalfW, headLen);

  // Shaft ends slightly inside the arrowhead (overlap by half headLen) to avoid a gap
  const shaftStop = headLen * 0.5;
  const shaftEndX = x2 - shaftStop * Math.cos(angle);
  const shaftEndY = y2 - shaftStop * Math.sin(angle);

  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = sw;
  ctx.lineCap = 'butt';

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  // Arrowhead — filled polygon, no stroke
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - headAngle),
    y2 - headLen * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + headAngle),
    y2 - headLen * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabelAnnotation(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number; text: string; fontSize: number; rotation: number; color: string },
  pr: LayoutRect,
  scale: number,
) {
  const x = pr.x + a.x * pr.w;
  const y = pr.y + a.y * pr.h;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a.rotation || 0);
  ctx.fillStyle = a.color;
  ctx.font = `600 ${a.fontSize * scale}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(a.text, 0, 0);
  ctx.restore();
}

/** Draw a highlight outline around an annotation. Uses current ctx stroke style. */
function drawAnnotationHighlight(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  pr: LayoutRect,
  displayScale: number,
) {
  const pad = 4 * displayScale;
  switch (a.type) {
    case 'circle': {
      const cx = pr.x + a.cx * pr.w;
      const cy = pr.y + a.cy * pr.h;
      const rx = a.rx * pr.w + pad;
      const ry = a.ry * pr.h + pad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, a.rotation || 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      const x1 = pr.x + a.x1 * pr.w;
      const y1 = pr.y + a.y1 * pr.h;
      const x2 = pr.x + a.x2 * pr.w;
      const y2 = pr.y + a.y2 * pr.h;
      const minX = Math.min(x1, x2) - pad;
      const minY = Math.min(y1, y2) - pad;
      const w = Math.abs(x2 - x1) + pad * 2;
      const h = Math.abs(y2 - y1) + pad * 2;
      ctx.strokeRect(minX, minY, w, h);
      break;
    }
    case 'label': {
      const x = pr.x + a.x * pr.w;
      const y = pr.y + a.y * pr.h;
      ctx.font = `600 ${a.fontSize}px Arial, sans-serif`;
      const tw = ctx.measureText(a.text).width;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a.rotation || 0);
      ctx.strokeRect(-tw / 2 - pad, -a.fontSize / 2 - pad, tw + pad * 2, a.fontSize + pad * 2);
      ctx.restore();
      break;
    }
  }
}

// ── Main compositor ──────────────────────────────────────────────────

interface CompositeOptions {
  state: PublishState;
  plotCanvas: HTMLCanvasElement;
  legendItems: LegendItem[];
  annotationName: string;
  includeShapes: boolean;
  /** When set, draw a highlight outline around this item on the preview. */
  highlightedItem?: { kind: 'annotation' | 'inset'; index: number } | null;
  /** Ratio of canvas pixels to display pixels — used to keep highlights at constant screen size. */
  displayScale?: number;
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

  const visibleCount = legendItems.filter((it) => it.isVisible).length;
  const { plotRect, legendRect } = computeLayout(W, H, state.legend, visibleCount);

  // Scale annotation pixel properties proportionally to the reference width
  const annotationScale = W / (state.referenceWidth || W);

  // Draw scatterplot into its area
  ctx.drawImage(plotCanvas, plotRect.x, plotRect.y, plotRect.w, plotRect.h);

  // Legend
  if (legendRect && state.legend.visible && state.legend.position !== 'none') {
    const isCorner = ['tl', 'tr', 'bl', 'br', 'free'].includes(state.legend.position);
    const legendCanvas = renderLegendCanvas(legendItems, {
      width: legendRect.w,
      height: legendRect.h,
      fontSizePx: state.legend.fontSizePx,
      columns: state.legend.columns,
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
    renderInset(ctx, plotCanvas, inset, plotRect, annotationScale);
  }

  // Annotations
  for (const annotation of state.annotations) {
    drawAnnotation(ctx, annotation, plotRect, annotationScale);
  }

  // Highlight outline for hovered item (preview only)
  const hi = opts.highlightedItem;
  if (hi) {
    const ds = opts.displayScale ?? 1;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 163, 224, 0.9)';
    ctx.lineWidth = 3 * ds;
    ctx.setLineDash([6 * ds, 4 * ds]);

    if (hi.kind === 'annotation') {
      const a = state.annotations[hi.index];
      if (a) {
        drawAnnotationHighlight(ctx, a, plotRect, ds);
      }
    } else {
      const inset = state.insets[hi.index];
      if (inset) {
        // Highlight both source and target rects
        const sr = inset.sourceRect;
        const tr = inset.targetRect;
        const sx = plotRect.x + sr.x * plotRect.w;
        const sy = plotRect.y + sr.y * plotRect.h;
        const sw = sr.w * plotRect.w;
        const sh = sr.h * plotRect.h;
        const tx = plotRect.x + tr.x * plotRect.w;
        const ty = plotRect.y + tr.y * plotRect.h;
        const tw = tr.w * plotRect.w;
        const th = tr.h * plotRect.h;
        const hp = 2 * ds;
        ctx.strokeRect(sx - hp, sy - hp, sw + hp * 2, sh + hp * 2);
        ctx.strokeRect(tx - hp, ty - hp, tw + hp * 2, th + hp * 2);
      }
    }

    ctx.restore();
  }
}
