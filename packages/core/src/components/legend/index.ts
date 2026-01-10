// Main component
export { ProtspaceLegend } from './legend';

// Types
export * from './types';

// Configuration
export * from './config';

// Processing and rendering utilities
export { LegendDataProcessor, createProcessorContext } from './legend-data-processor';
export type { LegendProcessorContext } from './legend-data-processor';
export { LegendRenderer } from './legend-renderer';

// Helper functions
export * from './legend-helpers';

// Visual encoding
export { getVisualEncoding, SlotTracker, SPECIAL_SLOTS } from './visual-encoding';
export type { VisualEncoding } from './visual-encoding';

// Focus trap utility
export { createFocusTrap, getFocusableElements } from './focus-trap';
