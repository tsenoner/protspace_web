export type { FigurePresetId, LegendPlacement, FigurePreset } from './presets';
export { FIGURE_PRESETS } from './presets';
export { MAX_LEGEND_ITEMS, maxLegendItemsForLayout } from './legend-caps';
export { sliceLegendItemsForLayout, type SlicedLegend } from './legend-slice';
export type { MmRect, PublicationLayout } from './layout';
export { computePublicationLayout } from './layout';
export { PRINT_DPI_DEFAULT, ptToPx, mmToPx, legendBodyPt } from './typography';
export { wrapLabelToTwoLines, type WrappedLabel } from './legend-text-layout';
export type {
  PublicationLegendModel,
  PublicationLegendRow,
  LegendExportSnapshot,
} from './legend-model';
export { buildPublicationLegendModel } from './build-legend-model';
export {
  scatterTargetPixels,
  captureScatterForLayout,
  createScatterCaptureFromElement,
  type ScatterplotCaptureFn,
  type ScatterplotCaptureElement,
  type ScatterCaptureOptions,
} from './scatter-capture';
export type { PxRect } from './pixel-rect';
export { mmRectToPx, rectToDrawImageArgs } from './pixel-rect';
export { composePublicationFigureRaster } from './figure-composer';
export { drawPublicationLegend, EXPORT_FONT_FAMILY } from './legend-canvas';
export { downloadPng } from './png-output';
export { downloadPublicationPdf } from './pdf-output';
export { exportPublicationFigure, type PublicationExportRequest } from './export-publication';
