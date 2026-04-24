// Publish modal — lazy-loadable sub-entry point
export { ProtspacePublishModal } from './publish-modal';
export type {
  PublishState,
  Overlay,
  Inset,
  LegendPosition,
  LegendOverflow,
  LegendFreePosition,
} from './publish-state';
export type { PresetId, JournalPreset } from './journal-presets';
export {
  JOURNAL_PRESETS,
  mmToPx,
  pxToMm,
  getPreset,
  resolvePresetDimensions,
} from './journal-presets';
export { createDefaultPublishState } from './publish-state';
export {
  adjustDpiForWidthMm,
  adjustWidthPxForDpi,
  clampHeight,
  SIZE_MODE_WIDTH_MM,
  MAX_HEIGHT_MM,
} from './dimension-utils';
export type { SizeMode } from './dimension-utils';
