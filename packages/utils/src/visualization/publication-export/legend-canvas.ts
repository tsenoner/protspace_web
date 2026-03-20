import { SHAPE_PATH_GENERATORS, renderPathOnCanvas } from '../shapes';
import type { FigurePresetId, LegendPlacement } from './presets';
import { sliceLegendItemsForLayout } from './legend-slice';
import type { PublicationLegendModel } from './legend-model';
import { wrapLabelToTwoLines } from './legend-text-layout';
import { legendBodyPt, mmToPx, ptToPx } from './typography';
import type { PxRect } from './pixel-rect';

export const EXPORT_FONT_FAMILY =
  '"Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';

const HEADER_BODY_MM = 5;

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

export function drawPublicationLegend(
  ctx: CanvasRenderingContext2D,
  rect: PxRect,
  model: PublicationLegendModel,
  options: {
    dpi: number;
    presetId: FigurePresetId;
    legendPlacement: LegendPlacement;
  },
): void {
  const { dpi, presetId, legendPlacement } = options;
  const paddingPx = Math.max(4, Math.round(mmToPx(0.6, dpi)));
  const legendBoxMmH = (rect.height * 25.4) / dpi;
  const padMm = (paddingPx * 25.4) / dpi;
  const innerHmm = Math.max(4, legendBoxMmH - 2 * padMm - HEADER_BODY_MM);

  const { visible, omittedCount } = sliceLegendItemsForLayout(
    model.items,
    presetId,
    legendPlacement,
  );
  const displayedRows = visible.length + (omittedCount > 0 ? 1 : 0);
  const bodyPt = legendBodyPt(innerHmm, displayedRows, HEADER_BODY_MM);
  const headerPt = Math.min(10, bodyPt + 1);

  const bodyPx = ptToPx(bodyPt, dpi);
  const headerPx = ptToPx(headerPt, dpi);
  const lineHeight = bodyPx * 1.15;
  const symbolSize = bodyPx * 1.15;
  const rowGap = Math.max(2, bodyPx * 0.2);
  const labelColumnGap = bodyPx * 0.45;

  ctx.save();
  ctx.fillStyle = '#1f2937';
  ctx.font = `600 ${headerPx}px ${EXPORT_FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const titleY = rect.y + paddingPx + headerPx / 2;
  ctx.fillText(model.annotationTitle, rect.x + paddingPx, titleY);

  const countProbe = '0000000';
  ctx.font = `500 ${bodyPx}px ${EXPORT_FONT_FAMILY}`;
  const countColW = ctx.measureText(countProbe).width + bodyPx * 0.35;
  const labelMaxWidth = rect.width - paddingPx * 2 - symbolSize - labelColumnGap - countColW;

  let y = rect.y + paddingPx + headerPx + rowGap;

  for (const item of visible) {
    const rowHeight = lineHeight * 2 + rowGap;

    const cx = rect.x + paddingPx + symbolSize / 2;
    const cy = y + rowHeight / 2;
    drawSymbol(ctx, item.shape, item.color, cx, cy, symbolSize, model.includeShapes);

    ctx.font = `500 ${bodyPx}px ${EXPORT_FONT_FAMILY}`;
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const labelX = rect.x + paddingPx + symbolSize + labelColumnGap;
    const wrapped = wrapLabelToTwoLines(ctx, item.displayLabel, labelMaxWidth);

    ctx.save();
    ctx.translate(
      labelX,
      y + (rowHeight - (wrapped.lines.length === 1 ? lineHeight : lineHeight * 2)) / 2,
    );
    ctx.scale(0.9, 1);
    for (let li = 0; li < wrapped.lines.length; li += 1) {
      ctx.fillText(wrapped.lines[li], 0, li * lineHeight);
    }
    ctx.restore();

    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(item.count), rect.x + rect.width - paddingPx, cy);

    y += rowHeight;
  }

  if (omittedCount > 0) {
    const summary = `+ ${omittedCount.toLocaleString()} more categories`;
    ctx.font = `500 ${bodyPx}px ${EXPORT_FONT_FAMILY}`;
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const wrappedSum = wrapLabelToTwoLines(ctx, summary, rect.width - paddingPx * 2);
    ctx.fillText(wrappedSum.lines[0], rect.x + paddingPx, y);
  }

  ctx.restore();
}
