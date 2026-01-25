/**
 * Bundle writer utilities for creating .parquetbundle files with optional settings.
 *
 * Bundle format:
 * - Part 1: selected_annotations.parquet (identifier + annotation columns)
 * - Delimiter: ---PARQUET_DELIMITER---
 * - Part 2: projections_metadata.parquet (projection_name, dimensions, info_json)
 * - Delimiter: ---PARQUET_DELIMITER---
 * - Part 3: projections_data.parquet (projection_name, identifier, x, y, z)
 * - Delimiter: ---PARQUET_DELIMITER--- (optional, only if settings included)
 * - Part 4: settings.parquet (optional, settings_json column)
 */

import { parquetWriteBuffer } from 'hyparquet-writer';
import type { VisualizationData, BundleSettings } from '../types';
import { BUNDLE_DELIMITER_BYTES } from './constants';
import { bigIntReplacer } from './bigint-utils';

/** Column data format for parquetWriteBuffer */
interface ColumnData {
  name: string;
  data: (string | number | boolean | null)[];
  type?: 'STRING' | 'INT32' | 'INT64' | 'DOUBLE' | 'FLOAT' | 'BOOLEAN';
}

/**
 * Create the annotations parquet buffer (Part 1).
 * Contains identifier column + all annotation columns.
 */
function createAnnotationsParquet(data: VisualizationData): ArrayBuffer {
  const columnData: ColumnData[] = [
    {
      name: 'identifier',
      data: data.protein_ids,
      type: 'STRING',
    },
  ];

  // Add annotation columns
  for (const [annotationName, annotation] of Object.entries(data.annotations)) {
    const annotationIndices = data.annotation_data[annotationName];
    if (!annotationIndices) continue;

    // Convert indices back to actual annotation values
    const values: (string | null)[] = new Array(data.protein_ids.length);
    for (let i = 0; i < data.protein_ids.length; i++) {
      const indices = annotationIndices[i];
      if (indices && indices.length > 0) {
        // Take first annotation value (primary)
        const idx = indices[0];
        values[i] = annotation.values[idx] ?? null;
      } else {
        values[i] = null;
      }
    }

    columnData.push({
      name: annotationName,
      data: values,
      type: 'STRING',
    });
  }

  return parquetWriteBuffer({ columnData });
}

/**
 * Create the projections metadata parquet buffer (Part 2).
 * Contains projection_name, dimensions, info_json columns.
 */
function createProjectionsMetadataParquet(data: VisualizationData): ArrayBuffer {
  const projectionNames: string[] = [];
  const dimensions: number[] = [];
  const infoJsons: string[] = [];

  for (const projection of data.projections) {
    projectionNames.push(projection.name);
    const dim = projection.metadata?.dimension ?? (projection.data[0]?.length === 3 ? 3 : 2);
    dimensions.push(dim);
    infoJsons.push(JSON.stringify(projection.metadata ?? {}, bigIntReplacer));
  }

  const columnData: ColumnData[] = [
    { name: 'projection_name', data: projectionNames, type: 'STRING' },
    { name: 'dimensions', data: dimensions, type: 'INT32' },
    { name: 'info_json', data: infoJsons, type: 'STRING' },
  ];

  return parquetWriteBuffer({ columnData });
}

/**
 * Create the projections data parquet buffer (Part 3).
 * Contains projection_name, identifier, x, y, z columns.
 */
function createProjectionsDataParquet(data: VisualizationData): ArrayBuffer {
  // Calculate total rows: proteins * projections
  const totalRows = data.protein_ids.length * data.projections.length;

  const projectionNames: string[] = new Array(totalRows);
  const identifiers: string[] = new Array(totalRows);
  const xValues: number[] = new Array(totalRows);
  const yValues: number[] = new Array(totalRows);
  const zValues: (number | null)[] = new Array(totalRows);

  let rowIndex = 0;
  for (const projection of data.projections) {
    for (let i = 0; i < data.protein_ids.length; i++) {
      const point = projection.data[i];
      projectionNames[rowIndex] = projection.name;
      identifiers[rowIndex] = data.protein_ids[i];
      xValues[rowIndex] = point[0];
      yValues[rowIndex] = point[1];
      zValues[rowIndex] = point.length === 3 ? (point as [number, number, number])[2] : null;
      rowIndex++;
    }
  }

  const columnData: ColumnData[] = [
    { name: 'projection_name', data: projectionNames, type: 'STRING' },
    { name: 'identifier', data: identifiers, type: 'STRING' },
    { name: 'x', data: xValues, type: 'DOUBLE' },
    { name: 'y', data: yValues, type: 'DOUBLE' },
    { name: 'z', data: zValues, type: 'DOUBLE' },
  ];

  return parquetWriteBuffer({ columnData });
}

/**
 * Create the settings parquet buffer (Part 4 - optional).
 * Contains a single settings_json column with one row.
 */
function createSettingsParquet(settings: BundleSettings): ArrayBuffer {
  const columnData: ColumnData[] = [
    {
      name: 'settings_json',
      data: [JSON.stringify(settings, bigIntReplacer)],
      type: 'STRING',
    },
  ];

  return parquetWriteBuffer({ columnData });
}

/**
 * Concatenate multiple ArrayBuffers with delimiters.
 */
function concatenateBuffers(buffers: ArrayBuffer[], delimiter: Uint8Array): ArrayBuffer {
  // Calculate total size
  let totalSize = 0;
  for (let i = 0; i < buffers.length; i++) {
    totalSize += buffers[i].byteLength;
    if (i < buffers.length - 1) {
      totalSize += delimiter.length;
    }
  }

  // Create output buffer
  const result = new Uint8Array(totalSize);
  let offset = 0;

  for (let i = 0; i < buffers.length; i++) {
    result.set(new Uint8Array(buffers[i]), offset);
    offset += buffers[i].byteLength;

    if (i < buffers.length - 1) {
      result.set(delimiter, offset);
      offset += delimiter.length;
    }
  }

  return result.buffer;
}

export interface CreateBundleOptions {
  /** Include legend settings in the bundle (4-part format) */
  includeSettings?: boolean;
  /** Legend settings to include (required if includeSettings is true) */
  settings?: BundleSettings;
}

/**
 * Create a .parquetbundle ArrayBuffer from VisualizationData.
 *
 * @param data - The visualization data to export
 * @param options - Options for bundle creation
 * @returns ArrayBuffer containing the parquetbundle
 */
export function createParquetBundle(
  data: VisualizationData,
  options: CreateBundleOptions = {},
): ArrayBuffer {
  const { includeSettings = false, settings } = options;

  // Create the three required parts
  const annotationsBuffer = createAnnotationsParquet(data);
  const metadataBuffer = createProjectionsMetadataParquet(data);
  const projectionsBuffer = createProjectionsDataParquet(data);

  const buffers: ArrayBuffer[] = [annotationsBuffer, metadataBuffer, projectionsBuffer];

  // Optionally add settings as 4th part
  if (includeSettings && settings && Object.keys(settings).length > 0) {
    const settingsBuffer = createSettingsParquet(settings);
    buffers.push(settingsBuffer);
  }

  return concatenateBuffers(buffers, BUNDLE_DELIMITER_BYTES);
}

/**
 * Export a .parquetbundle file by triggering a download.
 *
 * @param data - The visualization data to export
 * @param filename - The filename for the download (should end in .parquetbundle)
 * @param options - Options for bundle creation
 */
export function exportParquetBundle(
  data: VisualizationData,
  filename: string,
  options: CreateBundleOptions = {},
): void {
  const buffer = createParquetBundle(data, options);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.parquetbundle') ? filename : `${filename}.parquetbundle`;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for the exported bundle.
 *
 * @param projectionName - The current projection name
 * @param includeSettings - Whether settings are included
 * @returns Generated filename
 */
export function generateBundleFilename(
  projectionName: string = 'data',
  includeSettings: boolean = false,
): string {
  const date = new Date().toISOString().split('T')[0];
  const cleanProjection = projectionName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const suffix = includeSettings ? '_with_settings' : '';
  return `protspace_${cleanProjection}${suffix}_${date}.parquetbundle`;
}
