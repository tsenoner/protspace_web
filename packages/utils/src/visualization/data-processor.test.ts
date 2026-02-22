import { describe, it, expect } from 'vitest';
import { DataProcessor } from './data-processor';
import type { VisualizationData } from '../types';

describe('DataProcessor', () => {
  it('should normalize null annotation values to __NA__', () => {
    const data: VisualizationData = {
      protein_ids: ['p1', 'p2'],
      projections: [
        {
          name: 'test',
          data: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
      annotations: {
        species: {
          values: ['human', null],
          colors: ['#f00', '#ddd'],
          shapes: ['circle', 'circle'],
        },
      },
      annotation_data: { species: [[0], [1]] },
    };

    const result = DataProcessor.processVisualizationData(data, 0);

    expect(result[0].annotationValues.species).toEqual(['human']);
    expect(result[1].annotationValues.species).toEqual(['__NA__']);
  });

  it('should preserve non-null annotation values unchanged', () => {
    const data: VisualizationData = {
      protein_ids: ['p1'],
      projections: [{ name: 'test', data: [[0, 0]] }],
      annotations: {
        species: { values: ['human'], colors: ['#f00'], shapes: ['circle'] },
      },
      annotation_data: { species: [[0]] },
    };

    const result = DataProcessor.processVisualizationData(data, 0);

    expect(result[0].annotationValues.species).toEqual(['human']);
  });
});
