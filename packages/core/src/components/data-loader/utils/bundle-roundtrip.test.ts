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

describe('metadata preservation through round-trip', () => {
  /**
   * Helper to normalize metadata for comparison.
   * Removes internal fields that are expected to differ (dimensions vs dimension).
   */
  function normalizeMetadata(metadata: Record<string, unknown> | undefined) {
    if (!metadata) return {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dimension, dimensions, ...rest } = metadata;
    return rest;
  }

  it('should preserve projection metadata fields through export/import cycle (5K)', async () => {
    const filePath = resolve(__dirname, '../../../../../../data/5K.parquetbundle');
    const buffer = readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    // Load original
    const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);
    const original = convertParquetToVisualizationData(rows, projectionsMetadata);

    // Export (without settings)
    const exportedBuffer = createParquetBundle(original);

    // Re-import
    const { rows: rows2, projectionsMetadata: meta2 } =
      await extractRowsFromParquetBundle(exportedBuffer);
    const reimported = convertParquetToVisualizationData(rows2, meta2);

    // 1. Protein IDs must be identical
    expect(reimported.protein_ids).toEqual(original.protein_ids);

    // 2. Projections count must match
    expect(reimported.projections.length).toBe(original.projections.length);

    // 3. Each projection must match
    for (let i = 0; i < original.projections.length; i++) {
      const origProj = original.projections[i];
      const reimportedProj = reimported.projections[i];

      // Name must match
      expect(reimportedProj.name).toBe(origProj.name);

      // Coordinates must be identical
      expect(reimportedProj.data).toEqual(origProj.data);

      // Metadata fields must match (excluding dimension/dimensions)
      const origMeta = normalizeMetadata(origProj.metadata);
      const reimportedMeta = normalizeMetadata(reimportedProj.metadata);
      expect(reimportedMeta).toEqual(origMeta);
    }

    // 4. Annotation names must be identical
    expect(Object.keys(reimported.annotations).sort()).toEqual(
      Object.keys(original.annotations).sort(),
    );
  });

  it('should preserve projection metadata fields through export/import cycle (40K)', async () => {
    const filePath = resolve(__dirname, '../../../../../../data/40K.parquetbundle');
    const buffer = readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    // Load original
    const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);
    const original = convertParquetToVisualizationData(rows, projectionsMetadata);

    // Export (without settings)
    const exportedBuffer = createParquetBundle(original);

    // Re-import
    const { rows: rows2, projectionsMetadata: meta2 } =
      await extractRowsFromParquetBundle(exportedBuffer);
    const reimported = convertParquetToVisualizationData(rows2, meta2);

    // Verify protein_ids
    expect(reimported.protein_ids).toEqual(original.protein_ids);

    // Verify projections
    expect(reimported.projections.length).toBe(original.projections.length);
    for (let i = 0; i < original.projections.length; i++) {
      const origProj = original.projections[i];
      const reimportedProj = reimported.projections[i];
      expect(reimportedProj.name).toBe(origProj.name);
      expect(reimportedProj.data).toEqual(origProj.data);

      const origMeta = normalizeMetadata(origProj.metadata);
      const reimportedMeta = normalizeMetadata(reimportedProj.metadata);
      expect(reimportedMeta).toEqual(origMeta);
    }

    // Verify annotation names
    expect(Object.keys(reimported.annotations).sort()).toEqual(
      Object.keys(original.annotations).sort(),
    );
  });

  it('should preserve projection metadata fields (n_components, svd_solver, etc.)', async () => {
    const filePath = resolve(__dirname, '../../../../../../data/5K.parquetbundle');
    const buffer = readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    // Load original
    const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);
    const original = convertParquetToVisualizationData(rows, projectionsMetadata);

    // Get first projection's metadata
    const origMeta = original.projections[0]?.metadata || {};

    // Should have actual metadata fields, not info_json
    expect(origMeta).not.toHaveProperty('info_json');

    // Common PCA metadata fields should exist at top level
    if (origMeta.n_components !== undefined) {
      expect(typeof origMeta.n_components).toBe('number');
    }
    if (origMeta.svd_solver !== undefined) {
      expect(typeof origMeta.svd_solver).toBe('string');
    }
    if (origMeta.explained_variance_ratio !== undefined) {
      expect(Array.isArray(origMeta.explained_variance_ratio)).toBe(true);
    }

    // Export and re-import
    const exportedBuffer = createParquetBundle(original);
    const { rows: rows2, projectionsMetadata: meta2 } =
      await extractRowsFromParquetBundle(exportedBuffer);
    const reimported = convertParquetToVisualizationData(rows2, meta2);

    // Re-imported should NOT have info_json at top level
    const reimportedMeta = reimported.projections[0]?.metadata || {};
    expect(reimportedMeta).not.toHaveProperty('info_json');

    // All original metadata fields should be preserved
    for (const [key, value] of Object.entries(origMeta)) {
      if (key !== 'dimension' && key !== 'dimensions') {
        expect(reimportedMeta[key]).toEqual(value);
      }
    }
  });
});
