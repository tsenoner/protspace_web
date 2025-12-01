import type { Feature, VisualizationData } from '@protspace/utils';

// GenericRow represents dynamic Parquet data with arbitrary columns
export type GenericRow = Record<string, unknown>;

export type Rows = GenericRow[];

export interface ExtractedBundleParts {
  selectedFeaturesBuffer: ArrayBuffer;
  projectionsMetadataBuffer: ArrayBuffer;
  projectionsDataBuffer: ArrayBuffer;
}

export interface ExtractedBundleData {
  rows: Rows;
}

export type FeaturesMap = Record<string, Feature>;

export type FeatureDataMap = Record<string, number[]>;

export type VisualizationDataResult = VisualizationData;
