import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  convertParquetToVisualizationData,
  convertParquetToVisualizationDataOptimized,
} from './conversion';
import { extractRowsFromParquetBundle } from './bundle';

async function loadFixtureVisualizationData(fixtureName: string) {
  const filePath = resolve(__dirname, '../../../../../../app/tests/fixtures', fixtureName);
  const fileBuffer = readFileSync(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  );

  const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);
  return convertParquetToVisualizationData(rows, projectionsMetadata ?? undefined);
}

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

  it('treats NaN and Infinity strings as missing values, preserving numeric inference', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: '1', family: 'A' },
      { identifier: 'P2', x: 1, y: 1, length: 'NaN', family: 'B' },
      { identifier: 'P3', x: 2, y: 2, length: 'Infinity', family: 'A' },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.annotations.length.numericType).toBe('int');
    expect(result.numeric_annotation_data?.length).toEqual([1, null, null]);
    expect(result.annotation_data.length).toBeUndefined();
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

  it('classifies all annotated data_custom edge cases deterministically', async () => {
    const result = await loadFixtureVisualizationData('data_custom.parquetbundle');
    const expectedIntAnnotations = [
      'num_sequential',
      'num_negative_mixed',
      'num_8_distinct_dense',
      'num_zero_padded',
      'num_all_negative',
      'cat_5_distinct_int',
      'cat_7_distinct_int',
      'cat_binary_01',
      'cat_sparse_int',
      'cat_all_same_number',
      'cat_large_ints',
      'edge_all_zeros',
      'edge_density_boundary',
      'edge_density_below',
      'cat_nan_inf_strings',
    ];
    const expectedFloatAnnotations = [
      'num_random_float',
      'num_mixed_int_float',
      'num_narrow_float',
      'cat_high_precision_float',
      'cat_wide_range_float',
      'edge_single_float',
      'cat_with_nan_strings',
      'edge_few_nan_many_numbers',
    ];
    const expectedStringAnnotations = [
      'cat_mixed_str_num',
      'cat_numbers_with_units',
      'cat_percentages',
      'cat_comma_thousands',
      'cat_pipe_delimited',
      'cat_semicolon_delimited',
      'edge_all_nan',
    ];
    const expectedAnnotationNames = [
      ...expectedIntAnnotations,
      ...expectedFloatAnnotations,
      ...expectedStringAnnotations,
    ].sort();

    expect(Object.keys(result.annotations).sort()).toEqual(expectedAnnotationNames);

    for (const columnName of expectedIntAnnotations) {
      const annotation = result.annotations[columnName];

      expect(annotation).toBeDefined();
      expect(annotation.kind).toBe('numeric');
      expect(annotation.numericType).toBe('int');
      expect(result.numeric_annotation_data).toBeDefined();
      expect(result.numeric_annotation_data?.[columnName]).toBeDefined();
      expect(result.numeric_annotation_data?.[columnName]).toHaveLength(result.protein_ids.length);
      expect(result.annotation_data[columnName]).toBeUndefined();
    }

    for (const columnName of expectedFloatAnnotations) {
      const annotation = result.annotations[columnName];

      expect(annotation).toBeDefined();
      expect(annotation.kind).toBe('numeric');
      expect(annotation.numericType).toBe('float');
      expect(result.numeric_annotation_data).toBeDefined();
      expect(result.numeric_annotation_data?.[columnName]).toBeDefined();
      expect(result.numeric_annotation_data?.[columnName]).toHaveLength(result.protein_ids.length);
      expect(result.annotation_data[columnName]).toBeUndefined();
    }

    expect(result.numeric_annotation_data?.num_sequential?.slice(0, 8)).toEqual([
      1, 2, 714, 3, 4, 1321, 1322, 1323,
    ]);
    expect(result.numeric_annotation_data?.num_random_float?.[0]).toBeCloseTo(63.94);
    expect(result.numeric_annotation_data?.num_random_float?.[1]).toBeCloseTo(2.5);
    expect(result.numeric_annotation_data?.num_random_float?.[2]).toBeCloseTo(50.05);

    for (const columnName of expectedStringAnnotations) {
      const annotation = result.annotations[columnName];

      expect(annotation).toBeDefined();
      expect(annotation.kind).toBe('categorical');
      expect(annotation.numericType).toBeUndefined();
      expect(result.numeric_annotation_data?.[columnName]).toBeUndefined();
      expect(result.annotation_data[columnName]).toBeDefined();
    }
  });

  it('detects length as numeric in the raw phosphatase fixture', async () => {
    const result = await loadFixtureVisualizationData('phosphatase_no_binning.parquetbundle');

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.annotations.length.numericType).toBe('int');
    expect(result.numeric_annotation_data?.length?.some((value) => typeof value === 'number')).toBe(
      true,
    );
  });

  it('treats NA, N/A, null, and none strings as missing values in numeric columns', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, score: 1.5 },
      { identifier: 'P2', x: 1, y: 1, score: 'NA' },
      { identifier: 'P3', x: 2, y: 2, score: 2.5 },
      { identifier: 'P4', x: 3, y: 3, score: 'N/A' },
      { identifier: 'P5', x: 4, y: 4, score: 'null' },
      { identifier: 'P6', x: 5, y: 5, score: 'none' },
    ]);

    expect(result.annotations.score.kind).toBe('numeric');
    expect(result.annotations.score.numericType).toBe('float');
    expect(result.numeric_annotation_data?.score).toEqual([1.5, null, 2.5, null, null, null]);
  });

  it('treats dash and dot as missing values in numeric columns', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, length: 100 },
      { identifier: 'P2', x: 1, y: 1, length: '-' },
      { identifier: 'P3', x: 2, y: 2, length: '.' },
      { identifier: 'P4', x: 3, y: 3, length: 200 },
    ]);

    expect(result.annotations.length.kind).toBe('numeric');
    expect(result.annotations.length.numericType).toBe('int');
    expect(result.numeric_annotation_data?.length).toEqual([100, null, null, 200]);
  });

  it('treats numeric NaN and Infinity values as missing', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, val: 10 },
      { identifier: 'P2', x: 1, y: 1, val: NaN },
      { identifier: 'P3', x: 2, y: 2, val: Infinity },
      { identifier: 'P4', x: 3, y: 3, val: 20 },
    ]);

    expect(result.annotations.val.kind).toBe('numeric');
    expect(result.annotations.val.numericType).toBe('int');
    expect(result.numeric_annotation_data?.val).toEqual([10, null, null, 20]);
  });

  it('falls back to categorical when ALL values are missing markers', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, score: 'NaN' },
      { identifier: 'P2', x: 1, y: 1, score: 'NA' },
      { identifier: 'P3', x: 2, y: 2, score: null },
    ]);

    expect(result.annotations.score.kind).toBe('categorical');
  });

  it('still falls back to categorical for non-missing non-numeric strings', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, label: '1' },
      { identifier: 'P2', x: 1, y: 1, label: 'alpha' },
      { identifier: 'P3', x: 2, y: 2, label: '3' },
    ]);

    expect(result.annotations.label.kind).toBe('categorical');
  });

  it('handles case-insensitive missing value markers', () => {
    const result = convertParquetToVisualizationData([
      { identifier: 'P1', x: 0, y: 0, val: 5 },
      { identifier: 'P2', x: 1, y: 1, val: 'nan' },
      { identifier: 'P3', x: 2, y: 2, val: 'NAN' },
      { identifier: 'P4', x: 3, y: 3, val: 'None' },
      { identifier: 'P5', x: 4, y: 4, val: 'NONE' },
      { identifier: 'P6', x: 5, y: 5, val: 10 },
    ]);

    expect(result.annotations.val.kind).toBe('numeric');
    expect(result.annotations.val.numericType).toBe('int');
    expect(result.numeric_annotation_data?.val).toEqual([5, null, null, null, null, 10]);
  });
});
