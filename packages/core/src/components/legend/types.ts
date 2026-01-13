export interface LegendItem {
  value: string | null;
  color: string;
  shape: string;
  count: number;
  isVisible: boolean;
  zOrder: number;
}

export interface OtherItem {
  value: string | null;
  count: number;
}

export interface ScatterplotData {
  protein_ids: string[];
  features: Record<string, { values: (string | null)[] }>;
  feature_data: Record<string, number[]>;
  projections?: Array<{ name: string }>;
}

export interface LegendAnnotationData {
  name: string;
  values: (string | null)[];
}

// Note: IScatterplotElement in scatterplot-interface.ts is the canonical interface
// for scatterplot element interactions with type guards.

// ─────────────────────────────────────────────────────────────────
// Custom Event Detail Types
// ─────────────────────────────────────────────────────────────────

/** Item action types for legend events */
export type ItemAction = 'toggle' | 'isolate' | 'extract';

/** Detail for legend-item-click event */
export interface LegendItemClickEventDetail {
  value: string | null;
  action: ItemAction;
}

/** Detail for legend-zorder-change event */
export interface LegendZOrderChangeEventDetail {
  zOrderMapping: Record<string, number>;
}

/** Detail for legend-colormapping-change event */
export interface LegendColorMappingChangeEventDetail {
  colorMapping: Record<string, string>;
  shapeMapping: Record<string, string>;
}

/** Detail for legend-error event */
export interface LegendErrorEventDetail {
  message: string;
  source: 'data-processing' | 'persistence' | 'scatterplot-sync' | 'rendering';
  originalError?: Error;
}

/** Typed custom events for the legend component */
export interface LegendEventMap {
  'legend-item-click': CustomEvent<LegendItemClickEventDetail>;
  'legend-zorder-change': CustomEvent<LegendZOrderChangeEventDetail>;
  'legend-colormapping-change': CustomEvent<LegendColorMappingChangeEventDetail>;
  'legend-customize': CustomEvent<void>;
  'legend-download': CustomEvent<void>;
  'legend-error': CustomEvent<LegendErrorEventDetail>;
}

export interface LegendDataInput {
  features?: Record<string, { values: (string | null)[]; colors?: string[]; shapes?: string[] }>;
}

export type LegendSortMode =
  | 'size-asc'
  | 'size-desc'
  | 'alpha-asc'
  | 'alpha-desc'
  | 'manual'
  | 'manual-reverse';

export interface PersistedCategoryData {
  zOrder: number;
  color: string;
  shape: string;
}

export interface LegendPersistedSettings {
  maxVisibleValues: number;
  includeShapes: boolean;
  shapeSize: number;
  sortMode: LegendSortMode;
  hiddenValues: string[];
  categories: Record<string, PersistedCategoryData>;
  enableDuplicateStackUI: boolean;
}
