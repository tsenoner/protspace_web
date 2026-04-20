// packages/core/src/components/scatter-plot/indicator-layer.ts
import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Indicator } from './annotation-types';
import { indicatorLayerStyles } from './indicator-layer.styles';

interface ZoomTransformLike {
  x: number;
  y: number;
  k: number;
}

export interface ArrowScreenPosition {
  tipX: number;
  tipY: number;
  shaftX: number;
  shaftY: number;
}

export function computeArrowScreenPosition(
  indicator: Indicator,
  scaleX: (v: number) => number,
  scaleY: (v: number) => number,
  transform: ZoomTransformLike,
): ArrowScreenPosition {
  const rawX = scaleX(indicator.dataCoords[0]);
  const rawY = scaleY(indicator.dataCoords[1]);
  const tipX = rawX * transform.k + transform.x;
  const tipY = rawY * transform.k + transform.y;
  return {
    tipX,
    tipY,
    shaftX: tipX + indicator.offsetPx[0],
    shaftY: tipY + indicator.offsetPx[1],
  };
}

@customElement('protspace-indicator-layer')
export class ProtspaceIndicatorLayer extends LitElement {
  static styles = indicatorLayerStyles;

  @property({ type: Array }) indicators: Indicator[] = [];
  @property({ type: Object }) transform: ZoomTransformLike = { x: 0, y: 0, k: 1 };
  @property({ attribute: false }) scaleX: ((v: number) => number) | null = null;
  @property({ attribute: false }) scaleY: ((v: number) => number) | null = null;

  private _dragState: {
    id: string;
    startX: number;
    startY: number;
    startOffset: [number, number];
  } | null = null;

  private _onPointerDown(e: PointerEvent, indicator: Indicator) {
    e.preventDefault();
    this._dragState = {
      id: indicator.id,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: [...indicator.offsetPx],
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onPointerMove(e: PointerEvent) {
    if (!this._dragState) return;
    const dx = e.clientX - this._dragState.startX;
    const dy = e.clientY - this._dragState.startY;
    this.dispatchEvent(
      new CustomEvent('indicator-update', {
        detail: {
          id: this._dragState.id,
          offsetPx: [this._dragState.startOffset[0] + dx, this._dragState.startOffset[1] + dy],
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onPointerUp() {
    this._dragState = null;
  }

  private _onLabelEdit(e: FocusEvent, id: string) {
    const text = (e.target as HTMLElement).textContent?.trim() ?? '';
    this.dispatchEvent(
      new CustomEvent('indicator-update', {
        detail: { id, label: text },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onKeyDown(e: KeyboardEvent, id: string) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if ((e.target as HTMLElement).contentEditable !== 'true') {
        this.dispatchEvent(
          new CustomEvent('indicator-remove', {
            detail: { id },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }
  }

  render() {
    if (!this.scaleX || !this.scaleY) return nothing;

    return html`
      ${this.indicators.map((ind) => {
        const pos = computeArrowScreenPosition(ind, this.scaleX!, this.scaleY!, this.transform);
        return html`
          <div
            class="indicator"
            style="left:${pos.shaftX}px;top:${pos.shaftY - 32}px;"
            tabindex="0"
            @pointerdown="${(e: PointerEvent) => this._onPointerDown(e, ind)}"
            @pointermove="${this._onPointerMove}"
            @pointerup="${this._onPointerUp}"
            @keydown="${(e: KeyboardEvent) => this._onKeyDown(e, ind.id)}"
          >
            <div
              class="arrow-label"
              contenteditable="true"
              @blur="${(e: FocusEvent) => this._onLabelEdit(e, ind.id)}"
            >
              ${ind.label}
            </div>
            <div class="arrow-shaft"></div>
            <div class="arrow-head"></div>
          </div>
        `;
      })}
    `;
  }
}
