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
}

export class ProtSpaceExporter {
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
   * Legend takes exactly 1/5 of the final width
   */
  private async exportCombinedPNG(options: ExportOptions = {}): Promise<void> {
    // Capture scatterplot
    const scatterplotElement = document.querySelector('protspace-scatterplot');
    if (!scatterplotElement) {
      console.error('Could not find protspace-scatterplot element');
      return;
    }

    const { default: html2canvas } = await import('html2canvas-pro');
    const canvasOptions = {
      backgroundColor: options.backgroundColor || '#ffffff',
      scale: options.scaleForExport ?? 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: (scatterplotElement as HTMLElement).clientWidth,
      height: (scatterplotElement as HTMLElement).clientHeight,
      scrollX: 0,
      scrollY: 0,
    };

    const scatterCanvas = await html2canvas(scatterplotElement as HTMLElement, canvasOptions);

    // Build legend data – prefer live legend component state for exact parity (includes "Other")
    const currentData = this.element.getCurrentData();
    if (!currentData) {
      console.error('No data available for legend generation');
      return;
    }
    const legendExportState = this.readLegendExportState();
    const featureNameFromLegend = legendExportState?.feature;
    const hiddenSet = this.readHiddenFeatureValueKeys();
    const legendItems = legendExportState
      ? legendExportState.items
          .filter((it) => it.isVisible)
          .map((it) => ({
            value: it.value === null ? 'N/A' : String(it.value),
            color: it.color,
            shape: it.shape,
            count: it.count,
            feature: featureNameFromLegend || this.element.selectedFeature,
          }))
      : this.computeLegendFromData(
          currentData,
          this.element.selectedFeature,
          options.includeSelection === true ? this.selectedProteins : undefined,
        ).filter((it) => {
          const key = it.value === 'N/A' ? 'null' : it.value;
          return !hiddenSet.has(key);
        });

    // Compose final image with legend = 1/5 width
    const combinedWidth = Math.round(scatterCanvas.width * 1.1);
    const combinedHeight = scatterCanvas.height;
    const legendWidth = combinedWidth - scatterCanvas.width; // 20%

    // Render legend to its own canvas sized to the reserved area
    const legendCanvas = this.renderLegendToCanvas(
      legendItems,
      legendWidth,
      combinedHeight,
      options,
      featureNameFromLegend || this.element.selectedFeature,
    );

    // Composite
    const outCanvas = document.createElement('canvas');
    outCanvas.width = combinedWidth;
    outCanvas.height = combinedHeight;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context for output canvas');
      return;
    }
    // Fill background
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, combinedWidth, combinedHeight);
    // Draw scatterplot left
    ctx.drawImage(scatterCanvas, 0, 0);
    // Draw legend at right
    ctx.drawImage(legendCanvas, scatterCanvas.width, 0);

    // Download
    const dataUrl = outCanvas.toDataURL('image/png');
    const fileName = options.exportName
      ? `${options.exportName}_combined.png`
      : 'protspace_combined.png';
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
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(100, Math.floor(width));
    canvas.height = Math.max(100, Math.floor(height));
    const ctx = canvas.getContext('2d')!;

    // Layout constants (will scale if content would overflow)
    const padding = 16;
    const headerHeight = 50;
    const itemHeight = 44;
    const symbolSize = 18;
    const rightPaddingForCount = 8;
    const bg = options.backgroundColor || '#ffffff';

    // Compute required height
    const required = padding + headerHeight + items.length * itemHeight + padding;
    const scaleY = Math.min(1, canvas.height / required);
    const scaleX = 1; // keep width as-is for readability
    ctx.save();
    ctx.scale(scaleX, scaleY);

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width / scaleX, canvas.height / scaleY);

    // Border
    ctx.strokeStyle = '#e1e5e9';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width / scaleX - 1, canvas.height / scaleY - 1);

    // Header (slightly larger for better readability in exports)
    ctx.fillStyle = '#374151';
    ctx.font = '500 16px Arial, sans-serif';
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

      ctx.fillStyle = '#374151';
      // Slightly larger item font for export clarity
      ctx.font = '14px Arial, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.value, padding + symbolSize + 8, cy);

      // Count on the right
      const countStr = String(it.count);
      const textWidth = ctx.measureText(countStr).width;
      ctx.fillStyle = '#6b7280';
      ctx.fillText(countStr, canvas.width / scaleX - rightPaddingForCount - textWidth, cy);

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
   * Create a single multi-page PDF that includes the scatterplot and (optionally) the legend
   */
  private async exportCombinedPDF(options: ExportOptions = {}): Promise<void> {
    // Find scatterplot element
    const scatterplotElement = document.querySelector('protspace-scatterplot');
    if (!scatterplotElement) {
      console.error('Could not find protspace-scatterplot element');
      return;
    }

    // Import libs
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas-pro'),
    ]);

    // Render scatterplot canvas
    const scatterCanvas = await html2canvas(scatterplotElement as HTMLElement, {
      backgroundColor: options.backgroundColor || '#ffffff',
      scale: options.scaleForExport ?? 3,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: (scatterplotElement as HTMLElement).clientWidth,
      height: (scatterplotElement as HTMLElement).clientHeight,
      scrollX: 0,
      scrollY: 0,
    });
    const scatterImg = scatterCanvas.toDataURL('image/png', 1.0);
    const scatterRatio = scatterCanvas.width / scatterCanvas.height;

    // Build programmatic legend items and render to canvas (prefer live legend state)
    const data = this.element.getCurrentData();
    const legendExportState = this.readLegendExportState();
    const featureNameFromLegend = legendExportState?.feature;
    const hiddenSet = this.readHiddenFeatureValueKeys();
    const legendItems = data
      ? legendExportState
        ? legendExportState.items
            .filter((it) => it.isVisible)
            .map((it) => ({
              value: it.value === null ? 'N/A' : String(it.value),
              color: it.color,
              shape: it.shape,
              count: it.count,
              feature: featureNameFromLegend || this.element.selectedFeature,
            }))
        : this.computeLegendFromData(
            data,
            this.element.selectedFeature,
            options.includeSelection === true ? this.selectedProteins : undefined,
          ).filter((it) => {
            const key = it.value === 'N/A' ? 'null' : it.value;
            return !hiddenSet.has(key);
          })
      : [];
    const legendCanvas = this.renderLegendToCanvas(
      legendItems,
      Math.max(100, Math.round(scatterCanvas.width * 0.1)),
      scatterCanvas.height,
      options,
      featureNameFromLegend || this.element.selectedFeature,
    );
    const legendImg = legendCanvas.toDataURL('image/png', 1.0);
    const legendRatio = legendCanvas.width / legendCanvas.height;

    // Prepare PDF
    const orientation = scatterRatio > 1 ? 'landscape' : 'portrait';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf: any = new (jsPDF as any)({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const exportTitle = options.exportName || 'ProtSpace Visualization';
    const exportDate = new Date().toISOString().replace('T', ' ').replace(/\..+$/, '');
    pdf.setProperties({
      title: exportTitle,
      subject: 'ProtSpace export',
      author: 'ProtSpace',
      creator: 'ProtSpace',
    });

    // Layout (single page, side-by-side; legend ~10% width)
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const headerHeight = 10;
    const footerHeight = 8;
    const contentLeft = margin;
    const contentTop = margin + headerHeight;
    const contentWidth = pdfWidth - 2 * margin;
    const contentHeight = pdfHeight - 2 * margin - headerHeight - footerHeight;
    const gap = 6;

    // Header
    pdf.setFontSize(12);
    pdf.text(exportTitle, contentLeft, margin + 6);
    pdf.setFontSize(9);
    const origin = (typeof window !== 'undefined' && window?.location?.origin) || '';
    pdf.text(`${exportDate}${origin ? `  •  ${origin}` : ''}`, pdfWidth - margin, margin + 6, {
      align: 'right',
    });

    // Desired widths
    const legendTargetWidth = (contentWidth - gap) * 0.1; // ~10%
    const scatterTargetWidth = contentWidth - gap - legendTargetWidth; // ~90%
    let sW = scatterTargetWidth;
    let sH = sW / scatterRatio;
    let lW = legendTargetWidth;
    let lH = lW / legendRatio;
    const maxH = Math.max(sH, lH);
    if (maxH > contentHeight) {
      const scale = contentHeight / maxH;
      sW *= scale;
      sH *= scale;
      lW *= scale;
      lH *= scale;
    }

    const y = contentTop + (contentHeight - Math.max(sH, lH)) / 2;
    const xScatter = contentLeft;
    const xLegend = xScatter + sW + gap;
    pdf.addImage(scatterImg, 'PNG', xScatter, y, sW, sH);
    pdf.addImage(legendImg, 'PNG', xLegend, y, lW, lH);

    // Footer
    pdf.setFontSize(9);
    pdf.text('Page 1 of 1', pdfWidth - margin, pdfHeight - margin, {
      align: 'right',
    });

    const dateForFile = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
    const fileName = options.exportName
      ? `${options.exportName}_${dateForFile}.pdf`
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
