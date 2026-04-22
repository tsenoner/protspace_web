/**
 * `<protspace-publish-modal>` — Full-screen figure editor for publication-ready exports.
 *
 * Hosts a live preview canvas and a settings sidebar with journal presets,
 * legend positioning, highlight annotations, and zoom insets.
 */

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { tokens } from '../../styles/tokens';
import { buttonMixin } from '../../styles/mixins';
import { publishModalStyles } from './publish-modal.styles';
import {
  JOURNAL_PRESETS,
  resolvePresetDimensions,
  getPreset,
  type PresetId,
} from './journal-presets';
import {
  createDefaultPublishState,
  type PublishState,
  type LegendPosition,
  type LegendOverflow,
  type OverlayTool,
  type Inset,
} from './publish-state';
import {
  pxToMm,
  mmToPx,
  adjustDpiForWidthMm,
  clampHeight,
  SIZE_MODE_WIDTH_MM,
  MAX_HEIGHT_MM,
  type SizeMode,
} from './dimension-utils';
import {
  capturePlotCanvas,
  composeFigure,
  computeLayout,
  type LegendItem,
} from './publish-compositor';
import { PublishOverlayController } from './publish-overlay-controller';

// ── Legend data reader (mirrors export-utils pattern) ─────────

interface LegendExportState {
  annotation: string;
  includeShapes: boolean;
  otherItemsCount: number;
  items: Array<{
    value: string;
    displayValue?: string;
    color: string;
    shape: string;
    count: number;
    isVisible: boolean;
    zOrder: number;
  }>;
}

function readLegendExportState(): LegendExportState | null {
  const el = document.querySelector('protspace-legend') as
    | (Element & { getLegendExportData?: () => LegendExportState })
    | null;
  try {
    if (el && typeof el.getLegendExportData === 'function') {
      const s = el.getLegendExportData();
      if (s && Array.isArray(s.items)) return s;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ── Component ────────────────────────────────────────────────

@customElement('protspace-publish-modal')
export class ProtspacePublishModal extends LitElement {
  static override styles = [tokens, buttonMixin, publishModalStyles];

  /** Plot element to capture from */
  @property({ attribute: false }) plotElement: HTMLElement | null = null;

  /** Initial export state to seed the editor with */
  @property({ attribute: false }) initialState: Partial<{
    imageWidth: number;
    imageHeight: number;
    legendWidthPercent: number;
    legendFontSizePx: number;
  }> = {};

  /** Saved publish state from parquetbundle, used to restore on open. */
  @property({ attribute: false }) savedPublishState: Record<string, unknown> | null = null;

  @state() private _state: PublishState = createDefaultPublishState();
  @state() private _tool: OverlayTool = 'select';
  @state() private _fullResPreview = false;
  @state() private _legendItems: LegendItem[] = [];
  @state() private _annotationName = 'Legend';
  @state() private _includeShapes = false;

  @query('.publish-preview-canvas') private _previewCanvas!: HTMLCanvasElement;

  private _overlayController: PublishOverlayController | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _plotCacheKey = '';
  private _cachedPlotCanvas: HTMLCanvasElement | null = null;

  override connectedCallback() {
    super.connectedCallback();
    if (this.savedPublishState) {
      const defaults = createDefaultPublishState(this.initialState);
      this._state = { ...defaults, ...this.savedPublishState } as PublishState;
    } else {
      this._state = createDefaultPublishState(this.initialState);
    }
    this._readLegend();
    document.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._overlayController?.destroy();
    this._overlayController = null;
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }

  override firstUpdated() {
    this._setupOverlay();
    this._scheduleRedraw();
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('_state') || changed.has('_fullResPreview') || changed.has('_tool')) {
      this._scheduleRedraw();
    }
  }

  // ── Legend data ────────────────────────────────────

  private _readLegend() {
    const legendState = readLegendExportState();
    if (legendState) {
      this._annotationName = legendState.annotation;
      this._includeShapes = legendState.includeShapes;
      this._legendItems = legendState.items.map((it) => ({
        value: it.value,
        displayValue: it.displayValue,
        color: it.color,
        shape: it.shape,
        count: it.count,
        isVisible: it.isVisible,
      }));
    }
  }

  // ── Overlay ────────────────────────────────────────

  private _setupOverlay() {
    if (!this._previewCanvas) return;
    this._overlayController = new PublishOverlayController(this._previewCanvas, {
      getPlotRect: () => {
        const { plotRect } = computeLayout(
          this._previewCanvas.width,
          this._previewCanvas.height,
          this._state.legend,
        );
        return plotRect;
      },
      getAnnotations: () => this._state.annotations,
      getInsets: () => this._state.insets,
      getLegendRect: () => {
        if (this._state.legend.position !== 'free') return null;
        const { legendRect } = computeLayout(
          this._previewCanvas.width,
          this._previewCanvas.height,
          this._state.legend,
        );
        return legendRect;
      },
      onAnnotationAdded: (a) => {
        this._state = { ...this._state, annotations: [...this._state.annotations, a] };
      },
      onAnnotationUpdated: (i, a) => {
        const anns = [...this._state.annotations];
        anns[i] = a;
        this._state = { ...this._state, annotations: anns };
      },
      onInsetAdded: (inset) => {
        this._state = { ...this._state, insets: [...this._state.insets, inset] };
      },
      onInsetUpdated: (i, inset) => {
        const ins = [...this._state.insets];
        ins[i] = inset;
        this._state = { ...this._state, insets: ins };
      },
      onSelectionChanged: () => {
        /* selection visual handled in redraw */
      },
      onLegendMoved: (nx: number, ny: number) => {
        this._updateLegend({ freePos: { nx, ny } });
      },
      requestRedraw: () => this._redraw(),
    });
  }

  // ── Redraw pipeline ────────────────────────────────

  private _scheduleRedraw() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._redraw(), 120);
  }

  private _redraw() {
    if (!this._previewCanvas || !this.plotElement) return;

    const s = this._state;
    const previewMaxW = this._fullResPreview ? s.widthPx : Math.min(s.widthPx, 1600);
    const aspect = s.heightPx / s.widthPx;
    const previewW = previewMaxW;
    const previewH = Math.round(previewW * aspect);

    this._previewCanvas.width = previewW;
    this._previewCanvas.height = previewH;

    // Capture plot (cache when dimensions and key state haven't changed)
    const { plotRect } = computeLayout(previewW, previewH, s.legend);
    const cacheKey = `${plotRect.w}x${plotRect.h}`;
    if (cacheKey !== this._plotCacheKey || !this._cachedPlotCanvas) {
      this._cachedPlotCanvas = capturePlotCanvas(
        this.plotElement as HTMLElement & {
          captureAtResolution?: (
            w: number,
            h: number,
            opts: { dpr?: number; backgroundColor?: string },
          ) => HTMLCanvasElement;
        },
        {
          width: plotRect.w,
          height: plotRect.h,
          backgroundColor: s.background === 'white' ? '#ffffff' : 'rgba(0,0,0,0)',
        },
      );
      this._plotCacheKey = cacheKey;
    }

    composeFigure(this._previewCanvas, {
      state: s,
      plotCanvas: this._cachedPlotCanvas,
      legendItems: this._legendItems,
      annotationName: this._annotationName,
      includeShapes: this._includeShapes,
    });

    // Draw overlay indicators
    this._overlayController?.drawDragIndicator(this._previewCanvas.getContext('2d')!);
  }

  // ── State mutations ────────────────────────────────

  private _updateState(partial: Partial<PublishState>) {
    this._state = { ...this._state, ...partial };
    // If user changes width/height, mark preset as custom
    if ('widthPx' in partial || 'heightPx' in partial) {
      this._state = { ...this._state, preset: 'custom' };
    }
    this._plotCacheKey = ''; // invalidate
  }

  private _updateLegend(partial: Partial<PublishState['legend']>) {
    this._state = { ...this._state, legend: { ...this._state.legend, ...partial } };
    this._plotCacheKey = '';
  }

  private _setSizeMode(mode: SizeMode) {
    const widthMm = SIZE_MODE_WIDTH_MM[mode];
    if (widthMm !== undefined) {
      const widthPx = mmToPx(widthMm, this._state.dpi);
      const heightPx = clampHeight(this._state.heightPx, this._state.dpi, MAX_HEIGHT_MM);
      this._state = { ...this._state, sizeMode: mode, widthPx, heightPx, preset: 'custom' };
    } else {
      this._state = { ...this._state, sizeMode: mode, preset: 'custom' };
    }
    this._plotCacheKey = '';
  }

  private _updateWidthPx(widthPx: number) {
    const s = this._state;
    const widthMm = SIZE_MODE_WIDTH_MM[s.sizeMode];
    if (widthMm !== undefined) {
      const dpi = adjustDpiForWidthMm(widthPx, widthMm);
      const heightPx = clampHeight(s.heightPx, dpi, MAX_HEIGHT_MM);
      this._state = { ...s, widthPx, dpi, heightPx, preset: 'custom' };
    } else {
      this._state = { ...s, widthPx, preset: 'custom' };
    }
    this._plotCacheKey = '';
  }

  private _updateHeightPx(heightPx: number) {
    const s = this._state;
    const maxMm = s.sizeMode !== 'flexible' ? MAX_HEIGHT_MM : undefined;
    const clamped = clampHeight(heightPx, s.dpi, maxMm);
    this._state = { ...s, heightPx: clamped, preset: 'custom' };
    this._plotCacheKey = '';
  }

  private _updateDpi(dpi: number) {
    const s = this._state;
    const widthMm = SIZE_MODE_WIDTH_MM[s.sizeMode];
    if (widthMm !== undefined) {
      const widthPx = mmToPx(widthMm, dpi);
      const heightPx = clampHeight(s.heightPx, dpi, MAX_HEIGHT_MM);
      this._state = { ...s, dpi, widthPx, heightPx, preset: 'custom' };
    } else {
      this._state = { ...s, dpi, preset: 'custom' };
    }
    this._plotCacheKey = '';
  }

  private _applyPreset(presetId: PresetId) {
    const preset = getPreset(presetId);
    if (!preset) return;
    const dims = resolvePresetDimensions(preset);
    this._state = {
      ...this._state,
      preset: presetId,
      widthPx: dims.widthPx,
      heightPx: dims.heightPx ?? this._state.heightPx,
      dpi: preset.dpi,
    };
    this._plotCacheKey = '';
  }

  private _setTool(tool: OverlayTool) {
    this._tool = tool;
    if (this._overlayController) {
      this._overlayController.tool = tool;
    }
  }

  private _removeAnnotation(index: number) {
    const anns = this._state.annotations.filter((_, i) => i !== index);
    this._state = { ...this._state, annotations: anns };
  }

  private _removeInset(index: number) {
    const ins = this._state.insets.filter((_, i) => i !== index);
    this._state = { ...this._state, insets: ins };
  }

  private _updateInset(index: number, partial: Partial<Inset>) {
    const insets = [...this._state.insets];
    insets[index] = { ...insets[index], ...partial };
    this._state = { ...this._state, insets };
  }

  // ── Export ─────────────────────────────────────────

  private _handleExport() {
    // Re-render at full resolution for export
    if (!this.plotElement) return;
    const s = this._state;
    const { plotRect } = computeLayout(s.widthPx, s.heightPx, s.legend);

    const plotCanvas = capturePlotCanvas(
      this.plotElement as HTMLElement & {
        captureAtResolution?: (
          w: number,
          h: number,
          opts: { dpr?: number; backgroundColor?: string },
        ) => HTMLCanvasElement;
      },
      {
        width: plotRect.w,
        height: plotRect.h,
        backgroundColor: s.background === 'white' ? '#ffffff' : 'rgba(0,0,0,0)',
      },
    );

    const outCanvas = document.createElement('canvas');
    outCanvas.width = s.widthPx;
    outCanvas.height = s.heightPx;

    composeFigure(outCanvas, {
      state: s,
      plotCanvas,
      legendItems: this._legendItems,
      annotationName: this._annotationName,
      includeShapes: this._includeShapes,
    });

    this.dispatchEvent(
      new CustomEvent('publish-export', {
        detail: { canvas: outCanvas, state: s },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._handleClose();
  };

  // ── Render ─────────────────────────────────────────

  override render() {
    const s = this._state;
    return html`
      <div class="publish-overlay" @mousedown=${this._onOverlayClick}>
        <div class="publish-container" @mousedown=${(e: Event) => e.stopPropagation()}>
          <!-- Preview area -->
          <div class="publish-preview">
            <div class="publish-preview-header">
              <h2>Figure Editor</h2>
              <span class="publish-preview-info">
                ${s.widthPx} &times; ${s.heightPx} px &middot; ${s.dpi} DPI
              </span>
            </div>

            <div class="publish-preview-canvas-container">
              <canvas class="publish-preview-canvas"></canvas>
            </div>

            ${this._renderToolbar()}
          </div>

          <!-- Sidebar -->
          <div class="publish-sidebar">
            <div class="publish-sidebar-header">
              <h3>Settings</h3>
              <button class="publish-close-btn" @click=${this._handleClose} title="Close">
                <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div class="publish-sidebar-content">
              ${this._renderPresetsSection()} ${this._renderDimensionsSection()}
              ${this._renderLegendSection()} ${this._renderAnnotationsSection()}
              ${this._renderInsetSection()} ${this._renderOptionsSection()}
            </div>

            <div class="publish-sidebar-footer">
              <button class="btn-secondary" @click=${this._handleClose}>Cancel</button>
              <button class="btn-primary" @click=${this._handleExport}>
                Export ${s.format.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _onOverlayClick = () => {
    this._handleClose();
  };

  // ── Toolbar ────────────────────────────────────────

  private _renderToolbar() {
    const tool = this._tool;
    return html`
      <div class="publish-preview-toolbar">
        <button
          class="publish-tool-btn ${tool === 'select' ? 'active' : ''}"
          @click=${() => this._setTool('select')}
          title="Select / Move"
        >
          <svg viewBox="0 0 24 24"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>
          Select
        </button>
        <button
          class="publish-tool-btn ${tool === 'circle' ? 'active' : ''}"
          @click=${() => this._setTool('circle')}
          title="Draw circle highlight"
        >
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg>
          Circle
        </button>
        <button
          class="publish-tool-btn ${tool === 'arrow' ? 'active' : ''}"
          @click=${() => this._setTool('arrow')}
          title="Draw arrow"
        >
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14m-4-4l4 4-4 4" />
          </svg>
          Arrow
        </button>
        <button
          class="publish-tool-btn ${tool === 'label' ? 'active' : ''}"
          @click=${() => this._setTool('label')}
          title="Add text label"
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 7V4h16v3M9 20h6M12 4v16" />
          </svg>
          Label
        </button>

        <div class="tool-separator"></div>

        <button
          class="publish-tool-btn ${tool === 'inset-source' ? 'active' : ''}"
          @click=${() => this._setTool('inset-source')}
          title="Add zoom inset"
        >
          <svg viewBox="0 0 24 24">
            <path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </svg>
          Zoom Inset
        </button>

        <div class="tool-separator"></div>

        <label class="publish-checkbox-label" style="margin-bottom: 0">
          <input
            type="checkbox"
            class="publish-checkbox"
            .checked=${this._fullResPreview}
            @change=${(e: Event) => {
              this._fullResPreview = (e.target as HTMLInputElement).checked;
              this._plotCacheKey = '';
            }}
          />
          Full resolution
        </label>
      </div>
    `;
  }

  // ── Presets section ────────────────────────────────

  private _renderPresetsSection() {
    return html`
      <div class="publish-section">
        <div class="publish-section-title">Presets</div>
        <div class="publish-preset-grid">
          ${JOURNAL_PRESETS.map(
            (p) => html`
              <button
                class="publish-preset-btn ${this._state.preset === p.id ? 'active' : ''}"
                @click=${() => this._applyPreset(p.id)}
                title="${p.label}"
              >
                ${p.label}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  // ── Dimensions section ─────────────────────────────

  private _renderDimensionsSection() {
    const s = this._state;
    const widthMm = pxToMm(s.widthPx, s.dpi);
    const heightMm = pxToMm(s.heightPx, s.dpi);
    const maxHeightPx = s.sizeMode !== 'flexible' ? mmToPx(MAX_HEIGHT_MM, s.dpi) : 8192;
    const dimWarning = s.widthPx > 6000 || s.heightPx > 6000;
    const isConstrained = s.sizeMode !== 'flexible';

    return html`
      <div class="publish-section">
        <div class="publish-section-title">Dimensions</div>

        <div class="publish-size-mode-toggle">
          ${(['1-column', '2-column', 'flexible'] as SizeMode[]).map(
            (mode) => html`
              <button
                class="publish-size-mode-btn ${s.sizeMode === mode ? 'active' : ''}"
                @click=${() => this._setSizeMode(mode)}
              >
                ${mode === '1-column'
                  ? '1 col (89 mm)'
                  : mode === '2-column'
                    ? '2 col (183 mm)'
                    : 'Flexible'}
              </button>
            `,
          )}
        </div>

        <div class="publish-row">
          <label>Width</label>
          <div class="publish-input-group">
            <input
              type="range"
              class="publish-slider"
              min="400"
              max="8192"
              .value=${String(s.widthPx)}
              @input=${(e: Event) => {
                this._updateWidthPx(parseInt((e.target as HTMLInputElement).value) || s.widthPx);
              }}
            />
            <input
              type="number"
              class="publish-row-input"
              min="400"
              max="8192"
              .value=${String(s.widthPx)}
              @change=${(e: Event) => {
                this._updateWidthPx(parseInt((e.target as HTMLInputElement).value) || s.widthPx);
              }}
            />
            <span class="publish-unit">px</span>
            <span class="publish-mm-display">${widthMm.toFixed(1)} mm</span>
          </div>
        </div>

        <div class="publish-row">
          <label>Height</label>
          <div class="publish-input-group">
            <input
              type="range"
              class="publish-slider"
              min="400"
              .max=${String(maxHeightPx)}
              .value=${String(s.heightPx)}
              @input=${(e: Event) => {
                this._updateHeightPx(parseInt((e.target as HTMLInputElement).value) || s.heightPx);
              }}
            />
            <input
              type="number"
              class="publish-row-input"
              min="400"
              .max=${String(maxHeightPx)}
              .value=${String(s.heightPx)}
              @change=${(e: Event) => {
                this._updateHeightPx(parseInt((e.target as HTMLInputElement).value) || s.heightPx);
              }}
            />
            <span class="publish-unit">px</span>
            <span class="publish-mm-display"
              >${heightMm.toFixed(1)} mm${isConstrained ? ` (max ${MAX_HEIGHT_MM})` : ''}</span
            >
          </div>
        </div>

        <div class="publish-row">
          <label>DPI</label>
          <div class="publish-input-group">
            <input
              type="range"
              class="publish-slider"
              min="72"
              max="600"
              .value=${String(s.dpi)}
              @input=${(e: Event) => {
                this._updateDpi(parseInt((e.target as HTMLInputElement).value) || s.dpi);
              }}
            />
            <input
              type="number"
              class="publish-row-input"
              min="72"
              max="600"
              .value=${String(s.dpi)}
              @change=${(e: Event) => {
                this._updateDpi(parseInt((e.target as HTMLInputElement).value) || s.dpi);
              }}
            />
          </div>
        </div>

        ${dimWarning
          ? html`<div class="publish-warning">
              Large dimensions may be slow to render. Consider using PDF for vector output.
            </div>`
          : nothing}
      </div>
    `;
  }

  // ── Legend section ──────────────────────────────────

  private _renderLegendSection() {
    const leg = this._state.legend;
    return html`
      <div class="publish-section">
        <div class="publish-section-title">Legend</div>

        <label class="publish-checkbox-label">
          <input
            type="checkbox"
            class="publish-checkbox"
            .checked=${leg.visible}
            @change=${(e: Event) => {
              this._updateLegend({ visible: (e.target as HTMLInputElement).checked });
            }}
          />
          Show legend
        </label>

        ${leg.visible
          ? html`
              <div class="publish-row">
                <label>Position</label>
                <select
                  class="publish-select"
                  .value=${leg.position}
                  @change=${(e: Event) => {
                    this._updateLegend({
                      position: (e.target as HTMLSelectElement).value as LegendPosition,
                    });
                  }}
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="tr">Top-right (overlay)</option>
                  <option value="tl">Top-left (overlay)</option>
                  <option value="br">Bottom-right (overlay)</option>
                  <option value="bl">Bottom-left (overlay)</option>
                  <option value="free">Free (drag to move)</option>
                  <option value="none">Hidden</option>
                </select>
              </div>

              <div class="publish-row">
                <label>Size %</label>
                <div class="publish-input-group">
                  <input
                    type="range"
                    class="publish-slider"
                    min="10"
                    max="50"
                    .value=${String(leg.widthPercent)}
                    @input=${(e: Event) => {
                      this._updateLegend({
                        widthPercent:
                          parseInt((e.target as HTMLInputElement).value) || leg.widthPercent,
                      });
                    }}
                  />
                  <input
                    type="number"
                    class="publish-row-input"
                    min="10"
                    max="50"
                    .value=${String(leg.widthPercent)}
                    @change=${(e: Event) => {
                      this._updateLegend({
                        widthPercent:
                          parseInt((e.target as HTMLInputElement).value) || leg.widthPercent,
                      });
                    }}
                  />
                  <span class="publish-unit">%</span>
                </div>
              </div>

              <div class="publish-row">
                <label>Font size</label>
                <div class="publish-input-group">
                  <input
                    type="range"
                    class="publish-slider"
                    min="8"
                    max="120"
                    .value=${String(leg.fontSizePx)}
                    @input=${(e: Event) => {
                      this._updateLegend({
                        fontSizePx:
                          parseInt((e.target as HTMLInputElement).value) || leg.fontSizePx,
                      });
                    }}
                  />
                  <input
                    type="number"
                    class="publish-row-input"
                    min="8"
                    max="120"
                    .value=${String(leg.fontSizePx)}
                    @change=${(e: Event) => {
                      this._updateLegend({
                        fontSizePx:
                          parseInt((e.target as HTMLInputElement).value) || leg.fontSizePx,
                      });
                    }}
                  />
                  <span class="publish-unit">px</span>
                </div>
              </div>

              <div class="publish-row">
                <label>Columns</label>
                <div class="publish-input-group">
                  <input
                    type="range"
                    class="publish-slider"
                    min="1"
                    max="6"
                    .value=${String(leg.columns)}
                    @input=${(e: Event) => {
                      this._updateLegend({
                        columns: parseInt((e.target as HTMLInputElement).value) || leg.columns,
                      });
                    }}
                  />
                  <input
                    type="number"
                    class="publish-row-input"
                    min="1"
                    max="6"
                    .value=${String(leg.columns)}
                    @change=${(e: Event) => {
                      this._updateLegend({
                        columns: parseInt((e.target as HTMLInputElement).value) || leg.columns,
                      });
                    }}
                  />
                </div>
              </div>

              <div class="publish-row">
                <label>Overflow</label>
                <select
                  class="publish-select"
                  .value=${leg.overflow}
                  @change=${(e: Event) => {
                    this._updateLegend({
                      overflow: (e.target as HTMLSelectElement).value as LegendOverflow,
                    });
                  }}
                >
                  <option value="multi-column">Multi-column (auto)</option>
                  <option value="truncate">Truncate</option>
                  <option value="scale">Scale (legacy)</option>
                </select>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Annotations section ────────────────────────────

  private _renderAnnotationsSection() {
    const anns = this._state.annotations;
    return html`
      <div class="publish-section">
        <div class="publish-section-title">Annotations (${anns.length})</div>
        ${anns.map(
          (a, i) => html`
            <div class="publish-annotation-item">
              <span>${a.type}${a.type === 'label' ? `: ${a.text}` : ''}</span>
              <button class="delete-btn" @click=${() => this._removeAnnotation(i)} title="Remove">
                <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          `,
        )}
        ${anns.length === 0
          ? html`<span style="font-size: var(--text-xs); color: var(--muted)"
              >Use toolbar to add</span
            >`
          : nothing}
      </div>
    `;
  }

  // ── Insets section ─────────────────────────────────

  private _renderInsetSection() {
    const ins = this._state.insets;
    return html`
      <div class="publish-section">
        <div class="publish-section-title">Zoom Insets (${ins.length})</div>
        ${ins.map(
          (inset, i) => html`
            <div
              class="publish-annotation-item"
              style="flex-direction: column; align-items: stretch; gap: 4px;"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>Inset ${i + 1}</span>
                <button class="delete-btn" @click=${() => this._removeInset(i)} title="Remove">
                  <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div class="publish-row" style="margin-bottom: 0;">
                <label>Zoom</label>
                <div class="publish-input-group">
                  <input
                    type="range"
                    class="publish-slider"
                    min="1"
                    max="10"
                    step="0.5"
                    .value=${String(inset.magnification ?? 2)}
                    @input=${(e: Event) => {
                      const mag = parseFloat((e.target as HTMLInputElement).value) || 2;
                      this._updateInset(i, { magnification: mag });
                    }}
                  />
                  <input
                    type="number"
                    class="publish-row-input"
                    min="1"
                    max="10"
                    step="0.5"
                    .value=${String(inset.magnification ?? 2)}
                    @change=${(e: Event) => {
                      const mag = parseFloat((e.target as HTMLInputElement).value) || 2;
                      this._updateInset(i, { magnification: mag });
                    }}
                  />
                  <span class="publish-unit">x</span>
                </div>
              </div>
            </div>
          `,
        )}
        ${ins.length === 0
          ? html`<span style="font-size: var(--text-xs); color: var(--muted)"
              >Use toolbar to add</span
            >`
          : nothing}
      </div>
    `;
  }

  // ── Options section ────────────────────────────────

  private _renderOptionsSection() {
    const s = this._state;
    return html`
      <div class="publish-section">
        <div class="publish-section-title">Options</div>

        <div class="publish-row">
          <label>Format</label>
          <div class="publish-format-toggle">
            <button
              class="btn-secondary btn-compact ${s.format === 'png' ? 'active' : ''}"
              @click=${() => this._updateState({ format: 'png' })}
            >
              PNG
            </button>
            <button
              class="btn-secondary btn-compact ${s.format === 'pdf' ? 'active' : ''}"
              @click=${() => this._updateState({ format: 'pdf' })}
            >
              PDF
            </button>
          </div>
        </div>

        <div class="publish-row">
          <label>Background</label>
          <select
            class="publish-select"
            .value=${s.background}
            @change=${(e: Event) => {
              this._updateState({
                background: (e.target as HTMLSelectElement).value as 'white' | 'transparent',
              });
            }}
          >
            <option value="white">White</option>
            <option value="transparent">Transparent</option>
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-publish-modal': ProtspacePublishModal;
  }
}
