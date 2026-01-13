import type { Annotation, VisualizationData } from '@protspace/utils';

// GenericRow represents dynamic Parquet data with arbitrary columns
export type GenericRow = Record<string, unknown>;

export type Rows = GenericRow[];

export interface ExtractedBundleParts {
  selectedAnnotationsBuffer: ArrayBuffer;
  projectionsMetadataBuffer: ArrayBuffer;
  projectionsDataBuffer: ArrayBuffer;
}

export interface ExtractedBundleData {
  rows: Rows;
  projectionsMetadata?: Rows;
}

export type AnnotationsMap = Record<string, Annotation>;

export type AnnotationDataMap = Record<string, number[]>;

export type VisualizationDataResult = VisualizationData;
