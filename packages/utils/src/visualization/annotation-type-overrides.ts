import type {
  Annotation,
  AnnotationTypeOverride,
  NumericAnnotationType,
  VisualizationData,
} from '../types';
import { COLOR_SCHEMES } from './color-scheme';

export interface AnnotationTypeOverrideError {
  annotation: string;
  message: string;
}

export interface AnnotationTypeOverrideResult {
  data: VisualizationData;
  errors: AnnotationTypeOverrideError[];
}

function parseOverrideNumericValue(rawValue: unknown): number | null {
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null;
  if (typeof rawValue !== 'string') return null;

  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.includes(';') || trimmed.includes('|')) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function generateColors(count: number): string[] {
  const palette = COLOR_SCHEMES.kellys as readonly string[];
  return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
}

function generateShapes(count: number): string[] {
  return Array.from({ length: count }, () => 'circle');
}

function createNumericAnnotation(numericType: NumericAnnotationType): Annotation {
  return { kind: 'numeric', numericType, values: [], colors: [], shapes: [] };
}

function createCategoricalFromRawValues(rawValues: Array<string | null>): {
  annotation: Annotation;
  annotationData: number[][];
} {
  const valueToIndex = new Map<string, number>();
  const values: string[] = [];
  const annotationData = rawValues.map((rawValue) => {
    if (rawValue == null || rawValue.trim() === '') return [];

    const value = rawValue.trim();
    let index = valueToIndex.get(value);
    if (index === undefined) {
      index = values.length;
      valueToIndex.set(value, index);
      values.push(value);
    }
    return [index];
  });

  return {
    annotation: {
      kind: 'categorical',
      values,
      colors: generateColors(values.length),
      shapes: generateShapes(values.length),
    },
    annotationData,
  };
}

function inferNumericValues(rawValues: Array<string | null>): {
  numericType: NumericAnnotationType;
  values: Array<number | null>;
} | null {
  const values: Array<number | null> = [];
  let sawNonEmpty = false;
  let sawFloat = false;

  for (const rawValue of rawValues) {
    if (rawValue == null || rawValue.trim() === '') {
      values.push(null);
      continue;
    }

    sawNonEmpty = true;
    const parsed = parseOverrideNumericValue(rawValue);
    if (parsed == null) return null;
    if (!Number.isInteger(parsed)) sawFloat = true;
    values.push(parsed);
  }

  if (!sawNonEmpty) return null;
  return { numericType: sawFloat ? 'float' : 'int', values };
}

function categoricalRowsToRawValues(
  data: VisualizationData,
  annotationName: string,
): string[] | null {
  const annotation = data.annotations[annotationName];
  const rows = data.annotation_data[annotationName];
  if (!annotation || !rows) return null;

  const rawValues: string[] = [];
  for (const row of rows) {
    if (row.length === 0) {
      rawValues.push('');
      continue;
    }
    if (row.length !== 1) return null;

    const valueIndex = row[0];
    rawValues.push(annotation.values[valueIndex] ?? '');
  }
  return rawValues;
}

function hasMeaningfulScores(scores: (number[] | null)[][] | undefined): boolean {
  return (
    scores?.some((row) => row.some((score) => Array.isArray(score) && score.length > 0)) ?? false
  );
}

function hasMeaningfulEvidence(evidence: (string | null)[][] | undefined): boolean {
  return (
    evidence?.some((row) =>
      row.some((value) => typeof value === 'string' && value.trim().length > 0),
    ) ?? false
  );
}

function hasMeaningfulScoreOrEvidenceMetadata(
  data: VisualizationData,
  annotationName: string,
): boolean {
  return (
    hasMeaningfulScores(data.annotation_scores?.[annotationName]) ||
    hasMeaningfulEvidence(data.annotation_evidence?.[annotationName])
  );
}

export function applyAnnotationTypeOverrides(
  data: VisualizationData,
  overrides: Record<string, AnnotationTypeOverride | undefined>,
): AnnotationTypeOverrideResult {
  const next: VisualizationData = {
    ...data,
    annotations: { ...data.annotations },
    annotation_data: { ...data.annotation_data },
    numeric_annotation_data: data.numeric_annotation_data
      ? { ...data.numeric_annotation_data }
      : {},
    annotation_scores: data.annotation_scores ? { ...data.annotation_scores } : undefined,
    annotation_evidence: data.annotation_evidence ? { ...data.annotation_evidence } : undefined,
  };
  const errors: AnnotationTypeOverrideError[] = [];

  for (const [annotationName, override] of Object.entries(overrides)) {
    if (!override || override === 'auto') continue;

    const annotation = data.annotations[annotationName];
    if (!annotation) continue;

    if (override === 'string' && annotation.kind === 'numeric') {
      const numericValues = data.numeric_annotation_data?.[annotationName] ?? [];
      const rawValues = numericValues.map((value) => (value == null ? null : String(value)));
      const categorical = createCategoricalFromRawValues(rawValues);
      next.annotations[annotationName] = categorical.annotation;
      next.annotation_data[annotationName] = categorical.annotationData;
      delete next.numeric_annotation_data?.[annotationName];
      continue;
    }

    if (override === 'numeric' && annotation.kind !== 'numeric') {
      if (hasMeaningfulScoreOrEvidenceMetadata(data, annotationName)) {
        errors.push({
          annotation: annotationName,
          message: `Cannot treat ${annotationName} as numeric because it has score or evidence metadata.`,
        });
        continue;
      }

      const rawValues = categoricalRowsToRawValues(data, annotationName);
      const inferred = rawValues ? inferNumericValues(rawValues) : null;
      if (!inferred) {
        errors.push({
          annotation: annotationName,
          message: `Cannot treat ${annotationName} as numeric because at least one non-empty value is nonnumeric.`,
        });
        continue;
      }

      next.annotations[annotationName] = createNumericAnnotation(inferred.numericType);
      next.numeric_annotation_data![annotationName] = inferred.values;
      delete next.annotation_data[annotationName];
      delete next.annotation_scores?.[annotationName];
      delete next.annotation_evidence?.[annotationName];
    }
  }

  if (next.numeric_annotation_data && Object.keys(next.numeric_annotation_data).length === 0) {
    delete next.numeric_annotation_data;
  }
  if (next.annotation_scores && Object.keys(next.annotation_scores).length === 0) {
    delete next.annotation_scores;
  }
  if (next.annotation_evidence && Object.keys(next.annotation_evidence).length === 0) {
    delete next.annotation_evidence;
  }

  return { data: next, errors };
}
