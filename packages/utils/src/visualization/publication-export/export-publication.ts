import { validateCanvasDimensions } from '../canvas-limits';
import { FIGURE_LAYOUTS, type FigureLayoutId } from './presets';
import { computePublicationLayout } from './layout';
import { PRINT_DPI_DEFAULT, mmToPx } from './typography';
import { captureScatterForLayout, type ScatterplotCaptureFn } from './scatter-capture';
import { composePublicationFigureRaster } from './figure-composer';
import { drawPublicationLegend } from './legend-canvas';
import type { PublicationLegendModel } from './legend-model';
import { downloadPng } from './png-output';
import { downloadPublicationPdf } from './pdf-output';

export interface PublicationExportRequest {
  layoutId: FigureLayoutId;
  format: 'png' | 'pdf';
  dpi?: number;
  backgroundColor?: string;
  viewportAspect?: number;
  scatterCapture: ScatterplotCaptureFn;
  legendModel: PublicationLegendModel;
  fileNameBase?: string;
}

export async function exportPublicationFigure(req: PublicationExportRequest): Promise<void> {
  const layoutDef = FIGURE_LAYOUTS[req.layoutId];
  const dpi = req.dpi ?? PRINT_DPI_DEFAULT;
  const layout = computePublicationLayout(layoutDef, req.viewportAspect);
  const bg = req.backgroundColor ?? '#ffffff';

  const figW = Math.round(mmToPx(layout.figureMm.width, dpi));
  const figH = Math.round(mmToPx(layout.figureMm.height, dpi));
  const figVal = validateCanvasDimensions(figW, figH);
  if (!figVal.isValid) {
    throw new Error(figVal.reason ?? 'Figure dimensions exceed browser limits');
  }

  const scatterCanvas = captureScatterForLayout(layout.scatterMm, dpi, req.scatterCapture, bg);

  const finalCanvas = await composePublicationFigureRaster({
    layout,
    scatterCanvas,
    legendDrawer: (ctx, rect) =>
      drawPublicationLegend(ctx, rect, req.legendModel, {
        dpi,
        layoutId: req.layoutId,
      }),
    dpi,
    backgroundColor: bg,
  });

  const name = req.fileNameBase ?? `protspace_${req.layoutId}`;
  const fileNameWithLayout = req.fileNameBase ? `${req.fileNameBase}_${req.layoutId}` : name;

  if (req.format === 'png') {
    downloadPng(finalCanvas, `${fileNameWithLayout}.png`);
  } else {
    await downloadPublicationPdf(finalCanvas, layout, `${fileNameWithLayout}.pdf`);
  }
}
