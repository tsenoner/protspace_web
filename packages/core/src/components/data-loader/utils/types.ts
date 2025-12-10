import type { Feature, VisualizationData } from '@protspace/utils';

export type GenericRow = Record<string, any>;

export type Rows = GenericRow[];

export interface ExtractedBundleParts {
  selectedFeaturesBuffer: ArrayBuffer;
  projectionsMetadataBuffer: ArrayBuffer;
  projectionsDataBuffer: ArrayBuffer;
}

export interface ExtractedBundleData {
  rows: Rows;
  projectionsMetadata?: Rows;
}

export type FeaturesMap = Record<string, Feature>;

export type FeatureDataMap = Record<string, number[]>;

export type VisualizationDataResult = VisualizationData;
