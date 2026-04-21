import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Displays a pre-composed canvas scaled to fit its container.
 * The canvas is rendered at full resolution and CSS-scaled down for preview.
 */
@customElement('protspace-export-studio-preview')
export class ProtspaceExportStudioPreview extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .preview-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    canvas {
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .placeholder {
      color: var(--text-disabled, #667);
      font-size: 12px;
      text-align: center;
      padding: 24px;
    }
  `;

  @property({ attribute: false }) canvas: HTMLCanvasElement | null = null;

  render() {
    if (!this.canvas) {
      return html`<div class="placeholder">Generating preview...</div>`;
    }
    return nothing;
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('canvas')) {
      this._attachCanvas();
    }
  }

  private _attachCanvas(): void {
    const container = this.shadowRoot;
    if (!container) return;

    // Remove any previously attached canvas
    const existing = container.querySelector('canvas');
    if (existing) existing.remove();

    // Remove placeholder if canvas is being set
    const placeholder = container.querySelector('.placeholder');
    if (placeholder && this.canvas) placeholder.remove();

    if (!this.canvas) return;

    // Compute CSS dimensions to fit the canvas into the host
    const hostRect = this.getBoundingClientRect();
    const availW = Math.max(100, hostRect.width - 40);
    const availH = Math.max(100, hostRect.height - 40);
    const canvasAspect = this.canvas.width / this.canvas.height;

    let displayW: number;
    let displayH: number;
    if (availW / availH > canvasAspect) {
      displayH = availH;
      displayW = availH * canvasAspect;
    } else {
      displayW = availW;
      displayH = availW / canvasAspect;
    }

    const el = this.canvas;
    el.style.width = `${Math.round(displayW)}px`;
    el.style.height = `${Math.round(displayH)}px`;
    el.style.display = 'block';

    container.appendChild(el);
  }
}
