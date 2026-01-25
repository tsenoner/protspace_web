import { parquetReadObjects } from 'hyparquet';
import {
  BUNDLE_DELIMITER_BYTES,
  findBundleDelimiterPositions,
  isParquetBundle,
  isValidBundleSettings,
  type BundleSettings,
  type LegendPersistedSettings,
} from '@protspace/utils';
import type { Rows, GenericRow } from './types';
import { assertValidParquetMagic, validateMergedBundleRows } from './validation';

// Re-export for consumers
export type { BundleSettings, LegendPersistedSettings };
export { isParquetBundle, findBundleDelimiterPositions };

/**
 * Result of extracting data from a parquetbundle.
 */
export interface BundleExtractionResult {
  rows: Rows;
  projectionsMetadata: Rows;
  /** Settings loaded from bundle (null if not present) */
  settings: BundleSettings | null;
}

/**
 * Extract rows and optional settings from a parquetbundle.
 *
 * Supports two formats:
 * - 2 delimiters (3 parts): Original format without settings
 * - 3 delimiters (4 parts): Extended format with settings
 */
export async function extractRowsFromParquetBundle(
  arrayBuffer: ArrayBuffer,
): Promise<BundleExtractionResult> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const delimiterPositions = findBundleDelimiterPositions(uint8Array);

  // Support both 2 delimiters (original) and 3 delimiters (with settings)
  if (delimiterPositions.length !== 2 && delimiterPositions.length !== 3) {
    throw new Error(
      `Expected 2 or 3 delimiters in parquetbundle, found ${delimiterPositions.length}`,
    );
  }

  const hasSettingsPart = delimiterPositions.length === 3;

  // Extract the three required parts
  const part1 = uint8Array.subarray(0, delimiterPositions[0]).slice().buffer;
  const part2 = uint8Array
    .subarray(delimiterPositions[0] + BUNDLE_DELIMITER_BYTES.length, delimiterPositions[1])
    .slice().buffer;

  let part3: ArrayBuffer;
  let part4: ArrayBuffer | null = null;

  if (hasSettingsPart) {
    part3 = uint8Array
      .subarray(delimiterPositions[1] + BUNDLE_DELIMITER_BYTES.length, delimiterPositions[2])
      .slice().buffer;
    part4 = uint8Array
      .subarray(delimiterPositions[2] + BUNDLE_DELIMITER_BYTES.length)
      .slice().buffer;
  } else {
    part3 = uint8Array
      .subarray(delimiterPositions[1] + BUNDLE_DELIMITER_BYTES.length)
      .slice().buffer;
  }

  // Validate parquet magic for each part before parsing
  assertValidParquetMagic(part1);
  assertValidParquetMagic(part2);
  assertValidParquetMagic(part3);

  // Parse the three required parts
  const [selectedAnnotationsData, projectionsMetadataData, projectionsData] = await Promise.all([
    parquetReadObjects({ file: part1 }),
    parquetReadObjects({ file: part2 }),
    parquetReadObjects({ file: part3 }),
  ]);

  // Parse settings if present
  let settings: BundleSettings | null = null;
  if (part4) {
    settings = await extractSettings(part4);
  }

  const mergedRows = mergeProjectionsWithAnnotations(projectionsData, selectedAnnotationsData);

  // Validate merged rows for expected bundle shape
  validateMergedBundleRows(mergedRows);

  return {
    rows: mergedRows,
    projectionsMetadata: projectionsMetadataData,
    settings,
  };
}

/**
 * Extract and parse settings from the 4th part of the bundle.
 * Returns null if parsing fails (graceful degradation).
 */
async function extractSettings(settingsBuffer: ArrayBuffer): Promise<BundleSettings | null> {
  try {
    // Validate parquet magic
    assertValidParquetMagic(settingsBuffer);

    const settingsData = await parquetReadObjects({ file: settingsBuffer });

    if (!settingsData || settingsData.length === 0) {
      console.warn('Settings parquet is empty, using defaults');
      return null;
    }

    // Extract the settings_json column from the first row
    const firstRow = settingsData[0] as { settings_json?: string };
    const settingsJson = firstRow.settings_json;

    if (typeof settingsJson !== 'string') {
      console.warn('Settings JSON is not a string, using defaults');
      return null;
    }

    const parsed = JSON.parse(settingsJson);

    // Validate structure using schema validation
    if (!isValidBundleSettings(parsed)) {
      console.warn('Settings JSON does not match expected schema, using defaults');
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse settings from bundle, using defaults:', error);
    return null;
  }
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
