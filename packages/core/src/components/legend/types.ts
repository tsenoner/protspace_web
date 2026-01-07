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

export interface LegendDataInput {
  features?: Record<string, { values: (string | null)[]; colors?: string[]; shapes?: string[] }>;
}

export type LegendSortMode = 'size' | 'size-asc' | 'alpha' | 'alpha-desc';

export interface LegendPersistedSettings {
  maxVisibleValues: number;
  includeOthers: boolean;
  includeShapes: boolean;
  shapeSize: number;
  sortMode: LegendSortMode;
  hiddenValues: string[];
  manualOtherValues: string[];
  zOrderMapping: Record<string, number>;
}
