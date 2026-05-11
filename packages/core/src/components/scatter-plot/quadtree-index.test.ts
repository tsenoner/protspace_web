import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { QuadtreeIndex, pointInPolygon } from './quadtree-index';
import type { PlotDataPoint } from '@protspace/utils';

function makePoint(id: string, x: number, y: number): PlotDataPoint {
  return { id, x, y, originalIndex: 0 };
}

function buildIndex(points: PlotDataPoint[]): QuadtreeIndex {
  const idx = new QuadtreeIndex();
  idx.setScales({
    x: d3.scaleLinear().domain([0, 100]).range([0, 100]),
    y: d3.scaleLinear().domain([0, 100]).range([0, 100]),
  });
  idx.rebuild(points);
  return idx;
}

// ── pointInPolygon ─────────────────────────────────────────────

describe('pointInPolygon', () => {
  const triangle: [number, number][] = [
    [0, 0],
    [10, 0],
    [5, 10],
  ];

  it('returns true for a point inside the triangle', () => {
    expect(pointInPolygon(5, 3, triangle)).toBe(true);
  });

  it('returns false for a point outside the triangle', () => {
    expect(pointInPolygon(0, 10, triangle)).toBe(false);
  });

  it('returns false for a point far outside', () => {
    expect(pointInPolygon(50, 50, triangle)).toBe(false);
  });

  it('works with a square polygon', () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(11, 5, square)).toBe(false);
  });

  it('works with a concave polygon', () => {
    // L-shape: concave polygon
    const lShape: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 5],
      [5, 5],
      [5, 10],
      [0, 10],
    ];
    expect(pointInPolygon(2, 2, lShape)).toBe(true); // inside bottom-left
    expect(pointInPolygon(8, 2, lShape)).toBe(true); // inside bottom-right
    expect(pointInPolygon(8, 8, lShape)).toBe(false); // inside the concave cutout
    expect(pointInPolygon(2, 8, lShape)).toBe(true); // inside top-left
  });
});

// ── QuadtreeIndex.queryByPolygon ───────────────────────────────

describe('QuadtreeIndex.queryByPolygon', () => {
  it('selects points inside a triangle', () => {
    const points = [
      makePoint('inside', 5, 3),
      makePoint('outside', 0, 10),
      makePoint('also-inside', 5, 1),
    ];
    const idx = buildIndex(points);
    const triangle: [number, number][] = [
      [0, 0],
      [10, 0],
      [5, 10],
    ];
    const result = idx.queryByPolygon(triangle);
    const ids = result.map((p) => p.id).sort();
    expect(ids).toEqual(['also-inside', 'inside']);
  });

  it('returns empty for polygon with < 3 vertices', () => {
    const points = [makePoint('a', 5, 5)];
    const idx = buildIndex(points);
    expect(idx.queryByPolygon([[0, 0]])).toEqual([]);
    expect(
      idx.queryByPolygon([
        [0, 0],
        [10, 10],
      ]),
    ).toEqual([]);
  });

  it('returns empty when no tree is built', () => {
    const idx = new QuadtreeIndex();
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(idx.queryByPolygon(square)).toEqual([]);
  });

  it('selects all points with a large enclosing polygon', () => {
    const points = Array.from({ length: 50 }, (_, i) =>
      makePoint(`p${i}`, Math.random() * 80 + 10, Math.random() * 80 + 10),
    );
    const idx = buildIndex(points);
    const bigSquare: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const result = idx.queryByPolygon(bigSquare);
    expect(result.length).toBe(50);
  });

  it('handles concave polygon correctly', () => {
    // L-shape: bottom-left + top-left, but NOT top-right
    const lShape: [number, number][] = [
      [0, 0],
      [60, 0],
      [60, 40],
      [40, 40],
      [40, 80],
      [0, 80],
    ];
    const points = [
      makePoint('bottom-left', 20, 20), // inside
      makePoint('bottom-right', 50, 20), // inside (bottom arm)
      makePoint('top-left', 20, 60), // inside (top arm)
      makePoint('top-right', 50, 60), // outside (concave cutout)
    ];
    const idx = buildIndex(points);
    const result = idx.queryByPolygon(lShape);
    const ids = result.map((p) => p.id).sort();
    expect(ids).toEqual(['bottom-left', 'bottom-right', 'top-left']);
  });
});
