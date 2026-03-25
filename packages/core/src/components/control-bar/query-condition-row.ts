import { LitElement, html, nothing } from 'lit';
import { customElement, property, state, query as litQuery } from 'lit/decorators.js';
import type { FilterCondition, LogicalOp, ConditionOperator } from './query-types';
import type { ProtspaceData } from './types';
import { ANNOTATION_CATEGORIES, TAXONOMY_ORDER, type CategoryName } from './annotation-categories';
import { LEGEND_VALUES } from '@protspace/utils';
import { queryBuilderStyles } from './query-builder.styles';
import './query-value-picker';

/**
 * Renders a single query condition row.
 *
 * Events:
 * - `condition-changed` — any field changed, detail: `{ condition: FilterCondition }`
 * - `condition-removed` — remove button clicked, detail: `{ id: string }`
 */
@customElement('protspace-query-condition-row')
class ProtspaceQueryConditionRow extends LitElement {
  static styles = queryBuilderStyles;

  @property({ type: Object }) condition!: FilterCondition;
  @property({ type: Array }) annotations: string[] = [];
  @property({ type: Object }) data: ProtspaceData | undefined = undefined;
  @property({ type: Boolean }) showLogicalOp: boolean = false;

  @state() private _showAnnotationPicker: boolean = false;
  @state() private _showValuePicker: boolean = false;
  @state() private _annotationSearch: string = '';

  @litQuery('.annotation-picker-input') private _annotationInputEl?: HTMLInputElement;

  // ─── Click-outside detection ──────────────────────────────────────────────

  private _handleDocumentClick = (e: MouseEvent) => {
    if (this._showAnnotationPicker && !this.contains(e.target as Node)) {
      this._showAnnotationPicker = false;
      this._annotationSearch = '';
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

  // ─── Auto-focus annotation picker input ───────────────────────────────────

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('_showAnnotationPicker') && this._showAnnotationPicker) {
      this.updateComplete.then(() => {
        this._annotationInputEl?.focus();
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _displayValue(value: string): string {
    return value === LEGEND_VALUES.NA_VALUE ? LEGEND_VALUES.NA_DISPLAY : value;
  }

  private _dispatchChanged(updated: FilterCondition) {
    this.dispatchEvent(
      new CustomEvent('condition-changed', {
        detail: { condition: updated },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _isTextOperator(op: ConditionOperator): boolean {
    return op === 'contains' || op === 'starts_with';
  }

  // ─── Annotation picker grouping ───────────────────────────────────────────

  private _groupAnnotations(): Array<{ category: CategoryName; items: string[] }> {
    const categorized: Record<CategoryName, string[]> = {
      UniProt: [],
      InterPro: [],
      Taxonomy: [],
      Other: [],
    };

    for (const ann of this.annotations) {
      let found = false;
      for (const [category, catAnns] of Object.entries(ANNOTATION_CATEGORIES)) {
        if ((catAnns as readonly string[]).includes(ann)) {
          categorized[category as CategoryName].push(ann);
          found = true;
          break;
        }
      }
      if (!found) {
        categorized.Other.push(ann);
      }
    }

    // Sort within categories
    categorized.UniProt.sort((a, b) => a.localeCompare(b));
    categorized.InterPro.sort((a, b) => a.localeCompare(b));
    categorized.Other.sort((a, b) => a.localeCompare(b));
    categorized.Taxonomy.sort((a, b) => {
      const ai = TAXONOMY_ORDER.indexOf(a as (typeof TAXONOMY_ORDER)[number]);
      const bi = TAXONOMY_ORDER.indexOf(b as (typeof TAXONOMY_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    const result: Array<{ category: CategoryName; items: string[] }> = [];
    const order: CategoryName[] = ['InterPro', 'Taxonomy', 'UniProt', 'Other'];
    for (const cat of order) {
      if (categorized[cat].length > 0) {
        result.push({ category: cat, items: categorized[cat] });
      }
    }
    return result;
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private _toggleAnnotationPicker() {
    this._showAnnotationPicker = !this._showAnnotationPicker;
    if (!this._showAnnotationPicker) {
      this._annotationSearch = '';
    }
  }

  private _handleAnnotationPickerKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this._showAnnotationPicker = false;
      this._annotationSearch = '';
    }
  }

  private _selectAnnotation(annotation: string) {
    this._showAnnotationPicker = false;
    this._annotationSearch = '';
    // Clear values when annotation changes
    this._dispatchChanged({ ...this.condition, annotation, values: [] });
  }

  private _handleLogicalOpChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as LogicalOp;
    this._dispatchChanged({ ...this.condition, logicalOp: value });
  }

  private _handleOperatorChange(e: Event) {
    const newOp = (e.target as HTMLSelectElement).value as ConditionOperator;
    const oldIsText = this._isTextOperator(this.condition.operator);
    const newIsText = this._isTextOperator(newOp);
    // Clear values when switching between chip-style and text-style operators
    const values = oldIsText !== newIsText ? [] : this.condition.values;
    this._dispatchChanged({ ...this.condition, operator: newOp, values });
  }

  private _removeValue(value: string) {
    const values = this.condition.values.filter((v) => v !== value);
    this._dispatchChanged({ ...this.condition, values });
  }

  private _handleValueSelected(e: CustomEvent<{ value: string }>) {
    const value = e.detail.value;
    if (!this.condition.values.includes(value)) {
      this._dispatchChanged({ ...this.condition, values: [...this.condition.values, value] });
    }
  }

  private _handleValuePickerClose() {
    this._showValuePicker = false;
  }

  private _handleTextInput(e: Event) {
    const text = (e.target as HTMLInputElement).value;
    this._dispatchChanged({ ...this.condition, values: [text] });
  }

  private _handleRemove() {
    this.dispatchEvent(
      new CustomEvent('condition-removed', {
        detail: { id: this.condition.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Sub-renders ──────────────────────────────────────────────────────────

  private _renderAnnotationPicker() {
    const queryLower = this._annotationSearch.trim().toLowerCase();
    const groups = this._groupAnnotations();

    const filteredGroups = queryLower
      ? groups
          .map((g) => ({ ...g, items: g.items.filter((a) => a.toLowerCase().includes(queryLower)) }))
          .filter((g) => g.items.length > 0)
      : groups;

    return html`
      <div class="annotation-picker" @click=${(e: Event) => e.stopPropagation()}>
        <input
          class="annotation-picker-input"
          placeholder="Search annotations..."
          .value=${this._annotationSearch}
          @input=${(e: Event) => {
            this._annotationSearch = (e.target as HTMLInputElement).value;
          }}
          @keydown=${this._handleAnnotationPickerKeydown}
        />
        <div class="value-picker-list">
          ${filteredGroups.map(
            (group) => html`
              <div class="annotation-picker-category">${group.category}</div>
              ${group.items.map(
                (ann) => html`
                  <div
                    class="annotation-picker-item"
                    @click=${() => this._selectAnnotation(ann)}
                  >
                    ${ann}
                  </div>
                `,
              )}
            `,
          )}
          ${filteredGroups.length === 0
            ? html`<div class="value-picker-footer">No matching annotations</div>`
            : nothing}
        </div>
      </div>
    `;
  }

  private _renderValues() {
    if (this._isTextOperator(this.condition.operator)) {
      return html`
        <input
          class="text-input"
          .value=${this.condition.values[0] ?? ''}
          @input=${this._handleTextInput}
          placeholder="Enter text..."
        />
      `;
    }

    return html`
      <div class="value-chips">
        ${this.condition.values.map(
          (v) => html`
            <span class="value-chip">
              ${this._displayValue(v)}
              <button
                class="value-chip-remove"
                @click=${() => this._removeValue(v)}
                title="Remove value"
              >
                ×
              </button>
            </span>
          `,
        )}
        <button
          class="value-chip-add"
          @click=${() => {
            this._showValuePicker = !this._showValuePicker;
          }}
          title="Add value"
        >
          +
        </button>
      </div>
      <protspace-query-value-picker
        .annotation=${this.condition.annotation}
        .data=${this.data}
        .selectedValues=${this.condition.values}
        .open=${this._showValuePicker}
        @value-selected=${this._handleValueSelected}
        @picker-close=${this._handleValuePickerClose}
      ></protspace-query-value-picker>
    `;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render() {
    const opClass = this.condition.logicalOp
      ? `op-${this.condition.logicalOp.toLowerCase()}`
      : 'op-and';

    return html`
      <div class="condition-row">
        ${this.showLogicalOp
          ? html`
              <select
                class="logical-op-select ${opClass}"
                .value=${this.condition.logicalOp ?? 'AND'}
                @change=${this._handleLogicalOpChange}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
                <option value="NOT">NOT</option>
              </select>
            `
          : html`<div class="logical-op-placeholder"></div>`}

        <button
          class="annotation-select-trigger"
          @click=${this._toggleAnnotationPicker}
        >
          ${this.condition.annotation || 'Select annotation...'}
        </button>

        ${this._showAnnotationPicker ? this._renderAnnotationPicker() : nothing}

        <select
          class="operator-select"
          .value=${this.condition.operator}
          @change=${this._handleOperatorChange}
        >
          <option value="is">is</option>
          <option value="is_not">is not</option>
          <option value="contains">contains</option>
          <option value="starts_with">starts with</option>
        </select>

        ${this._renderValues()}

        <button
          class="condition-remove"
          @click=${this._handleRemove}
          title="Remove condition"
        >
          ×
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-query-condition-row': ProtspaceQueryConditionRow;
  }
}
