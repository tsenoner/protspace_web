import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ProtspaceData } from './types';
import type { FilterQuery, FilterCondition, FilterGroup, LogicalOp } from './query-types';
import { createCondition, createGroup, isFilterGroup } from './query-types';
import { evaluateQuery } from './query-evaluate';
import { queryBuilderStyles } from './query-builder.styles';
import './query-condition-row';

/**
 * Main query builder component managing the full query builder UI.
 *
 * Events:
 * - `query-changed` — dispatched whenever the query changes, detail: `{ query: FilterQuery }`
 * - `query-apply`   — dispatched when "Apply & Isolate" is clicked, detail: `{ matchedIndices: Set<number> }`
 * - `query-reset`   — dispatched when "Reset All" is clicked
 */
@customElement('protspace-query-builder')
export class ProtspaceQueryBuilder extends LitElement {
  static styles = queryBuilderStyles;

  @property({ type: Array }) annotations: string[] = [];
  @property({ type: Object }) data: ProtspaceData | undefined = undefined;
  @property({ type: Array }) query: FilterQuery = [];

  @state() private _matchCount: number = 0;
  @state() private _totalCount: number = 0;
  @state() private _evaluating: boolean = false;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('data') || changedProperties.has('query')) {
      this._scheduleEvaluation(this.query);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  // ─── Match Count (debounced) ──────────────────────────────────────────────

  private _scheduleEvaluation(query: FilterQuery) {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      if (!this.data) return;
      this._evaluating = true;
      const result = evaluateQuery(query, this.data);
      this._matchCount = result.size;
      this._totalCount = this.data.protein_ids?.length ?? 0;
      this._evaluating = false;
    }, 300);
  }

  // ─── Dispatch helpers ────────────────────────────────────────────────────

  private _dispatchQueryChanged(newQuery: FilterQuery) {
    this.dispatchEvent(
      new CustomEvent('query-changed', {
        detail: { query: newQuery },
        bubbles: true,
        composed: true,
      }),
    );
    // Match count update handled by updated() when query prop flows back down
  }

  // ─── Query mutations ─────────────────────────────────────────────────────

  private _addCondition() {
    const newQuery = [
      ...this.query,
      createCondition({ logicalOp: this.query.length > 0 ? 'AND' : undefined }),
    ];
    this._dispatchQueryChanged(newQuery);
  }

  private _addGroup() {
    const group = createGroup({ logicalOp: this.query.length > 0 ? 'AND' : undefined });
    this._dispatchQueryChanged([...this.query, group]);
  }

  private _addConditionToGroup(groupId: string) {
    const newQuery = this.query.map((item) => {
      if (isFilterGroup(item) && item.id === groupId) {
        return {
          ...item,
          conditions: [
            ...item.conditions,
            createCondition({
              logicalOp: item.conditions.length > 0 ? 'AND' : undefined,
            }),
          ],
        };
      }
      return item;
    });
    this._dispatchQueryChanged(newQuery);
  }

  private _handleConditionChanged(
    e: CustomEvent<{ condition: FilterCondition }>,
    groupId: string | null,
  ) {
    e.stopPropagation();
    const updated = e.detail.condition;
    if (groupId === null) {
      const newQuery = this.query.map((item) =>
        !isFilterGroup(item) && item.id === updated.id ? updated : item,
      );
      this._dispatchQueryChanged(newQuery);
    } else {
      const newQuery = this.query.map((item) => {
        if (isFilterGroup(item) && item.id === groupId) {
          return {
            ...item,
            conditions: item.conditions.map((c) =>
              !isFilterGroup(c) && c.id === updated.id ? updated : c,
            ),
          };
        }
        return item;
      });
      this._dispatchQueryChanged(newQuery);
    }
  }

  private _handleConditionRemoved(
    e: CustomEvent<{ id: string }>,
    groupId: string | null,
  ) {
    e.stopPropagation();
    const removedId = e.detail.id;
    if (groupId === null) {
      const newQuery = this.query.filter((item) => item.id !== removedId);
      this._dispatchQueryChanged(newQuery);
    } else {
      const newQuery = this.query.map((item) => {
        if (isFilterGroup(item) && item.id === groupId) {
          return { ...item, conditions: item.conditions.filter((c) => c.id !== removedId) };
        }
        return item;
      });
      this._dispatchQueryChanged(newQuery);
    }
  }

  private _removeGroup(groupId: string) {
    this._dispatchQueryChanged(this.query.filter((item) => item.id !== groupId));
  }

  private _handleGroupLogicalOpChange(groupId: string, e: Event) {
    const value = (e.target as HTMLSelectElement).value as LogicalOp;
    const newQuery = this.query.map((item) =>
      isFilterGroup(item) && item.id === groupId ? { ...item, logicalOp: value } : item,
    );
    this._dispatchQueryChanged(newQuery);
  }

  // ─── Apply & Reset ────────────────────────────────────────────────────────

  private _handleApply() {
    if (!this.data) return;
    const result = evaluateQuery(this.query, this.data);
    this.dispatchEvent(
      new CustomEvent('query-apply', {
        detail: { matchedIndices: result },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleReset() {
    this.dispatchEvent(
      new CustomEvent('query-reset', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Group rendering ──────────────────────────────────────────────────────

  private _renderGroup(group: FilterGroup, groupIndex: number) {
    const opClass = group.logicalOp ? `op-${group.logicalOp.toLowerCase()}` : 'op-and';

    return html`
      <div class="group-container">
        <div class="group-header">
          ${groupIndex > 0
            ? html`<select
                class="logical-op-select ${opClass}"
                .value=${group.logicalOp ?? 'AND'}
                @change=${(e: Event) => this._handleGroupLogicalOpChange(group.id, e)}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
                <option value="NOT">NOT</option>
              </select>`
            : html`<div class="logical-op-placeholder"></div>`}
          <span>Group</span>
          <button class="condition-remove" @click=${() => this._removeGroup(group.id)}>
            ×
          </button>
        </div>
        <div class="group-conditions">
          ${group.conditions.map(
            (item, index) => html`
              <protspace-query-condition-row
                .condition=${item as FilterCondition}
                .annotations=${this.annotations}
                .data=${this.data}
                .showLogicalOp=${index > 0}
                @condition-changed=${(e: CustomEvent) =>
                  this._handleConditionChanged(e, group.id)}
                @condition-removed=${(e: CustomEvent) =>
                  this._handleConditionRemoved(e, group.id)}
              ></protspace-query-condition-row>
            `,
          )}
        </div>
        <button
          class="group-add-condition"
          @click=${() => this._addConditionToGroup(group.id)}
        >
          + Add condition
        </button>
      </div>
    `;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render() {
    return html`
      <div class="query-builder">
        <div class="query-header">
          <span>Filter Query</span>
          <span class="match-count ${this._evaluating ? 'loading' : ''}">
            ${this._matchCount} of ${this._totalCount} proteins matched
          </span>
        </div>

        <div class="query-conditions">
          ${this.query.map((item, index) => {
            if (isFilterGroup(item)) {
              return this._renderGroup(item as FilterGroup, index);
            }
            return html`
              <protspace-query-condition-row
                .condition=${item as FilterCondition}
                .annotations=${this.annotations}
                .data=${this.data}
                .showLogicalOp=${index > 0}
                @condition-changed=${(e: CustomEvent) =>
                  this._handleConditionChanged(e, null)}
                @condition-removed=${(e: CustomEvent) =>
                  this._handleConditionRemoved(e, null)}
              ></protspace-query-condition-row>
            `;
          })}
        </div>

        <div class="query-actions">
          <button @click=${this._addCondition}>+ Add condition</button>
          <button @click=${this._addGroup}>+ Add group</button>
        </div>

        <div class="query-footer">
          <button class="reset-btn" @click=${this._handleReset}>Reset All</button>
          <button
            class="apply-btn"
            ?disabled=${this._matchCount === 0 || this.query.length === 0}
            @click=${this._handleApply}
          >
            Apply &amp; Isolate
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-query-builder': ProtspaceQueryBuilder;
  }
}
