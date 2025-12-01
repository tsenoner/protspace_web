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
    } | null,
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
}
