import type { Annotation, VisualizationData } from '@protspace/utils';
import { COLOR_SCHEMES, sanitizeValue } from '@protspace/utils';
import { validateRowsBasic } from './validation';
import { findColumn } from './bundle';
import type { Rows } from './types';

/**
 * Fast yield using MessageChannel instead of setTimeout(0).
 * setTimeout(0) has a ~4ms minimum delay in browsers;
 * MessageChannel.postMessage fires in ~0.1ms.
 */
function fastYield(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });
}

/** Column names that should be excluded when identifying annotation columns */
const ID_COLUMNS = [
  'projection_name',
  'x',
  'y',
  'z',
  'identifier',
  'protein_id',
  'id',
  'uniprot',
  'entry',
] as const;

/** Creates a set of ID columns including the detected protein ID column */
function getIdColumnsSet(proteinIdCol: string): Set<string> {
  return new Set([...ID_COLUMNS, proteinIdCol]);
}

/** Keys to exclude when building metadata */
const METADATA_EXCLUDED_KEYS = new Set(['projection_name', 'name', 'info_json']);

/** Match GO/ECO evidence codes: 2–5 uppercase letters OR ECO:NNNNNNN */
const EVIDENCE_CODE_RE = /^(?:[A-Z]{2,5}|ECO:\d+)$/;
const STRING_NUMERIC_DENSITY_THRESHOLD = 0.1;
const STRING_NUMERIC_MIN_DISTINCT_VALUES = 8;
const MAX_STRING_NUMERIC_DENSITY_DECIMALS = 6;

function parseNumericAnnotationValue(rawValue: unknown): number | null {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null;
  }

  if (typeof rawValue === 'bigint') {
    const parsed = Number(rawValue);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed.includes(';') || trimmed.includes('|')) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function countNumericStringDecimalPlaces(rawValue: string): number {
  const trimmed = rawValue.trim().toLowerCase();
  if (!trimmed) {
    return 0;
  }

  const scientificMatch = trimmed.match(/^[-+]?\d+(?:\.(\d+))?[e]([-+]?\d+)$/);
  if (scientificMatch) {
    const fractionalDigits = scientificMatch[1]?.length ?? 0;
    const exponent = Number(scientificMatch[2]);
    return Number.isFinite(exponent) ? Math.max(0, fractionalDigits - exponent) : 0;
  }

  const decimalIndex = trimmed.indexOf('.');
  return decimalIndex === -1 ? 0 : trimmed.length - decimalIndex - 1;
}

function isScalarNumericAnnotationColumn(values: unknown[]): boolean {
  let sawNumericValue = false;
  let sawTypedNumericValue = false;
  let sawStringValue = false;
  const distinctNumericStringValues = new Set<number>();
  let maxStringDecimalPlaces = 0;

  for (const rawValue of values) {
    if (rawValue == null) {
      continue;
    }

    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed === '') {
        continue;
      }
      sawStringValue = true;
    }

    const parsed = parseNumericAnnotationValue(rawValue);
    if (parsed == null) {
      return false;
    }

    if (typeof rawValue === 'string') {
      distinctNumericStringValues.add(parsed);
      maxStringDecimalPlaces = Math.max(
        maxStringDecimalPlaces,
        countNumericStringDecimalPlaces(rawValue),
      );
    } else {
      sawTypedNumericValue = true;
    }

    sawNumericValue = true;
  }

  if (!sawNumericValue) {
    return false;
  }

  if (!sawStringValue) {
    return true;
  }

  if (sawTypedNumericValue) {
    return true;
  }

  if (distinctNumericStringValues.size < STRING_NUMERIC_MIN_DISTINCT_VALUES) {
    return false;
  }

  const scale = 10 ** Math.min(maxStringDecimalPlaces, MAX_STRING_NUMERIC_DENSITY_DECIMALS);
  const sortedValues = [...distinctNumericStringValues]
    .map((value) => Math.round(value * scale))
    .sort((left, right) => left - right);
  const minValue = sortedValues[0];
  const maxValue = sortedValues[sortedValues.length - 1];
  const rangeWidth = maxValue - minValue + 1;
  const density = rangeWidth > 0 ? sortedValues.length / rangeWidth : 1;

  // Keep sparse numeric-looking string columns categorical by default so
  // code-style identifiers do not flip to numeric only because cardinality grows.
  return density >= STRING_NUMERIC_DENSITY_THRESHOLD;
}

function createNumericAnnotation(): Annotation {
  return {
    kind: 'numeric',
    values: [],
    colors: [],
    shapes: [],
  };
}

function createCategoricalAnnotation(
  uniqueValues: string[],
  colors: string[],
  shapes: string[],
): Annotation {
  return {
    kind: 'categorical',
    values: uniqueValues,
    colors,
    shapes,
  };
}

/**
 * Parse an annotation value that may contain a pipe-separated score or evidence code suffix.
 * Format: `label|score`, `label|score1,score2,...`, or `label|EVIDENCE_CODE`
 * If the part after the last `|` is numeric → scores.
 * If it matches an evidence code pattern (2–5 uppercase letters or ECO:digits) → evidence.
 * Otherwise the full string is kept as the label.
 * Examples:
 *   "PF00001 (7tm_1)|1.5e-10"       → { label: "PF00001 (7tm_1)", scores: [1.5e-10], evidence: null }
 *   "PF00001|1.5e-10,2.3e-5"        → { label: "PF00001", scores: [1.5e-10, 2.3e-5], evidence: null }
 *   "Cytoplasm|EXP"                  → { label: "Cytoplasm", scores: [], evidence: "EXP" }
 *   "Cytoplasm|ECO:0000269"          → { label: "Cytoplasm", scores: [], evidence: "ECO:0000269" }
 *   "GO:0005524|ATP binding"         → { label: "GO:0005524|ATP binding", scores: [], evidence: null }
 *   "taxonomy_value"                 → { label: "taxonomy_value", scores: [], evidence: null }
 */
export const parseAnnotationValue = (
  raw: string,
): { label: string; scores: number[]; evidence: string | null } => {
  const trimmed = raw.trim();
  if (!trimmed) return { label: '', scores: [], evidence: null };

  const lastPipe = trimmed.lastIndexOf('|');
  if (lastPipe === -1 || lastPipe === trimmed.length - 1) {
    return { label: trimmed, scores: [], evidence: null };
  }

  const suffix = trimmed.substring(lastPipe + 1).trim();

  // Check for evidence code pattern (2–5 uppercase letters or ECO:digits)
  if (EVIDENCE_CODE_RE.test(suffix)) {
    const label = trimmed.substring(0, lastPipe).trim();
    return { label, scores: [], evidence: suffix };
  }

  // Check for numeric scores
  const parts = suffix.split(',');
  const scores: number[] = [];

  for (const part of parts) {
    const num = Number(part.trim());
    if (!Number.isFinite(num)) {
      // Not numeric and not an evidence code — treat the full string as the label
      return { label: trimmed, scores: [], evidence: null };
    }
    scores.push(num);
  }

  const label = trimmed.substring(0, lastPipe).trim();
  return { label, scores, evidence: null };
};

/**
 * Parses the info_json field and returns its contents as sanitized metadata fields.
 * This handles the round-trip case where metadata was serialized to JSON during export.
 */
function parseInfoJson(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value) return {};

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return {};

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(parsed)) {
      // Skip dimension as it's handled separately by convertBundleFormatData
      if (key !== 'dimension') {
        result[key] = sanitizeValue(val);
      }
    }
    return result;
  } catch {
    // If parsing fails, return empty object
    return {};
  }
}

/**
 * Builds a metadata map from projections metadata rows.
 * Parses info_json field and spreads its contents into metadata.
 */
function buildProjectionsMetadataMap(
  projectionsMetadata?: Rows,
): Map<string, Record<string, unknown>> {
  const metadataMap = new Map<string, Record<string, unknown>>();

  if (!projectionsMetadata?.length) return metadataMap;

  for (const metaRow of projectionsMetadata) {
    const projName = metaRow.projection_name || metaRow.name;
    if (!projName) continue;

    // Start with parsed info_json fields (if present)
    const metadata: Record<string, unknown> = parseInfoJson(metaRow.info_json);

    // Add remaining fields (excluding projection identifiers and info_json)
    for (const [key, value] of Object.entries(metaRow)) {
      if (!METADATA_EXCLUDED_KEYS.has(key)) {
        metadata[key] = sanitizeValue(value);
      }
    }

    metadataMap.set(String(projName), metadata);
  }

  return metadataMap;
}

/**
 * Builds a coordinate map from projection rows.
 * Maps protein IDs to their [x, y] or [x, y, z] coordinates.
 */
function buildCoordinateMap(
  projectionRows: Rows,
  proteinIdCol: string,
): Map<string, [number, number] | [number, number, number]> {
  const coordMap = new Map<string, [number, number] | [number, number, number]>();
  for (const row of projectionRows) {
    const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
    const x = Number(row.x) || 0;
    const y = Number(row.y) || 0;
    const zValue = row.z;
    const z = zValue == null ? null : Number(zValue);
    if (z !== null && !Number.isNaN(z)) {
      coordMap.set(proteinId, [x, y, z]);
    } else {
      coordMap.set(proteinId, [x, y]);
    }
  }
  return coordMap;
}

export function convertParquetToVisualizationData(
  rows: Rows,
  projectionsMetadata?: Rows,
): VisualizationData {
  validateRowsBasic(rows);

  const columnNames = Object.keys(rows[0]);
  const hasProjectionName = columnNames.includes('projection_name');
  const hasXY = columnNames.includes('x') && columnNames.includes('y');

  if (hasProjectionName && hasXY) {
    return convertBundleFormatData(rows, columnNames, projectionsMetadata);
  }
  return convertLegacyFormatData(rows, columnNames);
}

export function convertParquetToVisualizationDataOptimized(
  rows: Rows,
  projectionsMetadata?: Rows,
): Promise<VisualizationData> {
  validateRowsBasic(rows);
  const dataSize = rows.length;
  if (dataSize < 10000) {
    return Promise.resolve(convertParquetToVisualizationData(rows, projectionsMetadata));
  }
  return convertLargeDatasetOptimized(rows, projectionsMetadata);
}

async function convertLargeDatasetOptimized(
  rows: Rows,
  projectionsMetadata?: Rows,
): Promise<VisualizationData> {
  const columnNames = Object.keys(rows[0]);
  const hasProjectionName = columnNames.includes('projection_name');
  const hasXY = columnNames.includes('x') && columnNames.includes('y');
  if (hasProjectionName && hasXY) {
    return convertBundleFormatDataOptimized(rows, columnNames, projectionsMetadata);
  }
  return convertLegacyFormatData(rows, columnNames);
}

function convertBundleFormatData(
  rows: Rows,
  columnNames: string[],
  projectionsMetadata?: Rows,
): VisualizationData {
  const proteinIdCol =
    findColumn(columnNames, ['identifier', 'protein_id', 'id', 'protein', 'uniprot']) ||
    columnNames[0];

  const projectionGroups = new Map<string, Rows>();
  for (const row of rows) {
    const projectionName = String(row.projection_name || 'Unknown');
    let group = projectionGroups.get(projectionName);
    if (!group) {
      group = [];
      projectionGroups.set(projectionName, group);
    }
    group.push(row);
  }

  const uniqueProteinIds = Array.from(
    new Set(
      rows.map((row) => {
        const value = row[proteinIdCol];
        return value ? String(value) : '';
      }),
    ),
  );

  const metadataMap = buildProjectionsMetadataMap(projectionsMetadata);

  const projections = [] as VisualizationData['projections'];
  for (const [projectionName, projectionRows] of projectionGroups.entries()) {
    const coordMap = buildCoordinateMap(projectionRows, proteinIdCol);
    const projectionData = uniqueProteinIds.map((proteinId) => coordMap.get(proteinId) || [0, 0]);
    const has3D = projectionData.some((p) => p.length === 3);

    // Merge dimension with existing metadata from projectionsMetadata
    const existingMetadata = metadataMap.get(projectionName) || {};
    const metadata = {
      ...existingMetadata,
      dimension: (has3D ? 3 : 2) as 2 | 3,
    };

    projections.push({
      name: formatProjectionName(projectionName),
      data: projectionData as Array<[number, number] | [number, number, number]>,
      metadata,
    });
  }

  const allIdColumns = getIdColumnsSet(proteinIdCol);
  const annotationColumns = columnNames.filter((col) => !allIdColumns.has(col));

  const annotations: Record<string, Annotation> = {};
  const annotation_data: Record<string, number[][]> = {};
  const numeric_annotation_data: Record<string, (number | null)[]> = {};
  const annotation_scores: Record<string, (number[] | null)[][]> = {};
  const annotation_evidence: Record<string, (string | null)[][]> = {};

  const baseProjectionData = projectionGroups.values().next().value || rows;
  const baseRowsByProteinId = new Map<string, Rows[number]>();
  for (const row of baseProjectionData) {
    baseRowsByProteinId.set(String(row[proteinIdCol] ?? ''), row);
  }

  for (const annotationCol of annotationColumns) {
    if (isScalarNumericAnnotationColumn(baseProjectionData.map((row) => row[annotationCol]))) {
      numeric_annotation_data[annotationCol] = uniqueProteinIds.map((proteinId) => {
        const row = baseRowsByProteinId.get(proteinId);
        const rawValue = row?.[annotationCol];
        if (rawValue == null) return null;
        return parseNumericAnnotationValue(rawValue);
      });
      annotations[annotationCol] = createNumericAnnotation();
      continue;
    }

    const annotationMap = new Map<string, string[]>();
    const annotationScoreMap = new Map<string, (number[] | null)[]>();
    const annotationEvidenceMap = new Map<string, (string | null)[]>();
    const valueCountMap = new Map<string, number>();
    let columnHasScores = false;
    let columnHasEvidence = false;

    for (const row of baseProjectionData) {
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
      const rawValue = row[annotationCol];

      if (rawValue == null) {
        annotationMap.set(proteinId, []);
        annotationScoreMap.set(proteinId, []);
        annotationEvidenceMap.set(proteinId, []);
        continue;
      }

      const rawValues = String(rawValue).split(';');
      const labels: string[] = [];
      const scores: (number[] | null)[] = [];
      const evidences: (string | null)[] = [];
      for (const raw of rawValues) {
        const parsed = parseAnnotationValue(raw);
        labels.push(parsed.label);
        scores.push(parsed.scores.length > 0 ? parsed.scores : null);
        evidences.push(parsed.evidence);
        if (parsed.scores.length > 0) columnHasScores = true;
        if (parsed.evidence) columnHasEvidence = true;
        valueCountMap.set(parsed.label, (valueCountMap.get(parsed.label) || 0) + 1);
      }
      annotationMap.set(proteinId, labels);
      annotationScoreMap.set(proteinId, scores);
      annotationEvidenceMap.set(proteinId, evidences);
    }

    // Sort unique values by frequency (most frequent first)
    // This ensures the most common categories get the most distinct colors (slots 0, 1, 2...)
    const uniqueValues = Array.from(valueCountMap.keys()).sort(
      (a, b) => (valueCountMap.get(b) || 0) - (valueCountMap.get(a) || 0),
    );

    const valueToIndex = new Map<string | null, number>();
    uniqueValues.forEach((value, idx) => valueToIndex.set(value, idx));

    const colors = generateColors(uniqueValues.length);
    const shapes = generateShapes(uniqueValues.length);

    const annotationDataArray = uniqueProteinIds.map((proteinId) => {
      const value = annotationMap.get(proteinId);
      return (value ?? []).map((v) => valueToIndex.get(v) ?? -1);
    });

    if (columnHasScores) {
      annotation_scores[annotationCol] = uniqueProteinIds.map(
        (proteinId) => annotationScoreMap.get(proteinId) ?? [],
      );
    }

    if (columnHasEvidence) {
      annotation_evidence[annotationCol] = uniqueProteinIds.map(
        (proteinId) => annotationEvidenceMap.get(proteinId) ?? [],
      );
    }

    annotations[annotationCol] = createCategoricalAnnotation(uniqueValues, colors, shapes);
    annotation_data[annotationCol] = annotationDataArray;
  }

  return {
    protein_ids: uniqueProteinIds,
    projections,
    annotations,
    annotation_data,
    numeric_annotation_data,
    annotation_scores,
    annotation_evidence,
  };
}

async function convertBundleFormatDataOptimized(
  rows: Rows,
  columnNames: string[],
  projectionsMetadata?: Rows,
): Promise<VisualizationData> {
  const chunkSize = 50000;
  const proteinIdCol =
    findColumn(columnNames, ['identifier', 'protein_id', 'id', 'protein', 'uniprot']) ||
    columnNames[0];

  const projectionGroups = new Map<string, Rows>();
  const uniqueProteinIdsSet = new Set<string>();

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, Math.min(i + chunkSize, rows.length));
    for (const row of chunk) {
      const projectionName = String(row.projection_name || 'Unknown');
      let group = projectionGroups.get(projectionName);
      if (!group) {
        group = [];
        projectionGroups.set(projectionName, group);
      }
      group.push(row);
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : undefined;
      if (proteinId) uniqueProteinIdsSet.add(proteinId);
    }
    // yield

    await fastYield();
  }

  const uniqueProteinIds = Array.from(uniqueProteinIdsSet);

  const metadataMap = buildProjectionsMetadataMap(projectionsMetadata);

  const projections = [] as VisualizationData['projections'];
  for (const [projectionName, projectionRows] of projectionGroups.entries()) {
    const coordMap = buildCoordinateMap(projectionRows, proteinIdCol);
    const projectionData: Array<[number, number] | [number, number, number]> = new Array(
      uniqueProteinIds.length,
    );
    for (let i = 0; i < uniqueProteinIds.length; i++) {
      projectionData[i] = coordMap.get(uniqueProteinIds[i]) || [0, 0];
    }
    const has3D = projectionData.some((p) => p.length === 3);

    // Merge dimension with existing metadata from projectionsMetadata
    const existingMetadata = metadataMap.get(projectionName) || {};
    const metadata = {
      ...existingMetadata,
      dimension: (has3D ? 3 : 2) as 2 | 3,
    };

    projections.push({
      name: formatProjectionName(projectionName),
      data: projectionData,
      metadata,
    });
    // yield

    await fastYield();
  }

  // Use only base projection's rows for annotations (not all rows across projections)
  const baseProjectionRows = projectionGroups.values().next().value || rows;
  const {
    annotations,
    annotation_data,
    numeric_annotation_data,
    annotation_scores,
    annotation_evidence,
  } = await extractAnnotationsOptimized(
    baseProjectionRows,
    columnNames,
    proteinIdCol,
    uniqueProteinIds,
  );

  return {
    protein_ids: uniqueProteinIds,
    projections,
    annotations,
    annotation_data,
    numeric_annotation_data,
    annotation_scores,
    annotation_evidence,
  };
}

function convertLegacyFormatData(rows: Rows, columnNames: string[]): VisualizationData {
  const proteinIdCol =
    findColumn(columnNames, ['identifier', 'protein_id', 'id', 'protein', 'uniprot']) ||
    columnNames[0];
  if (!proteinIdCol) {
    throw new Error(`Protein ID column not found. Available columns: ${columnNames.join(', ')}`);
  }

  const projectionPairs = findProjectionPairs(columnNames);
  if (projectionPairs.length === 0) {
    const numericColumns = columnNames.filter((col) => {
      const sampleValue = rows[0][col];
      return typeof sampleValue === 'number' || !Number.isNaN(Number(sampleValue));
    });
    if (numericColumns.length === 0) {
      throw new Error(
        `No projection coordinate pairs found. Available columns: ${columnNames.join(', ')}`,
      );
    }
  }

  const protein_ids = rows.map((row) => (row[proteinIdCol] ? String(row[proteinIdCol]) : ''));

  const projections = projectionPairs.map((pair) => {
    const projectionData: [number, number][] = rows.map((row, idx) => {
      const x = Number(row[pair.xCol]);
      const y = Number(row[pair.yCol]);
      if (Number.isNaN(x) || Number.isNaN(y)) {
        console.warn(`Invalid coordinates at row ${idx} for projection ${pair.name}`, { x, y });
      }
      return [x, y];
    });
    return {
      name: pair.name,
      data: projectionData,
    } as VisualizationData['projections'][number];
  });

  const usedColumns = new Set([proteinIdCol, ...projectionPairs.flatMap((p) => [p.xCol, p.yCol])]);
  const annotationColumns = columnNames.filter((col) => !usedColumns.has(col));

  const annotations: Record<string, Annotation> = {};
  const annotation_data: Record<string, number[][]> = {};
  const numeric_annotation_data: Record<string, (number | null)[]> = {};
  const annotation_scores: Record<string, (number[] | null)[][]> = {};
  const annotation_evidence: Record<string, (string | null)[][]> = {};

  for (const annotationCol of annotationColumns) {
    if (isScalarNumericAnnotationColumn(rows.map((row) => row[annotationCol]))) {
      const numericValues = rows.map((row) => {
        const rawValue = row[annotationCol];
        if (rawValue == null) return null;
        return parseNumericAnnotationValue(rawValue);
      });

      annotations[annotationCol] = createNumericAnnotation();
      numeric_annotation_data[annotationCol] = numericValues;
      continue;
    }

    const rawValues: string[][] = rows.map((row) => {
      const v = row[annotationCol];
      return v == null ? [] : String(v).split(';');
    });

    let columnHasScores = false;
    let columnHasEvidence = false;
    const parsed = rawValues.map((valueArray) => {
      const labels: string[] = [];
      const scores: (number[] | null)[] = [];
      const evidences: (string | null)[] = [];
      for (const raw of valueArray) {
        const p = parseAnnotationValue(raw);
        labels.push(p.label);
        scores.push(p.scores.length > 0 ? p.scores : null);
        evidences.push(p.evidence);
        if (p.scores.length > 0) columnHasScores = true;
        if (p.evidence) columnHasEvidence = true;
      }
      return { labels, scores, evidences };
    });

    const labelsByRow = parsed.map((p) => p.labels);
    const scoresByRow = parsed.map((p) => p.scores);
    const evidencesByRow = parsed.map((p) => p.evidences);

    const uniqueValues = Array.from(new Set(labelsByRow.flat()));
    const valueToIndex = new Map<string, number>();
    uniqueValues.forEach((value, idx) => valueToIndex.set(value, idx));

    const colors = generateColors(uniqueValues.length);
    const shapes = generateShapes(uniqueValues.length);

    const annotationDataArray = labelsByRow.map((valueArray) =>
      valueArray.map((v) => valueToIndex.get(v) ?? -1),
    );

    annotations[annotationCol] = createCategoricalAnnotation(uniqueValues, colors, shapes);
    annotation_data[annotationCol] = annotationDataArray;
    if (columnHasScores) {
      annotation_scores[annotationCol] = scoresByRow;
    }
    if (columnHasEvidence) {
      annotation_evidence[annotationCol] = evidencesByRow;
    }
  }

  return {
    protein_ids,
    projections,
    annotations,
    annotation_data,
    numeric_annotation_data,
    annotation_scores,
    annotation_evidence,
  };
}

function findProjectionPairs(
  columnNames: string[],
): Array<{ name: string; xCol: string; yCol: string }> {
  const pairs: Array<{ name: string; xCol: string; yCol: string }> = [];
  const groups = new Map<string, { x?: string; y?: string }>();

  for (const col of columnNames) {
    const lower = col.toLowerCase();
    if (
      lower.includes('protein') ||
      lower.includes('id') ||
      (!lower.includes('_x') &&
        !lower.includes('_y') &&
        !lower.includes('1') &&
        !lower.includes('2'))
    ) {
      continue;
    }
    let projectionName = '';
    let coordType = '';
    if (lower.includes('_x') || lower.includes('_y')) {
      const parts = col.split('_');
      coordType = parts[parts.length - 1].toLowerCase();
      projectionName = parts.slice(0, -1).join('_');
    } else if (lower.includes('1') || lower.includes('2')) {
      if (lower.includes('1')) {
        coordType = 'x';
        projectionName = col.replace(/[_]?1/g, '');
      } else if (lower.includes('2')) {
        coordType = 'y';
        projectionName = col.replace(/[_]?2/g, '');
      }
    }
    if (projectionName && coordType) {
      const group = groups.get(projectionName) ?? {};
      if (coordType === 'x') group.x = col;
      if (coordType === 'y') group.y = col;
      groups.set(projectionName, group);
    }
  }

  for (const [name, group] of groups.entries()) {
    if (group.x && group.y) {
      pairs.push({
        name: formatProjectionName(name),
        xCol: group.x,
        yCol: group.y,
      });
    }
  }

  if (pairs.length === 0) {
    const xCol = findColumn(columnNames, ['x', 'umap_1', 'pc1', 'tsne_1']);
    const yCol = findColumn(columnNames, ['y', 'umap_2', 'pc2', 'tsne_2']);
    if (xCol && yCol) pairs.push({ name: inferProjectionName(xCol, yCol), xCol, yCol });
  }

  return pairs;
}

function formatProjectionName(name: string): string {
  return name;
}

function inferProjectionName(xCol: string, yCol: string): string {
  const lx = xCol.toLowerCase();
  const ly = yCol.toLowerCase();
  if (lx.includes('umap') || ly.includes('umap')) return 'UMAP';
  if (lx.includes('pca') || lx.includes('pc')) return 'PCA';
  if (lx.includes('tsne')) return 't-SNE';
  return 'Projection';
}

/**
 * Generates colors for categories using Kelly's palette.
 * Simply cycles through Kelly's 20 colors of maximum contrast.
 *
 * Note: This is a fallback for when no legend is present.
 * When a legend is used, it provides frequency-sorted colors
 * via the colorMapping event, which takes precedence.
 *
 * @param count - Number of colors to generate
 * @returns Array of hex color strings
 */
function generateColors(count: number): string[] {
  if (count <= 0) return [];

  const kellysPalette = COLOR_SCHEMES.kellys as readonly string[];

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(kellysPalette[i % kellysPalette.length]);
  }
  return colors;
}

/**
 * Generates shapes optimized for visible categories.
 * Prioritizes the most distinct shapes for early categories (most visible).
 * Only includes shapes supported by the WebGL renderer.
 *
 * Supported shapes: circle, square, diamond, triangle-up, triangle-down, plus
 *
 * @param count - Number of shapes to generate
 * @returns Array of shape names
 */
function generateShapes(count: number): string[] {
  if (count <= 0) return [];

  // Shapes ordered by visual distinctness for optimal category separation
  // Order must match visual-encoding.ts SHAPES array for legend consistency
  // These are the only shapes supported by the WebGL renderer
  const supportedShapes: Array<
    'circle' | 'square' | 'diamond' | 'plus' | 'triangle-up' | 'triangle-down'
  > = [
    'circle', // Most common, good baseline
    'square', // High contrast with circle (angular vs round)
    'diamond', // Distinct angular shape, rotated square
    'plus', // Cross shape, very distinct from others
    'triangle-up', // Pointed shape, easy to distinguish
    'triangle-down', // Inverted triangle, contrasts with triangle-up
  ];

  const shapes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Use distinct shapes for first 6 categories, then cycle
    shapes.push(supportedShapes[i % supportedShapes.length]);
  }
  return shapes;
}

async function extractAnnotationsOptimized(
  rows: Rows,
  columnNames: string[],
  proteinIdCol: string,
  uniqueProteinIds: string[],
): Promise<{
  annotations: Record<string, Annotation>;
  annotation_data: Record<string, number[][]>;
  numeric_annotation_data: Record<string, (number | null)[]>;
  annotation_scores: Record<string, (number[] | null)[][]>;
  annotation_evidence: Record<string, (string | null)[][]>;
}> {
  const allIdColumns = getIdColumnsSet(proteinIdCol);
  const annotationColumns = columnNames.filter((c) => !allIdColumns.has(c));

  const annotations: Record<string, Annotation> = {};
  const annotation_data: Record<string, number[][]> = {};
  const numeric_annotation_data: Record<string, (number | null)[]> = {};
  const annotation_scores: Record<string, (number[] | null)[][]> = {};
  const annotation_evidence: Record<string, (string | null)[][]> = {};

  if (annotationColumns.length === 0) {
    return {
      annotations,
      annotation_data,
      numeric_annotation_data,
      annotation_scores,
      annotation_evidence,
    };
  }

  // Build protein ID → index map once (shared across all columns)
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < uniqueProteinIds.length; i++) {
    idToIndex.set(uniqueProteinIds[i], i);
  }

  const numProteins = uniqueProteinIds.length;
  const chunkSize = 50000;

  // Process one column at a time so GC can reclaim between columns
  for (let colIdx = 0; colIdx < annotationColumns.length; colIdx++) {
    const annotationCol = annotationColumns[colIdx];

    if (isScalarNumericAnnotationColumn(rows.map((row) => row[annotationCol]))) {
      const numericValues: (number | null)[] = new Array(numProteins).fill(null);

      for (let i = 0; i < rows.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, rows.length);
        for (let r = i; r < end; r++) {
          const row = rows[r];
          const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
          const idx = idToIndex.get(proteinId);
          if (idx === undefined) continue;

          const rawValue = row[annotationCol];
          if (rawValue == null) {
            numericValues[idx] = null;
            continue;
          }

          numericValues[idx] = parseNumericAnnotationValue(rawValue);
        }
        await fastYield();
      }

      annotations[annotationCol] = createNumericAnnotation();
      numeric_annotation_data[annotationCol] = numericValues;
      continue;
    }

    // === Pass 1: Collect unique values, frequency counts, detect scores/evidence ===
    const valueCountMap = new Map<string, number>();
    let columnHasScores = false;
    let columnHasEvidence = false;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, rows.length);
      for (let r = i; r < end; r++) {
        const rawValue = rows[r][annotationCol];
        if (rawValue == null) continue;

        const rawValues = String(rawValue).split(';');
        for (const raw of rawValues) {
          const parsed = parseAnnotationValue(raw);
          valueCountMap.set(parsed.label, (valueCountMap.get(parsed.label) || 0) + 1);
          if (parsed.scores.length > 0) columnHasScores = true;
          if (parsed.evidence) columnHasEvidence = true;
        }
      }
      await fastYield();
    }

    // Sort unique values by frequency (most frequent first)
    const uniqueValues = Array.from(valueCountMap.keys()).sort(
      (a, b) => (valueCountMap.get(b) || 0) - (valueCountMap.get(a) || 0),
    );

    const valueToIndex = new Map<string | null, number>();
    uniqueValues.forEach((val, idx) => valueToIndex.set(val, idx));

    const colors = generateColors(uniqueValues.length);
    const shapes = generateShapes(uniqueValues.length);

    // === Pass 2: Build output arrays directly (no intermediate string arrays) ===
    const annotationDataArray = new Array<number[]>(numProteins);
    const scoresArray = columnHasScores ? new Array<(number[] | null)[]>(numProteins) : null;
    const evidenceArray = columnHasEvidence ? new Array<(string | null)[]>(numProteins) : null;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, rows.length);
      for (let r = i; r < end; r++) {
        const row = rows[r];
        const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
        const idx = idToIndex.get(proteinId);
        if (idx === undefined) continue;

        const rawValue = row[annotationCol];
        if (rawValue == null) continue;

        const rawValues = String(rawValue).split(';');
        const indices: number[] = [];
        const scores: (number[] | null)[] | null = scoresArray ? [] : null;
        const evidences: (string | null)[] | null = evidenceArray ? [] : null;

        for (const raw of rawValues) {
          const parsed = parseAnnotationValue(raw);
          indices.push(valueToIndex.get(parsed.label) ?? -1);
          if (scores) scores.push(parsed.scores.length > 0 ? parsed.scores : null);
          if (evidences) evidences.push(parsed.evidence);
        }

        annotationDataArray[idx] = indices;
        if (scoresArray && scores) scoresArray[idx] = scores;
        if (evidenceArray && evidences) evidenceArray[idx] = evidences;
      }
      await fastYield();
    }

    // Fill empty arrays for proteins not found in this column's rows
    for (let p = 0; p < numProteins; p++) {
      if (annotationDataArray[p] === undefined) {
        annotationDataArray[p] = [];
        if (scoresArray) scoresArray[p] = [];
        if (evidenceArray) evidenceArray[p] = [];
      }
    }

    annotations[annotationCol] = createCategoricalAnnotation(uniqueValues, colors, shapes);
    annotation_data[annotationCol] = annotationDataArray;
    if (scoresArray) annotation_scores[annotationCol] = scoresArray;
    if (evidenceArray) annotation_evidence[annotationCol] = evidenceArray;
  }

  return {
    annotations,
    annotation_data,
    numeric_annotation_data,
    annotation_scores,
    annotation_evidence,
  };
}
