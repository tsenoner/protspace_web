/**
 * Export utilities for ProtSpace visualizations
 */

// PDF generation libraries are imported dynamically for better browser compatibility
declare const window: Window & typeof globalThis;

export interface ExportableData {
  protein_ids: string[];
  features: Record<
    string,
    {
      values: (string | null)[];
      colors: string[];
      shapes: string[];
    }
  >;
  feature_data: Record<string, number[][]>;
  projections?: Array<{ name: string }>;
}

export interface ExportableElement extends Element {
  getCurrentData(): ExportableData | null;
  selectedFeature: string;
  selectedProteinIds?: string[];
  hiddenFeatureValues?: string[];
}

// Narrow typing for accessing the legend component from this utils package
type LegendExportItem = {
  value: string | null | 'Other';
  color: string;
  shape: string;
  count: number;
  isVisible: boolean;
  zOrder: number;
  extractedFromOther?: boolean;
};
type LegendExportState = {
  feature: string;
  includeShapes: boolean;
  items: LegendExportItem[];
};

export interface ExportOptions {
  includeSelection?: boolean;
  exportName?: string;
  scaleForExport?: number;
  maxLegendItems?: number;
  backgroundColor?: string;
  /**
   * Whether the exported legend should render per-category shapes.
   * If omitted, we will mirror the current scatterplot setting (`protspace-scatterplot.useShapes`).
   */
  includeShapes?: boolean;
  /**
   * Scale factor for legend elements (fonts, symbols, spacing) in exports.
   * Defaults to 1.0. Use larger values (e.g., 1.3-1.5) for better readability.
   */
  legendScaleFactor?: number;
}

export class ProtSpaceExporter {
  // Export configuration constants
  private static readonly LEGEND_WIDTH_RATIO = 0.25;
  private static readonly LEGEND_SCALE_FACTOR = 1.4;
  private static readonly PNG_SCALE = 2;
  private static readonly PDF_SCALE = 3;
  private static readonly DEFAULT_BACKGROUND = '#ffffff';
  private static readonly PDF_MARGIN = 2; // mm
  private static readonly PDF_GAP = 4; // mm
  private static readonly PDF_MAX_WIDTH = 210; // A4 width in mm

  private element: ExportableElement;
  private selectedProteins: string[];
  private isolationMode: boolean;

  constructor(
    element: ExportableElement,
    selectedProteins: string[] = [],
    isolationMode: boolean = false,
  ) {
    this.element = element;
    this.selectedProteins = selectedProteins;
    this.isolationMode = isolationMode;
  }

  /**
   * Get the scatterplot element from the DOM
   */
  private getScatterplotElement(): HTMLElement | null {
    const element = document.querySelector('protspace-scatterplot') as HTMLElement;
    if (!element) {
      console.error('Could not find protspace-scatterplot element');
    }
    return element;
  }

  /**
   * Get export options with defaults applied
   */
  private getOptionsWithDefaults(options: ExportOptions = {}) {
    return {
      backgroundColor: options.backgroundColor || ProtSpaceExporter.DEFAULT_BACKGROUND,
      scaleForExport: options.scaleForExport,
      legendScaleFactor: options.legendScaleFactor ?? ProtSpaceExporter.LEGEND_SCALE_FACTOR,
      exportName: options.exportName,
      includeSelection: options.includeSelection,
      includeShapes: options.includeShapes,
      maxLegendItems: options.maxLegendItems,
    };
  }

  /**
   * Check if an element should be ignored during export (UI overlays, tooltips, etc.)
   */
  private shouldIgnoreElement(element: Element): boolean {
    const ignoredClasses = [
      'projection-metadata',
      'mode-indicator',
      'isolation-indicator',
      'tooltip',
      'duplicate-spiderfy-layer',
      'dup-spiderfy',
      'overlay-container',
      'brush-container',
    ];
    return ignoredClasses.some((className) => element.classList?.contains(className));
  }

  /**
   * Generate legend canvas for export
   */
  private generateLegendCanvas(
    scatterCanvas: HTMLCanvasElement,
    options: ReturnType<typeof this.getOptionsWithDefaults>,
  ): HTMLCanvasElement {
    const legendItems = this.buildLegendItems(options);
    const legendExportState = this.readLegendExportState();
    const featureNameFromLegend = legendExportState?.feature;

    const legendWidth = Math.round(scatterCanvas.width * ProtSpaceExporter.LEGEND_WIDTH_RATIO);

    return this.renderLegendToCanvas(
      legendItems,
      legendWidth,
      scatterCanvas.height,
      options,
      featureNameFromLegend || this.element.selectedFeature,
      options.legendScaleFactor,
    );
  }

  /**
   * Capture scatterplot element as canvas with borders cropped out
   */
  private async captureScatterplotCanvas(
    scatterplotElement: HTMLElement,
    scale: number,
    backgroundColor: string,
  ): Promise<HTMLCanvasElement> {
    const { default: html2canvas } = await import('html2canvas-pro');

    // Capture WITH the border - don't modify live element to avoid triggering ResizeObserver
    const rawCanvas = await html2canvas(scatterplotElement, {
      backgroundColor,
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: scatterplotElement.clientWidth,
      height: scatterplotElement.clientHeight,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      ignoreElements: (element) => this.shouldIgnoreElement(element),
    });

    // Crop the 1px border from all sides
    const borderWidth = 1 * scale;
    return this.cropCanvas(
      rawCanvas,
      borderWidth,
      borderWidth,
      rawCanvas.width - borderWidth * 2,
      rawCanvas.height - borderWidth * 2,
    );
  }

  /**
   * Crop a canvas to remove borders
   */
  private cropCanvas(
    sourceCanvas: HTMLCanvasElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): HTMLCanvasElement {
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const ctx = croppedCanvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context for cropped canvas');
      return sourceCanvas;
    }
    ctx.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height);
    return croppedCanvas;
  }

  /**
   * Build legend items for export from live legend state or computed data
   */
  private buildLegendItems(options: ExportOptions): Array<{
    value: string;
    color: string;
    shape: string;
    count: number;
    feature: string;
  }> {
    const currentData = this.element.getCurrentData();
    if (!currentData) return [];

    const legendExportState = this.readLegendExportState();
    const featureNameFromLegend = legendExportState?.feature;
    const hiddenSet = this.readHiddenFeatureValueKeys();

    if (legendExportState) {
      return legendExportState.items
        .filter((it) => it.isVisible)
        .map((it) => ({
          value: it.value === null ? 'N/A' : String(it.value),
          color: it.color,
          shape: it.shape,
          count: it.count,
          feature: featureNameFromLegend || this.element.selectedFeature,
        }));
    }

    return this.computeLegendFromData(
      currentData,
      this.element.selectedFeature,
      options.includeSelection === true ? this.selectedProteins : undefined,
    ).filter((it) => {
      const key = it.value === 'N/A' ? 'null' : it.value;
      return !hiddenSet.has(key);
    });
  }

  /**
   * Export current data as JSON
   */
  exportJSON(options: ExportOptions = {}): void {
    const data = this.element.getCurrentData();
    if (!data) {
      console.error('No data available for export');
      return;
    }

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportName =
      options.exportName || (this.isolationMode ? 'protspace_data_split' : 'protspace_data');

    this.downloadFile(dataUri, `${exportName}.json`);
  }

  /**
   * Export protein IDs as text file
   */
  exportProteinIds(_options: ExportOptions = {}): void {
    const data = this.element.getCurrentData();
    if (!data) {
      console.error('No data available for export');
      return;
    }

    // Compute visibility based on the scatterplot's current hidden feature values
    const selectedFeature = this.element.selectedFeature;
    const featureIndices = data.feature_data?.[selectedFeature];
    const featureInfo = data.features?.[selectedFeature];
    const hiddenValues: string[] = Array.isArray(this.element.hiddenFeatureValues)
      ? (this.element.hiddenFeatureValues as string[])
      : [];

    let visibleIds: string[] = [];
    if (featureIndices && featureInfo && Array.isArray(featureInfo.values)) {
      const hiddenSet = new Set(hiddenValues);
      visibleIds = data.protein_ids.filter((_id, i) => {
        const viArray = featureIndices[i];
        // A protein is visible if at least one of its feature values is not hidden
        if (!Array.isArray(viArray) || viArray.length === 0) {
          return !hiddenSet.has('null');
        }
        return viArray.some((vi) => {
          const value: string | null =
            typeof vi === 'number' && vi >= 0 && vi < featureInfo.values.length
              ? (featureInfo.values[vi] ?? null)
              : null;
          const key = value === null ? 'null' : String(value);
          return !hiddenSet.has(key);
        });
      });
    } else {
      // Fallback: if we cannot determine feature visibility, export all ids
      visibleIds = data.protein_ids || [];
    }

    const idsStr = visibleIds.join('\n');
    const idsUri = `data:text/plain;charset=utf-8,${encodeURIComponent(idsStr)}`;
    const fileName = 'protein_ids.txt';

    this.downloadFile(idsUri, fileName);
  }

  /**
   * Export visualization as a single PNG with a programmatic legend on the right (legend width = 1/5 of total)
   */
  async exportPNG(options: ExportOptions = {}): Promise<void> {
    try {
      await this.exportCombinedPNG(options);
    } catch (error) {
      console.error('PNG export failed:', error);
      throw error;
    }
  }

  /**
   * Create a combined PNG by compositing the scatterplot on the left and a generated legend on the right
   * Legend takes 30% of the final width with improved sizing for readability
   */
  private async exportCombinedPNG(options: ExportOptions = {}): Promise<void> {
    const scatterplotElement = this.getScatterplotElement();
    if (!scatterplotElement) return;

    const opts = this.getOptionsWithDefaults(options);

    // Capture scatterplot with border removed
    const scatterCanvas = await this.captureScatterplotCanvas(
      scatterplotElement,
      opts.scaleForExport ?? ProtSpaceExporter.PNG_SCALE,
      opts.backgroundColor,
    );

    // Generate legend canvas
    const legendCanvas = this.generateLegendCanvas(scatterCanvas, opts);

    // Composite scatterplot and legend
    const combinedWidth = Math.round(
      scatterCanvas.width * (1 + ProtSpaceExporter.LEGEND_WIDTH_RATIO),
    );
    const outCanvas = document.createElement('canvas');
    outCanvas.width = combinedWidth;
    outCanvas.height = scatterCanvas.height;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context for output canvas');
      return;
    }

    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, combinedWidth, scatterCanvas.height);
    ctx.drawImage(scatterCanvas, 0, 0);
    ctx.drawImage(legendCanvas, scatterCanvas.width, 0);

    // Download
    const dataUrl = outCanvas.toDataURL('image/png');
    const fileName = opts.exportName ? `${opts.exportName}_combined.png` : 'protspace_combined.png';
    this.downloadFile(dataUrl, fileName);
  }

  /**
   * Compute legend items (value, color, shape, count) from raw data and selected feature.
   * If selectedProteinIds provided, counts will be based on the selection subset.
   */
  private computeLegendFromData(
    data: ExportableData,
    selectedFeature: string,
    selectedProteinIds?: string[],
  ): Array<{
    value: string;
    color: string;
    shape: string;
    count: number;
    feature: string;
  }> {
    const feature = selectedFeature || Object.keys(data.features || {})[0] || '';
    const featureInfo = data.features?.[feature];
    const indices = data.feature_data?.[feature];
    if (!featureInfo || !indices || !Array.isArray(featureInfo.values)) {
      return [];
    }

    // Map protein id -> index for selection filtering
    let allowedIndexSet: Set<number> | null = null;
    if (selectedProteinIds && Array.isArray(selectedProteinIds) && selectedProteinIds.length > 0) {
      const idToIndex = new Map<string, number>();
      for (let i = 0; i < data.protein_ids.length; i += 1) {
        idToIndex.set(data.protein_ids[i], i);
      }
      allowedIndexSet = new Set<number>();
      selectedProteinIds.forEach((pid) => {
        const idx = idToIndex.get(pid);
        if (typeof idx === 'number') allowedIndexSet!.add(idx);
      });
    }

    const counts = new Array(featureInfo.values.length).fill(0) as number[];
    for (let i = 0; i < indices.length; i += 1) {
      if (allowedIndexSet && !allowedIndexSet.has(i)) continue;
      const viArray = indices[i];
      if (Array.isArray(viArray)) {
        for (const vi of viArray) {
          if (typeof vi === 'number' && vi >= 0 && vi < counts.length) {
            counts[vi] += 1;
          }
        }
      }
    }

    const items: Array<{
      value: string;
      color: string;
      shape: string;
      count: number;
      feature: string;
    }> = [];
    for (let i = 0; i < featureInfo.values.length; i += 1) {
      const value = featureInfo.values[i] ?? 'N/A';
      const color = featureInfo.colors?.[i] ?? '#888';
      const shape = featureInfo.shapes?.[i] ?? 'circle';
      const count = counts[i] ?? 0;
      items.push({ value: String(value), color, shape, count, feature });
    }
    return items;
  }

  /**
   * Render a legend using Canvas 2D API (no dependency on legend component)
   */
  private renderLegendToCanvas(
    items: Array<{
      value: string;
      color: string;
      shape: string;
      count: number;
      feature: string;
    }>,
    width: number,
    height: number,
    options: ExportOptions,
    overrideFeatureName?: string,
    scaleFactor: number = 1.0,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(100, Math.floor(width));
    canvas.height = Math.max(100, Math.floor(height));
    const ctx = canvas.getContext('2d')!;

    const basePadding = 24;
    const baseHeaderHeight = 60;
    const baseItemHeight = 56;
    const baseSymbolSize = 28;
    const baseHeaderFont = 28;
    const baseItemFont = 24;

    const padding = basePadding * scaleFactor;
    const headerHeight = baseHeaderHeight * scaleFactor;
    const itemHeight = baseItemHeight * scaleFactor;
    const symbolSize = baseSymbolSize * scaleFactor;
    const headerFontSize = baseHeaderFont * scaleFactor;
    const itemFontSize = baseItemFont * scaleFactor;
    const bg = options.backgroundColor || '#ffffff';

    // Compute required height
    const required = padding + headerHeight + items.length * itemHeight + padding;
    const scaleY = Math.min(1, canvas.height / required);
    const scaleX = 1; // keep width as-is for readability
    ctx.save();
    ctx.scale(scaleX, scaleY);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width / scaleX, canvas.height / scaleY);

    ctx.fillStyle = '#1f2937';
    ctx.font = `600 ${headerFontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    const headerLabel = overrideFeatureName || items[0]?.feature || 'Legend';
    ctx.fillText(`${headerLabel}`, padding, padding + headerHeight / 2);

    // Items
    let y = padding + headerHeight;
    const includeShapes =
      typeof options.includeShapes === 'boolean'
        ? options.includeShapes
        : this.readUseShapesFromScatterplot();

    for (const it of items) {
      const cx = padding + symbolSize / 2;
      const cy = y + itemHeight / 2;
      if (includeShapes) {
        this.drawCanvasSymbol(ctx, it.shape, it.color, cx, cy, symbolSize);
      } else {
        // Draw a simple color swatch (circle) to match no-shape mode
        ctx.save();
        ctx.fillStyle = it.color || '#888';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, symbolSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#1f2937';
      ctx.font = `500 ${itemFontSize}px Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      const textOffset = 8 * scaleFactor;
      ctx.fillText(it.value, padding + symbolSize + textOffset, cy);

      const countStr = String(it.count);
      ctx.font = `500 ${itemFontSize}px Arial, sans-serif`;
      ctx.fillStyle = '#4b5563';
      const countX =
        padding + symbolSize + textOffset + ctx.measureText(it.value).width + 12 * scaleFactor;
      ctx.fillText(countStr, countX, cy);

      y += itemHeight;
    }

    ctx.restore();
    return canvas;
  }

  /**
   * Read the current `useShapes` flag from the live `protspace-scatterplot` web component.
   * Defaults to false if not available so exported legends match the common default.
   */
  private readUseShapesFromScatterplot(): boolean {
    const el = document.querySelector('protspace-scatterplot') as
      | (Element & { useShapes?: boolean })
      | null;
    if (el && typeof el.useShapes === 'boolean') {
      return Boolean(el.useShapes);
    }
    return false;
  }

  /**
   * Read hidden feature values from the live scatterplot so exports mirror visibility.
   * Returns keys in the same format used internally (e.g., "null" for null values).
   */
  private readHiddenFeatureValueKeys(): Set<string> {
    try {
      const raw = Array.isArray(this.element.hiddenFeatureValues)
        ? (this.element.hiddenFeatureValues as string[])
        : [];
      return new Set(raw);
    } catch (_e) {
      console.error('Error reading hidden feature values:', _e);
      return new Set<string>();
    }
  }

  private drawCanvasSymbol(
    ctx: CanvasRenderingContext2D,
    shape: string,
    color: string,
    cx: number,
    cy: number,
    size: number,
  ) {
    const half = size / 2;
    ctx.save();
    switch ((shape || 'circle').toLowerCase()) {
      case 'square': {
        ctx.fillStyle = color || '#888';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(cx - half, cy - half, size, size);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'triangle': {
        ctx.fillStyle = color || '#888';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx + half, cy + half);
        ctx.lineTo(cx - half, cy + half);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'diamond': {
        ctx.fillStyle = color || '#888';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx + half, cy);
        ctx.lineTo(cx, cy + half);
        ctx.lineTo(cx - half, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'cross':
      case 'plus': {
        ctx.strokeStyle = color || '#888';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - half * 0.8);
        ctx.lineTo(cx, cy + half * 0.8);
        ctx.moveTo(cx - half * 0.8, cy);
        ctx.lineTo(cx + half * 0.8, cy);
        ctx.stroke();
        break;
      }
      default: {
        ctx.fillStyle = color || '#888';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  /**
   * Read legend export state from the live legend component if available.
   */
  private readLegendExportState(): LegendExportState | null {
    const legendEl = document.querySelector('protspace-legend') as
      | (Element & { getLegendExportData?: () => LegendExportState })
      | null;
    try {
      if (legendEl && typeof legendEl.getLegendExportData === 'function') {
        const state = legendEl.getLegendExportData();
        if (state && Array.isArray(state.items)) return state as LegendExportState;
      }
    } catch (_e) {
      console.error('Error reading legend export state:', _e);
    }
    return null;
  }

  /**
   * Export visualization as a single PDF file (scatterplot on first page, legend on second if present)
   */
  async exportPDF(options: ExportOptions = {}): Promise<void> {
    try {
      await this.exportCombinedPDF(options);
    } catch (error) {
      console.error('PDF export failed:', error);
      throw error;
    }
  }

  /**
   * Create a single-page PDF with scatterplot and legend side-by-side
   * Legend takes 20% of content width with improved typography and formatting
   */
  private async exportCombinedPDF(options: ExportOptions = {}): Promise<void> {
    const scatterplotElement = this.getScatterplotElement();
    if (!scatterplotElement) return;

    const opts = this.getOptionsWithDefaults(options);
    const { default: jsPDF } = await import('jspdf');

    // Capture scatterplot with border removed
    const scatterCanvas = await this.captureScatterplotCanvas(
      scatterplotElement,
      opts.scaleForExport ?? ProtSpaceExporter.PDF_SCALE,
      opts.backgroundColor,
    );

    // Generate legend canvas
    const legendCanvas = this.generateLegendCanvas(scatterCanvas, opts);

    // Convert to images
    const scatterImg = scatterCanvas.toDataURL('image/png', 1.0);
    const legendImg = legendCanvas.toDataURL('image/png', 1.0);
    const scatterRatio = scatterCanvas.width / scatterCanvas.height;
    const legendRatio = legendCanvas.width / legendCanvas.height;

    // Calculate PDF dimensions
    const margin = ProtSpaceExporter.PDF_MARGIN;
    const gap = ProtSpaceExporter.PDF_GAP;
    const maxWidth = ProtSpaceExporter.PDF_MAX_WIDTH - 2 * margin;
    const availableWidth = maxWidth - gap;

    // Distribute width proportionally based on aspect ratios
    const totalRatioWidth = scatterRatio + legendRatio;
    const scatterTargetW = availableWidth * (scatterRatio / totalRatioWidth);
    const legendTargetW = availableWidth * (legendRatio / totalRatioWidth);

    // Calculate heights maintaining aspect ratios
    const scatterTargetH = scatterTargetW / scatterRatio;
    const legendTargetH = legendTargetW / legendRatio;
    const contentHeight = Math.max(scatterTargetH, legendTargetH);

    // Create custom page size that fits content exactly
    const pdfWidth = maxWidth + 2 * margin;
    const pdfHeight = contentHeight + 2 * margin;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf: any = new (jsPDF as any)({
      orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    pdf.setProperties({
      title: 'ProtSpace Visualization',
      subject: 'ProtSpace export',
      author: 'ProtSpace',
      creator: 'ProtSpace',
    });

    // Place images
    const xScatter = margin;
    const xLegend = xScatter + scatterTargetW + gap;
    pdf.addImage(scatterImg, 'PNG', xScatter, margin, scatterTargetW, scatterTargetH);
    pdf.addImage(legendImg, 'PNG', xLegend, margin, legendTargetW, legendTargetH);

    const dateForFile = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
    const fileName = opts.exportName
      ? `${opts.exportName}_${dateForFile}.pdf`
      : `protspace_visualization_${dateForFile}.pdf`;
    pdf.save(fileName);
  }

  /**
   * Download file helper
   */
  private downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }
}

/**
 * Convenience function to create an exporter instance
 */
export function createExporter(
  element: ExportableElement,
  selectedProteins: string[] = [],
  isolationMode: boolean = false,
): ProtSpaceExporter {
  return new ProtSpaceExporter(element, selectedProteins, isolationMode);
}

/**
 * Quick export functions for common use cases
 */
export const exportUtils = {
  /**
   * Export data as JSON
   */
  exportJSON: (element: ExportableElement, options?: ExportOptions) => {
    const exporter = createExporter(element);
    exporter.exportJSON(options);
  },

  /**
   * Export protein IDs
   */
  exportProteinIds: (
    element: ExportableElement,
    selectedProteins?: string[],
    options?: ExportOptions,
  ) => {
    const exporter = createExporter(element, selectedProteins);
    exporter.exportProteinIds(options);
  },

  /**
   * Export as PNG
   */
  exportPNG: async (element: ExportableElement, options?: ExportOptions) => {
    const exporter = createExporter(element);
    return exporter.exportPNG(options);
  },

  /**
   * Export as PDF
   */
  exportPDF: async (element: ExportableElement, options?: ExportOptions) => {
    const exporter = createExporter(element);
    return exporter.exportPDF(options);
  },

  // SVG export removed per requirements
};
