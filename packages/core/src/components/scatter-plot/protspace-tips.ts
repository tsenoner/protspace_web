import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { protspaceTipsStyles } from './protspace-tips.styles';

@customElement('protspace-tips')
export class ProtspaceTips extends LitElement {
  static styles = protspaceTipsStyles;

  @state() private _isTooltipVisible = false;

  private _handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._toggleTooltip();
    } else if (event.key === 'Escape') {
      this._hideTooltip();
    }
  }

  private _toggleTooltip() {
    this._isTooltipVisible = !this._isTooltipVisible;
  }

  private _showTooltip() {
    this._isTooltipVisible = true;
  }

  private _hideTooltip() {
    this._isTooltipVisible = false;
  }

  private _handleFocusOut(event: FocusEvent) {
    // Hide tooltip when focus moves outside the component
    const relatedTarget = event.relatedTarget as Element;
    if (!this.contains(relatedTarget)) {
      this._hideTooltip();
    }
  }

  render() {
    return html`
      <button
        class="trigger ${this._isTooltipVisible ? 'active' : ''}"
        type="button"
        tabindex="0"
        aria-label="View ProtSpace tips and shortcuts"
        aria-describedby="protspace-tips-content"
        aria-expanded="${this._isTooltipVisible}"
        @keydown=${this._handleKeyDown}
        @mouseenter=${this._showTooltip}
        @mouseleave=${this._hideTooltip}
        @focus=${this._showTooltip}
        @blur=${this._handleFocusOut}
      >
        <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </button>

      <div
        class="content ${this._isTooltipVisible ? 'visible' : ''}"
        id="protspace-tips-content"
        role="tooltip"
        aria-hidden="${!this._isTooltipVisible}"
      >
        <div class="header">ProtSpace Tips & Shortcuts</div>
        <div class="tips-section">
          <div class="tips-group">
            <h4 class="tips-group-title">Navigation</h4>
            <ul class="tips-list">
              <li><kbd>Click & drag</kbd> to pan around the plot</li>
              <li><kbd>Mouse wheel</kbd> to zoom in/out</li>
              <li><kbd>Double-click</kbd> to reset zoom</li>
            </ul>
          </div>

          <div class="tips-group">
            <h4 class="tips-group-title">Selection</h4>
            <ul class="tips-list">
              <li><kbd>Shift + click</kbd> to select multiple points</li>
              <li><kbd>Ctrl + click</kbd> to add/remove from selection</li>
              <li><kbd>Click & drag</kbd> to select rectangular area</li>
            </ul>
          </div>

          <div class="tips-group">
            <h4 class="tips-group-title">Data Exploration</h4>
            <ul class="tips-list">
              <li>Hover over points to see detailed information</li>
              <li>Use the legend to filter by categories</li>
              <li>Switch between XY, XZ, and YZ projections</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-tips': ProtspaceTips;
  }
}
