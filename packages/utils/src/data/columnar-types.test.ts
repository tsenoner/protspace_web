import { describe, it, expect } from 'vitest';
import type { ColumnarData, AnnotationStore } from './columnar-types';

describe('ColumnarData types', () => {
  it('should allow creating a ColumnarData object with typed arrays', () => {
    const data: ColumnarData = {
      ids: ['P1', 'P2', 'P3'],
      x: new Float32Array([1.0, 2.0, 3.0]),
      y: new Float32Array([4.0, 5.0, 6.0]),
      z: null,
      length: 3,
      annotationStore: {
        annotations: {},
        indices: {},
        scores: {},
        evidence: {},
      },
      originalIndices: new Uint32Array([0, 1, 2]),
    };

    expect(data.length).toBe(3);
    expect(data.x[0]).toBe(1.0);
    expect(data.y[2]).toBe(6.0);
    expect(data.z).toBeNull();
    expect(data.ids[1]).toBe('P2');
  });

  it('should allow creating an AnnotationStore with indexed lookup', () => {
    const store: AnnotationStore = {
      annotations: {
        species: {
          values: ['human', 'mouse', '__NA__'],
          colors: ['#f00', '#0f0', '#ccc'],
          shapes: ['circle', 'square', 'circle'],
        },
      },
      indices: {
        species: [new Uint16Array([0]), new Uint16Array([1]), new Uint16Array([0, 1])],
      },
      scores: {},
      evidence: {},
    };

    // Point 0 has species = ['human']
    const point0Values = Array.from(store.indices.species[0]).map(
      (i) => store.annotations.species.values[i],
    );
    expect(point0Values).toEqual(['human']);

    // Point 2 has species = ['human', 'mouse'] (multi-label)
    const point2Values = Array.from(store.indices.species[2]).map(
      (i) => store.annotations.species.values[i],
    );
    expect(point2Values).toEqual(['human', 'mouse']);
  });
});
