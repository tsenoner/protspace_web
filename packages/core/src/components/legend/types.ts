/**
 * Legend-related type definitions
 */

export interface LegendItem {
  value: string | null;
  color: string;
  shape: string;
  count: number;
  isVisible: boolean;
  // Add z-order for controlling the layering of items
  zOrder: number;
  // Flag for items that were extracted from "Other"
  extractedFromOther?: boolean;
}

export interface OtherItem {
  value: string | null;
  count: number;
}

// Define proper interfaces for scatterplot data
export interface ScatterplotData {
  protein_ids: string[];
  features: Record<
    string,
    {
      values: (string | null)[];
      colors: string[];
      shapes: string[];
    }
  >;
  feature_data: Record<string, number[]>;
  projections?: Array<{ name: string }>;
}

export interface ScatterplotElement extends Element {
  getCurrentData(): ScatterplotData | null;
  selectedFeature: string;
  hiddenFeatureValues: string[];
  otherFeatureValues?: string[];
  useShapes?: boolean;
}

/**
 * Legend component events
 */
export interface LegendItemClickEvent extends CustomEvent {
  detail: {
    value: string | null;
    action: 'toggle' | 'isolate' | 'extract' | 'merge-into-other';
  };
}

export interface LegendZOrderChangeEvent extends CustomEvent {
  detail: {
    zOrderMapping: Record<string, number>;
  };
}

export interface LegendCustomizeEvent extends CustomEvent {
  detail: {};
}

export interface LegendDownloadEvent extends CustomEvent {
  detail: {};
}

/**
 * Legend configuration types
 */
export interface LegendFeatureData {
  name: string;
  values: (string | null)[];
  colors: string[];
  shapes: string[];
}

export interface LegendDataInput {
  features?: Record<
    string,
    {
      values: (string | null)[];
      colors: string[];
      shapes: string[];
    }
  >;
}

export interface LegendSettings {
  includeOthers: boolean;
  includeShapes: boolean;
}

/**
 * Sort mode for legend items
 * - 'size': Sort by feature size (number of proteins) descending
 * - 'size-asc': Sort by feature size ascending
 * - 'alpha': Sort alphabetically/numerically ascending
 * - 'alpha-desc': Sort alphabetically/numerically descending
 */
export type LegendSortMode = 'size' | 'size-asc' | 'alpha' | 'alpha-desc';
