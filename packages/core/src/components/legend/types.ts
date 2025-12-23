/**
 * Legend-related type definitions
 */

export interface LegendItem {
  value: string | null;
  color: string;
  shape: string;
  count: number;
  isVisible: boolean;
  zOrder: number;
  extractedFromOther?: boolean;
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

export interface LegendFeatureData {
  name: string;
  values: (string | null)[];
}

export interface ScatterplotElement extends Element {
  getCurrentData(): ScatterplotData | null;
  selectedFeature: string;
  hiddenFeatureValues: string[];
  otherFeatureValues?: string[];
  useShapes?: boolean;
}

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

export interface LegendSettings {
  includeOthers: boolean;
  includeShapes: boolean;
}

export interface LegendDataInput {
  features?: Record<string, { values: (string | null)[]; colors?: string[]; shapes?: string[] }>;
}

export type LegendSortMode = 'size' | 'size-asc' | 'alpha' | 'alpha-desc';
