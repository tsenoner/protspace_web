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
import { JOURNAL_PRESETS, type PresetId } from './journal-presets';
import {
  createDefaultPublishState,
  type PublishState,
  type LegendPosition,
  type OverlayTool,
  type Overlay,
  type Inset,
} from './publish-state';
import { pxToMm, mmToPx } from './dimension-utils';
import { sanitizePublishState } from './publish-state-validator';
import {
  capturePlotCanvas,
  composeFigure,
  computeInsetBoost,
  computeLayout,
  clampCaptureSize,
  waitForFonts,
  type LegendItem,
} from './publish-compositor';
import { PublishOverlayController } from './publish-overlay-controller';
import {
  getActivePresetConstraints,
  computeWidthUpdate,
  computeHeightUpdate,
  computeDpiUpdate,
  computePresetApplication,
  shouldShowFingerprintWarning,
} from './publish-modal-helpers';

// ── Types ─────────────────────────────────────────────────────

interface CaptureablePlotElement extends HTMLElement {
  captureAtResolution?: (
    w: number,
    h: number,
    opts: { dpr?: number; backgroundColor?: string },
  ) => HTMLCanvasElement;
}

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
  } catch (e) {
    console.warn('Failed to read legend export state:', e);
  }
  return null;
}

// ── Component ────────────────────────────────────────────────

@customElement('protspace-publish-modal')
export class ProtspacePublishModal extends LitElement {
  static override styles = [tokens, buttonMixin, publishModalStyles];

  /** Plot element to capture from */
  @property({ attribute: false }) plotElement: HTMLElement | null = null;

  /** Saved publish state from parquetbundle or localStorage, used to restore on open. */
  @property({ attribute: false }) savedPublishState: Record<string, unknown> | null = null;

  /** Current projection info for view fingerprint comparison. */
  @property({ attribute: false }) currentProjection: {
    projection: string;
    dimensionality: number;
  } | null = null;

  @state() private _state: PublishState = createDefaultPublishState();
  @state() private _tool: OverlayTool = 'select';
  @state() private _highlightedItem: { kind: 'overlay' | 'inset'; index: number } | null = null;
  @state() private _showFingerprintWarning = false;
  @state() private _legendItems: LegendItem[] = [];
  @state() private _legendTitle = 'Legend';

  @query('.publish-preview-canvas') private _previewCanvas!: HTMLCanvasElement;

  private _overlayController: PublishOverlayController | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _plotCacheKey = '';
  private _cachedPlotCanvas: HTMLCanvasElement | null = null;
  private _insetCacheKey = '';
  private _cachedInsetCanvas: HTMLCanvasElement | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._state = this.savedPublishState
      ? sanitizePublishState(this.savedPublishState)
      : createDefaultPublishState();
    // Set fingerprint on first use (no saved state)
    if (!this._state.viewFingerprint && this.currentProjection) {
      this._state = { ...this._state, viewFingerprint: this.currentProjection };
    }
    // Check for fingerprint mismatch
    this._showFingerprintWarning = shouldShowFingerprintWarning(
      this._state.viewFingerprint,
      this.currentProjection,
    );
    this._readLegend();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._overlayController?.destroy();
    this._overlayController = null;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }

  override firstUpdated() {
    this._setupOverlay();
    this._scheduleRedraw();
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('_state') || changed.has('_tool') || changed.has('_highlightedItem')) {
      this._scheduleRedraw();
    }
  }

  // ── Legend data ────────────────────────────────────

  private _readLegend() {
    const legendState = readLegendExportState();
    if (legendState) {
      this._legendTitle = legendState.annotation;
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
          this._legendItems.filter((it) => it.isVisible).length,
        );
        return plotRect;
      },
      getOverlays: () => this._state.overlays,
      getInsets: () => this._state.insets,
      getLegendRect: () => {
        if (this._state.legend.position !== 'free') return null;
        const { legendRect } = computeLayout(
          this._previewCanvas.width,
          this._previewCanvas.height,
          this._state.legend,
          this._legendItems.filter((it) => it.isVisible).length,
        );
        return legendRect;
      },
      onOverlayAdded: (a) => {
        this._state = {
          ...this._state,
          overlays: [...this._state.overlays, a],
          referenceWidth: this._state.widthPx,
        };
      },
      onOverlayUpdated: (i, a) => {
        const anns = [...this._state.overlays];
        anns[i] = a;
        this._state = { ...this._state, overlays: anns };
      },
      onInsetAdded: (inset) => {
        this._state = {
          ...this._state,
          insets: [...this._state.insets, inset],
          referenceWidth: this._state.widthPx,
        };
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
    const aspect = s.heightPx / s.widthPx;
    const previewW = s.widthPx;
    const previewH = Math.round(previewW * aspect);

    this._previewCanvas.width = previewW;
    this._previewCanvas.height = previewH;

    // Capture plot (cache when dimensions and key state haven't changed)
    const visibleCount = this._legendItems.filter((it) => it.isVisible).length;
    const { plotRect } = computeLayout(previewW, previewH, s.legend, visibleCount);
    const plotEl = this.plotElement as CaptureablePlotElement;
    const bgColor = s.background === 'white' ? '#ffffff' : 'rgba(0,0,0,0)';

    const cacheKey = `${plotRect.w}x${plotRect.h}`;
    if (cacheKey !== this._plotCacheKey || !this._cachedPlotCanvas) {
      this._cachedPlotCanvas = capturePlotCanvas(plotEl, {
        width: plotRect.w,
        height: plotRect.h,
        backgroundColor: bgColor,
      });
      this._plotCacheKey = cacheKey;
    }

    // Boosted capture for crisp inset rendering
    let insetPlotCanvas: HTMLCanvasElement | undefined;
    const boost = computeInsetBoost(s.insets);
    if (boost > 1) {
      const { width: capW, height: capH } = clampCaptureSize(
        plotRect.w * boost,
        plotRect.h * boost,
      );
      const insetKey = `${capW}x${capH}`;
      if (insetKey !== this._insetCacheKey || !this._cachedInsetCanvas) {
        this._cachedInsetCanvas = capturePlotCanvas(plotEl, {
          width: capW,
          height: capH,
          backgroundColor: bgColor,
        });
        this._insetCacheKey = insetKey;
      }
      insetPlotCanvas = this._cachedInsetCanvas;
    }

    composeFigure(this._previewCanvas, {
      state: s,
      plotCanvas: this._cachedPlotCanvas,
      legendItems: this._legendItems,
      legendTitle: this._legendTitle,
      highlightedItem: this._highlightedItem,
      displayScale:
        this._previewCanvas.width /
        (this._previewCanvas.getBoundingClientRect().width || this._previewCanvas.width),
      insetPlotCanvas,
    });

    // Draw overlay indicators and selection handles
    const overlayCtx = this._previewCanvas.getContext('2d')!;
    this._overlayController?.drawDragIndicator(overlayCtx);
    const annotScale = previewW / (s.referenceWidth || previewW);
    this._overlayController?.drawSelectionHandles(overlayCtx, annotScale);
  }

  // ── State mutations ────────────────────────────────

  private _updateState(partial: Partial<PublishState>) {
    this._state = { ...this._state, ...partial };
    // If user changes width/height, mark preset as custom
    if ('widthPx' in partial || 'heightPx' in partial) {
      this._state = { ...this._state, preset: 'custom' };
    }
    this._plotCacheKey = '';
    this._insetCacheKey = ''; // invalidate
  }

  private _updateLegend(partial: Partial<PublishState['legend']>) {
    this._state = { ...this._state, legend: { ...this._state.legend, ...partial } };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  /** Return the active preset's mm constraints, or null for px-based / custom. */
  private _getActivePresetConstraints() {
    return getActivePresetConstraints(this._state);
  }

  private _updateWidthPx(widthPx: number) {
    this._state = { ...this._state, ...computeWidthUpdate(this._state, widthPx) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _updateHeightPx(heightPx: number) {
    this._state = { ...this._state, ...computeHeightUpdate(this._state, heightPx) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _updateDpi(dpi: number) {
    this._state = { ...this._state, ...computeDpiUpdate(this._state, dpi) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _applyPreset(presetId: PresetId) {
    const patch = computePresetApplication(presetId);
    if (!patch) return;
    this._state = {
      ...this._state,
      ...patch,
      heightPx: patch.heightPx ?? this._state.heightPx,
    };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _setTool(tool: OverlayTool) {
    this._tool = tool;
    if (this._overlayController) {
      this._overlayController.tool = tool;
    }
  }

  private _removeOverlay(index: number) {
    const anns = this._state.overlays.filter((_, i) => i !== index);
    this._state = { ...this._state, overlays: anns };
  }

  private _updateOverlay(index: number, partial: Partial<Overlay>) {
    const anns = [...this._state.overlays];
    anns[index] = { ...anns[index], ...partial } as Overlay;
    this._state = { ...this._state, overlays: anns };
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

  private async _handleExport() {
    // Re-render at full resolution for export
    if (!this.plotElement) return;
    await waitForFonts();
    const s = this._state;
    const visibleCount = this._legendItems.filter((it) => it.isVisible).length;
    const { plotRect } = computeLayout(s.widthPx, s.heightPx, s.legend, visibleCount);
    const plotEl = this.plotElement as CaptureablePlotElement;
    const bgColor = s.background === 'white' ? '#ffffff' : 'rgba(0,0,0,0)';

    const plotSize = clampCaptureSize(plotRect.w, plotRect.h);
    const plotCanvas = capturePlotCanvas(plotEl, {
      width: plotSize.width,
      height: plotSize.height,
      backgroundColor: bgColor,
    });

    // Boosted capture for crisp inset rendering
    let insetPlotCanvas: HTMLCanvasElement | undefined;
    const boost = computeInsetBoost(s.insets);
    if (boost > 1) {
      const insetSize = clampCaptureSize(plotRect.w * boost, plotRect.h * boost);
      insetPlotCanvas = capturePlotCanvas(plotEl, {
        width: insetSize.width,
        height: insetSize.height,
        backgroundColor: bgColor,
      });
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = s.widthPx;
    outCanvas.height = s.heightPx;

    composeFigure(outCanvas, {
      state: s,
      plotCanvas,
      legendItems: this._legendItems,
      legendTitle: this._legendTitle,
      insetPlotCanvas,
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
    this.dispatchEvent(
      new CustomEvent('close', {
        detail: { state: this._state },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleReset() {
    const state = createDefaultPublishState();
    this._applyStateAndRebuild({
      ...state,
      viewFingerprint: this.currentProjection ?? undefined,
    });
  }

  private _handleNewFigure() {
    this._applyStateAndRebuild({
      ...this._state,
      overlays: [],
      insets: [],
      viewFingerprint: this.currentProjection ?? undefined,
    });
  }

  private _applyStateAndRebuild(newState: PublishState) {
    this._state = newState;
    this._tool = 'select';
    this._highlightedItem = null;
    this._showFingerprintWarning = false;
    this._plotCacheKey = '';
    this._insetCacheKey = '';
    this._overlayController?.destroy();
    this._overlayController = null;
    this.updateComplete.then(() => this._setupOverlay());
  }

  private _clearOverlays() {
    this._state = {
      ...this._state,
      overlays: [],
      insets: [],
      viewFingerprint: this.currentProjection ?? undefined,
    };
    this._showFingerprintWarning = false;
  }

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
              ${this._showFingerprintWarning
                ? html`
                    <div class="publish-warning">
                      Overlays were placed on ${this._state.viewFingerprint?.projection ?? '?'}
                      ${this._state.viewFingerprint?.dimensionality ?? '?'}D. Current view:
                      ${this.currentProjection?.projection ?? '?'}
                      ${this.currentProjection?.dimensionality ?? '?'}D.
                      <a
                        href="#"
                        @click=${(e: Event) => {
                          e.preventDefault();
                          this._clearOverlays();
                        }}
                        >Clear overlays</a
                      >
                    </div>
                  `
                : nothing}
              ${this._renderPresetsSection()} ${this._renderDimensionsSection()}
              ${this._renderLegendSection()} ${this._renderOverlaysSection()}
              ${this._renderInsetSection()} ${this._renderOptionsSection()}
            </div>

            <div class="publish-sidebar-footer">
              <button
                class="btn-danger"
                @click=${this._handleNewFigure}
                title="Clear overlays and insets, keep layout"
              >
                New Figure
              </button>
              <button
                class="btn-danger"
                @click=${this._handleReset}
                title="Reset all settings to defaults"
              >
                Reset
              </button>
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

  // ── Shared UI helpers ──────────────────────────────

  private _renderSliderInput(opts: {
    min: number;
    max: number;
    step?: number;
    value: number;
    unit?: string;
    onChange: (v: number) => void;
  }) {
    const { min, max, step, value, unit, onChange } = opts;
    const stepAttr = step ?? 1;
    const parse = step && step < 1 ? parseFloat : parseInt;
    return html`
      <div class="publish-input-group">
        <input
          type="range"
          class="publish-slider"
          min=${min}
          max=${max}
          step=${stepAttr}
          .value=${String(value)}
          @input=${(e: Event) => onChange(parse((e.target as HTMLInputElement).value) || value)}
        />
        <input
          type="number"
          class="publish-row-input"
          min=${min}
          max=${max}
          step=${stepAttr}
          .value=${String(value)}
          @change=${(e: Event) => onChange(parse((e.target as HTMLInputElement).value) || value)}
        />
        ${unit ? html`<span class="publish-unit">${unit}</span>` : nothing}
      </div>
    `;
  }

  // ── Toolbar ────────────────────────────────────────

  private _renderToolbar() {
    const tool = this._tool;
    return html`
      <div class="publish-preview-toolbar">
        <button
          class="publish-toggle-btn publish-tool-btn ${tool === 'select' ? 'active' : ''}"
          @click=${() => this._setTool('select')}
          title="Select / Move"
        >
          <svg viewBox="0 0 24 24"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>
          Select
        </button>
        <button
          class="publish-toggle-btn publish-tool-btn ${tool === 'circle' ? 'active' : ''}"
          @click=${() => this._setTool('circle')}
          title="Draw circle highlight"
        >
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg>
          Circle
        </button>
        <button
          class="publish-toggle-btn publish-tool-btn ${tool === 'arrow' ? 'active' : ''}"
          @click=${() => this._setTool('arrow')}
          title="Draw arrow"
        >
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14m-4-4l4 4-4 4" />
          </svg>
          Arrow
        </button>
        <button
          class="publish-toggle-btn publish-tool-btn ${tool === 'label' ? 'active' : ''}"
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
          class="publish-toggle-btn publish-tool-btn ${tool === 'inset-source' ? 'active' : ''}"
          @click=${() => this._setTool('inset-source')}
          title="Add zoom inset"
        >
          <svg viewBox="0 0 24 24">
            <path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </svg>
          Zoom Inset
        </button>
      </div>
    `;
  }

  // ── Presets section ────────────────────────────────

  private _renderPresetsSection() {
    return html`
      <div class="publish-section">
        <div class="publish-section-title">Presets</div>
        <div class="publish-preset-grid">
          ${JOURNAL_PRESETS.map((p) => {
            const preset = p as { widthMm?: number; widthPx?: number; heightPx?: number };
            const dims =
              preset.widthMm !== undefined
                ? `${preset.widthMm} mm`
                : `${preset.widthPx}\u00d7${preset.heightPx}`;
            return html`
              <button
                class="publish-toggle-btn publish-preset-btn ${this._state.preset === p.id
                  ? 'active'
                  : ''}"
                @click=${() => this._applyPreset(p.id)}
                title="${p.label} (${dims})"
              >
                ${p.label}<span class="publish-preset-dims">${dims}</span>
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }

  // ── Dimensions section ─────────────────────────────

  private _renderDimensionsSection() {
    const s = this._state;
    const constraints = this._getActivePresetConstraints();
    const widthMmDisplay = constraints
      ? `${constraints.widthMm} mm`
      : `${pxToMm(s.widthPx, s.dpi).toFixed(1)} mm`;
    const heightMm = pxToMm(s.heightPx, s.dpi);
    const maxHeightPx = constraints?.maxHeightMm ? mmToPx(constraints.maxHeightMm, s.dpi) : 8192;
    const heightMmDisplay = constraints?.maxHeightMm
      ? `${heightMm.toFixed(1)} mm (max ${constraints.maxHeightMm})`
      : `${heightMm.toFixed(1)} mm`;

    return html`
      <div class="publish-section">
        <div class="publish-section-title">Dimensions</div>

        <div class="publish-dim-field">
          <div class="publish-dim-header">
            <label>Width</label>
            <span class="publish-dim-value">
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
              <span class="publish-mm-display">${widthMmDisplay}</span>
            </span>
          </div>
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
        </div>

        <div class="publish-dim-field">
          <div class="publish-dim-header">
            <label>Height</label>
            <span class="publish-dim-value">
              <input
                type="number"
                class="publish-row-input"
                min="400"
                .max=${String(maxHeightPx)}
                .value=${String(s.heightPx)}
                @change=${(e: Event) => {
                  this._updateHeightPx(
                    parseInt((e.target as HTMLInputElement).value) || s.heightPx,
                  );
                }}
              />
              <span class="publish-unit">px</span>
              <span class="publish-mm-display">${heightMmDisplay}</span>
            </span>
          </div>
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
        </div>

        <div class="publish-dim-field">
          <div class="publish-dim-header">
            <label>DPI</label>
            <span class="publish-dim-value">
              <input
                type="number"
                class="publish-row-input"
                min="72"
                max="1000"
                .value=${String(s.dpi)}
                @change=${(e: Event) => {
                  this._updateDpi(parseInt((e.target as HTMLInputElement).value) || s.dpi);
                }}
              />
            </span>
          </div>
          <input
            type="range"
            class="publish-slider"
            min="72"
            max="1000"
            .value=${String(s.dpi)}
            @input=${(e: Event) => {
              this._updateDpi(parseInt((e.target as HTMLInputElement).value) || s.dpi);
            }}
          />
        </div>
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
                  <option value="free">Free (drag to move)</option>
                </select>
              </div>

              <div class="publish-row">
                <label>Size %</label>
                ${this._renderSliderInput({
                  min: 10,
                  max: 100,
                  value: leg.widthPercent,
                  unit: '%',
                  onChange: (v) => this._updateLegend({ widthPercent: v }),
                })}
              </div>

              <div class="publish-row">
                <label>Font size</label>
                ${this._renderSliderInput({
                  min: 8,
                  max: 120,
                  value: leg.fontSizePx,
                  unit: 'px',
                  onChange: (v) => this._updateLegend({ fontSizePx: v }),
                })}
              </div>

              <div class="publish-row">
                <label>Columns</label>
                ${this._renderSliderInput({
                  min: 1,
                  max: 6,
                  value: leg.columns,
                  onChange: (v) => this._updateLegend({ columns: v }),
                })}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Overlays section ───────────────────────────────

  private _renderOverlaysSection() {
    const anns = this._state.overlays;
    return html`
      <div class="publish-section">
        <div class="publish-section-title">Overlays (${anns.length})</div>
        ${anns.map((a, i) => {
          const isHi =
            this._highlightedItem?.kind === 'overlay' && this._highlightedItem.index === i;
          return html`
            <div
              class="publish-overlay-item ${isHi ? 'highlighted' : ''}"
              style="flex-direction: column; align-items: stretch; gap: 4px;"
              @mouseenter=${() => {
                this._highlightedItem = { kind: 'overlay', index: i };
              }}
              @mouseleave=${() => {
                this._highlightedItem = null;
              }}
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${a.type}${a.type === 'label' ? `: ${a.text}` : ''}</span>
                <button class="delete-btn" @click=${() => this._removeOverlay(i)} title="Remove">
                  <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              ${this._renderOverlayProps(a, i)}
            </div>
          `;
        })}
        ${anns.length === 0
          ? html`<span style="font-size: var(--text-xs); color: var(--muted)"
              >Use toolbar to add</span
            >`
          : nothing}
      </div>
    `;
  }

  private _renderOverlayProps(a: Overlay, i: number) {
    switch (a.type) {
      case 'circle':
        return html`
          <div class="publish-row" style="margin-bottom: 0;">
            <label>Stroke</label>
            ${this._renderSliderInput({
              min: 0.5,
              max: 10,
              step: 0.5,
              value: a.strokeWidth,
              unit: 'px',
              onChange: (v) => this._updateOverlay(i, { strokeWidth: v }),
            })}
          </div>
        `;
      case 'arrow':
        return html`
          <div class="publish-row" style="margin-bottom: 0;">
            <label>Stroke</label>
            ${this._renderSliderInput({
              min: 0.5,
              max: 10,
              step: 0.5,
              value: a.width,
              unit: 'px',
              onChange: (v) => this._updateOverlay(i, { width: v }),
            })}
          </div>
        `;
      case 'label':
        return html`
          <div class="publish-row" style="margin-bottom: 2px;">
            <label>Text</label>
            <input
              type="text"
              class="publish-row-input"
              style="width: 8rem; text-align: left;"
              .value=${a.text}
              @change=${(e: Event) => {
                this._updateOverlay(i, {
                  text: (e.target as HTMLInputElement).value || 'Label',
                });
              }}
            />
          </div>
          <div class="publish-row" style="margin-bottom: 0;">
            <label>Size</label>
            ${this._renderSliderInput({
              min: 8,
              max: 72,
              value: a.fontSize,
              unit: 'px',
              onChange: (v) => this._updateOverlay(i, { fontSize: v }),
            })}
          </div>
        `;
    }
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
              class="publish-overlay-item ${this._highlightedItem?.kind === 'inset' &&
              this._highlightedItem.index === i
                ? 'highlighted'
                : ''}"
              style="flex-direction: column; align-items: stretch; gap: 4px;"
              @mouseenter=${() => {
                this._highlightedItem = { kind: 'inset', index: i };
              }}
              @mouseleave=${() => {
                this._highlightedItem = null;
              }}
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>Inset ${i + 1}</span>
                <button class="delete-btn" @click=${() => this._removeInset(i)} title="Remove">
                  <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div class="publish-row" style="margin-bottom: 0;">
                <label>Border</label>
                ${this._renderSliderInput({
                  min: 0.5,
                  max: 10,
                  step: 0.5,
                  value: inset.border,
                  unit: 'px',
                  onChange: (v) => this._updateInset(i, { border: v }),
                })}
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
