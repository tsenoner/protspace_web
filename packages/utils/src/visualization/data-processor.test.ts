import { describe, it, expect } from 'vitest';
import { DataProcessor } from './data-processor';
import type { VisualizationData } from '../types';

describe('DataProcessor N/A normalization', () => {
  const makeData = (values: (string | null | undefined)[]): VisualizationData => ({
    protein_ids: values.map((_, i) => `p${i}`),
    projections: [{ name: 'test', data: values.map((_, i) => [i, i] as [number, number]) }],
    annotations: {
      species: {
        values: values as (string | null)[],
        colors: values.map(() => '#ccc'),
        shapes: values.map(() => 'circle'),
      },
    },
    annotation_data: { species: values.map((_, i) => [i]) },
  });

  it('should normalize null to __NA__', () => {
    const result = DataProcessor.processVisualizationData(makeData(['human', null]), 0);
    expect(result[0].annotationValues.species).toEqual(['human']);
    expect(result[1].annotationValues.species).toEqual(['__NA__']);
  });

  it('should normalize a single null value to __NA__', () => {
    const result = DataProcessor.processVisualizationData(makeData([null]), 0);
    expect(result[0].annotationValues.species).toEqual(['__NA__']);
  });

  it('should normalize undefined to __NA__', () => {
    const result = DataProcessor.processVisualizationData(makeData([undefined]), 0);
    expect(result[0].annotationValues.species).toEqual(['__NA__']);
  });

  it('should preserve non-null values unchanged', () => {
    const result = DataProcessor.processVisualizationData(makeData(['human', 'mouse']), 0);
    expect(result[0].annotationValues.species).toEqual(['human']);
    expect(result[1].annotationValues.species).toEqual(['mouse']);
  });

  it('should normalize out-of-bounds annotation index to __NA__', () => {
    const data: VisualizationData = {
      protein_ids: ['p1'],
      projections: [{ name: 'test', data: [[0, 0]] }],
      annotations: {
        species: { values: ['human'], colors: ['#f00'], shapes: ['circle'] },
      },
      annotation_data: { species: [[99]] }, // index 99 doesn't exist in values
    };
    const result = DataProcessor.processVisualizationData(data, 0);
    expect(result[0].annotationValues.species).toEqual(['__NA__']);
  });

  it('should return empty array when annotation_data is missing for a protein', () => {
    const data: VisualizationData = {
      protein_ids: ['p1'],
      projections: [{ name: 'test', data: [[0, 0]] }],
      annotations: {
        species: { values: ['human'], colors: ['#f00'], shapes: ['circle'] },
      },
      annotation_data: {}, // no species key
    };
    const result = DataProcessor.processVisualizationData(data, 0);
    expect(result[0].annotationValues.species).toEqual([]);
  });

  it('should handle multiple annotations with mixed N/A', () => {
    const data: VisualizationData = {
      protein_ids: ['p1'],
      projections: [{ name: 'test', data: [[0, 0]] }],
      annotations: {
        species: { values: ['human'], colors: ['#f00'], shapes: ['circle'] },
        family: { values: [null], colors: ['#ddd'], shapes: ['circle'] },
      },
      annotation_data: { species: [[0]], family: [[0]] },
    };
    const result = DataProcessor.processVisualizationData(data, 0);
    expect(result[0].annotationValues.species).toEqual(['human']);
    expect(result[0].annotationValues.family).toEqual(['__NA__']);
  });
});
