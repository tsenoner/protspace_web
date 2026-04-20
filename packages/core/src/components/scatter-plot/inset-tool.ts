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
  const sourceLeft = source.x;
  const sourceRight = source.x + source.width;
  const sourceTop = source.y;
  const sourceBottom = source.y + source.height;
  const insetLeft = inset.x;
  const insetRight = inset.x + inset.width;
  const insetTop = inset.y;
  const insetBottom = inset.y + inset.height;

  if (sourceLeft <= insetLeft) {
    return [
      { x1: sourceLeft, y1: sourceTop, x2: insetLeft, y2: insetTop },
      { x1: sourceRight, y1: sourceBottom, x2: insetRight, y2: insetBottom },
    ];
  }
  return [
    { x1: sourceRight, y1: sourceTop, x2: insetRight, y2: insetTop },
    { x1: sourceLeft, y1: sourceBottom, x2: insetLeft, y2: insetBottom },
  ];
}

@customElement('protspace-inset-tool')
export class ProtspaceInsetTool extends LitElement {
  static styles = insetToolStyles;

  @property({ type: String }) step: InsetStep = 'idle';
  @property({ type: Array }) insets: Inset[] = [];
  @property({ type: Object }) containerSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };

  @state()
  private _dragState: {
    id: string;
    startX: number;
    startY: number;
    startPos: { x: number; y: number };
  } | null = null;

  private _onInsetPointerDown(e: PointerEvent, inset: Inset) {
    e.preventDefault();
    this._dragState = {
      id: inset.id,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...inset.position },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onInsetPointerMove(e: PointerEvent) {
    if (!this._dragState || !this.containerSize.width) return;
    const dx = (e.clientX - this._dragState.startX) / this.containerSize.width;
    const dy = (e.clientY - this._dragState.startY) / this.containerSize.height;
    this.dispatchEvent(
      new CustomEvent('inset-reposition', {
        detail: {
          id: this._dragState.id,
          position: {
            x: this._dragState.startPos.x + dx,
            y: this._dragState.startPos.y + dy,
          },
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onInsetPointerUp() {
    this._dragState = null;
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.dispatchEvent(new CustomEvent('inset-cancel', { bubbles: true, composed: true }));
    } else if (e.key === 'Enter') {
      this.dispatchEvent(new CustomEvent('inset-confirm', { bubbles: true, composed: true }));
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback();
  }

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
        <div class="resize-handle"></div>
        ${inset.label
          ? html`<div class="inset-label">${inset.label} · ${inset.zoomFactor.toFixed(1)}×</div>`
          : nothing}
      </div>
    `;
  }

  render() {
    if (this.step === 'idle' && this.insets.length === 0) return nothing;

    return html`
      ${this.step === 'framing'
        ? html`
            <div class="framing-badge">FRAMING</div>
            <div class="toolbar-hint">
              Zoom &amp; pan to frame · Press <kbd>Enter</kbd> to snap · <kbd>Esc</kbd> to cancel
            </div>
          `
        : nothing}
      ${this.step === 'snapped'
        ? html`<div class="snap-badge">Content locked — drag to position</div>`
        : nothing}
      <svg class="connector-svg" width="100%" height="100%"></svg>
      ${this.insets.map((inset) => this._renderInset(inset))}
    `;
  }
}
