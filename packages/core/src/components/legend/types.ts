/**
 * A legend item representing a category.
 * N/A items use LEGEND_VALUES.NA_VALUE ('__NA__') as their value.
 */
export interface LegendItem {
  /** Category value. N/A items use '__NA__', "Other" uses 'Other' */
  value: string;
  color: string;
  shape: string;
  count: number;
  isVisible: boolean;
  zOrder: number;
}

/**
 * An item in the "Other" category bucket.
 * These are items that didn't make the top maxVisibleValues.
 */
export interface OtherItem {
  /** Category value. N/A items use '__NA__' */
  value: string;
  count: number;
}

export interface ScatterplotData {
  protein_ids: string[];
  annotations: Record<string, { values: (string | null)[] }>;
  annotation_data: Record<string, (number | number[])[]>;
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

/** Detail for legend-error event */
export interface LegendErrorEventDetail {
  message: string;
  source: 'data-processing' | 'persistence' | 'scatterplot-sync' | 'rendering';
  originalError?: Error;
}

export interface LegendDataInput {
  annotations?: Record<string, { values: (string | null)[]; colors?: string[]; shapes?: string[] }>;
}

// Internal re-exports from @protspace/utils for legend component implementation
// External consumers should import directly from @protspace/utils
export type {
  LegendSortMode,
  PersistedCategoryData,
  LegendPersistedSettings,
} from '@protspace/utils';
