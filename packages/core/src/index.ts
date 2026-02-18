// Export web components - these will auto-register when imported
export * from './components/scatter-plot/scatter-plot';
export * from './components/legend/legend';
export * from './components/structure-viewer/structure-viewer';
export { ProtspaceControlBar } from './components/control-bar/control-bar'; // Explicit export for value access
export { EXPORT_DEFAULTS } from './components/control-bar/control-bar-helpers';
export * from './components/data-loader/data-loader';
export type { DataLoadedEventDetail } from './components/data-loader/data-loader';

// Export types for TypeScript support (for components that don't need value access)
export type { ProtspaceScatterplot } from './components/scatter-plot/scatter-plot';
export type { ProtspaceLegend } from './components/legend/legend';
export type { ProtspaceStructureViewer } from './components/structure-viewer/structure-viewer';

// Utilities for data loading
export { readFileOptimized } from './components/data-loader/utils/file-io';
export { extractRowsFromParquetBundle } from './components/data-loader/utils/bundle';
export type { BundleExtractionResult } from './components/data-loader/utils/bundle';
export { convertParquetToVisualizationDataOptimized } from './components/data-loader/utils/conversion';
