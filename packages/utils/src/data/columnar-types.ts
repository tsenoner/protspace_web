import type { Annotation } from '../types.js';

/**
 * Columnar (struct-of-arrays) storage for visualization data.
 * Coordinates are stored as Float32Arrays for efficient GPU upload.
 * Annotations are stored once and accessed by index — never duplicated.
 */
export interface ColumnarData {
  /** Protein identifiers (length N) */
  ids: string[];
  /** X coordinates for current projection (length N) */
  x: Float32Array;
  /** Y coordinates for current projection (length N) */
  y: Float32Array;
  /** Z coordinates for 3D projections (length N), or null for 2D */
  z: Float32Array | null;
  /** Number of data points */
  length: number;
  /** Shared annotation data — never duplicated on projection switch */
  annotationStore: AnnotationStore;
  /** Mapping back to original VisualizationData index (length N) */
  originalIndices: Uint32Array;
}

/**
 * Stores annotation data in a format that avoids per-point object allocation.
 * Values are stored once; points reference them by index.
 */
export interface AnnotationStore {
  /** Annotation metadata (values, colors, shapes) keyed by annotation name */
  annotations: Record<string, Annotation>;
  /** Per-point annotation value indices. indices[annotationKey][pointIndex] = Uint16Array of value indices */
  indices: Record<string, Uint16Array[]>;
  /** Per-point annotation scores. scores[annotationKey][pointIndex] = (number[] | null)[] */
  scores: Record<string, (number[] | null)[][]>;
  /** Per-point annotation evidence. evidence[annotationKey][pointIndex] = (string | null)[] */
  evidence: Record<string, (string | null)[][]>;
}

/**
 * Look up annotation values for a specific point and annotation.
 * This replaces the old point.annotationValues[annotationKey] pattern.
 */
export function getAnnotationValues(
  store: AnnotationStore,
  annotationKey: string,
  pointIndex: number,
): string[] {
  const indexArray = store.indices[annotationKey]?.[pointIndex];
  if (!indexArray || indexArray.length === 0) return ['__NA__'];
  const annotation = store.annotations[annotationKey];
  if (!annotation) return ['__NA__'];
  return Array.from(indexArray).map((i) => annotation.values[i] ?? '__NA__');
}

/**
 * Look up annotation scores for a specific point and annotation.
 */
export function getAnnotationScores(
  store: AnnotationStore,
  annotationKey: string,
  pointIndex: number,
): (number[] | null)[] {
  return store.scores[annotationKey]?.[pointIndex] ?? [];
}

/**
 * Look up annotation evidence for a specific point and annotation.
 */
export function getAnnotationEvidence(
  store: AnnotationStore,
  annotationKey: string,
  pointIndex: number,
): (string | null)[] {
  return store.evidence[annotationKey]?.[pointIndex] ?? [];
}
