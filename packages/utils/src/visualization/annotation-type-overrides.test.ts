import { describe, expect, it } from 'vitest';
import { applyAnnotationTypeOverrides } from './annotation-type-overrides';
import type { VisualizationData } from '../types';

function createData(): VisualizationData {
  return {
    protein_ids: ['P1', 'P2', 'P3'],
    projections: [
      {
        name: 'UMAP',
        data: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      },
    ],
    annotations: {
      score: {
        kind: 'categorical',
        values: ['1.5', '2.5'],
        colors: ['#111', '#222'],
        shapes: ['circle', 'circle'],
      },
      family: {
        kind: 'categorical',
        values: ['A', 'B'],
        colors: ['#333', '#444'],
        shapes: ['circle', 'circle'],
      },
      length: { kind: 'numeric', numericType: 'int', values: [], colors: [], shapes: [] },
    },
    annotation_data: {
      score: [[0], [1], []],
      family: [[0], [1], [0]],
    },
    numeric_annotation_data: {
      length: [1000, 2000, null],
    },
  };
}

describe('applyAnnotationTypeOverrides', () => {
  it('converts a single-value numeric-looking categorical annotation to numeric', () => {
    const input = createData();
    const result = applyAnnotationTypeOverrides(input, { score: 'numeric' });

    expect(result.errors).toEqual([]);
    expect(result.data.annotations.score.kind).toBe('numeric');
    expect(result.data.annotations.score.numericType).toBe('float');
    expect(result.data.numeric_annotation_data?.score).toEqual([1.5, 2.5, null]);
    expect(result.data.annotation_data.score).toBeUndefined();
    expect(input.annotations.score.kind).toBe('categorical');
    expect(input.annotation_data.score).toEqual([[0], [1], []]);
  });

  it('rejects numeric override when categorical values are nonnumeric', () => {
    const result = applyAnnotationTypeOverrides(createData(), { family: 'numeric' });

    expect(result.errors).toEqual([
      {
        annotation: 'family',
        message:
          'Cannot treat family as numeric because at least one non-empty value is nonnumeric.',
      },
    ]);
    expect(result.data.annotations.family.kind).toBe('categorical');
    expect(result.data.annotation_data.family).toEqual([[0], [1], [0]]);
  });

  it('converts a numeric annotation to categorical strings', () => {
    const result = applyAnnotationTypeOverrides(createData(), { length: 'string' });

    expect(result.errors).toEqual([]);
    expect(result.data.annotations.length.kind).toBe('categorical');
    expect(result.data.annotations.length.numericType).toBeUndefined();
    expect(result.data.numeric_annotation_data?.length).toBeUndefined();
    expect(result.data.annotations.length.values).toEqual(['1000', '2000']);
    expect(result.data.annotation_data.length).toEqual([[0], [1], []]);
  });
});
