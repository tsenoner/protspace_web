import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractRowsFromParquetBundle } from './bundle';
import { convertParquetToVisualizationData } from './conversion';
import { createParquetBundle, countBundleDelimiters, isParquetBundle } from '@protspace/utils';

/**
 * Round-trip integration tests for parquetbundle files.
 * These tests verify that we can:
 * 1. Read existing parquetbundle files
 * 2. Convert them to VisualizationData
 * 3. Export them back to parquetbundle format without errors
 *
 * This specifically tests that BigInt values from parquet parsing
 * are properly handled and don't cause JSON serialization errors.
 */
describe('round-trip with real data files', () => {
  it('should successfully export 5K.parquetbundle after loading', async () => {
    const filePath = resolve(__dirname, '../../../../../../data/5K.parquetbundle');
    const buffer = readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    // Extract rows from the bundle
    const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);

    // Convert to VisualizationData
    const data = convertParquetToVisualizationData(rows, projectionsMetadata);

    // Verify data was loaded correctly
    expect(data.protein_ids.length).toBeGreaterThan(0);
    expect(data.projections.length).toBeGreaterThan(0);

    // This should not throw "Do not know how to serialize a BigInt"
    const exportedBuffer = createParquetBundle(data);
    expect(exportedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(exportedBuffer.byteLength).toBeGreaterThan(0);
    expect(isParquetBundle(exportedBuffer)).toBe(true);
  });

  it('should successfully export 40K.parquetbundle after loading', async () => {
    const filePath = resolve(__dirname, '../../../../../../data/40K.parquetbundle');
    const buffer = readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    // Extract rows from the bundle
    const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);

    // Convert to VisualizationData
    const data = convertParquetToVisualizationData(rows, projectionsMetadata);

    // Verify data was loaded correctly
    expect(data.protein_ids.length).toBeGreaterThan(0);
    expect(data.projections.length).toBeGreaterThan(0);

    // This should not throw "Do not know how to serialize a BigInt"
    const exportedBuffer = createParquetBundle(data);
    expect(exportedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(exportedBuffer.byteLength).toBeGreaterThan(0);
    expect(isParquetBundle(exportedBuffer)).toBe(true);
  });

  it('should successfully export with settings after loading 5K.parquetbundle', async () => {
    const filePath = resolve(__dirname, '../../../../../../data/5K.parquetbundle');
    const buffer = readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    // Extract rows from the bundle
    const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);

    // Convert to VisualizationData
    const data = convertParquetToVisualizationData(rows, projectionsMetadata);

    // Create mock settings
    const mockSettings = {
      testAnnotation: {
        maxVisibleValues: 10,
        includeShapes: true,
        shapeSize: 24,
        sortMode: 'size-desc' as const,
        hiddenValues: [],
        categories: {
          category1: { zOrder: 0, color: '#ff0000', shape: 'circle' },
        },
        enableDuplicateStackUI: false,
      },
    };

    // Export with settings - should not throw
    const exportedBuffer = createParquetBundle(data, {
      includeSettings: true,
      settings: mockSettings,
    });

    expect(exportedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(exportedBuffer.byteLength).toBeGreaterThan(0);
    expect(isParquetBundle(exportedBuffer)).toBe(true);

    // Count delimiters - should be 3 for 4-part bundle with settings
    const uint8Array = new Uint8Array(exportedBuffer);
    const delimiterCount = countBundleDelimiters(uint8Array);
    expect(delimiterCount).toBe(3);
  });
});
