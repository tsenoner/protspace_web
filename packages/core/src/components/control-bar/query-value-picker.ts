import { LitElement, html, nothing } from 'lit';
import { customElement, property, state, query as litQuery } from 'lit/decorators.js';
import type { ProtspaceData } from './types';
import { toInternalValue } from '../legend/config';
import { LEGEND_VALUES } from '@protspace/utils';
import { queryBuilderStyles } from './query-builder.styles';

/**
 * Searchable dropdown for selecting annotation values.
 *
 * Events:
 * - `value-selected` — user clicked a value, detail: `{ value: string }`
 * - `picker-close`   — Escape pressed or click outside
 */
@customElement('protspace-query-value-picker')
class ProtspaceQueryValuePicker extends LitElement {
  static styles = queryBuilderStyles;

  @property({ type: String }) annotation: string = '';
  @property({ type: Object }) data: ProtspaceData | undefined = undefined;
  @property({ type: Array }) selectedValues: string[] = [];
  @property({ type: Boolean }) open: boolean = false;

  @state() private _searchQuery: string = '';

  @litQuery('.value-picker-input') private _inputEl?: HTMLInputElement;

  // ─── Click-outside detection ──────────────────────────────────────────────

  private _handleDocumentClick = (e: MouseEvent) => {
    if (this.open && !this.contains(e.target as Node)) {
      this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._handleDocumentClick, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleDocumentClick, true);
  }

  // ─── Auto-focus on open ───────────────────────────────────────────────────

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      this.updateComplete.then(() => {
        this._inputEl?.focus();
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _displayValue(value: string): string {
    return value === LEGEND_VALUES.NA_VALUE ? LEGEND_VALUES.NA_DISPLAY : value;
  }

  /**
   * Build a map from internal value → protein count.
   */
  private _buildCountMap(): Map<string, number> {
    const counts = new Map<string, number>();

    const annotationMeta = this.data?.annotations?.[this.annotation];
    const rawIndices = this.data?.annotation_data?.[this.annotation];

    if (!annotationMeta || !rawIndices) {
      return counts;
    }

    const values = annotationMeta.values;

    // annotation_data entries can be number[] or number[][] (multi-label)
    for (const entry of rawIndices) {
      const indices: number[] = Array.isArray(entry) ? (entry as number[]) : [entry as number];
      for (const idx of indices) {
        const raw = values[idx];
        const internal = toInternalValue(raw);
        counts.set(internal, (counts.get(internal) ?? 0) + 1);
      }
    }

    return counts;
  }

  /**
   * Compute the full list of internal values for this annotation (excluding
   * already-selected ones) and the filtered subset based on the current search.
   */
  private _computeValues(): {
    allValues: string[];
    filteredValues: Array<{ value: string; count: number }>;
  } {
    const annotationMeta = this.data?.annotations?.[this.annotation];
    if (!annotationMeta) {
      return { allValues: [], filteredValues: [] };
    }

    const selectedSet = new Set(this.selectedValues);
    const countMap = this._buildCountMap();

    // Deduplicate while preserving order, applying toInternalValue normalisation
    const seen = new Set<string>();
    const allValues: string[] = [];
    for (const raw of annotationMeta.values) {
      const internal = toInternalValue(raw);
      if (!seen.has(internal) && !selectedSet.has(internal)) {
        seen.add(internal);
        allValues.push(internal);
      }
    }

    const queryLower = this._searchQuery.trim().toLowerCase();
    const filteredValues = allValues
      .filter((v) => {
        if (!queryLower) return true;
        return this._displayValue(v).toLowerCase().includes(queryLower);
      })
      .map((v) => ({ value: v, count: countMap.get(v) ?? 0 }));

    return { allValues, filteredValues };
  }

  /**
   * Return a Lit template that wraps matched characters in `<strong class="value-picker-highlight">`.
   */
  private _highlightMatch(text: string) {
    const queryLower = this._searchQuery.trim().toLowerCase();
    if (!queryLower) {
      return html`${text}`;
    }

    const idx = text.toLowerCase().indexOf(queryLower);
    if (idx === -1) {
      return html`${text}`;
    }

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + queryLower.length);
    const after = text.slice(idx + queryLower.length);

    return html`${before}<strong class="value-picker-highlight">${match}</strong>${after}`;
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private _handleSearch(e: Event) {
    this._searchQuery = (e.target as HTMLInputElement).value;
  }

  private _handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
    }
  }

  private _selectValue(value: string) {
    this.dispatchEvent(
      new CustomEvent('value-selected', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
    // Do NOT close — dropdown stays open for multi-add
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render() {
    if (!this.open) {
      return nothing;
    }

    const { allValues, filteredValues } = this._computeValues();

    return html`
      <div class="value-picker">
        <input
          class="value-picker-input"
          placeholder="Search values..."
          .value=${this._searchQuery}
          @input=${this._handleSearch}
          @keydown=${this._handleKeydown}
        />
        <div class="value-picker-list">
          ${filteredValues.map(
            ({ value, count }) => html`
              <div class="value-picker-item" @click=${() => this._selectValue(value)}>
                <span>${this._highlightMatch(this._displayValue(value))}</span>
                <span class="value-picker-count">${count} proteins</span>
              </div>
            `,
          )}
        </div>
        <div class="value-picker-footer">
          ${filteredValues.length} of ${allValues.length} values shown
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-query-value-picker': ProtspaceQueryValuePicker;
  }
}
