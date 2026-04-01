import * as d3 from 'd3';
import type { PlotDataPoint } from '@protspace/utils';

type IndexedPoint = {
  point: PlotDataPoint;
  px: number;
  py: number;
};

export class QuadtreeIndex {
  private qt: d3.Quadtree<IndexedPoint> | null = null;
  private scales: {
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
  } | null = null;

  setScales(
    scales: {
      x: d3.ScaleLinear<number, number>;
      y: d3.ScaleLinear<number, number>;
    } | null,
  ) {
    this.scales = scales;
  }

  rebuild(plotData: PlotDataPoint[]) {
    if (!this.scales || plotData.length === 0) {
      this.qt = null;
      return;
    }

    // Precompute screen-space coordinates once at rebuild time.
    // This makes query/hit-testing significantly cheaper, because we avoid calling
    // scale functions for every candidate point during interactions.
    const sx = this.scales.x;
    const sy = this.scales.y;
    const indexed: IndexedPoint[] = new Array(plotData.length);
    for (let i = 0; i < plotData.length; i++) {
      const p = plotData[i];
      indexed[i] = { point: p, px: sx(p.x), py: sy(p.y) };
    }

    this.qt = d3
      .quadtree<IndexedPoint>()
      .x((d) => d.px)
      .y((d) => d.py)
      .addAll(indexed);
  }

  findNearest(screenX: number, screenY: number, radius: number): PlotDataPoint | undefined {
    if (!this.qt) return undefined;
    return this.qt.find(screenX, screenY, radius)?.point;
  }

  hasTree(): boolean {
    return !!this.qt;
  }

  clear() {
    this.qt = null;
  }

  queryByPixels(minX: number, minY: number, maxX: number, maxY: number): PlotDataPoint[] {
    if (!this.qt) {
      return [];
    }

    const results: PlotDataPoint[] = [];
    this.qt.visit((node, x0, y0, x1, y1) => {
      if (!node.length) {
        let leaf: d3.QuadtreeLeaf<IndexedPoint> | undefined = node as d3.QuadtreeLeaf<IndexedPoint>;
        while (leaf) {
          const ip = leaf.data;
          if (ip.px >= minX && ip.px <= maxX && ip.py >= minY && ip.py <= maxY) {
            results.push(ip.point);
          }
          leaf = leaf.next as d3.QuadtreeLeaf<IndexedPoint> | undefined;
        }
      }
      return x0 > maxX || x1 < minX || y0 > maxY || y1 < minY;
    });

    return results;
  }

  queryByPolygon(vertices: ReadonlyArray<[number, number]>): PlotDataPoint[] {
    if (!this.qt || vertices.length < 3) return [];

    // Compute AABB of polygon for fast quadtree pruning
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of vertices) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const results: PlotDataPoint[] = [];
    this.qt.visit((node, x0, y0, x1, y1) => {
      // Prune quadtree nodes outside the polygon's bounding box
      if (x0 > maxX || x1 < minX || y0 > maxY || y1 < minY) return true;
      if (!node.length) {
        let leaf: d3.QuadtreeLeaf<IndexedPoint> | undefined = node as d3.QuadtreeLeaf<IndexedPoint>;
        while (leaf) {
          const ip = leaf.data;
          if (
            ip.px >= minX &&
            ip.px <= maxX &&
            ip.py >= minY &&
            ip.py <= maxY &&
            pointInPolygon(ip.px, ip.py, vertices)
          ) {
            results.push(ip.point);
          }
          leaf = leaf.next as d3.QuadtreeLeaf<IndexedPoint> | undefined;
        }
      }
      return false;
    });

    return results;
  }
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(
  px: number,
  py: number,
  vertices: ReadonlyArray<[number, number]>,
): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, yi] = vertices[i];
    const [xj, yj] = vertices[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
