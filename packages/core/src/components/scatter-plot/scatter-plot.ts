import { LitElement, html } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import * as d3 from 'd3';
import type { VisualizationData, PlotDataPoint, ScatterplotConfig } from '@protspace/utils';
import { DataProcessor } from '@protspace/utils';
import { scatterplotStyles } from './scatter-plot.styles';
import { DEFAULT_CONFIG } from './config';
import { createStyleGetters } from './style-getters';
import { CanvasRenderer } from './canvas-renderer';
import { QuadtreeIndex } from './quadtree-index';

// Default configuration moved to config.ts

/**
 * High-performance canvas-based scatterplot component for up to 100k points.
 * Uses canvas for rendering and SVG overlay for interactions.
 */
@customElement('protspace-scatterplot')
export class ProtspaceScatterplot extends LitElement {
  static styles = scatterplotStyles;

  // Properties
  @property({ type: Object }) data: VisualizationData | null = null;
  @property({ type: Number }) selectedProjectionIndex = 0;
  @property({ type: String }) projectionPlane: 'xy' | 'xz' | 'yz' = 'xy';
  @property({ type: String }) selectedFeature = 'family';
  @property({ type: Array }) highlightedProteinIds: string[] = [];
  @property({ type: Array }) selectedProteinIds: string[] = [];
  @property({ type: Boolean }) selectionMode = false;
  @property({ type: Array }) hiddenFeatureValues: string[] = [];
  @property({ type: Array }) otherFeatureValues: string[] = [];
  @property({ type: Boolean }) useShapes: boolean = false;
  @property({ type: Object }) config: Partial<ScatterplotConfig> = {};
  @property({ type: Boolean }) useCanvas = true;
  @property({ type: Boolean }) enableVirtualization = false;

  // State
  @state() private _plotData: PlotDataPoint[] = [];
  @state() private _tooltipData: {
    x: number;
    y: number;
    protein: PlotDataPoint;
  } | null = null;
  @state() private _mergedConfig = DEFAULT_CONFIG;
  @state() private _transform = d3.zoomIdentity;
  @state() private _isolationHistory: string[][] = [];
  @state() private _isolationMode = false;

  // Queries
  @query('canvas') private _canvas?: HTMLCanvasElement;
  @query('svg') private _svg!: SVGSVGElement;

  // Internal
  private _quadtreeIndex: QuadtreeIndex = new QuadtreeIndex();
  private resizeObserver: ResizeObserver;
  private _zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private _svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private _mainGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private _brushGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private _overlayGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private _brush: d3.BrushBehavior<unknown> | null = null;
  private _canvasRenderer: CanvasRenderer | null = null;
  private _zoomRafId: number | null = null;
  private _styleSig: string | null = null;
  private _zOrderMapping: Record<string, number> = {};
  private _styleGettersCache: ReturnType<typeof createStyleGetters> | null = null;
  private _quadtreeRebuildRafId: number | null = null;
  private _cachedScales: ReturnType<typeof DataProcessor.createScales> = null;
  private _scalesCacheDeps: {
    plotDataLength: number;
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
  } | null = null;

  // Computed properties with caching
  private get _scales() {
    const config = this._mergedConfig;

    // Check if cache is valid
    const needsRecompute =
      !this._cachedScales ||
      !this._scalesCacheDeps ||
      this._scalesCacheDeps.plotDataLength !== this._plotData.length ||
      this._scalesCacheDeps.width !== config.width ||
      this._scalesCacheDeps.height !== config.height ||
      this._scalesCacheDeps.margin.top !== config.margin.top ||
      this._scalesCacheDeps.margin.right !== config.margin.right ||
      this._scalesCacheDeps.margin.bottom !== config.margin.bottom ||
      this._scalesCacheDeps.margin.left !== config.margin.left;

    if (needsRecompute) {
      this._cachedScales = DataProcessor.createScales(
        this._plotData,
        config.width,
        config.height,
        config.margin,
      );
      this._scalesCacheDeps = {
        plotDataLength: this._plotData.length,
        width: config.width,
        height: config.height,
        margin: { ...config.margin },
      };
    }

    return this._cachedScales;
  }

  private _invalidateScalesCache() {
    this._cachedScales = null;
    this._scalesCacheDeps = null;
  }

  constructor() {
    super();
    this.resizeObserver = new ResizeObserver(() => this._updateSizeAndRender());
  }

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver.observe(this);

    // Listen for legend z-order changes
    this.addEventListener('legend-zorder-change', this._handleLegendZOrderChange.bind(this));
    this.addEventListener('dragover', this.handleDragOver);
    this.addEventListener('dragenter', this.handleDragEnter);
    this.addEventListener('dragleave', this.handleDragLeave);
    this.addEventListener('drop', this.handleDrop);
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
    if (this._quadtreeRebuildRafId !== null) {
      cancelAnimationFrame(this._quadtreeRebuildRafId);
      this._quadtreeRebuildRafId = null;
    }

    super.disconnectedCallback();
    this.removeEventListener('dragover', this.handleDragOver);
    this.removeEventListener('dragenter', this.handleDragEnter);
    this.removeEventListener('dragleave', this.handleDragLeave);
    this.removeEventListener('drop', this.handleDrop);
  }

  private handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
    this.setAttribute('dragging', '');
  };

  private handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    this.setAttribute('dragging', '');
  };

  private handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    this.removeAttribute('dragging');
  };

  private handleDrop = (e: DragEvent) => {
    e.preventDefault();
    this.removeAttribute('dragging');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.dispatchEvent(
        new CustomEvent('file-dropped', {
          detail: { file: files[0] },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  private _handleLegendZOrderChange(event: Event) {
    const customEvent = event as CustomEvent;
    const { zOrderMapping } = customEvent.detail;

    if (zOrderMapping) {
      this._zOrderMapping = { ...zOrderMapping };
      // Update CanvasRenderer with new z-order mapping
      this._canvasRenderer?.setZOrderMapping(this._zOrderMapping);
      this._renderPlot();
    }
  }

  updated(changedProperties: Map<PropertyKey, unknown>) {
    if (
      changedProperties.has('data') ||
      changedProperties.has('selectedProjectionIndex') ||
      changedProperties.has('projectionPlane')
    ) {
      this._processData();
      this._scheduleQuadtreeRebuild();
      this._canvasRenderer?.invalidatePositionCache();
      this._canvasRenderer?.invalidateStyleCache();
      if (changedProperties.has('data')) {
        this.resetZoom();
      }

      // Dispatch data-change event for auto-sync with control bar and other components
      if (changedProperties.has('data') && this.data) {
        this.dispatchEvent(
          new CustomEvent('data-change', {
            detail: { data: this.data },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }
    if (changedProperties.has('config')) {
      const prev = this._mergedConfig;
      this._mergedConfig = { ...DEFAULT_CONFIG, ...prev, ...this.config };
      this._updateStyleSignature();
      this._canvasRenderer?.invalidateStyleCache();
      this._canvasRenderer?.setStyleSignature(this._styleSig);
      this._scheduleQuadtreeRebuild();
    }
    if (
      changedProperties.has('selectedFeature') ||
      changedProperties.has('hiddenFeatureValues') ||
      changedProperties.has('otherFeatureValues')
    ) {
      this._scheduleQuadtreeRebuild();
      this._canvasRenderer?.invalidateStyleCache();
      this._updateStyleSignature();
      this._canvasRenderer?.setStyleSignature(this._styleSig);
      if (changedProperties.has('selectedFeature')) {
        this._canvasRenderer?.setSelectedFeature(this.selectedFeature);
        this._canvasRenderer?.setZOrderMapping(this._zOrderMapping);
      }
    }
    if (changedProperties.has('selectionMode')) {
      this._updateSelectionMode();
    }
    // Refresh cached style getters when any relevant input changes
    if (
      changedProperties.has('data') ||
      changedProperties.has('selectedFeature') ||
      changedProperties.has('hiddenFeatureValues') ||
      changedProperties.has('otherFeatureValues') ||
      changedProperties.has('selectedProteinIds') ||
      changedProperties.has('highlightedProteinIds') ||
      changedProperties.has('config') ||
      changedProperties.has('useShapes')
    ) {
      this._styleGettersCache = createStyleGetters(this.data, {
        selectedProteinIds: this.selectedProteinIds,
        highlightedProteinIds: this.highlightedProteinIds,
        selectedFeature: this.selectedFeature,
        hiddenFeatureValues: this.hiddenFeatureValues,
        otherFeatureValues: this.otherFeatureValues,
        useShapes: this.useShapes,
        sizes: {
          base: this._mergedConfig.pointSize,
        },
        opacities: {
          base: this._mergedConfig.baseOpacity,
          selected: this._mergedConfig.selectedOpacity,
          faded: this._mergedConfig.fadedOpacity,
        },
      });
    }
    if (
      changedProperties.has('selectedProteinIds') ||
      changedProperties.has('highlightedProteinIds')
    ) {
      this._updateSelectionOverlays();
      this._canvasRenderer?.invalidateStyleCache();
      this._renderPlot();
    }
    // Render for other changes
    const selectionKeys = ['selectedProteinIds', 'highlightedProteinIds'];
    const changedKeys = Array.from(changedProperties.keys()).map(String);
    const onlySelectionChanged =
      changedKeys.length > 0 && changedKeys.every((k) => selectionKeys.includes(k));
    if (!onlySelectionChanged) {
      this._renderPlot();
      this._updateSelectionOverlays();
    }
  }

  firstUpdated() {
    this._initializeInteractions();
    this._updateSizeAndRender();
    if (this._canvas) {
      this._canvasRenderer = new CanvasRenderer(
        this._canvas,
        () => this._scales,
        () => this._transform,
        {
          getColors: (p: PlotDataPoint) => this._getColors(p),
          getPointSize: (p: PlotDataPoint) => this._getPointSize(p),
          getOpacity: (p: PlotDataPoint) => this._getOpacity(p),
          getStrokeColor: (p: PlotDataPoint) => this._getStrokeColor(p),
          getStrokeWidth: (p: PlotDataPoint) => this._getStrokeWidth(p),
          getShape: (p: PlotDataPoint) => this._getPointShape(p),
        },
        () => this._mergedConfig.zoomSizeScaleExponent,
      );
      this._updateStyleSignature();
      this._canvasRenderer.setStyleSignature(this._styleSig);
      this._canvasRenderer.setSelectedFeature(this.selectedFeature);
      this._canvasRenderer.setZOrderMapping(this._zOrderMapping);
    }
  }

  private _processData() {
    const dataToUse = this.data;
    if (!dataToUse) return;
    this._plotData = DataProcessor.processVisualizationData(
      dataToUse,
      this.selectedProjectionIndex,
      this._isolationMode,
      this._isolationHistory,
      this.projectionPlane,
    );
    // Invalidate scales cache when plot data changes
    this._invalidateScalesCache();
  }

  private _buildQuadtree() {
    if (!this._plotData.length || !this._scales) return;
    const visiblePoints = this._plotData.filter((d) => this._getOpacity(d) > 0);
    this._quadtreeIndex.setScales(this._scales);
    this._quadtreeIndex.rebuild(visiblePoints);
  }

  private _scheduleQuadtreeRebuild() {
    if (this._quadtreeRebuildRafId !== null) {
      cancelAnimationFrame(this._quadtreeRebuildRafId);
    }
    this._quadtreeRebuildRafId = requestAnimationFrame(() => {
      this._quadtreeRebuildRafId = null;
      this._buildQuadtree();
    });
  }

  private _initializeInteractions() {
    if (!this._svg) return;

    this._svgSelection = d3.select(this._svg);

    // Clear existing content
    this._svgSelection.selectAll('*').remove();

    // Create main container group
    this._mainGroup = this._svgSelection.append('g').attr('class', 'scatter-plot-container');

    // Create brush group
    this._brushGroup = this._svgSelection.append('g').attr('class', 'brush-container');

    // Create overlay group (above brush) for transient drawings like selections
    this._overlayGroup = this._svgSelection.append('g').attr('class', 'overlay-container');

    this._zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(this._mergedConfig.zoomExtent)
      .on('zoom', (event) => {
        this._transform = event.transform;
        if (this._mainGroup) {
          this._mainGroup.attr('transform', event.transform);
        }
        if (this._brushGroup) {
          this._brushGroup.attr('transform', event.transform);
        }
        if (this._overlayGroup) {
          this._overlayGroup.attr('transform', event.transform);
        }
        // Smooth canvas rendering during zoom using requestAnimationFrame
        if (this.useCanvas && this._canvas) {
          if (this._zoomRafId !== null) {
            cancelAnimationFrame(this._zoomRafId);
          }
          this._zoomRafId = requestAnimationFrame(() => {
            this._zoomRafId = null;
            this._renderCanvas();
            this._updateSelectionOverlays();
          });
        }
      });
    this._svgSelection.call(this._zoom);
    this._svgSelection.on('dblclick.zoom', null);
    this._svgSelection.on('dblclick.reset', (event: MouseEvent) => {
      event.preventDefault();
      this.resetZoom();
    });
  }

  private _updateSizeAndRender() {
    const width = this.clientWidth || 800;
    const height = this.clientHeight || 600;

    if (this._canvas) {
      if (!this._canvasRenderer) {
        this._canvasRenderer = new CanvasRenderer(
          this._canvas,
          () => this._scales,
          () => this._transform,
          {
            getColors: (p: PlotDataPoint) => this._getColors(p),
            getPointSize: (p: PlotDataPoint) => this._getPointSize(p),
            getOpacity: (p: PlotDataPoint) => this._getOpacity(p),
            getStrokeColor: (p: PlotDataPoint) => this._getStrokeColor(p),
            getStrokeWidth: (p: PlotDataPoint) => this._getStrokeWidth(p),
            getShape: (p: PlotDataPoint) => this._getPointShape(p),
          },
          () => this._mergedConfig.zoomSizeScaleExponent,
        );
        this._updateStyleSignature();
        this._canvasRenderer.setStyleSignature(this._styleSig);
        this._canvasRenderer.setSelectedFeature(this.selectedFeature);
        this._canvasRenderer.setZOrderMapping(this._zOrderMapping);
      }
      this._canvasRenderer.setupHighDPICanvas(width, height);
      this._canvasRenderer.invalidatePositionCache();
    }

    if (this._svg) {
      this._svg.setAttribute('width', width.toString());
      this._svg.setAttribute('height', height.toString());
    }

    this._mergedConfig = { ...this._mergedConfig, width, height };
    // Scales depend on width/height; rebuild spatial index to keep hit-testing accurate after resize
    this._scheduleQuadtreeRebuild();
    this._renderPlot();
    this._updateSelectionOverlays();
  }

  // HiDPI setup and quality moved to CanvasRenderer

  private _updateSelectionMode() {
    if (!this._svgSelection || !this._brushGroup || !this._scales) return;

    // Clear existing brush
    this._brushGroup.selectAll('*').remove();

    if (this.selectionMode) {
      // Disable zoom
      if (this._zoom) {
        this._svgSelection.on('.zoom', null);
      }

      // Create brush
      const config = this._mergedConfig;
      this._brush = d3
        .brush()
        .extent([
          [config.margin.left, config.margin.top],
          [config.width - config.margin.right, config.height - config.margin.bottom],
        ])
        .on('end', (event) => this._handleBrushEnd(event));

      this._brushGroup.call(this._brush);
    } else {
      // Re-enable zoom
      if (this._zoom) {
        this._svgSelection.call(this._zoom);
        this._svgSelection.on('dblclick.zoom', null);
        this._svgSelection.on('dblclick.reset', (event: MouseEvent) => {
          event.preventDefault();
          this.resetZoom();
        });
      }
      this._brush = null;
    }
  }

  private _handleBrushEnd(event: d3.D3BrushEvent<unknown>) {
    if (!event.selection || !this._scales) return;

    const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];
    const selectedIds: string[] = [];

    this._plotData.forEach((d) => {
      if (this._getOpacity(d) === 0) return;
      const pointX = this._scales!.x(d.x);
      const pointY = this._scales!.y(d.y);

      if (pointX >= x0 && pointX <= x1 && pointY >= y0 && pointY <= y1) {
        selectedIds.push(d.id);
      }
    });

    if (selectedIds.length > 0) {
      // Batch the updates for better performance
      requestAnimationFrame(() => {
        this.selectedProteinIds = [...selectedIds];

        // Dispatch brush selection event instead of individual protein-click events
        this.dispatchEvent(
          new CustomEvent('brush-selection', {
            detail: {
              proteinIds: selectedIds,
              isMultiple: true,
            },
            bubbles: true,
            composed: true,
          }),
        );

        this.requestUpdate(); // Force re-render for highlighting
      });
    }

    // Clear brush selection
    setTimeout(() => {
      if (this._brush && this._brushGroup) {
        this._brushGroup.call(this._brush.move, null);
      }
      if (this._zoom && this._svgSelection && !this.selectionMode) {
        this._svgSelection.call(this._zoom);
      }
    }, 100);
  }

  private _renderPlot() {
    if (!this._scales || this._plotData.length === 0) {
      return;
    }

    // Always prefer canvas for better performance
    if (this._canvas && this.useCanvas) {
      this._renderCanvas();
      // Setup canvas event handling for interactions
      this._setupCanvasEventHandling();
    } else {
      // Fallback to SVG only if canvas is explicitly disabled
      if (this._mainGroup) {
        this._renderSVG();
      }
    }
  }

  private _renderCanvas() {
    if (!this._canvasRenderer || !this._scales) return;
    this._canvasRenderer.render(this._plotData);
    this._mainGroup?.selectAll('.protein-point').remove();
  }

  private _renderSVG() {
    if (!this._mainGroup || !this._scales) return;

    const dataSize = this._plotData.length;
    const config = this._mergedConfig;
    const useSimpleShapes = dataSize > config.maxPointsForComplexShapes || config.useSimpleShapes;
    const enableTransitions = config.enableTransitions && dataSize < config.largeDatasetThreshold;

    // Clear any existing points
    this._mainGroup.selectAll('.protein-point').remove();

    // Create points
    const points = this._mainGroup
      .selectAll<SVGElement, PlotDataPoint>('.protein-point')
      .data(this._plotData, (d) => d.id);

    const enterPoints = points
      .enter()
      .append(useSimpleShapes ? 'circle' : 'path')
      .attr('class', 'protein-point')
      .attr('cursor', 'pointer')
      .on('mouseover', (event, d) => this._handleMouseOver(event, d))
      .on('mouseout', (event, d) => this._handleMouseOut(event, d))
      .on('click', (event, d) => this._handleClick(event, d));

    if (useSimpleShapes) {
      enterPoints
        .attr('r', (d) => Math.sqrt(this._getPointSize(d)) / 3)
        .attr('cx', (d) => this._scales!.x(d.x))
        .attr('cy', (d) => this._scales!.y(d.y));
    } else {
      enterPoints
        .attr('d', (d) => this._getPointPath(d))
        .attr('transform', (d) => `translate(${this._scales!.x(d.x)}, ${this._scales!.y(d.y)})`);
    }

    enterPoints
      .attr('fill', (d) => this._getColors(d))
      .attr('stroke', (d) => this._getStrokeColor(d))
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d) => this._getStrokeWidth(d))
      .attr('opacity', enableTransitions ? 0 : (d) => this._getOpacity(d));

    if (enableTransitions) {
      enterPoints
        .transition()
        .duration(config.transitionDuration)
        .attr('opacity', (d) => this._getOpacity(d));
    }
  }

  private _updateSelectionOverlays() {
    if (!this._overlayGroup) return;
    this._overlayGroup.selectAll('.selected-overlay').remove();
  }

  private _getPointPath(point: PlotDataPoint): string {
    const shape = this._getPointShape(point);
    const size = this._getPointSize(point);
    return d3.symbol().type(shape).size(size)()!;
  }

  private _getPointShape(point: PlotDataPoint): d3.SymbolType {
    const getters = this._getStyleGetters();
    return getters.getPointShape(point);
  }

  private _getColors(point: PlotDataPoint): string[] {
    const getters = this._getStyleGetters();
    return getters.getColors(point);
  }

  private _getPointSize(point: PlotDataPoint): number {
    const getters = this._getStyleGetters();
    return getters.getPointSize(point);
  }

  private _getOpacity(point: PlotDataPoint): number {
    const getters = this._getStyleGetters();
    return getters.getOpacity(point);
  }

  private _getStrokeColor(point: PlotDataPoint): string {
    const getters = this._getStyleGetters();
    return getters.getStrokeColor(point);
  }

  private _getStrokeWidth(point: PlotDataPoint): number {
    const getters = this._getStyleGetters();
    return getters.getStrokeWidth(point);
  }

  private _getStyleGetters() {
    if (!this._styleGettersCache) {
      this._styleGettersCache = createStyleGetters(this.data, {
        selectedProteinIds: this.selectedProteinIds,
        highlightedProteinIds: this.highlightedProteinIds,
        selectedFeature: this.selectedFeature,
        hiddenFeatureValues: this.hiddenFeatureValues,
        otherFeatureValues: this.otherFeatureValues,
        useShapes: this.useShapes,
        sizes: {
          base: this._mergedConfig.pointSize,
        },
        opacities: {
          base: this._mergedConfig.baseOpacity,
          selected: this._mergedConfig.selectedOpacity,
          faded: this._mergedConfig.fadedOpacity,
        },
      });
    }
    return this._styleGettersCache;
  }

  private _getLocalPointerPosition(event: MouseEvent): {
    x: number;
    y: number;
  } {
    const rect = this.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private _handleMouseOver(event: MouseEvent, point: PlotDataPoint) {
    const { x, y } = this._getLocalPointerPosition(event);
    this._tooltipData = { x, y, protein: point };

    this.dispatchEvent(
      new CustomEvent('protein-hover', {
        detail: { proteinId: point.id, point },
        bubbles: true,
      }),
    );
  }

  private _handleMouseOut(_event: MouseEvent, _point: PlotDataPoint) {
    this._tooltipData = null;
    this.dispatchEvent(
      new CustomEvent('protein-hover', {
        detail: { proteinId: null },
        bubbles: true,
      }),
    );
  }

  private _handleClick(event: MouseEvent, point: PlotDataPoint) {
    this.dispatchEvent(
      new CustomEvent('protein-click', {
        detail: {
          proteinId: point.id,
          point,
          modifierKeys: {
            ctrl: event.ctrlKey,
            meta: event.metaKey,
            shift: event.shiftKey,
            alt: event.altKey,
          },
        },
        bubbles: true,
      }),
    );
  }

  /**
   * Setup event handling for canvas-based rendering
   */
  private _setupCanvasEventHandling(): void {
    if (!this._svgSelection) return;

    // Use event delegation on the SVG overlay for canvas interactions
    this._svgSelection
      .on('mousemove.canvas', (event) => this._handleCanvasMouseMove(event))
      .on('click.canvas', (event) => this._handleCanvasClick(event))
      .on('mouseout.canvas', () => this._handleCanvasMouseOut());
  }

  /**
   * Handle mouse move events for canvas rendering
   */
  private _handleCanvasMouseMove(event: MouseEvent): void {
    if (!this._scales) return;

    const [mouseX, mouseY] = d3.pointer(event);

    // Transform mouse coordinates to data space
    const dataX = (mouseX - this._transform.x) / this._transform.k;
    const dataY = (mouseY - this._transform.y) / this._transform.k;

    // Find nearest point using spatial index
    const searchRadius = 15 / this._transform.k; // Search radius adjusted for zoom
    const nearestPoint = this._quadtreeIndex.findNearest(dataX, dataY, searchRadius);

    if (nearestPoint) {
      // Calculate actual distance to verify it's within the point
      const pointX = this._scales.x(nearestPoint.x);
      const pointY = this._scales.y(nearestPoint.y);
      const distance = Math.sqrt(Math.pow(dataX - pointX, 2) + Math.pow(dataY - pointY, 2));
      const exp = this._mergedConfig.zoomSizeScaleExponent ?? 1;
      const pointRadius =
        Math.sqrt(this._getPointSize(nearestPoint)) / 3 / Math.pow(this._transform.k, exp);

      if (distance <= pointRadius) {
        this._handleMouseOver(event, nearestPoint);
        return;
      }
    }

    // No point found, clear tooltip if it exists
    if (this._tooltipData) {
      this._tooltipData = null;
    }
  }

  /**
   * Handle click events for canvas rendering
   */
  private _handleCanvasClick(event: MouseEvent): void {
    if (!this._scales) return;

    const [mouseX, mouseY] = d3.pointer(event);

    // Transform mouse coordinates to data space
    const dataX = (mouseX - this._transform.x) / this._transform.k;
    const dataY = (mouseY - this._transform.y) / this._transform.k;

    // Find nearest point using spatial index
    const searchRadius = 15 / this._transform.k;
    const nearestPoint = this._quadtreeIndex.findNearest(dataX, dataY, searchRadius);

    if (nearestPoint) {
      // Calculate actual distance to verify it's within the point
      const pointX = this._scales.x(nearestPoint.x);
      const pointY = this._scales.y(nearestPoint.y);
      const distance = Math.sqrt(Math.pow(dataX - pointX, 2) + Math.pow(dataY - pointY, 2));
      const exp = this._mergedConfig.zoomSizeScaleExponent ?? 1;
      const pointRadius =
        Math.sqrt(this._getPointSize(nearestPoint)) / 3 / Math.pow(this._transform.k, exp);

      if (distance <= pointRadius) {
        this._handleClick(event, nearestPoint);
      }
    }
  }

  /**
   * Handle mouse out events for canvas rendering
   */
  private _handleCanvasMouseOut(): void {
    if (this._tooltipData) {
      this._tooltipData = null;
    }
  }

  // Public API Methods (these were missing in the original but are required by main.ts)
  configurePerformance(dataSize: number, mode: string = 'auto') {
    const config = { ...this._mergedConfig };

    if (mode === 'fast' || dataSize > config.fastRenderingThreshold) {
      this.useCanvas = true;
      this.enableVirtualization = true;
      config.enableTransitions = false;
      config.useSimpleShapes = true;
    } else if (mode === 'auto' || dataSize > config.largeDatasetThreshold) {
      this.useCanvas = true; // Always prefer canvas for better performance
      config.enableTransitions = false;
    } else {
      this.useCanvas = true; // Canvas is fast even for small datasets
      config.enableTransitions = false; // Canvas doesn't use transitions
      config.useSimpleShapes = false;
    }

    this._mergedConfig = config;
    this.requestUpdate();
  }

  resetZoom() {
    if (this._zoom && this._svgSelection) {
      this._svgSelection.transition().duration(750).call(this._zoom.transform, d3.zoomIdentity);
    }
  }

  render() {
    const config = this._mergedConfig;

    return html`
      <div class="container">
        <!-- Canvas for high-performance rendering (always visible for better performance) -->
        <canvas style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 1;">
        </canvas>

        <!-- SVG overlay for interactions and UI elements -->
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 ${config.width} ${config.height}"
          style="position: absolute; top: 0; left: 0; max-width: ${config.width}px; max-height: ${config.height}px; z-index: 2; background: transparent;"
        ></svg>

        ${this._tooltipData
          ? html`
              <div
                class="tooltip"
                style="left: ${this._tooltipData.x + 10}px; top: ${this._tooltipData.y -
                60}px; z-index: 10;"
              >
                <div class="tooltip-protein-id">${this._tooltipData.protein.id}</div>

                <div class="tooltip-feature-header">${this.selectedFeature}:</div>

                ${this._tooltipData.protein.featureValues[this.selectedFeature].map(
                  (value) => html`<div class="tooltip-feature">${value || 'N/A'}</div>`,
                )}
              </div>
            `
          : ''}
        ${this.selectionMode
          ? html`
              <div
                class="mode-indicator"
                style="z-index: 10; display: flex; flex-direction: column; gap: 4px;"
              >
                <div>Selection Mode</div>
                ${this.selectedProteinIds.length > 0
                  ? html`<div style="font-size: 11px; opacity: 0.8;">
                      ${this.selectedProteinIds.length} selected
                    </div>`
                  : ''}
              </div>
            `
          : ''}
        ${this._isolationMode
          ? html`
              <div
                class="isolation-indicator"
                style="z-index: 10; bottom: 10px; right: 10px; position: absolute; background: rgba(59, 130, 246, 0.9); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;"
              >
                ${this._plotData.length} points
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _updateStyleSignature() {
    const cfg = this._mergedConfig;
    const parts = [
      `ps:${cfg.pointSize}`,
      `feat:${this.selectedFeature}`,
      `sh:${this.useShapes ? 1 : 0}`,
    ];
    this._styleSig = parts.join('|');
  }

  isolateSelection() {
    if (!this.data || this.selectedProteinIds.length === 0) {
      return;
    }

    // Validate selected IDs against current plot data
    const currentProteinIds = new Set(this._plotData.map((point) => point.id));
    const validSelectedIds = this.selectedProteinIds.filter((id) => currentProteinIds.has(id));

    if (validSelectedIds.length === 0) {
      return;
    }

    // Add valid selection to isolation history
    this._isolationHistory.push(validSelectedIds);
    this._isolationMode = true;
    this.selectedProteinIds = [];

    // Process data and update rendering
    this._processData();
    this._buildQuadtree();

    // Ensure canvas renderer is completely refreshed
    if (this._canvasRenderer) {
      this._canvasRenderer.invalidatePositionCache();
      this._canvasRenderer.invalidateStyleCache();
      this._updateStyleSignature();
      this._canvasRenderer.setStyleSignature(this._styleSig);
    }

    // Force immediate component update
    this.requestUpdate();

    // Render after all updates are complete
    this.updateComplete.then(() => {
      this._renderPlot();
    });

    this.dispatchEvent(
      new CustomEvent('data-isolation', {
        detail: {
          isolationHistory: this._isolationHistory,
          isolationMode: this._isolationMode,
          dataSize: this._plotData.length,
        },
        bubbles: true,
        composed: true,
      }),
    );

    // Dispatch data-change event to update legend and other auto-sync components
    this.dispatchEvent(
      new CustomEvent('data-change', {
        detail: {
          data: this.getCurrentData(),
          isSplitData: true,
          isolationMode: true,
        },
        bubbles: true,
        composed: true,
      }),
    );

    // Auto-disable selection mode if only 1 point left
    if (this._plotData.length <= 1) {
      this.selectionMode = false;
      this.dispatchEvent(
        new CustomEvent('auto-disable-selection', {
          detail: {
            reason: 'insufficient-data',
            dataSize: this._plotData.length,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  resetIsolation() {
    this._isolationHistory = [];
    this._isolationMode = false;
    this.selectedProteinIds = [];

    // Process data and update rendering
    this._processData();
    this._buildQuadtree();

    // Ensure canvas renderer is completely refreshed
    if (this._canvasRenderer) {
      this._canvasRenderer.invalidatePositionCache();
      this._canvasRenderer.invalidateStyleCache();
      this._updateStyleSignature();
      this._canvasRenderer.setStyleSignature(this._styleSig);
    }

    // Force immediate component update
    this.requestUpdate();

    // Render after all updates are complete
    this.updateComplete.then(() => {
      this._renderPlot();
    });

    this.dispatchEvent(
      new CustomEvent('data-isolation-reset', {
        detail: {
          isolationHistory: this._isolationHistory,
          isolationMode: this._isolationMode,
          dataSize: this._plotData.length,
        },
        bubbles: true,
        composed: true,
      }),
    );

    // Dispatch data-change event to update legend back to full data
    this.dispatchEvent(
      new CustomEvent('data-change', {
        detail: {
          data: this.getCurrentData(),
          isFiltered: false,
          isolationMode: false,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  getIsolationHistory(): string[][] {
    return [...this._isolationHistory];
  }

  isIsolationMode(): boolean {
    return this._isolationMode;
  }

  getCurrentData(): VisualizationData | null {
    if (!this.data) return null;

    // If we're in isolation mode, return filtered data based on current plot data
    if (this._isolationMode && this._plotData.length > 0) {
      const currentProteinIds = this._plotData.map((point) => point.id);
      const currentProteinIdsSet = new Set(currentProteinIds);

      // Filter feature data to match current protein IDs
      const filteredFeatureData: { [key: string]: number[][] } = {};

      for (const [featureName, featureValues] of Object.entries(this.data.feature_data)) {
        filteredFeatureData[featureName] = [];

        // Map original indices to current indices
        this.data.protein_ids.forEach((proteinId, originalIndex) => {
          if (currentProteinIdsSet.has(proteinId)) {
            filteredFeatureData[featureName].push(featureValues[originalIndex]);
          }
        });
      }

      return {
        ...this.data,
        protein_ids: currentProteinIds,
        feature_data: filteredFeatureData,
        projections: this.data.projections, // Keep original projections
      };
    }

    return this.data;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-scatterplot': ProtspaceScatterplot;
  }
}
