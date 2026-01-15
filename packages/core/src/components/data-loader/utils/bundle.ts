import { parquetReadObjects } from 'hyparquet';
import type { Rows, GenericRow } from './types';
import { assertValidParquetMagic, validateMergedBundleRows } from './validation';

const BUNDLE_DELIMITER = new TextEncoder().encode('---PARQUET_DELIMITER---');

export function isParquetBundle(arrayBuffer: ArrayBuffer): boolean {
  const uint8Array = new Uint8Array(arrayBuffer);
  const len = BUNDLE_DELIMITER.length;
  for (let i = 0; i <= uint8Array.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (uint8Array[i + j] !== BUNDLE_DELIMITER[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export function findBundleDelimiterPositions(uint8Array: Uint8Array): number[] {
  const positions: number[] = [];
  const len = BUNDLE_DELIMITER.length;
  for (let i = 0; i <= uint8Array.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (uint8Array[i + j] !== BUNDLE_DELIMITER[j]) {
        match = false;
        break;
      }
    }
    if (match) positions.push(i);
  }
  return positions;
}

export async function extractRowsFromParquetBundle(
  arrayBuffer: ArrayBuffer,
): Promise<{ rows: Rows; projectionsMetadata: Rows }> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const delimiterPositions = findBundleDelimiterPositions(uint8Array);

  if (delimiterPositions.length !== 2) {
    throw new Error(`Expected 2 delimiters in parquetbundle, found ${delimiterPositions.length}`);
  }

  const part1 = uint8Array.subarray(0, delimiterPositions[0]).slice().buffer;
  const part2 = uint8Array
    .subarray(delimiterPositions[0] + BUNDLE_DELIMITER.length, delimiterPositions[1])
    .slice().buffer;
  const part3 = uint8Array.subarray(delimiterPositions[1] + BUNDLE_DELIMITER.length).slice().buffer;

  // Validate parquet magic for each part before parsing
  assertValidParquetMagic(part1);
  assertValidParquetMagic(part2);
  assertValidParquetMagic(part3);

  const [selectedAnnotationsData, projectionsMetadataData, projectionsData] = await Promise.all([
    parquetReadObjects({ file: part1 }),
    parquetReadObjects({ file: part2 }),
    parquetReadObjects({ file: part3 }),
  ]);

  const mergedRows = mergeProjectionsWithAnnotations(projectionsData, selectedAnnotationsData);

  // Validate merged rows for expected bundle shape
  validateMergedBundleRows(mergedRows);

  return { rows: mergedRows, projectionsMetadata: projectionsMetadataData };
}

export function mergeProjectionsWithAnnotations(
  projectionsData: Rows,
  annotationsData: Rows,
): Rows {
  // Build map of annotations keyed by protein id
  const annotationIdColumn = findColumn(
    annotationsData.length > 0 ? Object.keys(annotationsData[0]) : [],
    ['protein_id', 'identifier', 'id', 'uniprot', 'entry'],
  );

  const finalAnnotationIdColumn =
    annotationIdColumn ||
    (annotationsData.length > 0 ? Object.keys(annotationsData[0])[0] : undefined);

  const annotationsMap = new Map<string, GenericRow>();
  if (finalAnnotationIdColumn) {
    for (const annotation of annotationsData) {
      const proteinId = annotation[finalAnnotationIdColumn];
      if (proteinId != null) {
        annotationsMap.set(String(proteinId), annotation);
      }
    }
  }

  const projectionIdColumn = findColumn(
    projectionsData.length > 0 ? Object.keys(projectionsData[0]) : [],
    ['identifier', 'protein_id', 'id', 'uniprot', 'entry'],
  );

  if (!projectionIdColumn) {
    return projectionsData;
  }

  const merged: Rows = new Array(projectionsData.length);
  for (let i = 0; i < projectionsData.length; i++) {
    const projection = projectionsData[i];
    const proteinId = projection[projectionIdColumn];
    const annotation = proteinId != null ? annotationsMap.get(String(proteinId)) : undefined;
    merged[i] = annotation ? { ...projection, ...annotation } : { ...projection };
  }

  return merged;
}

export function findColumn(columnNames: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const found = columnNames.find((col) => col.toLowerCase().includes(candidate.toLowerCase()));
    if (found) return found;
  }
  return null;
}
