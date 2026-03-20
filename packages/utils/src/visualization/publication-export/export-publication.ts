import { validateCanvasDimensions } from '../canvas-limits';
import { FIGURE_PRESETS, type FigurePresetId, type LegendPlacement } from './presets';
import { computePublicationLayout } from './layout';
import { PRINT_DPI_DEFAULT, mmToPx } from './typography';
import { captureScatterForLayout, type ScatterplotCaptureFn } from './scatter-capture';
import { composePublicationFigureRaster } from './figure-composer';
import { drawPublicationLegend } from './legend-canvas';
import type { PublicationLegendModel } from './legend-model';
import { downloadPng } from './png-output';
import { downloadPublicationPdf } from './pdf-output';

export interface PublicationExportRequest {
  presetId: FigurePresetId;
  legendPlacement: LegendPlacement;
  format: 'png' | 'pdf';
  dpi?: number;
  backgroundColor?: string;
  scatterCapture: ScatterplotCaptureFn;
  legendModel: PublicationLegendModel;
  fileNameBase?: string;
}

export async function exportPublicationFigure(req: PublicationExportRequest): Promise<void> {
  const preset = FIGURE_PRESETS[req.presetId];
  const dpi = req.dpi ?? PRINT_DPI_DEFAULT;
  const layout = computePublicationLayout(preset, req.legendPlacement);
  const bg = req.backgroundColor ?? '#ffffff';

  const figW = Math.round(mmToPx(layout.figureMm.width, dpi));
  const figH = Math.round(mmToPx(layout.figureMm.height, dpi));
  const figVal = validateCanvasDimensions(figW, figH);
  if (!figVal.isValid) {
    throw new Error(figVal.reason ?? 'Figure dimensions exceed browser limits');
  }

  const scatterCanvas = captureScatterForLayout(layout.scatterMm, dpi, req.scatterCapture, bg);

  const finalCanvas = composePublicationFigureRaster({
    layout,
    scatterCanvas,
    legendDrawer: (ctx, rect) =>
      drawPublicationLegend(ctx, rect, req.legendModel, {
        dpi,
        presetId: req.presetId,
        legendPlacement: req.legendPlacement,
      }),
    dpi,
    backgroundColor: bg,
  });

  const name = req.fileNameBase ?? `protspace_${req.presetId}_${req.legendPlacement}`;
  if (req.format === 'png') {
    downloadPng(finalCanvas, `${name}.png`);
  } else {
    await downloadPublicationPdf(finalCanvas, layout, `${name}.pdf`);
  }
}
