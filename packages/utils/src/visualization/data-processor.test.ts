import { describe, it, expect } from 'vitest';
import { DataProcessor } from './data-processor';
import type { VisualizationData } from '../types';

describe('DataProcessor.processVisualizationData', () => {
  it('returns one bare PlotDataPoint per protein for 2D coordinates', () => {
    const data: VisualizationData = {
      protein_ids: ['p0', 'p1'],
      projections: [
        {
          name: 't',
          data: [
            [1, 2],
            [3, 4],
          ],
        },
      ],
      annotations: {},
      annotation_data: {},
    };
    const result = DataProcessor.processVisualizationData(data, 0);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'p0', x: 1, y: 2, originalIndex: 0 });
    expect(result[1]).toEqual({ id: 'p1', x: 3, y: 4, originalIndex: 1 });
  });

  it('drops the z coordinate for 3D projections (rendered as 2D)', () => {
    const data: VisualizationData = {
      protein_ids: ['p0'],
      projections: [{ name: 't', data: [[1, 2, 3]] }],
      annotations: {},
      annotation_data: {},
    };
    const result = DataProcessor.processVisualizationData(data, 0);
    expect(result[0]).toEqual({ id: 'p0', x: 1, y: 2, originalIndex: 0 });
    expect(result[0]).not.toHaveProperty('z');
  });

  it('returns empty array when projection index is out of range', () => {
    const data: VisualizationData = {
      protein_ids: ['p0'],
      projections: [],
      annotations: {},
      annotation_data: {},
    };
    expect(DataProcessor.processVisualizationData(data, 0)).toEqual([]);
  });

  it('filters points using isolation history', () => {
    const data: VisualizationData = {
      protein_ids: ['p0', 'p1', 'p2'],
      projections: [
        {
          name: 't',
          data: [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
        },
      ],
      annotations: {},
      annotation_data: {},
    };
    const result = DataProcessor.processVisualizationData(data, 0, true, [['p0', 'p2']]);
    expect(result.map((p) => p.id)).toEqual(['p0', 'p2']);
  });

  it('applies multiple isolation history layers (intersection)', () => {
    const data: VisualizationData = {
      protein_ids: ['p0', 'p1', 'p2', 'p3'],
      projections: [
        {
          name: 't',
          data: [
            [0, 0],
            [1, 1],
            [2, 2],
            [3, 3],
          ],
        },
      ],
      annotations: {},
      annotation_data: {},
    };
    const result = DataProcessor.processVisualizationData(data, 0, true, [
      ['p0', 'p1', 'p2'],
      ['p1', 'p2', 'p3'],
    ]);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('does not materialize annotation Records on points', () => {
    const data: VisualizationData = {
      protein_ids: ['p0'],
      projections: [{ name: 't', data: [[0, 0]] }],
      annotations: {
        species: {
          kind: 'categorical',
          values: ['human'],
          colors: ['#f00'],
          shapes: ['circle'],
        },
      },
      annotation_data: { species: Int32Array.of(0) },
    };
    const result = DataProcessor.processVisualizationData(data, 0);
    expect(result).toHaveLength(1);
    expect(Object.keys(result[0]).sort()).toEqual(['id', 'originalIndex', 'x', 'y']);
  });
});
