import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  convertParquetToVisualizationData,
  convertParquetToVisualizationDataOptimized,
} from './conversion';
import { extractRowsFromParquetBundle } from './bundle';

describe('convertParquetToVisualizationData numeric annotations', () => {
  it('detects scalar numeric annotations and preserves raw values', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: 100, family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: 200, family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: null, family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.numeric_annotation_data?.length).toEqual([100, 200, null]);
    expect(result.annotation_data.length).toBeUndefined();
    expect(result.annotations.family.kind).toBe('categorical');
  });

  it('keeps multi-value and scored annotations categorical', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, keyword: 'A;B', score: 'GO:1|0.5' },
      { identifier: 'P2', x: 1, y: 1, keyword: 'B', score: 'GO:2|0.1' },
    ]);

    expect(result.annotations.keyword.kind).toBe('categorical');
    expect(result.annotations.score.kind).toBe('categorical');
    expect(result.numeric_annotation_data?.keyword).toBeUndefined();
    expect(result.numeric_annotation_data?.score).toBeUndefined();
  });

  it('keeps numeric-looking string labels categorical', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, cluster_id: '101', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, cluster_id: '203', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, cluster_id: '101', family: 'A' },
    ]);

    expect(result.annotations.cluster_id.kind).toBe('categorical');
    expect(result.numeric_annotation_data?.cluster_id).toBeUndefined();
    expect(result.annotation_data.cluster_id).toEqual([[0], [1], [0]]);
  });

  it('keeps sparse integer-like string columns categorical', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '101', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: '203', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '305', family: 'A' },
      { identifier: 'P4', x: 3, y: 3, length: '407', family: 'B' },
      { identifier: 'P5', x: 4, y: 4, length: '509', family: 'A' },
      { identifier: 'P6', x: 5, y: 5, length: '611', family: 'B' },
      { identifier: 'P7', x: 6, y: 6, length: '713', family: 'A' },
      { identifier: 'P8', x: 7, y: 7, length: '815', family: 'B' },
      { identifier: 'P9', x: 8, y: 8, length: null, family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('categorical');
    expect(result.numeric_annotation_data?.length).toBeUndefined();
    expect(result.annotation_data.length).toBeDefined();
  });

  it('keeps small dense integer-like string columns categorical', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '1', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: '2', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '3', family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('categorical');
    expect(result.numeric_annotation_data?.length).toBeUndefined();
    expect(result.annotation_data.length).toEqual([[0], [1], [2]]);
  });

  it('keeps sparse fractional string labels categorical', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '1.0', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: '2.0', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '5.0', family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('categorical');
    expect(result.numeric_annotation_data?.length).toBeUndefined();
    expect(result.annotation_data.length).toEqual([[0], [1], [2]]);
  });

  it('detects dense integer-like string columns as numeric', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '101', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: '102', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '103', family: 'A' },
      { identifier: 'P4', x: 3, y: 3, length: '104', family: 'B' },
      { identifier: 'P5', x: 4, y: 4, length: '105', family: 'A' },
      { identifier: 'P6', x: 5, y: 5, length: '106', family: 'B' },
      { identifier: 'P7', x: 6, y: 6, length: '107', family: 'A' },
      { identifier: 'P8', x: 7, y: 7, length: '108', family: 'B' },
      { identifier: 'P9', x: 8, y: 8, length: null, family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.numeric_annotation_data?.length).toEqual([
      101,
      102,
      103,
      104,
      105,
      106,
      107,
      108,
      null,
    ]);
    expect(result.annotation_data.length).toBeUndefined();
  });

  it('detects sufficiently varied fractional string columns as numeric', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '1.1', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: '2.2', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '3.3', family: 'A' },
      { identifier: 'P4', x: 3, y: 3, length: '4.4', family: 'B' },
      { identifier: 'P5', x: 4, y: 4, length: '5.5', family: 'A' },
      { identifier: 'P6', x: 5, y: 5, length: '6.6', family: 'B' },
      { identifier: 'P7', x: 6, y: 6, length: '7.7', family: 'A' },
      { identifier: 'P8', x: 7, y: 7, length: '8.8', family: 'B' },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.numeric_annotation_data?.length).toEqual([
      1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8,
    ]);
    expect(result.annotation_data.length).toBeUndefined();
  });

  it('detects raw numeric annotations in bundle-format rows', () => {
    const result = convertParquetToVisualizationData(
      [
        { projection_name: 'UMAP', identifier: 'P1', x: 0, y: 0, length: 100, family: 'A' },
        { projection_name: 'UMAP', identifier: 'P2', x: 1, y: 1, length: 200, family: 'B' },
        { projection_name: 'UMAP', identifier: 'P3', x: 2, y: 2, length: null, family: 'A' },
      ],
      [{ projection_name: 'UMAP', dimensions: 2 }],
    );

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.numeric_annotation_data?.length).toEqual([100, 200, null]);
    expect(result.annotation_data.length).toBeUndefined();
    expect(result.annotations.family.kind).toBe('categorical');
    expect(result.projections).toHaveLength(1);
  });

  it('preserves numeric annotations in the optimized large-dataset path', async () => {
    const rows = Array.from({ length: 10001 }, (_, index) => ({
      projection_name: 'UMAP',
      identifier: `P${index}`,
      x: index,
      y: index / 2,
      length: index + 1,
      family: index % 2 === 0 ? 'A' : 'B',
    }));

    const result = await convertParquetToVisualizationDataOptimized(rows, [
      { projection_name: 'UMAP', dimensions: 2 },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.numeric_annotation_data?.length?.[0]).toBe(1);
    expect(result.numeric_annotation_data?.length?.[10000]).toBe(10001);
    expect(result.annotation_data.length).toBeUndefined();
    expect(result.protein_ids).toHaveLength(10001);
  });

  it('detects length as numeric in the raw phosphatase fixture', async () => {
    const filePath = resolve(
      __dirname,
      '../../../../../../app/tests/fixtures/phosphatase_no_binning.parquetbundle',
    );
    const fileBuffer = readFileSync(filePath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    );

    const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);
    const result = convertParquetToVisualizationData(rows, projectionsMetadata ?? undefined);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.numeric_annotation_data?.length?.some((value) => typeof value === 'number')).toBe(
      true,
    );
  });
});
