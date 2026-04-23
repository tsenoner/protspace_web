import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Inset, InsetStep } from './annotation-types';
import { insetToolStyles } from './inset-tool.styles';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function computeConnectorLines(source: Rect, inset: Rect): Line[] {
  const sl = source.x,
    sr = source.x + source.width;
  const st = source.y,
    sb = source.y + source.height;
  const il = inset.x,
    ir = inset.x + inset.width;
  const it = inset.y,
    ib = inset.y + inset.height;
  return sl <= il
    ? [
        { x1: sl, y1: st, x2: il, y2: it },
        { x1: sr, y1: sb, x2: ir, y2: ib },
      ]
    : [
        { x1: sr, y1: st, x2: ir, y2: it },
        { x1: sl, y1: sb, x2: il, y2: ib },
      ];
}

/**
 * Inset Tool — a draggable magnifying lens on the scatter canvas.
 *
 * Framing mode: a lens overlay appears. Drag it over the region of interest,
 * scroll inside to zoom. The lens shows a live cropped+zoomed view of the
 * main scatter canvas underneath. Confirm to create a permanent inset.
 */
@customElement('protspace-inset-tool')
export class ProtspaceInsetTool extends LitElement {
  static styles = insetToolStyles;

  @property({ type: String }) step: InsetStep = 'idle';
  @property({ type: Array }) insets: Inset[] = [];
  @property({ type: Object }) containerSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  /** The main scatter WebGL canvas to read zoomed regions from. */
  @property({ attribute: false }) sourceCanvas: HTMLCanvasElement | null = null;

  // ── Lens state (framing mode) ──
  @state() private _lensX = 0; // px from container left
  @state() private _lensY = 0; // px from container top
  @state() private _lensSize = 200; // px (square)
  @state() private _lensZoom = 2; // multiplier (1 = no zoom, 4 = 4x)

  // ── Drag state ──
  @state() private _dragState: {
    type: 'lens' | 'lens-resize' | 'inset';
    id?: string;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startSize?: number;
  } | null = null;

  private _rafId: number | null = null;

  // ── Lifecycle ──

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    super.disconnectedCallback();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('step') && this.step === 'framing') {
      // Center the lens on the canvas
      this._lensX = (this.containerSize.width - this._lensSize) / 2;
      this._lensY = (this.containerSize.height - this._lensSize) / 2;
      this._lensZoom = 2;
      this._scheduleLensRender();
    }
    // Redraw confirmed inset canvases
    this._drawInsetCanvases();
    // Redraw lens if visible
    if (this.step === 'framing') {
      this._scheduleLensRender();
    }
  }

  // ── Lens rendering — crops + zooms from the source canvas ──

  private _scheduleLensRender() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._renderLensCanvas();
    });
  }

  private _renderLensCanvas() {
    const lensCanvas = this.shadowRoot?.querySelector('.lens-canvas') as HTMLCanvasElement | null;
    if (!lensCanvas || !this.sourceCanvas) return;

    const ctx = lensCanvas.getContext('2d');
    if (!ctx) return;

    const src = this.sourceCanvas;
    const dpr = src.width / (this.containerSize.width || 1);

    // Source region: center of lens mapped to source canvas, divided by zoom
    const regionW = this._lensSize / this._lensZoom;
    const regionH = this._lensSize / this._lensZoom;
    const centerX = this._lensX + this._lensSize / 2;
    const centerY = this._lensY + this._lensSize / 2;

    const sx = (centerX - regionW / 2) * dpr;
    const sy = (centerY - regionH / 2) * dpr;
    const sw = regionW * dpr;
    const sh = regionH * dpr;

    lensCanvas.width = this._lensSize * 2; // retina
    lensCanvas.height = this._lensSize * 2;

    ctx.clearRect(0, 0, lensCanvas.width, lensCanvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, lensCanvas.width, lensCanvas.height);
  }

  // ── Lens interactions ──

  private _onLensPointerDown(e: PointerEvent) {
    if (this.step !== 'framing') return;
    e.preventDefault();
    e.stopPropagation();
    this._dragState = {
      type: 'lens',
      startX: e.clientX,
      startY: e.clientY,
      startPosX: this._lensX,
      startPosY: this._lensY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onLensPointerMove(e: PointerEvent) {
    if (!this._dragState) return;
    if (this._dragState.type === 'lens') {
      this._lensX = this._dragState.startPosX + (e.clientX - this._dragState.startX);
      this._lensY = this._dragState.startPosY + (e.clientY - this._dragState.startY);
      this._scheduleLensRender();
    } else if (this._dragState.type === 'lens-resize') {
      const dx = e.clientX - this._dragState.startX;
      const dy = e.clientY - this._dragState.startY;
      const delta = Math.max(dx, dy);
      this._lensSize = Math.max(80, Math.min(600, (this._dragState.startSize ?? 200) + delta));
      this._scheduleLensRender();
    }
  }

  private _onLensPointerUp() {
    if (this._dragState?.type === 'lens' || this._dragState?.type === 'lens-resize') {
      this._dragState = null;
    }
  }

  private _onResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    this._dragState = {
      type: 'lens-resize',
      startX: e.clientX,
      startY: e.clientY,
      startPosX: this._lensX,
      startPosY: this._lensY,
      startSize: this._lensSize,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onLensWheel(e: WheelEvent) {
    if (this.step !== 'framing') return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    this._lensZoom = Math.max(1, Math.min(8, this._lensZoom + delta));
    this._scheduleLensRender();
  }

  private _onLensConfirm() {
    // Dispatch the frame rectangle (normalized) + zoom
    const cw = this.containerSize.width || 1;
    const ch = this.containerSize.height || 1;
    this.dispatchEvent(
      new CustomEvent('inset-frame-drawn', {
        detail: {
          x: this._lensX / cw,
          y: this._lensY / ch,
          width: this._lensSize / cw,
          height: this._lensSize / ch,
          zoom: this._lensZoom,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Inset drag (confirmed insets) ──

  private _onInsetPointerDown(e: PointerEvent, inset: Inset) {
    e.preventDefault();
    this._dragState = {
      type: 'inset',
      id: inset.id,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: inset.position.x,
      startPosY: inset.position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onInsetPointerMove(e: PointerEvent) {
    if (!this._dragState || this._dragState.type !== 'inset') return;
    const cw = this.containerSize.width || 1;
    const ch = this.containerSize.height || 1;
    this.dispatchEvent(
      new CustomEvent('inset-reposition', {
        detail: {
          id: this._dragState.id,
          position: {
            x: this._dragState.startPosX + (e.clientX - this._dragState.startX) / cw,
            y: this._dragState.startPosY + (e.clientY - this._dragState.startY) / ch,
          },
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onInsetPointerUp() {
    if (this._dragState?.type === 'inset') {
      this._dragState = null;
    }
  }

  // ── Keyboard ──

  private _onKeyDown = (e: KeyboardEvent) => {
    if (this.step === 'idle') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('inset-cancel', { bubbles: true, composed: true }));
    } else if (e.key === 'Enter' && this.step === 'framing') {
      e.preventDefault();
      this._onLensConfirm();
    }
  };

  // ── Draw confirmed inset canvases ──

  private _drawInsetCanvases() {
    for (const inset of this.insets) {
      if (!inset.capturedCanvas) continue;
      const boxes = this.shadowRoot?.querySelectorAll('.inset-box');
      if (!boxes) continue;
      for (const box of boxes) {
        const canvas = box.querySelector('canvas');
        if (canvas && canvas.dataset.insetId === inset.id) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(inset.capturedCanvas, 0, 0);
          }
        }
      }
    }
  }

  // ── Render ──

  private _renderInset(inset: Inset) {
    const { width: cw, height: ch } = this.containerSize;
    const left = inset.position.x * cw;
    const top = inset.position.y * ch;
    const width = inset.size.width * cw;
    const height = inset.size.height * ch;

    return html`
      <div
        class="inset-box ${inset.shape === 'circle' ? 'circle' : ''}"
        style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"
        @pointerdown="${(e: PointerEvent) => this._onInsetPointerDown(e, inset)}"
        @pointermove="${this._onInsetPointerMove}"
        @pointerup="${this._onInsetPointerUp}"
      >
        ${inset.capturedCanvas
          ? html`<canvas
              data-inset-id="${inset.id}"
              width="${inset.capturedCanvas.width}"
              height="${inset.capturedCanvas.height}"
            ></canvas>`
          : nothing}
        <div class="resize-handle"></div>
        ${inset.label ? html`<div class="inset-label">${inset.label}</div>` : nothing}
      </div>
    `;
  }

  render() {
    if (this.step === 'idle' && this.insets.length === 0) return nothing;

    return html`
      ${this.step === 'framing'
        ? html`
            <div
              class="lens"
              style="left:${this._lensX}px;top:${this._lensY}px;width:${this
                ._lensSize}px;height:${this._lensSize}px;"
              @pointerdown="${this._onLensPointerDown}"
              @pointermove="${this._onLensPointerMove}"
              @pointerup="${this._onLensPointerUp}"
              @wheel="${this._onLensWheel}"
            >
              <canvas class="lens-canvas"></canvas>
              <div class="lens-zoom-label">${this._lensZoom.toFixed(1)}×</div>
              <div
                class="lens-resize-handle"
                @pointerdown="${this._onResizePointerDown}"
                @pointermove="${this._onLensPointerMove}"
                @pointerup="${this._onLensPointerUp}"
              ></div>
              <button class="lens-confirm" @click="${this._onLensConfirm}" title="Confirm inset">
                ✓
              </button>
            </div>
            <div class="toolbar-hint">
              Drag lens to move · Scroll inside to zoom · <kbd>Enter</kbd> to confirm ·
              <kbd>Esc</kbd> to cancel
            </div>
          `
        : nothing}
      <svg class="connector-svg" width="100%" height="100%"></svg>
      ${this.insets.map((inset) => this._renderInset(inset))}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-inset-tool': ProtspaceInsetTool;
  }
}
