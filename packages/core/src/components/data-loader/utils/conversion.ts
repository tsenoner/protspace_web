import type { Annotation, VisualizationData } from '@protspace/utils';
import { COLOR_SCHEMES, sanitizeValue } from '@protspace/utils';
import { validateRowsBasic } from './validation';
import { findColumn } from './bundle';
import type { Rows } from './types';

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

// Helper functions for annotation parsing (PFAM, CATH, etc.)
// These annotations have format: label|score
const isAnnotationWithScore = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return normalized === 'pfam' || normalized === 'cath';
};

const parseAnnotationValue = (raw: string): { label: string; score: number | null } => {
  const [labelPart, scorePart] = raw.split('|');
  const label = (labelPart ?? '').trim();
  const scoreRaw = scorePart?.trim();
  if (!scoreRaw) return { label, score: null };
  const score = Number(scoreRaw);
  return Number.isFinite(score) ? { label, score } : { label, score: null };
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
  const annotation_scores: Record<string, (number | null)[][]> = {};

  const baseProjectionData = projectionGroups.values().next().value || rows;

  for (const annotationCol of annotationColumns) {
    const hasScore = isAnnotationWithScore(annotationCol);
    const annotationMap = new Map<string, string[]>();
    const annotationScoreMap = hasScore ? new Map<string, (number | null)[]>() : null;
    const valueCountMap = new Map<string, number>();

    for (const row of baseProjectionData) {
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
      const rawValue = row[annotationCol];

      if (rawValue == null) {
        annotationMap.set(proteinId, []);
        if (annotationScoreMap) annotationScoreMap.set(proteinId, []);
        continue;
      }

      const rawValues = String(rawValue).split(';');
      if (hasScore) {
        const labels: string[] = [];
        const scores: (number | null)[] = [];
        for (const raw of rawValues) {
          const { label, score } = parseAnnotationValue(raw);
          labels.push(label);
          scores.push(score);
          valueCountMap.set(label, (valueCountMap.get(label) || 0) + 1);
        }
        annotationMap.set(proteinId, labels);
        annotationScoreMap?.set(proteinId, scores);
      } else {
        annotationMap.set(proteinId, rawValues);
        // Count occurrences for frequency-based sorting
        for (const v of rawValues) {
          valueCountMap.set(v, (valueCountMap.get(v) || 0) + 1);
        }
      }
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

    if (annotationScoreMap) {
      annotation_scores[annotationCol] = uniqueProteinIds.map(
        (proteinId) => annotationScoreMap.get(proteinId) ?? [],
      );
    }

    annotations[annotationCol] = { values: uniqueValues, colors, shapes };
    annotation_data[annotationCol] = annotationDataArray;
  }

  return {
    protein_ids: uniqueProteinIds,
    projections,
    annotations,
    annotation_data,
    annotation_scores,
  };
}

async function convertBundleFormatDataOptimized(
  rows: Rows,
  columnNames: string[],
  projectionsMetadata?: Rows,
): Promise<VisualizationData> {
  const chunkSize = 5000;
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

    await new Promise((r) => setTimeout(r, 0));
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

    await new Promise((r) => setTimeout(r, 0));
  }

  const { annotations, annotation_data, annotation_scores } = await extractAnnotationsOptimized(
    rows,
    columnNames,
    proteinIdCol,
    uniqueProteinIds,
  );

  return {
    protein_ids: uniqueProteinIds,
    projections,
    annotations,
    annotation_data,
    annotation_scores,
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
  const annotation_scores: Record<string, (number | null)[][]> = {};

  for (const annotationCol of annotationColumns) {
    const hasScore = isAnnotationWithScore(annotationCol);
    const rawValues: string[][] = rows.map((row) => {
      const v = row[annotationCol];
      return v == null ? [] : String(v).split(';');
    });

    if (hasScore) {
      const parsed = rawValues.map((valueArray) => {
        const labels: string[] = [];
        const scores: (number | null)[] = [];
        for (const raw of valueArray) {
          const { label, score } = parseAnnotationValue(raw);
          labels.push(label);
          scores.push(score);
        }
        return { labels, scores };
      });

      const labelsByRow = parsed.map((p) => p.labels);
      const scoresByRow = parsed.map((p) => p.scores);

      const uniqueValues = Array.from(new Set(labelsByRow.flat()));
      const valueToIndex = new Map<string, number>();
      uniqueValues.forEach((value, idx) => valueToIndex.set(value, idx));

      const colors = generateColors(uniqueValues.length);
      const shapes = generateShapes(uniqueValues.length);

      const annotationDataArray = labelsByRow.map((valueArray) =>
        valueArray.map((v) => valueToIndex.get(v) ?? -1),
      );

      annotations[annotationCol] = { values: uniqueValues, colors, shapes };
      annotation_data[annotationCol] = annotationDataArray;
      annotation_scores[annotationCol] = scoresByRow;
    } else {
      const uniqueValues = Array.from(new Set(rawValues.flat()));
      const valueToIndex = new Map<string, number>();
      uniqueValues.forEach((value, idx) => valueToIndex.set(value, idx));

      const colors = generateColors(uniqueValues.length);
      const shapes = generateShapes(uniqueValues.length);
      const annotationDataArray = rawValues.map((valueArray) =>
        valueArray.map((v) => valueToIndex.get(v) ?? -1),
      );

      annotations[annotationCol] = { values: uniqueValues, colors, shapes };
      annotation_data[annotationCol] = annotationDataArray;
    }
  }

  return { protein_ids, projections, annotations, annotation_data, annotation_scores };
}

export function findProjectionPairs(
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

export function formatProjectionName(name: string): string {
  if (name.toUpperCase() === 'PCA_2') return 'PCA 2';
  if (name.toUpperCase() === 'PCA_3') return 'PCA 3';
  if (/^PCA_?\d+$/i.test(name)) {
    const number = name.replace(/^PCA_?/i, '');
    return `PCA ${number}`;
  }
  return name
    .split('_')
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower.includes('umap')) return 'UMAP' + part.replace(/umap/i, '');
      if (lower.includes('pca')) return 'PCA' + part.replace(/pca/i, '');
      if (lower.includes('tsne')) return 't-SNE' + part.replace(/tsne/i, '');
      if (/^\d+$/.test(part)) return part;
      return part.toUpperCase();
    })
    .join(' ');
}

export function inferProjectionName(xCol: string, yCol: string): string {
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
export function generateColors(count: number): string[] {
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
export function generateShapes(count: number): string[] {
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

export async function extractAnnotationsOptimized(
  rows: Rows,
  columnNames: string[],
  proteinIdCol: string,
  uniqueProteinIds: string[],
): Promise<{
  annotations: Record<string, Annotation>;
  annotation_data: Record<string, number[][]>;
  annotation_scores: Record<string, (number | null)[][]>;
}> {
  const allIdColumns = getIdColumnsSet(proteinIdCol);
  const annotationColumns = columnNames.filter((c) => !allIdColumns.has(c));

  const annotations: Record<string, Annotation> = {};
  const annotation_data: Record<string, number[][]> = {};
  const annotation_scores: Record<string, (number | null)[][]> = {};

  const chunkSize = 10000;
  for (const annotationCol of annotationColumns) {
    const hasScore = isAnnotationWithScore(annotationCol);
    const annotationMap = new Map<string, string[]>();
    const annotationScoreMap = hasScore ? new Map<string, (number | null)[]>() : null;
    const valueCountMap = new Map<string | null, number>();
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, Math.min(i + chunkSize, rows.length));
      for (const row of chunk) {
        const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
        const rawValue = row[annotationCol];

        if (rawValue == null) {
          annotationMap.set(proteinId, []);
          if (annotationScoreMap) annotationScoreMap.set(proteinId, []);
          continue;
        }

        const rawValues = String(rawValue).split(';');
        if (hasScore) {
          const labels: string[] = [];
          const scores: (number | null)[] = [];
          for (const raw of rawValues) {
            const { label, score } = parseAnnotationValue(raw);
            labels.push(label);
            scores.push(score);
            valueCountMap.set(label, (valueCountMap.get(label) || 0) + 1);
          }
          annotationMap.set(proteinId, labels);
          annotationScoreMap?.set(proteinId, scores);
        } else {
          annotationMap.set(proteinId, rawValues);
          for (const v of rawValues) {
            valueCountMap.set(v, (valueCountMap.get(v) || 0) + 1);
          }
        }
      }
      // yield

      await new Promise((r) => setTimeout(r, 0));
    }

    const uniqueValues = Array.from(valueCountMap.keys());
    const valueToIndex = new Map<string | null, number>();
    uniqueValues.forEach((val, idx) => valueToIndex.set(val, idx));

    const colors = generateColors(uniqueValues.length);
    const shapes = generateShapes(uniqueValues.length);

    const annotationDataArray = new Array<number[]>(uniqueProteinIds.length);

    for (let i = 0; i < uniqueProteinIds.length; i++) {
      const valueArray = annotationMap.get(uniqueProteinIds[i]) ?? null;
      annotationDataArray[i] = (valueArray ?? []).map((v) => valueToIndex.get(v) ?? -1);
    }

    if (annotationScoreMap) {
      annotation_scores[annotationCol] = uniqueProteinIds.map(
        (proteinId) => annotationScoreMap.get(proteinId) ?? [],
      );
    }

    annotations[annotationCol] = { values: uniqueValues, colors, shapes };
    annotation_data[annotationCol] = annotationDataArray;
  }

  return { annotations, annotation_data, annotation_scores };
}
