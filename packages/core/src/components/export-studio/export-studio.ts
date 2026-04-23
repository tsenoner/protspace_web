import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  type FigureLayoutId,
  FIGURE_LAYOUTS,
  type PublicationLegendModel,
  type ScatterplotCaptureFn,
  captureScatterForLayout,
  composePublicationFigureRaster,
  computePublicationLayout,
  drawPublicationLegend,
  exportPublicationFigure,
  downloadPng,
  downloadPublicationPdf,
  mmToPx,
} from '@protspace/utils';
import type { Indicator, Inset } from '../scatter-plot/annotation-types';
import { tokens } from '../../styles/tokens';
import { buttonMixin, inputMixin } from '../../styles/mixins';
import { overlayMixins } from '../../styles/overlay-mixins';
import { exportStudioStyles } from './export-studio.styles';
import './export-studio-preview';

type LayoutMode = 'publication' | 'native';

interface FigureSizeMm {
  widthMm: number;
  heightMm: number;
  widthPx?: undefined;
  heightPx?: undefined;
}

interface FigureSizePx {
  widthPx: number;
  heightPx: number;
  widthMm?: undefined;
  heightMm?: undefined;
}

type FigureSize = FigureSizeMm | FigureSizePx;

export function computePreviewDimensions(
  figure: FigureSize,
  available: { width: number; height: number },
): { width: number; height: number } {
  const aspect =
    figure.widthMm != null ? figure.widthMm / figure.heightMm : figure.widthPx! / figure.heightPx!;

  const fitByWidth = { width: available.width, height: available.width / aspect };
  const fitByHeight = { width: available.height * aspect, height: available.height };

  return fitByWidth.height <= available.height ? fitByWidth : fitByHeight;
}

const LAYOUT_LABELS: Record<FigureLayoutId, string> = {
  one_column_below: '1-col + legend below',
  two_column_right: '2-col + legend right',
  two_column_below: '2-col + legend below',
  full_page_top: 'Full page + legend top',
  one_column_scatter_only: '1-col scatter only',
  two_column_scatter_only: '2-col scatter only',
  full_page_scatter_only: 'Full page scatter only',
};

@customElement('protspace-export-studio')
export class ProtspaceExportStudio extends LitElement {
  static styles = [tokens, buttonMixin, inputMixin, overlayMixins, exportStudioStyles];

  @property({ type: Boolean }) open = false;
  @property({ type: Array }) indicators: Indicator[] = [];
  @property({ type: Array }) insets: Inset[] = [];
  @property({ attribute: false }) scatterCapture: ScatterplotCaptureFn | null = null;
  @property({ attribute: false }) legendModel: PublicationLegendModel | null = null;
  @property({ attribute: false }) viewportAspect: number | undefined = undefined;
  @property({ attribute: false }) fileNameBase: string = 'protspace_export';

  @state() private _layoutMode: LayoutMode = 'publication';
  @state() private _layoutId: FigureLayoutId = 'two_column_right';
  @state() private _dpi = 300;
  @state() private _format: 'png' | 'pdf' = 'png';
  @state() private _previewCanvas: HTMLCanvasElement | null = null;
  @state() private _isRendering = false;
  @state() private _legendLocked = true; // true = t03i's publication styling
  @state() private _legendFontSizePx = 15;
  @state() private _legendWidthPercent = 20;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private _close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('export-studio-close', { bubbles: true, composed: true }));
  }

  private async _handleDownload(format?: 'png' | 'pdf') {
    const fmt = format ?? this._format;
    if (!this.scatterCapture || !this.legendModel) return;

    try {
      if (this._layoutMode === 'publication') {
        const layoutDef = FIGURE_LAYOUTS[this._layoutId];
        await exportPublicationFigure({
          layoutId: this._layoutId,
          format: fmt,
          dpi: this._dpi,
          backgroundColor: '#ffffff',
          scatterCapture: this.scatterCapture,
          legendModel: this.legendModel,
          fileNameBase: this.fileNameBase,
          viewportAspect: this.viewportAspect,
          legendBandMmOverride: !this._legendLocked
            ? layoutDef.widthMm * (this._legendWidthPercent / 100)
            : undefined,
          fontSizeOverridePx: !this._legendLocked ? this._legendFontSizePx : undefined,
        });
      } else {
        // Native or Freeform: render at exact pixel dimensions
        const { w, h } = this._getPixelDimensions();
        const canvas = this.scatterCapture(w, h, {
          backgroundColor: '#ffffff',
        });
        const name = `${this.fileNameBase}_${this._layoutMode}`;
        if (fmt === 'png') {
          downloadPng(canvas, `${name}.png`);
        } else {
          // For native/freeform PDF, create a pseudo-layout for sizing
          const widthMm = (w / this._dpi) * 25.4;
          const heightMm = (h / this._dpi) * 25.4;
          const layout = {
            figureMm: { width: widthMm, height: heightMm },
            scatterMm: { x: 0, y: 0, width: widthMm, height: heightMm },
            legendMm: { x: 0, y: 0, width: 0, height: 0 },
          };
          await downloadPublicationPdf(canvas, layout, `${name}.pdf`);
        }
      }
    } catch (err) {
      console.error('Export Studio download failed:', err);
    }
  }

  private _getPixelDimensions(): { w: number; h: number } {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  private _onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this._close();
    }
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._close();
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<PropertyKey, unknown>) {
    const triggerKeys: PropertyKey[] = [
      'open',
      '_layoutMode',
      '_layoutId',
      '_dpi',
      '_legendLocked',
      '_legendFontSizePx',
      '_legendWidthPercent',
      'scatterCapture',
      'legendModel',
      'viewportAspect',
    ];
    const shouldRerender = triggerKeys.some((k) => changedProperties.has(k));
    if (shouldRerender && this.open) {
      this._schedulePreviewRender();
    }
  }

  private _schedulePreviewRender() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      void this._renderPreview();
    }, 300);
  }

  private async _renderPreview() {
    if (!this.scatterCapture || !this.legendModel) {
      this._previewCanvas = null;
      return;
    }

    this._isRendering = true;

    try {
      if (this._layoutMode === 'publication') {
        const layoutDef = FIGURE_LAYOUTS[this._layoutId];
        const bg = '#ffffff';

        // Use a lower DPI for preview to keep it fast
        const previewDpi = Math.min(this._dpi, 150);

        // Flexible legend: override legend band width
        const legendOverrides = !this._legendLocked
          ? { legendBandMm: layoutDef.widthMm * (this._legendWidthPercent / 100) }
          : undefined;
        const previewLayout = computePublicationLayout(
          layoutDef,
          this.viewportAspect,
          legendOverrides,
        );

        const scatterCanvas = captureScatterForLayout(
          previewLayout.scatterMm,
          previewDpi,
          this.scatterCapture,
          bg,
        );

        const legendModel = this.legendModel;
        const layoutId = this._layoutId;
        const fontSizeOverridePx = !this._legendLocked ? this._legendFontSizePx : undefined;

        const canvas = await composePublicationFigureRaster({
          layout: previewLayout,
          scatterCanvas,
          legendDrawer: (ctx, rect) =>
            drawPublicationLegend(ctx, rect, legendModel, {
              dpi: previewDpi,
              layoutId,
              fontSizeOverridePx,
            }),
          dpi: previewDpi,
          backgroundColor: bg,
        });

        this._previewCanvas = canvas;
      } else {
        // Native or Freeform: capture at reduced resolution for preview
        const { w, h } = this._getPixelDimensions();
        const scale = Math.min(1, 800 / Math.max(w, h));
        const previewW = Math.round(w * scale);
        const previewH = Math.round(h * scale);

        const canvas = this.scatterCapture(previewW, previewH, {
          backgroundColor: '#ffffff',
        });
        this._previewCanvas = canvas;
      }
    } catch (err) {
      console.error('Preview render failed:', err);
      this._previewCanvas = null;
    } finally {
      this._isRendering = false;
    }
  }

  private _selectLayoutMode(mode: LayoutMode) {
    this._layoutMode = mode;
  }

  private _selectLayout(id: FigureLayoutId) {
    this._layoutId = id;
  }

  private _getDimensionLabel(): string {
    if (this._layoutMode === 'publication') {
      const layout = FIGURE_LAYOUTS[this._layoutId];
      const wPx = Math.round(mmToPx(layout.widthMm, this._dpi));
      const hPx = Math.round(mmToPx(layout.heightMm, this._dpi));
      return `${layout.widthMm}mm x ${layout.heightMm}mm (${wPx} x ${hPx}px @ ${this._dpi}dpi)`;
    }
    return `${window.innerWidth} x ${window.innerHeight}px (screen)`;
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div
        class="modal-overlay"
        @click="${this._onOverlayClick}"
        role="dialog"
        aria-modal="true"
        aria-label="Export Studio"
      >
        <div class="studio">
          <div class="preview-area">
            <div class="checkerboard"></div>
            <div class="figure-frame">
              <protspace-export-studio-preview
                .canvas="${this._previewCanvas}"
              ></protspace-export-studio-preview>
              ${this._isRendering
                ? html`<div class="dim-badge">Rendering...</div>`
                : html`<div class="dim-badge">${this._getDimensionLabel()}</div>`}
            </div>
          </div>
          <div class="controls-panel">
            <div class="studio-header">
              <h2>Export Studio</h2>
              <button class="btn-close" @click="${this._close}" aria-label="Close">&#x2715;</button>
            </div>

            ${this._renderModeSelector()} ${this._renderLayoutControls()}
            ${this._renderIndicatorsSection()} ${this._renderInsetsSection()}
            ${this._renderOutputSection()} ${this._renderDownloadButtons()}
          </div>
        </div>
      </div>
    `;
  }

  private _renderModeSelector() {
    const modes: { id: LayoutMode; label: string }[] = [
      { id: 'publication', label: 'Publication' },
      { id: 'native', label: 'Screen' },
    ];

    return html`
      <div class="control-section">
        <h3>Mode</h3>
        <div class="preset-grid mode-grid">
          ${modes.map(
            (m) => html`
              <button
                class="preset-btn ${this._layoutMode === m.id ? 'active' : ''}"
                @click="${() => this._selectLayoutMode(m.id)}"
              >
                ${m.label}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderLayoutControls() {
    if (this._layoutMode === 'publication') {
      return this._renderPublicationPresets();
    }
    return this._renderNativeInfo();
  }

  private _renderPublicationPresets() {
    const layoutIds = Object.keys(FIGURE_LAYOUTS) as FigureLayoutId[];

    return html`
      <div class="control-section">
        <h3>Layout Preset</h3>
        <div class="preset-grid">
          ${layoutIds.map(
            (id) => html`
              <button
                class="preset-btn ${this._layoutId === id ? 'active' : ''}"
                @click="${() => this._selectLayout(id)}"
                title="${LAYOUT_LABELS[id]}"
              >
                ${LAYOUT_LABELS[id]}
              </button>
            `,
          )}
        </div>
      </div>

      <div class="control-section">
        <h3>Legend</h3>
        <div class="control-row">
          <span class="control-label">Placement</span>
          <span class="control-value">${FIGURE_LAYOUTS[this._layoutId].legend.placement}</span>
        </div>
        <div class="control-row">
          <span class="control-label">Columns</span>
          <span class="control-value">${FIGURE_LAYOUTS[this._layoutId].legend.columns}</span>
        </div>
        <div class="control-row">
          <label class="control-label">
            <input
              type="checkbox"
              .checked="${this._legendLocked}"
              @change="${(e: Event) => {
                this._legendLocked = (e.target as HTMLInputElement).checked;
              }}"
            />
            Locked styling
          </label>
        </div>
        ${!this._legendLocked
          ? html`
              <div class="control-row">
                <span class="control-label">Font size</span>
                <span class="control-value">${this._legendFontSizePx}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                .value="${String(this._legendFontSizePx)}"
                @input="${(e: Event) => {
                  this._legendFontSizePx = Number((e.target as HTMLInputElement).value);
                }}"
                style="width:100%;margin-bottom:8px;"
              />
              <div class="control-row">
                <span class="control-label">Legend width</span>
                <span class="control-value">${this._legendWidthPercent}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                .value="${String(this._legendWidthPercent)}"
                @input="${(e: Event) => {
                  this._legendWidthPercent = Number((e.target as HTMLInputElement).value);
                }}"
                style="width:100%;"
              />
            `
          : nothing}
      </div>
    `;
  }

  private _renderNativeInfo() {
    return html`
      <div class="control-section">
        <h3>Native Resolution</h3>
        <div class="control-row">
          <span class="control-label">Width</span>
          <span class="control-value">${window.innerWidth}px</span>
        </div>
        <div class="control-row">
          <span class="control-label">Height</span>
          <span class="control-value">${window.innerHeight}px</span>
        </div>
        <p class="info-text">
          Exports at current screen pixel dimensions (scatter only, no legend).
        </p>
      </div>
    `;
  }

  private _renderIndicatorsSection() {
    return html`
      <div class="control-section">
        <h3>Indicators (${this.indicators.length})</h3>
        ${this.indicators.length === 0
          ? html`<p class="info-text">Right-click a point on canvas to add</p>`
          : this.indicators.map(
              (ind) => html`
                <div class="annotation-item">
                  <span class="annotation-icon">&nearr;</span>
                  <span>${ind.label}</span>
                </div>
              `,
            )}
      </div>
    `;
  }

  private _renderInsetsSection() {
    return html`
      <div class="control-section">
        <h3>Insets (${this.insets.length})</h3>
        ${this.insets.length === 0
          ? html`<p class="info-text">Use inset tool on canvas to add</p>`
          : this.insets.map(
              (inset) => html`
                <div class="annotation-item">
                  <span class="annotation-icon"
                    >${inset.shape === 'circle' ? '\u25CF' : '\u25A0'}</span
                  >
                  <span
                    >${inset.label || 'Inset'} &middot; ${inset.zoomFactor.toFixed(1)}&times;</span
                  >
                </div>
              `,
            )}
      </div>
    `;
  }

  private _renderOutputSection() {
    return html`
      <div class="control-section">
        <h3>Output</h3>
        <div class="control-row">
          <span class="control-label">DPI</span>
          <select
            class="select-input"
            @change="${(e: Event) => {
              this._dpi = Number((e.target as HTMLSelectElement).value);
            }}"
          >
            <option value="150" ?selected="${this._dpi === 150}">150 (draft)</option>
            <option value="300" ?selected="${this._dpi === 300}">300 (print)</option>
            <option value="600" ?selected="${this._dpi === 600}">600 (high-res)</option>
          </select>
        </div>
      </div>
    `;
  }

  private _dispatchExportAction(type: string) {
    this.dispatchEvent(
      new CustomEvent('export-action', {
        detail: { type },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderDownloadButtons() {
    const disabled = !this.scatterCapture || !this.legendModel;
    return html`
      <div class="btn-row">
        <button
          class="btn btn-primary"
          ?disabled="${disabled}"
          @click="${() => this._handleDownload('png')}"
        >
          PNG
        </button>
        <button
          class="btn btn-secondary"
          ?disabled="${disabled}"
          @click="${() => this._handleDownload('pdf')}"
        >
          PDF
        </button>
        <button class="btn btn-secondary" @click="${() => this._dispatchExportAction('ids')}">
          IDs
        </button>
        <button class="btn btn-secondary" @click="${() => this._dispatchExportAction('parquet')}">
          Parquet
        </button>
      </div>
    `;
  }
}
