import * as d3 from 'd3';
import type { PlotDataPoint } from '@protspace/utils';

export interface RenderConfig {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  pointSize: number;
  baseOpacity: number;
  selectedOpacity: number;
  fadedOpacity: number;
  transitionDuration: number;
}

export interface StyleGetters {
  getColor: (point: PlotDataPoint) => string;
  getShape: (point: PlotDataPoint) => d3.SymbolType;
  getSize: (point: PlotDataPoint) => number;
  getOpacity: (point: PlotDataPoint) => number;
  getStrokeColor: (point: PlotDataPoint) => string;
  getStrokeWidth: (point: PlotDataPoint) => number;
}

export class ScatterplotRenderer {
  private mainGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: RenderConfig;
  private scales: {
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
  } | null = null;

  constructor(mainGroup: SVGGElement, config: RenderConfig) {
    this.mainGroup = d3.select(mainGroup);
    this.config = config;
  }

  setScales(scales: { x: d3.ScaleLinear<number, number>; y: d3.ScaleLinear<number, number> }) {
    this.scales = scales;
  }

  render(
    plotData: PlotDataPoint[],
    styleGetters: StyleGetters,
    eventHandlers: {
      onMouseOver: (event: MouseEvent, point: PlotDataPoint) => void;
      onMouseOut: (event: MouseEvent, point: PlotDataPoint) => void;
      onClick: (event: MouseEvent, point: PlotDataPoint) => void;
    },
    isTransitioning: boolean = false
  ) {
    if (!this.scales || plotData.length === 0) return;

    const transitionDuration = isTransitioning ? 750 : this.config.transitionDuration;
    const t = d3.transition().duration(transitionDuration);

    // D3 enter/update/exit pattern
    const points = this.mainGroup
      .selectAll<SVGPathElement, PlotDataPoint>('.protein-point')
      .data(plotData, (d) => d.id);

    // Remove exiting points
    points.exit().transition(t).attr('opacity', 0).remove();

    // Add new points
    const enterPoints = points
      .enter()
      .append('path')
      .attr('class', 'protein-point')
      .attr('d', (d) => this._createPointPath(d, styleGetters))
      .attr('fill', (d) => styleGetters.getColor(d))
      .attr('stroke', (d) => styleGetters.getStrokeColor(d))
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d) => styleGetters.getStrokeWidth(d))
      .attr('opacity', 0)
      .attr('transform', (d) => `translate(${this.scales!.x(d.x)}, ${this.scales!.y(d.y)})`)
      .attr('cursor', 'pointer')
      .attr('data-protein-id', (d) => d.id)
      .on('mouseover', (event, d) => eventHandlers.onMouseOver(event, d))
      .on('mouseout', (event, d) => eventHandlers.onMouseOut(event, d))
      .on('click', (event, d) => eventHandlers.onClick(event, d));

    // Animate new points in
    enterPoints.transition(t).attr('opacity', (d) => styleGetters.getOpacity(d));

    // Update existing points
    points
      .transition(t)
      .attr('d', (d) => this._createPointPath(d, styleGetters))
      .attr('fill', (d) => styleGetters.getColor(d))
      .attr('opacity', (d) => styleGetters.getOpacity(d))
      .attr('stroke', (d) => styleGetters.getStrokeColor(d))
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d) => styleGetters.getStrokeWidth(d))
      .attr('transform', (d) => `translate(${this.scales!.x(d.x)}, ${this.scales!.y(d.y)})`);
  }

  private _createPointPath(point: PlotDataPoint, styleGetters: StyleGetters): string {
    const shape = styleGetters.getShape(point);
    const size = styleGetters.getSize(point);
    return d3.symbol().type(shape).size(size)()!;
  }

  clear() {
    this.mainGroup.selectAll('.protein-point').remove();
  }

  highlightPoints(proteinIds: string[], className: string = 'highlighted') {
    this.mainGroup
      .selectAll<SVGPathElement, PlotDataPoint>('.protein-point')
      .classed(className, (d) => proteinIds.includes(d.id));
  }

  animatePointSelection(proteinId: string, isSelected: boolean) {
    const point = this.mainGroup.select<SVGPathElement>(
      `.protein-point[data-protein-id="${proteinId}"]`
    );

    if (point.empty()) return;

    if (isSelected) {
      // Selection animation - pulse effect
      point
        .transition()
        .duration(150)
        .attr('stroke-width', 5)
        .attr('stroke-opacity', 1)
        .transition()
        .duration(150)
        .attr('stroke-width', 3)
        .attr('stroke-opacity', 0.5);
    } else {
      // Deselection animation
      point.transition().duration(150).attr('stroke-width', 1).attr('stroke-opacity', 0.5);
    }
  }
}
