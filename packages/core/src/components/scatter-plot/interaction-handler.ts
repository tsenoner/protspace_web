import * as d3 from 'd3';
import type { PlotDataPoint } from '@protspace/utils';

export interface InteractionConfig {
  enableZoom: boolean;
  enableBrush: boolean;
  enableTooltip: boolean;
  zoomExtent: [number, number];
  transitionDuration: number;
}

export class InteractionHandler {
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private brush: d3.BrushBehavior<unknown> | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private mainGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private brushGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: InteractionConfig;

  constructor(
    svg: SVGSVGElement,
    mainGroup: SVGGElement,
    brushGroup: SVGGElement,
    config: InteractionConfig
  ) {
    this.svg = d3.select(svg);
    this.mainGroup = d3.select(mainGroup);
    this.brushGroup = d3.select(brushGroup);
    this.config = config;
  }

  initializeZoom(onZoom: (transform: d3.ZoomTransform) => void) {
    if (!this.config.enableZoom) return;

    this.zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(this.config.zoomExtent)
      .on('zoom', (event) => {
        this.mainGroup.attr('transform', event.transform);
        this.brushGroup.attr('transform', event.transform);
        onZoom(event.transform);
      });

    this.svg.call(this.zoom);
  }

  initializeBrush(
    extent: [[number, number], [number, number]],
    onBrushEnd: (selectedPoints: PlotDataPoint[]) => void,
    plotData: PlotDataPoint[],
    scales: {
      x: d3.ScaleLinear<number, number>;
      y: d3.ScaleLinear<number, number>;
    }
  ) {
    if (!this.config.enableBrush) return;

    // Disable zoom when brushing
    if (this.zoom) {
      this.svg.on('.zoom', null);
    }

    this.brush = d3
      .brush()
      // Keep the UX simple: no resize handles, just drag a rectangle.
      .handleSize(0)
      .extent(extent)
      .on('end', (event) => {
        if (!event.selection) {
          // Re-enable zoom
          if (this.zoom) this.svg.call(this.zoom);
          return;
        }

        const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];
        const selectedPoints = plotData.filter((d) => {
          const pointX = scales.x(d.x);
          const pointY = scales.y(d.y);
          return pointX >= x0 && pointX <= x1 && pointY >= y0 && pointY <= y1;
        });

        onBrushEnd(selectedPoints);

        // Clear brush and re-enable zoom
        this.brushGroup.call(this.brush!.move, null);
        if (this.zoom) this.svg.call(this.zoom);
      });

    this.brushGroup.call(this.brush);
  }

  resetZoom() {
    if (this.zoom) {
      this.svg
        .transition()
        .duration(this.config.transitionDuration)
        .call(this.zoom.transform, d3.zoomIdentity);
    }
  }

  disableBrush() {
    this.brushGroup.selectAll('*').remove();
    if (this.zoom) {
      this.svg.call(this.zoom);
    }
    this.brush = null;
  }

  destroy() {
    if (this.zoom) {
      this.svg.on('.zoom', null);
    }
    if (this.brush) {
      this.svg.on('.brush', null);
    }
    this.brushGroup.selectAll('*').remove();
  }
}
