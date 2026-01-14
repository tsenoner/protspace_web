import { html, type TemplateResult } from 'lit';
import type { OtherItem } from './types';
import { toDisplayValue } from './config';

/**
 * State for the Other dialog
 */
export interface OtherDialogState {
  otherItems: OtherItem[];
}

/**
 * Callbacks for the Other dialog
 */
export interface OtherDialogCallbacks {
  onExtract: (value: string) => void;
  onClose: () => void;
}

/**
 * Renders a single item in the Other dialog list.
 * All items (including N/A with '__NA__' value) can be extracted.
 */
function renderOtherItem(item: OtherItem, callbacks: OtherDialogCallbacks): TemplateResult {
  return html`
    <div class="other-item">
      <div class="other-item-info">
        <span class="other-item-name">${toDisplayValue(item.value)}</span>
        <span class="other-item-count">(${item.count})</span>
      </div>
      <button class="extract-button" @click=${() => callbacks.onExtract(item.value)}>
        Extract
      </button>
    </div>
  `;
}

/**
 * Renders the close button SVG icon.
 * Shared utility for dialog close buttons.
 */
export function renderCloseIcon(): TemplateResult {
  return html`
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  `;
}

/**
 * Renders the Other dialog for extracting items from the "Other" category
 */
export function renderOtherDialog(
  state: OtherDialogState,
  callbacks: OtherDialogCallbacks,
): TemplateResult {
  return html`
    <div class="modal-overlay" part="dialog-overlay" @click=${callbacks.onClose}>
      <div
        id="legend-other-dialog"
        class="modal-content"
        part="dialog-content"
        tabindex="-1"
        @click=${(e: Event) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="other-dialog-title"
      >
        <div class="modal-header">
          <h3 id="other-dialog-title" class="modal-title">Extract from 'Other' category</h3>
          <button class="close-button" @click=${callbacks.onClose} aria-label="Close dialog">
            ${renderCloseIcon()}
          </button>
        </div>

        <div class="modal-description">
          Select items to extract from the 'Other' category. Extracted items will appear
          individually in the legend.
        </div>

        <div class="other-items-list" role="list">
          ${state.otherItems.map((item) => renderOtherItem(item, callbacks))}
        </div>

        <div class="modal-footer">
          <button class="modal-close-button" @click=${callbacks.onClose}>Close</button>
        </div>
      </div>
    </div>
  `;
}
