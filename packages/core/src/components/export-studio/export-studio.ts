import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Indicator, Inset } from '../scatter-plot/annotation-types';
import { exportStudioStyles } from './export-studio.styles';

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

@customElement('protspace-export-studio')
export class ProtspaceExportStudio extends LitElement {
  static styles = exportStudioStyles;

  @property({ type: Boolean }) open = false;
  @property({ type: Array }) indicators: Indicator[] = [];
  @property({ type: Array }) insets: Inset[] = [];

  @state() private _layoutId = 'two_column_right';
  @state() private _dpi = 300;
  @state() private _format: 'png' | 'pdf' = 'png';

  private _close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('export-studio-close', { bubbles: true, composed: true }));
  }

  private _handleDownload() {
    this.dispatchEvent(
      new CustomEvent('export-studio-download', {
        detail: {
          layoutId: this._layoutId,
          dpi: this._dpi,
          format: this._format,
          indicators: this.indicators,
          insets: this.insets,
        },
        bubbles: true,
        composed: true,
      }),
    );
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
    super.disconnectedCallback();
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div
        class="overlay"
        @click="${this._onOverlayClick}"
        role="dialog"
        aria-modal="true"
        aria-label="Export Studio"
      >
        <div class="studio">
          <div class="preview-area">
            <div class="checkerboard"></div>
            <div class="figure-frame" style="width:400px;height:300px;">
              <div class="dim-badge">Preview</div>
            </div>
          </div>
          <div class="controls-panel">
            <div class="studio-header">
              <h2>Export Studio</h2>
              <button class="close-btn" @click="${this._close}" aria-label="Close">✕</button>
            </div>

            <div class="control-section">
              <h3>Layout Preset</h3>
              <p style="font-size:11px;color:var(--text-secondary,#aab);">
                Presets will be wired to PR #224 layouts
              </p>
            </div>

            <div class="control-section">
              <h3>Legend</h3>
              <p style="font-size:11px;color:var(--text-secondary,#aab);">Legend controls here</p>
            </div>

            <div class="control-section">
              <h3>Indicators (${this.indicators.length})</h3>
              ${this.indicators.length === 0
                ? html`<p style="font-size:10px;color:var(--text-disabled,#667);">
                    Right-click a point on canvas to add
                  </p>`
                : this.indicators.map(
                    (ind) => html`
                      <div
                        style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;color:var(--text-primary,#ddd);"
                      >
                        <span>↗</span>
                        <span>${ind.label}</span>
                      </div>
                    `,
                  )}
            </div>

            <div class="control-section">
              <h3>Insets (${this.insets.length})</h3>
              ${this.insets.length === 0
                ? html`<p style="font-size:10px;color:var(--text-disabled,#667);">
                    Use inset tool on canvas to add
                  </p>`
                : this.insets.map(
                    (inset) => html`
                      <div
                        style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;color:var(--text-primary,#ddd);"
                      >
                        <span>${inset.shape === 'circle' ? '●' : '■'}</span>
                        <span>${inset.label || 'Inset'} · ${inset.zoomFactor.toFixed(1)}×</span>
                      </div>
                    `,
                  )}
            </div>

            <div class="control-section">
              <h3>Output</h3>
              <div
                style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-secondary,#aab);margin-bottom:6px;"
              >
                <span>DPI</span>
                <span style="color:var(--accent-color,#5b8fd9);">${this._dpi}</span>
              </div>
              <div
                style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-secondary,#aab);"
              >
                <span>Format</span>
                <span style="color:var(--accent-color,#5b8fd9);"
                  >${this._format.toUpperCase()}</span
                >
              </div>
            </div>

            <div class="btn-row">
              <button class="btn btn-primary" @click="${this._handleDownload}">Download PNG</button>
              <button
                class="btn btn-secondary"
                @click="${() => {
                  this._format = 'pdf';
                  this._handleDownload();
                }}"
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
