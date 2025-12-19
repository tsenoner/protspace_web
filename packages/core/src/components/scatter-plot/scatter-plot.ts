import { LitElement, html } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import * as d3 from 'd3';
import type { VisualizationData, PlotDataPoint, ScatterplotConfig } from '@protspace/utils';
import { DataProcessor } from '@protspace/utils';
import { scatterplotStyles } from './scatter-plot.styles';
import { DEFAULT_CONFIG } from './config';
import { createStyleGetters } from './style-getters';
import { MAX_POINTS_DIRECT_RENDER, WebGLRenderer } from './webgl';
import { QuadtreeIndex } from './quadtree-index';

// Virtualization is only needed for viewport culling on very large datasets.
// For <= MAX_POINTS_DIRECT_RENDER we can render the full set once and then pan/zoom via uniforms
// (no per-frame quadtree queries or buffer rebuilds), which is substantially faster for ~500k points.
const VIRTUALIZATION_THRESHOLD = MAX_POINTS_DIRECT_RENDER;
const VIRTUALIZATION_PADDING = 100;

// Duplicate stack UI performance tuning (target: M1 MacBook + Chrome)
const DUPLICATE_BADGES_MAX_VISIBLE = 800;
const DUPLICATE_BADGES_VIEWPORT_PADDING = 60;
const DUPLICATE_BADGES_UPDATE_DEBOUNCE_MS = 120;
const DUPLICATE_STACK_COMPUTE_CHUNK_SIZE = 25_000;
type ScalePair = {
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
};

// Default configuration moved to config.ts

/**
 * High-performance WebGL-based scatterplot component for large datasets.
 * Uses WebGL for rendering and SVG overlay for interactions.
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
  @state() private _zOrderMapping: Record<string, number> | null = null;

  // Queries
  @query('canvas') private _canvas?: HTMLCanvasElement;
  @query('canvas.badges-canvas') private _badgesCanvas?: HTMLCanvasElement;
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
  private _webglRenderer: WebGLRenderer | null = null;
  private _zoomRafId: number | null = null;
  private _styleSig: string | null = null;
  private _styleGettersCache: ReturnType<typeof createStyleGetters> | null = null;
  private _quadtreeRebuildRafId: number | null = null;
  private _visiblePlotData: PlotDataPoint[] = [];
  private _virtualizationCacheKey: string | null = null;
  private _hoveredProteinId: string | null = null;
  private _cachedScales: ScalePair | null = null;
  private _scalesCacheDeps: {
    plotDataLength: number;
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
  } | null = null;

  // Duplicate stacks (exact same coordinates)
  private _duplicateStacks: Array<{
    key: string;
    x: number;
    y: number;
    px: number;
    py: number;
    points: PlotDataPoint[];
  }> = [];
  private _duplicateStackByKey = new Map<
    string,
    { key: string; x: number; y: number; px: number; py: number; points: PlotDataPoint[] }
  >();
  private _pointIdToDuplicateStackKey = new Map<string, string>();
  private _expandedDuplicateStackKey: string | null = null;
  private _isDuplicateStackUIEnabled(): boolean {
    return !!this._mergedConfig.enableDuplicateStackUI;
  }
  private _duplicateOverlayDebounceId: number | null = null;
  private _duplicateStacksCacheKey: string | null = null;
  private _duplicateStacksComputeJobId = 0;
  private _duplicateStacksComputing = false;
  // Spiderfy interaction can lose native 'click' due to d3.zoom gesture handling in some browsers.
  // Track press/release to reliably treat spiderfy node interactions like normal point clicks.
  private _spiderfyPressByPointerId = new Map<number, { x: number; y: number; t: number }>();

  // Computed properties with caching
  private get _scales(): ScalePair | null {
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
      const computedScales = DataProcessor.createScales(
        this._plotData,
        config.width,
        config.height,
        config.margin,
      ) as ScalePair | null;
      this._cachedScales = computedScales;
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

  private _syncWebglSelectionActive() {
    this._webglRenderer?.setSelectionActive(
      this.selectedProteinIds.length > 0 || this.highlightedProteinIds.length > 0,
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver.observe(this);

    this.addEventListener('legend-zorder-change', this._handleZOrderChange);
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
    if (this._zoomRafId !== null) {
      cancelAnimationFrame(this._zoomRafId);
      this._zoomRafId = null;
    }
    this._cancelDuplicateOverlayDebounce();
    this._cancelDuplicateStackCompute();
    this._clearDuplicateBadgesCanvas();

    super.disconnectedCallback();
    this.removeEventListener('legend-zorder-change', this._handleZOrderChange);
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

  private _handleZOrderChange = (event: Event) => {
    const customEvent = event as CustomEvent;
    this._zOrderMapping = customEvent.detail.zOrderMapping;
    // z-order affects GPU depth; force a fresh style getter cache so getDepth sees the new mapping
    this._styleGettersCache = null;

    // Trigger render (z-order is handled in WebGL depth; avoid CPU-sorting on every zoom/pan)
    if (this._plotData.length > 0) {
      // Force webgl update and invalidate virtualization cache to re-sort visible points
      this._webglRenderer?.invalidatePositionCache();
      this._webglRenderer?.invalidateStyleCache();
      this._invalidateVirtualizationCache();
      this._renderPlot();
    }
  };

  updated(changedProperties: Map<string, unknown>) {
    // When new data is loaded (or projection index changes), ensure the selection is valid.
    // This prevents a blank plot when switching from a dataset with many projections/features
    // to one with only a single projection/feature.
    if (
      (changedProperties.has('data') || changedProperties.has('selectedProjectionIndex')) &&
      this.data
    ) {
      const projectionsCount = Array.isArray(this.data.projections)
        ? this.data.projections.length
        : 0;
      if (!Number.isFinite(this.selectedProjectionIndex)) {
        this.selectedProjectionIndex = 0;
      } else if (projectionsCount > 0) {
        const clamped = Math.max(0, Math.min(this.selectedProjectionIndex, projectionsCount - 1));
        if (clamped !== this.selectedProjectionIndex) {
          this.selectedProjectionIndex = clamped;
        }
      } else if (this.selectedProjectionIndex !== 0) {
        this.selectedProjectionIndex = 0;
      }

      const featureKeys = Object.keys(this.data.features || {});
      if (this.selectedFeature && featureKeys.includes(this.selectedFeature)) {
        // ok
      } else {
        this.selectedFeature = featureKeys[0] || '';
        // Reset filters when the active feature changes due to a data swap
        this.hiddenFeatureValues = [];
        this.otherFeatureValues = [];
      }
    }

    if (
      changedProperties.has('data') ||
      changedProperties.has('selectedProjectionIndex') ||
      changedProperties.has('projectionPlane')
    ) {
      this._processData();
      this._scheduleQuadtreeRebuild();
      this._webglRenderer?.invalidatePositionCache();
      this._webglRenderer?.invalidateStyleCache();
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
      const prevDupUI = !!prev.enableDuplicateStackUI;
      const nextDupUI = !!this._mergedConfig.enableDuplicateStackUI;
      if (prevDupUI !== nextDupUI) {
        // Cancel any in-flight work and invalidate caches when toggling.
        this._cancelDuplicateOverlayDebounce();
        this._cancelDuplicateStackCompute();
        this._duplicateStacksCacheKey = null;
      }
      this._updateStyleSignature();
      this._webglRenderer?.invalidateStyleCache();
      this._webglRenderer?.setStyleSignature(this._styleSig);
      this._scheduleQuadtreeRebuild();
    }
    if (
      changedProperties.has('selectedFeature') ||
      changedProperties.has('hiddenFeatureValues') ||
      changedProperties.has('otherFeatureValues')
    ) {
      this._scheduleQuadtreeRebuild();
      this._webglRenderer?.invalidateStyleCache();
      // Visibility might change (points hidden/shown), so we must rebuild position buffer
      // to keep colors and positions in sync in the dense arrays
      this._webglRenderer?.invalidatePositionCache();
      this._updateStyleSignature();
      this._webglRenderer?.setStyleSignature(this._styleSig);
      if (changedProperties.has('selectedFeature')) {
        this._webglRenderer?.setSelectedFeature(this.selectedFeature);
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
        zOrderMapping: this._zOrderMapping,
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
      this._syncWebglSelectionActive();
      this._webglRenderer?.invalidateStyleCache();
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
      this._webglRenderer = new WebGLRenderer(
        this._canvas,
        () => this._scales,
        () => this._transform,
        () => this._mergedConfig,
        {
          getColors: (p: PlotDataPoint) => this._getColors(p),
          getPointSize: (p: PlotDataPoint) => this._getPointSize(p),
          getOpacity: (p: PlotDataPoint) => this._getOpacity(p),
          getDepth: (p: PlotDataPoint) => this._getDepth(p),
          getStrokeColor: (p: PlotDataPoint) => this._getStrokeColor(p),
          getStrokeWidth: (p: PlotDataPoint) => this._getStrokeWidth(p),
          getShape: (p: PlotDataPoint) => this._getPointShape(p),
        },
      );
      this._updateStyleSignature();
      this._webglRenderer.setStyleSignature(this._styleSig);
      this._webglRenderer.setSelectedFeature(this.selectedFeature);
      this._syncWebglSelectionActive();
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

    // z-order is resolved in WebGL depth (see style getters), so we avoid sorting 500k+ points on CPU.

    // Invalidate scales cache when plot data changes
    this._invalidateScalesCache();
    this._invalidateVirtualizationCache();
  }

  private _buildQuadtree() {
    if (!this._plotData.length || !this._scales) {
      this._duplicateStacks = [];
      this._duplicateStackByKey.clear();
      this._pointIdToDuplicateStackKey.clear();
      this._expandedDuplicateStackKey = null;
      this._duplicateStacksCacheKey = null;
      return;
    }
    const visiblePoints = this._plotData.filter((d) => this._getOpacity(d) > 0);
    this._quadtreeIndex.setScales(this._scales);
    this._quadtreeIndex.rebuild(visiblePoints);
    // Duplicate stacks are computed lazily for the current viewport (see _ensureDuplicateStacksForViewport)
    // to keep quadtree rebuilds fast on large datasets.
    this._duplicateStacks = [];
    this._duplicateStackByKey.clear();
    this._pointIdToDuplicateStackKey.clear();
    this._expandedDuplicateStackKey = null;
    this._duplicateStacksCacheKey = null;
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
        // Smooth WebGL rendering during zoom using requestAnimationFrame
        if (this._canvas) {
          if (this._zoomRafId !== null) {
            cancelAnimationFrame(this._zoomRafId);
          }
          this._zoomRafId = requestAnimationFrame(() => {
            this._zoomRafId = null;
            this._renderWebGL();
            // During active zoom/pan, defer duplicate badge DOM updates to keep interactions smooth.
            this._updateSelectionOverlays({ duplicateImmediate: false });
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
      if (!this._webglRenderer) {
        this._webglRenderer = new WebGLRenderer(
          this._canvas,
          () => this._scales,
          () => this._transform,
          () => this._mergedConfig,
          {
            getColors: (p: PlotDataPoint) => this._getColors(p),
            getPointSize: (p: PlotDataPoint) => this._getPointSize(p),
            getOpacity: (p: PlotDataPoint) => this._getOpacity(p),
            getDepth: (p: PlotDataPoint) => this._getDepth(p),
            getStrokeColor: (p: PlotDataPoint) => this._getStrokeColor(p),
            getStrokeWidth: (p: PlotDataPoint) => this._getStrokeWidth(p),
            getShape: (p: PlotDataPoint) => this._getPointShape(p),
          },
        );
        this._updateStyleSignature();
        this._webglRenderer.setStyleSignature(this._styleSig);
        this._webglRenderer.setSelectedFeature(this.selectedFeature);
      }
      this._webglRenderer.resize(width, height);
      this._webglRenderer.invalidatePositionCache();
    }

    // Keep badge canvas in sync with layout and DPR
    if (this._badgesCanvas) {
      const dpr = window.devicePixelRatio || 1;
      const physicalWidth = Math.max(1, Math.floor(width * dpr));
      const physicalHeight = Math.max(1, Math.floor(height * dpr));
      if (
        this._badgesCanvas.width !== physicalWidth ||
        this._badgesCanvas.height !== physicalHeight
      ) {
        this._badgesCanvas.width = physicalWidth;
        this._badgesCanvas.height = physicalHeight;
        this._badgesCanvas.style.width = `${width}px`;
        this._badgesCanvas.style.height = `${height}px`;
      }
    }

    if (this._svg) {
      this._svg.setAttribute('width', width.toString());
      this._svg.setAttribute('height', height.toString());
    }

    this._mergedConfig = { ...this._mergedConfig, width, height };
    this._invalidateVirtualizationCache();
    // Scales depend on width/height; rebuild spatial index to keep hit-testing accurate after resize
    this._scheduleQuadtreeRebuild();
    this._renderPlot();
    this._updateSelectionOverlays();
  }

  private _clearDuplicateBadgesCanvas() {
    if (!this._badgesCanvas) return;
    const ctx = this._badgesCanvas.getContext('2d');
    if (!ctx) return;
    // Clear in device pixels (canvas is sized to DPR).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._badgesCanvas.width, this._badgesCanvas.height);
  }

  private _renderDuplicateBadgesCanvas(
    stacks: Array<{ key: string; px: number; py: number; points: PlotDataPoint[] }>,
  ) {
    if (!this._badgesCanvas) return;
    const ctx = this._badgesCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = this._mergedConfig.width;
    const height = this._mergedConfig.height;

    // Work in CSS pixels for drawing; scale to device pixels once.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const t = this._transform;
    const badgeOffset = { x: 10, y: -10 };
    const r = 9;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 10px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';

    for (let i = 0; i < stacks.length; i++) {
      const s = stacks[i];
      const x = t.x + t.k * s.px + badgeOffset.x;
      const y = t.y + t.k * s.py + badgeOffset.y;
      const isExpanded = s.key === this._expandedDuplicateStackKey;

      ctx.fillStyle = isExpanded ? 'rgba(59, 130, 246, 0.9)' : 'rgba(17, 24, 39, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(s.points.length), x, y);
    }
  }

  // HiDPI setup and quality handled by WebGLRenderer

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
        // Keep the UX simple: no resize handles, just drag a rectangle.
        .handleSize(0)
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
      this._webglRenderer?.clear();
      return;
    }

    if (this._canvas && this._webglRenderer) {
      this._renderWebGL();
      this._setupCanvasEventHandling();
    }
  }

  private _renderWebGL() {
    if (!this._webglRenderer || !this._scales) return;
    const points = this._getPointsForRendering();
    if (points.length === 0) {
      this._webglRenderer.clear();
      return;
    }
    // Only track exact rendered IDs when we might truncate the dataset.
    // For typical datasets, tracking adds significant per-render overhead.
    this._webglRenderer.setTrackRenderedPointIds(points.length > MAX_POINTS_DIRECT_RENDER);
    this._webglRenderer.render(points);
    this._mainGroup?.selectAll('.protein-point').remove();
  }

  private _getPointsForRendering(): PlotDataPoint[] {
    if (!this._scales || this._plotData.length === 0) {
      this._visiblePlotData = [];
      return [];
    }

    // For smaller datasets, pass all points - renderer handles display mode
    if (this._plotData.length < VIRTUALIZATION_THRESHOLD || !this._quadtreeIndex.hasTree()) {
      this._visiblePlotData = this._plotData;
      return this._plotData;
    }

    // For very large datasets, apply viewport culling
    const config = this._mergedConfig;
    const transform = this._transform;
    const padding = VIRTUALIZATION_PADDING;

    const leftPx = transform.invertX(config.margin.left - padding);
    const rightPx = transform.invertX(config.width - config.margin.right + padding);
    const topPx = transform.invertY(config.margin.top - padding);
    const bottomPx = transform.invertY(config.height - config.margin.bottom + padding);

    const minX = Math.min(leftPx, rightPx);
    const maxX = Math.max(leftPx, rightPx);
    const minY = Math.min(topPx, bottomPx);
    const maxY = Math.max(topPx, bottomPx);

    const cacheKey = `${Math.round(transform.x)}|${Math.round(transform.y)}|${transform.k.toFixed(3)}|${config.width}|${config.height}`;
    if (this._virtualizationCacheKey !== cacheKey) {
      this._visiblePlotData = this._quadtreeIndex.queryByPixels(minX, minY, maxX, maxY);

      this._virtualizationCacheKey = cacheKey;
    }

    return this._visiblePlotData;
  }

  private _invalidateVirtualizationCache() {
    this._virtualizationCacheKey = null;
    this._visiblePlotData = this._plotData;
  }

  private _updateSelectionOverlays(options: { duplicateImmediate?: boolean } = {}) {
    if (!this._overlayGroup) return;
    this._overlayGroup.selectAll('.selected-overlay').remove();
    this._scheduleDuplicateOverlayUpdate(options.duplicateImmediate ?? true);
  }

  private _cancelDuplicateOverlayDebounce() {
    if (this._duplicateOverlayDebounceId !== null) {
      window.clearTimeout(this._duplicateOverlayDebounceId);
      this._duplicateOverlayDebounceId = null;
    }
  }

  private _cancelDuplicateStackCompute() {
    // Bump job id so any in-flight chunked compute aborts early.
    this._duplicateStacksComputeJobId++;
    this._duplicateStacksComputing = false;
  }

  private _scheduleDuplicateOverlayUpdate(immediate: boolean) {
    if (!this._overlayGroup) return;

    // When the feature is disabled, keep this lightweight and synchronous.
    if (!this._isDuplicateStackUIEnabled()) {
      this._updateDuplicateOverlays();
      return;
    }

    if (immediate) {
      this._cancelDuplicateOverlayDebounce();
      this._updateDuplicateOverlays();
      return;
    }

    // Cheap path: redraw existing badges with the current zoom transform (no recompute, no DOM churn).
    this._redrawDuplicateBadgesCanvasOnly();

    // Debounce to avoid DOM churn during pan/zoom.
    this._cancelDuplicateOverlayDebounce();
    this._duplicateOverlayDebounceId = window.setTimeout(() => {
      this._duplicateOverlayDebounceId = null;
      this._updateDuplicateOverlays();
    }, DUPLICATE_BADGES_UPDATE_DEBOUNCE_MS);
  }

  private _ensureDuplicateStacksForViewport(
    viewKey: string,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean {
    if (this._duplicateStacksCacheKey === viewKey) return true;
    if (this._duplicateStacksComputing) return false;

    this._duplicateStacksComputing = true;
    const jobId = ++this._duplicateStacksComputeJobId;

    // Query only the points currently in (or near) the viewport. This is the key perf win.
    const candidates = this._quadtreeIndex.queryByPixels(minX, minY, maxX, maxY);
    const scales = this._scales;
    if (!scales) {
      this._duplicateStacksComputing = false;
      return false;
    }

    const stackMap = new Map<
      string,
      { key: string; x: number; y: number; px: number; py: number; points: PlotDataPoint[] }
    >();
    const idToKey = new Map<string, string>();

    let idx = 0;
    const step = () => {
      if (jobId !== this._duplicateStacksComputeJobId) return; // cancelled
      const end = Math.min(candidates.length, idx + DUPLICATE_STACK_COMPUTE_CHUNK_SIZE);
      for (; idx < end; idx++) {
        const p = candidates[idx];
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        const key = `${p.x}|${p.y}`;
        let stack = stackMap.get(key);
        if (!stack) {
          stack = {
            key,
            x: p.x,
            y: p.y,
            px: scales.x(p.x),
            py: scales.y(p.y),
            points: [],
          };
          stackMap.set(key, stack);
        }
        stack.points.push(p);
        idToKey.set(p.id, key);
      }

      if (idx < candidates.length) {
        requestAnimationFrame(step);
        return;
      }

      // Finalize: keep only true duplicates.
      const stacks: Array<{
        key: string;
        x: number;
        y: number;
        px: number;
        py: number;
        points: PlotDataPoint[];
      }> = [];
      const byKey = new Map<
        string,
        { key: string; x: number; y: number; px: number; py: number; points: PlotDataPoint[] }
      >();

      for (const stack of stackMap.values()) {
        if (stack.points.length > 1) {
          stacks.push(stack);
          byKey.set(stack.key, stack);
        }
      }

      this._duplicateStacks = stacks;
      this._duplicateStackByKey = byKey;
      this._pointIdToDuplicateStackKey = idToKey;

      // If the expanded stack is no longer available for this viewport, collapse it.
      if (
        this._expandedDuplicateStackKey &&
        !this._duplicateStackByKey.has(this._expandedDuplicateStackKey)
      ) {
        this._expandedDuplicateStackKey = null;
      }

      this._duplicateStacksCacheKey = viewKey;
      this._duplicateStacksComputing = false;

      // Re-render overlays for the freshly computed viewport stacks.
      this._updateDuplicateOverlays();
    };

    requestAnimationFrame(step);
    return false;
  }

  private _capDuplicateStacksForRendering(
    stacks: Array<{ key: string; px: number; py: number; points: PlotDataPoint[] }>,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): Array<{ key: string; px: number; py: number; points: PlotDataPoint[] }> {
    let stacksToRender = stacks;

    if (stacksToRender.length > DUPLICATE_BADGES_MAX_VISIBLE) {
      stacksToRender = [...stacksToRender]
        .sort((a, b) => b.points.length - a.points.length)
        .slice(0, DUPLICATE_BADGES_MAX_VISIBLE);

      // Ensure the expanded stack remains visible even if it is not in the top-N.
      if (
        this._expandedDuplicateStackKey &&
        !stacksToRender.some((s) => s.key === this._expandedDuplicateStackKey)
      ) {
        const expanded = this._duplicateStackByKey.get(this._expandedDuplicateStackKey);
        if (
          expanded &&
          expanded.px >= minX &&
          expanded.px <= maxX &&
          expanded.py >= minY &&
          expanded.py <= maxY
        ) {
          stacksToRender = [...stacksToRender, expanded];
        }
      }
    }

    return stacksToRender;
  }

  private _redrawDuplicateBadgesCanvasOnly() {
    if (!this._isDuplicateStackUIEnabled() || this.selectionMode) {
      this._clearDuplicateBadgesCanvas();
      return;
    }
    if (!this._scales) return;

    const config = this._mergedConfig;
    const padding = DUPLICATE_BADGES_VIEWPORT_PADDING;
    const leftPx = this._transform.invertX(config.margin.left - padding);
    const rightPx = this._transform.invertX(config.width - config.margin.right + padding);
    const topPx = this._transform.invertY(config.margin.top - padding);
    const bottomPx = this._transform.invertY(config.height - config.margin.bottom + padding);

    const minX = Math.min(leftPx, rightPx);
    const maxX = Math.max(leftPx, rightPx);
    const minY = Math.min(topPx, bottomPx);
    const maxY = Math.max(topPx, bottomPx);

    const visibleStacks = this._duplicateStacks.filter(
      (s) => s.px >= minX && s.px <= maxX && s.py >= minY && s.py <= maxY,
    );
    const stacksToRender = this._capDuplicateStacksForRendering(
      visibleStacks,
      minX,
      minY,
      maxX,
      maxY,
    );

    // Note: canvas drawing uses screen coordinates and already keeps badge size constant.
    this._renderDuplicateBadgesCanvas(stacksToRender);
  }

  private _ensureDuplicateSpiderfyLayer() {
    if (!this._overlayGroup) return null;
    let spiderfyLayer = this._overlayGroup.select<SVGGElement>('g.duplicate-spiderfy-layer');
    if (spiderfyLayer.empty()) {
      spiderfyLayer = this._overlayGroup.append('g').attr('class', 'duplicate-spiderfy-layer');
    }
    return spiderfyLayer;
  }

  private _updateDuplicateOverlays() {
    if (!this._overlayGroup || !this._scales) return;

    if (!this._isDuplicateStackUIEnabled()) {
      // Remove both to clean up older DOM from previous versions.
      this._overlayGroup.selectAll('g.duplicate-stacks-layer, g.duplicate-spiderfy-layer').remove();
      this._expandedDuplicateStackKey = null;
      this._clearDuplicateBadgesCanvas();
      return;
    }

    // Don't show stack UI while brushing/selecting.
    if (this.selectionMode) {
      this._overlayGroup.selectAll('g.duplicate-stacks-layer, g.duplicate-spiderfy-layer').remove();
      this._expandedDuplicateStackKey = null;
      this._clearDuplicateBadgesCanvas();
      return;
    }

    const spiderfyLayer = this._ensureDuplicateSpiderfyLayer();
    if (!spiderfyLayer) return;

    const k = this._transform.k || 1;
    const config = this._mergedConfig;
    const viewKey = `${Math.round(this._transform.x)}|${Math.round(this._transform.y)}|${k.toFixed(3)}|${config.width}|${config.height}`;

    // Compute visible window in "base pixel space" (same as quadtree indexing).
    const padding = DUPLICATE_BADGES_VIEWPORT_PADDING;
    const leftPx = this._transform.invertX(config.margin.left - padding);
    const rightPx = this._transform.invertX(config.width - config.margin.right + padding);
    const topPx = this._transform.invertY(config.margin.top - padding);
    const bottomPx = this._transform.invertY(config.height - config.margin.bottom + padding);

    const minX = Math.min(leftPx, rightPx);
    const maxX = Math.max(leftPx, rightPx);
    const minY = Math.min(topPx, bottomPx);
    const maxY = Math.max(topPx, bottomPx);

    // Ensure we have duplicate stacks for the current viewport before trying to render.
    if (!this._ensureDuplicateStacksForViewport(viewKey, minX, minY, maxX, maxY)) {
      // Keep existing DOM as-is until computation finishes; _updateDuplicateOverlays will rerun.
      return;
    }

    const visibleStacks = this._duplicateStacks.filter(
      (s) => s.px >= minX && s.px <= maxX && s.py >= minY && s.py <= maxY,
    );

    // --- Badges (N) ---
    const stacksToRender = this._capDuplicateStacksForRendering(
      visibleStacks,
      minX,
      minY,
      maxX,
      maxY,
    );

    // Phase 3: render badges via a lightweight 2D canvas overlay (much faster than many SVG nodes).
    // Spiderfy remains in SVG for interaction.
    this._renderDuplicateBadgesCanvas(stacksToRender);

    // --- Spiderfy ---
    spiderfyLayer.selectAll('*').remove();
    if (!this._expandedDuplicateStackKey) return;

    const stack = this._duplicateStackByKey.get(this._expandedDuplicateStackKey);
    if (!stack) {
      this._expandedDuplicateStackKey = null;
      return;
    }

    // Hide spiderfy if the stack is off-screen (e.g., after a zoom/pan).
    if (!(stack.px >= minX && stack.px <= maxX && stack.py >= minY && stack.py <= maxY)) {
      this._expandedDuplicateStackKey = null;
      return;
    }

    const points = stack.points;
    const n = points.length;
    // Ring radius in screen pixels (kept constant by scale(1/k) below)
    const ringRadius = Math.min(70, Math.max(22, 12 + n * 2));
    const nodeRadius = 5;

    const spiderGroup = spiderfyLayer
      .append('g')
      .attr('class', 'dup-spiderfy')
      // Keep spiderfy UI constant-size in screen pixels via scale(1/k)
      .attr('transform', `translate(${stack.px},${stack.py}) scale(${1 / k})`);

    const items = points.map((p, idx) => {
      const angle = (idx / n) * Math.PI * 2 - Math.PI / 2;
      const x = ringRadius * Math.cos(angle);
      const y = ringRadius * Math.sin(angle);
      return { point: p, idx, x, y };
    });

    // Leader lines
    spiderGroup
      .selectAll('line.dup-spiderfy-line')
      .data(items)
      .enter()
      .append('line')
      .attr('class', 'dup-spiderfy-line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (d) => d.x)
      .attr('y2', (d) => d.y);

    // Clickable nodes
    const nodes = spiderGroup
      .selectAll('g.dup-spiderfy-node')
      .data(items)
      .enter()
      .append('g')
      .attr('class', 'dup-spiderfy-node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Create circles with explicit pointer-events and handle selection via pointer press/release.
    // We avoid relying on the native 'click' event because it can be suppressed by d3.zoom gesture handling.
    nodes
      .append('circle')
      .attr('class', 'dup-spiderfy-node-circle')
      .attr('r', nodeRadius)
      .attr('fill', (d) => this._getColors(d.point)[0] ?? '#888888')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('pointerdown', (event) => {
        event.stopPropagation();
        const pe = event as PointerEvent;
        if (typeof pe.pointerId === 'number') {
          this._spiderfyPressByPointerId.set(pe.pointerId, {
            x: pe.clientX,
            y: pe.clientY,
            t: Date.now(),
          });
        }
        // Keep pointer events routed to this element even if the pointer moves slightly.
        const el = event.currentTarget as HTMLElement | null;
        if (el && typeof el.setPointerCapture === 'function' && typeof pe.pointerId === 'number') {
          try {
            el.setPointerCapture(pe.pointerId);
          } catch {
            // ignore
          }
        }
      })
      .on('pointerup', (event, d) => {
        event.stopPropagation();
        const pe = event as PointerEvent;
        const rec =
          typeof pe.pointerId === 'number'
            ? this._spiderfyPressByPointerId.get(pe.pointerId)
            : undefined;
        if (typeof pe.pointerId === 'number') this._spiderfyPressByPointerId.delete(pe.pointerId);
        if (!rec) return;

        // Treat a short, low-movement press/release as a click.
        const dx = pe.clientX - rec.x;
        const dy = pe.clientY - rec.y;
        const dist2 = dx * dx + dy * dy;
        const dt = Date.now() - rec.t;
        if (dist2 <= 16 && dt <= 700) {
          this._handleClick(event as unknown as MouseEvent, d.point);
        }
      })
      .on('lostpointercapture', (event) => {
        const pe = event as PointerEvent;
        if (typeof pe.pointerId === 'number') this._spiderfyPressByPointerId.delete(pe.pointerId);
      })
      .on('pointercancel', (event) => {
        const pe = event as PointerEvent;
        if (typeof pe.pointerId === 'number') this._spiderfyPressByPointerId.delete(pe.pointerId);
      })
      .on('mouseenter', (event, d) => {
        // Show the real tooltip for the hovered protein (not the stack centroid)
        this._handleMouseOver(event as unknown as MouseEvent, d.point);
      })
      .on('mouseleave', () => {
        this._clearHoverState();
      });
  }

  private _toggleSpiderfy(stackKey: string) {
    this._expandedDuplicateStackKey =
      this._expandedDuplicateStackKey === stackKey ? null : stackKey;
    this._updateDuplicateOverlays();
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

  private _getDepth(point: PlotDataPoint): number {
    const getters = this._getStyleGetters();
    return getters.getDepth(point);
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
        zOrderMapping: this._zOrderMapping,
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

    if (this._hoveredProteinId !== point.id) {
      this._hoveredProteinId = point.id;
      this.dispatchEvent(
        new CustomEvent('protein-hover', {
          detail: { proteinId: point.id, point },
          bubbles: true,
        }),
      );
    }
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
        composed: true,
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
      // Don't hover hidden points (opacity=0)
      if (this._getOpacity(nearestPoint) === 0) {
        this._clearHoverState();
        return;
      }

      // Verify the point is actually rendered (not excluded due to point limits)
      if (this._webglRenderer && !this._webglRenderer.isPointRendered(nearestPoint.id)) {
        // Point exists in spatial index but isn't rendered - clear tooltip
        this._clearHoverState();
        return;
      }

      // Calculate actual distance to verify it's within the point
      const pointX = this._scales.x(nearestPoint.x);
      const pointY = this._scales.y(nearestPoint.y);
      const distance = Math.sqrt(Math.pow(dataX - pointX, 2) + Math.pow(dataY - pointY, 2));
      const pointRadius = Math.sqrt(this._getPointSize(nearestPoint)) / 3;

      if (distance <= pointRadius) {
        this._handleMouseOver(event, nearestPoint);
        return;
      }
    }

    // No point found, clear hover state if it exists
    this._clearHoverState();
  }

  /**
   * Handle click events for canvas rendering
   */
  private _handleCanvasClick(event: MouseEvent): void {
    if (!this._scales) return;

    // If the click originated from the spiderfy UI, let the spiderfy handlers deal with it.
    // This avoids collapsing the expanded stack (and early-returning) before a spiderfy node can be selected.
    const target = event.target as Element | null;
    if (target?.closest('.dup-spiderfy')) {
      return;
    }

    // Clicking anywhere outside the expanded stack collapses it.
    const hadExpanded = !!this._expandedDuplicateStackKey;
    if (this._expandedDuplicateStackKey) {
      this._expandedDuplicateStackKey = null;
      this._updateDuplicateOverlays();
    }

    const [mouseX, mouseY] = d3.pointer(event);

    // Transform mouse coordinates to data space
    const dataX = (mouseX - this._transform.x) / this._transform.k;
    const dataY = (mouseY - this._transform.y) / this._transform.k;

    // Find nearest point using spatial index
    const searchRadius = 15 / this._transform.k;
    const nearestPoint = this._quadtreeIndex.findNearest(dataX, dataY, searchRadius);

    if (nearestPoint) {
      // Don't click hidden points (opacity=0)
      if (this._getOpacity(nearestPoint) === 0) {
        return;
      }

      // Verify the point is actually rendered (not excluded due to point limits)
      if (this._webglRenderer && !this._webglRenderer.isPointRendered(nearestPoint.id)) {
        return;
      }

      // Calculate actual distance to verify it's within the point
      const pointX = this._scales.x(nearestPoint.x);
      const pointY = this._scales.y(nearestPoint.y);
      const distance = Math.sqrt(Math.pow(dataX - pointX, 2) + Math.pow(dataY - pointY, 2));
      const pointRadius = Math.sqrt(this._getPointSize(nearestPoint)) / 3;

      if (distance <= pointRadius) {
        if (this._isDuplicateStackUIEnabled()) {
          // If this point belongs to a duplicate stack, spiderfy instead of picking an arbitrary member.
          const stackKey = this._pointIdToDuplicateStackKey.get(nearestPoint.id);
          const stack = stackKey ? this._duplicateStackByKey.get(stackKey) : undefined;
          if (stack && stack.points.length > 1) {
            this._toggleSpiderfy(stack.key);
            return;
          }
        }

        // If we just collapsed an expanded stack, treat this click as a "dismiss" click.
        // This prevents accidental selection when the user is simply trying to close the spiderfy UI.
        if (hadExpanded) return;

        this._handleClick(event, nearestPoint);
      }
    }
  }

  /**
   * Handle mouse out events for canvas rendering
   */
  private _handleCanvasMouseOut(): void {
    this._clearHoverState();
  }

  private _clearHoverState(): void {
    if (this._tooltipData) {
      this._tooltipData = null;
    }

    // Dispatch "hover cleared" signal so other components can reset their hover UI.
    if (this._hoveredProteinId !== null) {
      this._hoveredProteinId = null;
      this.dispatchEvent(
        new CustomEvent('protein-hover', {
          detail: { proteinId: null, point: null },
          bubbles: true,
        }),
      );
    }
  }

  resetZoom() {
    if (this._zoom && this._svgSelection) {
      this._svgSelection.transition().duration(750).call(this._zoom.transform, d3.zoomIdentity);
    }
  }

  private _getCurrentProjectionMetadata(): Record<string, unknown> | undefined {
    if (!this.data || !this.data.projections[this.selectedProjectionIndex]) {
      return undefined;
    }
    return this.data.projections[this.selectedProjectionIndex].metadata;
  }

  private _renderProjectionMetadata() {
    const metadata = this._getCurrentProjectionMetadata();
    if (!metadata || Object.keys(metadata).length === 0) {
      return '';
    }

    // Filter out dimension, dimensions, and projection name fields
    let displayMetadata = Object.entries(metadata).filter(([key]) => {
      const lowerKey = key.toLowerCase();
      return lowerKey !== 'dimension' && lowerKey !== 'dimensions' && lowerKey !== 'name';
    });

    // Parse JSON fields (like "info", "info_json", etc.)
    const parsedMetadata: Array<[string, unknown]> = [];
    for (const [key, value] of displayMetadata) {
      const lowerKey = key.toLowerCase();
      if (
        (lowerKey === 'info' || lowerKey === 'info_json' || lowerKey.includes('json')) &&
        typeof value === 'string'
      ) {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null) {
            // Flatten the JSON object into individual fields
            for (const [subKey, subValue] of Object.entries(parsed)) {
              parsedMetadata.push([subKey, subValue]);
            }
            continue; // Skip adding the original JSON string
          }
        } catch {
          // If parsing fails, keep the original value
        }
      }
      parsedMetadata.push([key, value]);
    }

    if (parsedMetadata.length === 0) {
      return '';
    }

    return html`
      <div class="projection-metadata">
        <div class="projection-metadata-label">
          <span>Projection Metadata</span>
        </div>
        <div class="projection-metadata-content">
          ${parsedMetadata.map(
            ([key, value]) => html`
              <div class="projection-metadata-item">
                <span class="projection-metadata-key">${this._formatMetadataKey(key)}:</span>
                <span class="projection-metadata-value"
                  >${this._formatMetadataValue(value, key)}</span
                >
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _formatMetadataKey(key: string): string {
    // Convert snake_case or camelCase to Title Case
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  private _formatMetadataValue(value: unknown, key?: string): string {
    if (value == null) return 'N/A';

    const lowerKey = key?.toLowerCase() || '';
    const isVarianceRatio =
      lowerKey.includes('explained_variance') || lowerKey.includes('variance_ratio');

    // Handle arrays
    if (Array.isArray(value)) {
      const formattedValues = value.map((item) => {
        if (typeof item === 'number') {
          if (item % 1 === 0) return item.toString();
          return isVarianceRatio ? item.toFixed(2) : item.toFixed(3);
        }
        return String(item);
      });
      return formattedValues.join(', ');
    }

    if (typeof value === 'number') {
      // Format numbers with appropriate precision
      if (value % 1 === 0) {
        return value.toString();
      }
      // Use 2 decimal places for explained variance ratio
      if (isVarianceRatio) {
        return value.toFixed(2);
      }
      return value.toFixed(3);
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  render() {
    const config = this._mergedConfig;

    return html`
      <div class="container">
        <!-- Canvas for high-performance rendering (always visible for better performance) -->
        <canvas style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 1;">
        </canvas>

        <!-- Canvas overlay for duplicate count badges (faster than SVG for large numbers of badges) -->
        <canvas
          class="badges-canvas"
          style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 2;"
        ></canvas>

        <!-- SVG overlay for interactions and UI elements -->
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 ${config.width} ${config.height}"
          style="position: absolute; top: 0; left: 0; max-width: ${config.width}px; max-height: ${config.height}px; z-index: 3; background: transparent;"
        ></svg>

        ${this._renderProjectionMetadata()}
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
        ${this.selectionMode || this.selectedProteinIds.length > 0
          ? html`
              <div
                class="mode-indicator"
                style="z-index: 10; display: flex; flex-direction: column; gap: 4px;"
              >
                ${this.selectionMode ? html`<div>Selection Mode</div>` : ''}
                ${this.selectedProteinIds.length > 0
                  ? html`<div style="font-size: 11px; opacity: 0.8;">
                      ${this.selectedProteinIds.length} proteins selected
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
    if (this._webglRenderer) {
      this._webglRenderer.invalidatePositionCache();
      this._webglRenderer.invalidateStyleCache();
      this._updateStyleSignature();
      this._webglRenderer.setStyleSignature(this._styleSig);
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
    if (this._webglRenderer) {
      this._webglRenderer.invalidatePositionCache();
      this._webglRenderer.invalidateStyleCache();
      this._updateStyleSignature();
      this._webglRenderer.setStyleSignature(this._styleSig);
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
