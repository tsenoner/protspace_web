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
    expect(result.annotations.length.numericType).toBe('int');
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

  it('detects integer strings as int numeric annotations', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, cluster_id: '101', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, cluster_id: '203', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, cluster_id: '101', family: 'A' },
    ]);

    expect(result.annotations.cluster_id.kind).toBe('numeric');
    expect(result.annotations.cluster_id.numericType).toBe('int');
    expect(result.numeric_annotation_data?.cluster_id).toEqual([101, 203, 101]);
    expect(result.annotation_data.cluster_id).toBeUndefined();
  });

  it('detects fractional strings as float numeric annotations', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '1.1', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: '2.2', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '3.3', family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.annotations.length.numericType).toBe('float');
    expect(result.numeric_annotation_data?.length).toEqual([1.1, 2.2, 3.3]);
    expect(result.annotation_data.length).toBeUndefined();
  });

  it('detects mixed integer and fractional values as float numeric annotations', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '1', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: 2, family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '3.5', family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.annotations.length.numericType).toBe('float');
    expect(result.numeric_annotation_data?.length).toEqual([1, 2, 3.5]);
    expect(result.annotation_data.length).toBeUndefined();
  });

  it('ignores null, undefined, and trimmed empty strings during inference', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: null, family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: undefined, family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '   ', family: 'A' },
      { identifier: 'P4', x: 3, y: 3, length: '4', family: 'B' },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.annotations.length.numericType).toBe('int');
    expect(result.numeric_annotation_data?.length).toEqual([null, null, null, 4]);
    expect(result.annotation_data.length).toBeUndefined();
  });

  it('falls back to empty categorical rows when every value is null, undefined, or empty', async () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: null, family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: undefined, family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: '   ', family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('categorical');
    expect(result.annotations.length.numericType).toBeUndefined();
    expect(result.numeric_annotation_data?.length).toBeUndefined();
    expect(result.annotation_data.length).toBeDefined();
    expect(result.annotation_data.length).toEqual([[], [], []]);

    const bundleResult = convertParquetToVisualizationData(
      [
        { projection_name: 'UMAP', identifier: 'P1', x: 0, y: 0, length: null },
        { projection_name: 'UMAP', identifier: 'P2', x: 1, y: 1, length: undefined },
        { projection_name: 'UMAP', identifier: 'P3', x: 2, y: 2, length: '   ' },
      ],
      [{ projection_name: 'UMAP', dimensions: 2 }],
    );

    expect(bundleResult.annotations.length.kind).toBe('categorical');
    expect(bundleResult.numeric_annotation_data?.length).toBeUndefined();
    expect(bundleResult.annotation_data.length).toEqual([[], [], []]);

    const optimizedRows = Array.from({ length: 10000 }, (_, index) => {
      const proteinIndex = index % 3;
      const values = [null, undefined, '   '];
      return {
        projection_name: 'UMAP',
        identifier: `P${proteinIndex + 1}`,
        x: index,
        y: index,
        length: values[proteinIndex],
      };
    });
    const optimizedResult = await convertParquetToVisualizationDataOptimized(optimizedRows, [
      { projection_name: 'UMAP', dimensions: 2 },
    ]);

    expect(optimizedResult.annotations.length.kind).toBe('categorical');
    expect(optimizedResult.numeric_annotation_data?.length).toBeUndefined();
    expect(optimizedResult.annotation_data.length).toEqual([[], [], []]);
  });

  it('falls back to categorical for nonnumeric and special numeric strings', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '1', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: 'NaN', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: 'Infinity', family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('categorical');
    expect(result.annotations.length.numericType).toBeUndefined();
    expect(result.numeric_annotation_data?.length).toBeUndefined();
    expect(result.annotation_data.length).toBeDefined();
  });

  it('falls back to categorical for semicolon and pipe-delimited strings', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, semicolon_values: '1;2', pipe_values: '1|2' },
      { identifier: 'P2', x: 1, y: 1, semicolon_values: '3', pipe_values: '4' },
    ]);

    expect(result.annotations.semicolon_values.kind).toBe('categorical');
    expect(result.annotations.pipe_values.kind).toBe('categorical');
    expect(result.numeric_annotation_data?.semicolon_values).toBeUndefined();
    expect(result.numeric_annotation_data?.pipe_values).toBeUndefined();
    expect(result.annotation_data.semicolon_values).toBeDefined();
    expect(result.annotation_data.pipe_values).toBeDefined();
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
    expect(result.annotations.length.numericType).toBe('int');
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
    expect(result.annotations.length.numericType).toBe('int');
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
    expect(result.annotations.length.numericType).toBe('int');
    expect(result.numeric_annotation_data?.length?.some((value) => typeof value === 'number')).toBe(
      true,
    );
  });
});
