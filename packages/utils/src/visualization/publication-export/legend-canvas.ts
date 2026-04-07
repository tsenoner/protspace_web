import { SHAPE_PATH_GENERATORS, renderPathOnCanvas } from '../shapes';
import { FIGURE_LAYOUTS, type FigureLayoutId } from './presets';
import { sliceLegendItemsForLayout } from './legend-slice';
import type { PublicationLegendModel, PublicationLegendRow } from './legend-model';
import { wrapLabelToTwoLines } from './legend-text-layout';
import { legendBodyPt, mmToPx, ptToPx } from './typography';
import type { PxRect } from './pixel-rect';

export const EXPORT_FONT_FAMILY =
  '"Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';

const HEADER_BODY_MM = 5;

interface PaintCellContext {
  ctx: CanvasRenderingContext2D;
  cols: number;
  rows: number;
  gridLeft: number;
  gridTop: number;
  cellW: number;
  cellH: number;
  lineHeight: number;
  bodyPx: number;
  symbolSize: number;
  symbolPad: number;
  labelGap: number;
  labelMaxWidth: number;
  includeShapes: boolean;
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  shape: string,
  color: string,
  cx: number,
  cy: number,
  size: number,
  includeShapes: boolean,
): void {
  if (includeShapes) {
    const shapeKey = (shape || 'circle').toLowerCase();
    const pathGenerator = SHAPE_PATH_GENERATORS[shapeKey] ?? SHAPE_PATH_GENERATORS.circle;
    const pathString = pathGenerator(size);
    renderPathOnCanvas(ctx, pathString, cx, cy, color || '#888', '#394150', 1);
    return;
  }
  ctx.save();
  ctx.fillStyle = color || '#888';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function pluralizeMore(omittedCount: number): string {
  const word = omittedCount === 1 ? 'category' : 'categories';
  return `+ ${omittedCount.toLocaleString()} more ${word}`;
}

async function paintCell(
  item: PublicationLegendRow,
  i: number,
  c: PaintCellContext,
): Promise<void> {
  const { ctx, cols, rows, gridLeft, gridTop, cellW, cellH } = c;
  const col = Math.floor(i / rows);
  if (col >= cols) return;
  const row = i % rows;
  const cellX = gridLeft + col * cellW;
  const cellY = gridTop + row * cellH;

  const cx = cellX + c.symbolPad + c.symbolSize / 2;
  const cy = cellY + cellH / 2;
  drawSymbol(ctx, item.shape, item.color, cx, cy, c.symbolSize, c.includeShapes);

  ctx.font = `500 ${c.bodyPx}px ${EXPORT_FONT_FAMILY}`;
  ctx.fillStyle = '#1f2937';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const labelX = cellX + c.symbolPad + c.symbolSize + c.labelGap;
  const wrapped = await wrapLabelToTwoLines(item.displayLabel, ctx.font, c.labelMaxWidth);

  ctx.save();
  const labelTopOffset =
    (cellH - (wrapped.lines.length === 1 ? c.lineHeight : c.lineHeight * 2)) / 2;
  ctx.translate(labelX, cellY + labelTopOffset);
  ctx.scale(0.9, 1);
  for (let li = 0; li < wrapped.lines.length; li += 1) {
    ctx.fillText(wrapped.lines[li], 0, li * c.lineHeight);
  }
  ctx.restore();

  ctx.fillStyle = '#4b5563';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(item.count), cellX + cellW - c.symbolPad, cy);
}

export async function drawPublicationLegend(
  ctx: CanvasRenderingContext2D,
  rect: PxRect,
  model: PublicationLegendModel,
  options: { dpi: number; layoutId: FigureLayoutId },
): Promise<void> {
  const { dpi, layoutId } = options;
  const layout = FIGURE_LAYOUTS[layoutId];
  const cols = layout.legend.columns;

  const { visible, omittedCount } = sliceLegendItemsForLayout(model.items, layoutId);
  const hasFooter = omittedCount > 0;

  const paddingPx = Math.max(4, Math.round(mmToPx(0.6, dpi)));
  const legendBoxMmH = (rect.height * 25.4) / dpi;
  const padMm = (paddingPx * 25.4) / dpi;
  const innerHmm = Math.max(4, legendBoxMmH - 2 * padMm - HEADER_BODY_MM);

  const displayedRows = visible.length + (hasFooter ? 1 : 0);
  const bodyPt = legendBodyPt(innerHmm, displayedRows, HEADER_BODY_MM);
  const headerPt = Math.min(10, bodyPt + 1);
  const bodyPx = ptToPx(bodyPt, dpi);
  const headerPx = ptToPx(headerPt, dpi);

  const titleY = rect.y + paddingPx + headerPx / 2;
  const gridTop = rect.y + paddingPx + headerPx + Math.max(2, bodyPx * 0.4);
  const footerH = hasFooter ? bodyPx * 1.4 : 0;
  const gridBottom = rect.y + rect.height - paddingPx - footerH;
  const gridLeft = rect.x + paddingPx;
  const gridRight = rect.x + rect.width - paddingPx;
  const gridW = Math.max(0, gridRight - gridLeft);
  const gridH = Math.max(0, gridBottom - gridTop);

  const rows = Math.max(1, Math.ceil(visible.length / cols));
  const cellW = cols > 0 ? gridW / cols : gridW;
  const cellH = rows > 0 ? gridH / rows : gridH;

  ctx.save();
  ctx.fillStyle = '#1f2937';
  ctx.font = `600 ${headerPx}px ${EXPORT_FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const wrappedTitle = await wrapLabelToTwoLines(model.annotationTitle, ctx.font, gridW);
  const titleText = wrappedTitle.lines[0] ?? '';
  ctx.fillText(titleText, gridLeft, titleY);

  const lineHeight = bodyPx * 1.15;
  const symbolSize = bodyPx * 1.15;
  const symbolPad = bodyPx * 0.35;
  const labelGap = bodyPx * 0.45;
  const countProbe = '0000000';
  ctx.font = `500 ${bodyPx}px ${EXPORT_FONT_FAMILY}`;
  const countColW = ctx.measureText(countProbe).width + bodyPx * 0.35;
  const labelMaxWidth = Math.max(
    1,
    cellW - symbolPad - symbolSize - labelGap - countColW - symbolPad,
  );

  const cellCtx: PaintCellContext = {
    ctx,
    cols,
    rows,
    gridLeft,
    gridTop,
    cellW,
    cellH,
    lineHeight,
    bodyPx,
    symbolSize,
    symbolPad,
    labelGap,
    labelMaxWidth,
    includeShapes: model.includeShapes,
  };
  for (let i = 0; i < visible.length; i += 1) {
    await paintCell(visible[i], i, cellCtx);
  }

  if (hasFooter) {
    ctx.fillStyle = '#374151';
    ctx.font = `500 ${bodyPx}px ${EXPORT_FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const footerY = gridBottom + footerH / 2;
    ctx.fillText(pluralizeMore(omittedCount), gridLeft, footerY);
  }

  ctx.restore();
}
