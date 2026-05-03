import { LitElement, html, nothing } from 'lit';
import { property, state, query as litQuery } from 'lit/decorators.js';
import { customElement } from '../../utils/safe-custom-element';
import type { FilterCondition, LogicalOp } from './query-types';
import type { ProtspaceData } from './types';
import { groupAnnotations } from './annotation-categories';
import { NA_VALUE, NA_DISPLAY } from '@protspace/utils';
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
  @property({ type: Object }) matchedIndices: Set<number> = new Set();
  @property({ type: Boolean }) isFirst: boolean = false;

  @state() private _showAnnotationPicker: boolean = false;
  @state() private _showValuePicker: boolean = false;
  @state() private _annotationSearch: string = '';
  @state() private _pickerPos = { top: 0, left: 0 };
  @state() private _valuePickerPos = { top: 0, left: 0 };

  @litQuery('.annotation-picker-input') private _annotationInputEl?: HTMLInputElement;

  // ─── Click-outside detection ──────────────────────────────────────────────

  private _handleDocumentClick = (e: MouseEvent) => {
    if (this._showAnnotationPicker && !e.composedPath().includes(this)) {
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
    return value === NA_VALUE ? NA_DISPLAY : value;
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

  // ─── Annotation picker grouping ───────────────────────────────────────────

  private _groupAnnotations() {
    return groupAnnotations(this.annotations).map((g) => ({
      category: g.category,
      items: g.annotations,
    }));
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private _toggleAnnotationPicker(e: Event) {
    this._showAnnotationPicker = !this._showAnnotationPicker;
    if (this._showAnnotationPicker) {
      const btn = e.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this._pickerPos = { top: rect.bottom + 4, left: rect.left };
    } else {
      this._annotationSearch = '';
    }
  }

  private _handleAnnotationPickerKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
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
    const raw = (e.target as HTMLSelectElement).value;
    const value = raw === '' ? undefined : (raw as LogicalOp);
    this._dispatchChanged({ ...this.condition, logicalOp: value });
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
          .map((g) => ({
            ...g,
            items: g.items.filter((a) => a.toLowerCase().includes(queryLower)),
          }))
          .filter((g) => g.items.length > 0)
      : groups;

    return html`
      <div
        class="annotation-picker"
        style="top:${this._pickerPos.top}px;left:${this._pickerPos.left}px"
        @click=${(e: Event) => e.stopPropagation()}
      >
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
                  <div class="annotation-picker-item" @click=${() => this._selectAnnotation(ann)}>
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
    return html`
      <div class="value-chips">
        ${this.condition.values.map(
          (v) => html`
            <span class="value-chip">
              <span class="value-chip-text">${this._displayValue(v)}</span>
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
          @click=${(e: Event) => {
            this._showValuePicker = !this._showValuePicker;
            if (this._showValuePicker) {
              const btn = e.currentTarget as HTMLElement;
              const rect = btn.getBoundingClientRect();
              this._valuePickerPos = { top: rect.bottom + 4, left: rect.left };
            }
          }}
          title="Add value"
        >
          +
        </button>
      </div>
      <protspace-query-value-picker
        .annotation=${this.condition.annotation}
        .data=${this.data}
        .matchedIndices=${this.matchedIndices}
        .logicalOp=${this.condition.logicalOp}
        .selectedValues=${this.condition.values}
        .open=${this._showValuePicker}
        .triggerTop=${this._valuePickerPos.top}
        .triggerLeft=${this._valuePickerPos.left}
        @value-selected=${this._handleValueSelected}
        @picker-close=${this._handleValuePickerClose}
      ></protspace-query-value-picker>
    `;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render() {
    return html`
      <div class="condition-row">
        ${this.isFirst
          ? html`
              <select
                class="logical-op-select ${this.condition.logicalOp === 'NOT' ? '' : 'op-blank'}"
                .value=${this.condition.logicalOp ?? ''}
                @change=${this._handleLogicalOpChange}
              >
                <option value="">​</option>
                <option value="NOT">NOT</option>
              </select>
            `
          : html`
              <select
                class="logical-op-select"
                .value=${this.condition.logicalOp ?? 'AND'}
                @change=${this._handleLogicalOpChange}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
                <option value="NOT">NOT</option>
              </select>
            `}

        <button class="annotation-select-trigger" @click=${this._toggleAnnotationPicker}>
          ${this.condition.annotation || 'Select annotation...'}
        </button>

        ${this._showAnnotationPicker ? this._renderAnnotationPicker() : nothing}
        ${this._renderValues()}

        <button class="condition-remove" @click=${this._handleRemove} title="Remove condition">
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
