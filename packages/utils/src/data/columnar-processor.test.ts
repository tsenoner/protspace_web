import { describe, it, expect } from 'vitest';
import { ColumnarDataProcessor } from './columnar-processor';
import { getAnnotationValues } from './columnar-types';
import type { VisualizationData } from '../types';

function makeTestData(count: number = 3): VisualizationData {
  const ids = Array.from({ length: count }, (_, i) => `P${i}`);
  return {
    protein_ids: ids,
    projections: [
      {
        name: 'UMAP',
        data: ids.map((_, i) => [i * 1.0, i * 2.0] as [number, number]),
      },
      {
        name: 'PCA',
        data: ids.map((_, i) => [i * 10.0, i * 20.0] as [number, number]),
      },
    ],
    annotations: {
      species: {
        values: ['human', 'mouse'],
        colors: ['#ff0000', '#00ff00'],
        shapes: ['circle', 'square'],
      },
    },
    annotation_data: {
      species: [[0], [1], [0, 1]],
    },
  };
}

describe('ColumnarDataProcessor', () => {
  describe('buildColumnarData', () => {
    it('should extract coordinates as Float32Arrays', () => {
      const data = makeTestData();
      const result = ColumnarDataProcessor.buildColumnarData(data, 0);

      expect(result.x).toBeInstanceOf(Float32Array);
      expect(result.y).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(3);
      expect(result.x[0]).toBeCloseTo(0.0);
      expect(result.x[1]).toBeCloseTo(1.0);
      expect(result.y[2]).toBeCloseTo(4.0);
    });

    it('should build annotation store without duplicating data', () => {
      const data = makeTestData();
      const result = ColumnarDataProcessor.buildColumnarData(data, 0);

      const vals0 = getAnnotationValues(result.annotationStore, 'species', 0);
      expect(vals0).toEqual(['human']);

      const vals2 = getAnnotationValues(result.annotationStore, 'species', 2);
      expect(vals2).toEqual(['human', 'mouse']);
    });

    it('should handle N/A normalization', () => {
      const data = makeTestData();
      data.annotations.species.values = ['human', null as unknown as string];
      const result = ColumnarDataProcessor.buildColumnarData(data, 0);

      const vals1 = getAnnotationValues(result.annotationStore, 'species', 1);
      expect(vals1).toEqual(['__NA__']);
    });
  });

  describe('switchProjection', () => {
    it('should only swap coordinate arrays without rebuilding annotations', () => {
      const data = makeTestData();
      const initial = ColumnarDataProcessor.buildColumnarData(data, 0);
      const storeRef = initial.annotationStore;

      const switched = ColumnarDataProcessor.switchProjection(initial, data, 1);

      // Coordinates changed
      expect(switched.x[0]).toBeCloseTo(0.0);
      expect(switched.x[1]).toBeCloseTo(10.0);
      expect(switched.y[1]).toBeCloseTo(20.0);

      // Annotation store is the SAME reference (not duplicated)
      expect(switched.annotationStore).toBe(storeRef);
    });
  });

  describe('createScales', () => {
    it('should create D3 scales from columnar data', () => {
      const data = makeTestData();
      const columnar = ColumnarDataProcessor.buildColumnarData(data, 0);
      const scales = ColumnarDataProcessor.createScales(columnar, 800, 600, {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      });

      expect(scales).not.toBeNull();
      expect(typeof scales!.x).toBe('function');
      expect(typeof scales!.y).toBe('function');
    });
  });
});
