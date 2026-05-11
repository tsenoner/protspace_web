import type { VisualizationData, NumericAnnotationType } from '../types.js';
import { getProteinAnnotationIndices } from './annotation-data-access.js';
import { getNumericBinLabelMap } from './numeric-binning.js';
import { toInternalValue } from './missing-values.js';

/**
 * Hot path — used per-protein per render frame.
 * Returns the raw annotation value strings for a protein on a given key.
 * Empty array when the protein has no value for this key.
 */
export function getProteinAnnotationValues(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): string[] {
  const annotation = data.annotations[annotationKey];
  const annotationRows = data.annotation_data?.[annotationKey];
  if (!annotation || !annotationRows || !Array.isArray(annotation.values)) return [];
  const indices = getProteinAnnotationIndices(annotationRows, proteinIdx);
  if (indices.length === 0) return [];
  const out: string[] = new Array(indices.length);
  for (let k = 0; k < indices.length; k++) {
    out[k] = toInternalValue(annotation.values[indices[k]]);
  }
  return out;
}

/**
 * Tooltip — display values run through the numeric-bin label map.
 */
export function getProteinDisplayValues(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): string[] {
  const annotation = data.annotations[annotationKey];
  const values = getProteinAnnotationValues(data, proteinIdx, annotationKey);
  if (!annotation || values.length === 0) return values;
  const labelMap = getNumericBinLabelMap(annotation);
  if (labelMap.size === 0) return values;
  return values.map((v) => labelMap.get(v) ?? v);
}

export function getProteinNumericValue(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): number | null {
  return data.numeric_annotation_data?.[annotationKey]?.[proteinIdx] ?? null;
}

export function getProteinNumericType(
  data: VisualizationData,
  annotationKey: string,
): NumericAnnotationType {
  const annotation = data.annotations[annotationKey];
  return annotation?.numericType ?? annotation?.numericMetadata?.numericType ?? 'float';
}

export function getProteinScores(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): (number[] | null)[] {
  const scores = data.annotation_scores?.[annotationKey]?.[proteinIdx];
  return Array.isArray(scores) ? scores : [];
}

export function getProteinEvidence(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): (string | null)[] {
  const evidence = data.annotation_evidence?.[annotationKey]?.[proteinIdx];
  return Array.isArray(evidence) ? evidence : [];
}

/**
 * Tooltip view — assembled once per hover, never per-protein.
 */
export interface TooltipView {
  proteinId: string;
  geneName: string[];
  proteinName: string[];
  uniprotKbId: string[];
  displayValues: string[];
  numericValue: number | null;
  numericType: NumericAnnotationType;
  scores: (number[] | null)[];
  evidence: (string | null)[];
}

function getHeaderValues(
  data: VisualizationData,
  proteinIdx: number,
  primaryKey: string,
  fallbackKey: string,
): string[] {
  if (data.annotations[primaryKey]) {
    return getProteinAnnotationValues(data, proteinIdx, primaryKey);
  }
  if (data.annotations[fallbackKey]) {
    return getProteinAnnotationValues(data, proteinIdx, fallbackKey);
  }
  return [];
}

export function buildTooltipView(
  data: VisualizationData,
  proteinIdx: number,
  selectedAnnotation: string | null,
): TooltipView {
  const proteinId = data.protein_ids[proteinIdx] ?? '';
  const geneName = getHeaderValues(data, proteinIdx, 'gene_name', 'Gene name');
  const proteinName = getHeaderValues(data, proteinIdx, 'protein_name', 'Protein name');
  const uniprotKbId = data.annotations.uniprot_kb_id
    ? getProteinAnnotationValues(data, proteinIdx, 'uniprot_kb_id')
    : [];

  if (!selectedAnnotation) {
    return {
      proteinId,
      geneName,
      proteinName,
      uniprotKbId,
      displayValues: [],
      numericValue: null,
      numericType: 'float',
      scores: [],
      evidence: [],
    };
  }

  return {
    proteinId,
    geneName,
    proteinName,
    uniprotKbId,
    displayValues: getProteinDisplayValues(data, proteinIdx, selectedAnnotation),
    numericValue: getProteinNumericValue(data, proteinIdx, selectedAnnotation),
    numericType: getProteinNumericType(data, selectedAnnotation),
    scores: getProteinScores(data, proteinIdx, selectedAnnotation),
    evidence: getProteinEvidence(data, proteinIdx, selectedAnnotation),
  };
}
