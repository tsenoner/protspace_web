import * as d3 from 'd3';
import type { PlotDataPoint } from '@protspace/utils';

export class QuadtreeIndex {
  private qt: d3.Quadtree<PlotDataPoint> | null = null;
  private scales: {
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
  } | null = null;

  setScales(
    scales: {
      x: d3.ScaleLinear<number, number>;
      y: d3.ScaleLinear<number, number>;
    } | null
  ) {
    this.scales = scales;
  }

  rebuild(plotData: PlotDataPoint[]) {
    if (!this.scales || plotData.length === 0) {
      this.qt = null;
      return;
    }
    this.qt = d3
      .quadtree<PlotDataPoint>()
      .x((d) => this.scales!.x(d.x))
      .y((d) => this.scales!.y(d.y))
      .addAll(plotData);
  }

  findNearest(screenX: number, screenY: number, radius: number): PlotDataPoint | undefined {
    if (!this.qt) return undefined;
    return this.qt.find(screenX, screenY, radius) || undefined;
  }

  hasTree(): boolean {
    return !!this.qt;
  }

  queryByPixels(minX: number, minY: number, maxX: number, maxY: number): PlotDataPoint[] {
    if (!this.qt || !this.scales) {
      return [];
    }

    const results: PlotDataPoint[] = [];
    this.qt.visit((node, x0, y0, x1, y1) => {
      if (!node.length) {
        let leaf: d3.QuadtreeLeaf<PlotDataPoint> | undefined = node as d3.QuadtreeLeaf<PlotDataPoint>;
        while (leaf) {
          const dataPoint = leaf.data;
          const px = this.scales!.x(dataPoint.x);
          const py = this.scales!.y(dataPoint.y);
          if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
            results.push(dataPoint);
          }
          leaf = leaf.next as d3.QuadtreeLeaf<PlotDataPoint> | undefined;
        }
      }
      return x0 > maxX || x1 < minX || y0 > maxY || y1 < minY;
    });

    return results;
  }
}
