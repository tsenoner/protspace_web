import { css } from 'lit';

/**
 * Query Builder Styles
 *
 * Shared styles for query-builder, query-condition-row, and query-value-picker components.
 */
export const queryBuilderStyles = css`
  /* ==========================================
     QUERY BUILDER CONTAINER
     ========================================== */

  .query-builder {
    min-width: 480px;
    max-width: 620px;
    padding: var(--spacing-md);
    box-sizing: border-box;
  }

  .query-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .query-conditions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    max-height: 50vh;
    overflow-y: auto;
    scrollbar-width: thin;
    margin-bottom: var(--spacing-sm);
  }

  .query-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .query-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-md);
    border-top: var(--border-width) solid var(--border);
  }

  /* ==========================================
     MATCH COUNT
     ========================================== */

  .match-count {
    font-size: var(--text-sm);
    color: var(--primary);
    text-align: right;
  }

  .match-count.loading {
    opacity: 0.5;
  }

  /* ==========================================
     CONDITION ROW
     ========================================== */

  .condition-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    padding: var(--spacing-sm);
    flex-wrap: wrap;
    box-sizing: border-box;
  }

  .logical-op-select {
    width: 56px;
    min-width: 56px;
    padding: var(--input-padding-y) var(--spacing-xs);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    text-align: center;
    cursor: pointer;
    box-sizing: border-box;
    transition: var(--transition-fast);
    appearance: none;
    -webkit-appearance: none;
  }

  .logical-op-select.op-and,
  .logical-op-select.op-or {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
    border-color: var(--primary);
  }

  .logical-op-select.op-not {
    background: color-mix(in srgb, #e74c3c 15%, transparent);
    color: #e74c3c;
    border-color: #e74c3c;
  }

  .logical-op-placeholder {
    width: 56px;
    min-width: 56px;
    flex-shrink: 0;
  }

  .annotation-select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-xs);
    min-width: 120px;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--text-primary);
    cursor: pointer;
    transition: var(--transition-fast);
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .annotation-select-trigger:hover {
    background: var(--hover-bg);
    border-color: var(--border-hover);
  }

  .annotation-select-trigger:focus-visible {
    outline: none;
    border-color: var(--primary);
    box-shadow:
      0 0 0 1px var(--primary),
      0 0 0 3px var(--focus-ring-bg);
  }

  .operator-select {
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--text-primary);
    cursor: pointer;
    transition: var(--transition-fast);
    box-sizing: border-box;
    appearance: none;
    -webkit-appearance: none;
  }

  .operator-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow:
      0 0 0 1px var(--primary),
      0 0 0 3px var(--focus-ring-bg);
  }

  .condition-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-secondary);
    opacity: 0.6;
    padding: var(--spacing-xs);
    border-radius: var(--radius);
    font-size: var(--text-base);
    line-height: 1;
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .condition-remove:hover {
    color: #e74c3c;
    opacity: 1;
    background: color-mix(in srgb, #e74c3c 10%, transparent);
  }

  /* ==========================================
     TEXT INPUT
     ========================================== */

  .text-input {
    flex: 1;
    min-width: 0;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--text-primary);
    transition: var(--transition-fast);
    box-sizing: border-box;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow:
      0 0 0 1px var(--primary),
      0 0 0 3px var(--focus-ring-bg);
  }

  /* ==========================================
     VALUE CHIPS
     ========================================== */

  .value-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-xs);
    flex: 1;
    min-width: 0;
  }

  .value-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: var(--text-sm);
    white-space: nowrap;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .value-chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.6;
    font-size: var(--text-sm);
    line-height: 1;
    border: none;
    background: none;
    color: inherit;
    padding: 0;
    flex-shrink: 0;
    transition: var(--transition-fast);
  }

  .value-chip-remove:hover {
    opacity: 1;
  }

  .value-chip-add {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: var(--border-width) dashed var(--primary);
    color: var(--primary);
    background: none;
    border-radius: 12px;
    padding: 2px 8px;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .value-chip-add:hover {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  /* ==========================================
     GROUP
     ========================================== */

  .group-container {
    border-left: 3px solid var(--border);
    padding-left: var(--spacing-md);
    margin-left: 4px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .group-conditions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .group-add-condition {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    transition: var(--transition-fast);
  }

  .group-add-condition:hover {
    color: var(--primary-hover);
  }

  /* ==========================================
     VALUE PICKER (DROPDOWN)
     ========================================== */

  .value-picker {
    position: absolute;
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-dropdown);
    max-width: 280px;
    min-width: 200px;
    padding: var(--spacing-sm);
    box-sizing: border-box;
    top: calc(100% + var(--dropdown-offset));
    left: 0;
  }

  .value-picker-input {
    width: 100%;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
    box-sizing: border-box;
    transition: var(--transition-fast);
  }

  .value-picker-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow:
      0 0 0 1px var(--primary),
      0 0 0 3px var(--focus-ring-bg);
  }

  .value-picker-list {
    display: flex;
    flex-direction: column;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .value-picker-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: var(--text-base);
    color: var(--text-primary);
    transition: var(--transition-fast);
  }

  .value-picker-item:hover {
    background: var(--primary-light);
    color: var(--primary);
  }

  .value-picker-item mark,
  .value-picker-highlight {
    color: var(--primary);
    font-weight: var(--font-medium);
    background: none;
  }

  .value-picker-count {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .value-picker-footer {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    padding-top: var(--spacing-xs);
    border-top: var(--border-width) solid var(--border);
    margin-top: var(--spacing-xs);
    text-align: center;
  }

  /* ==========================================
     ANNOTATION PICKER (INSIDE CONDITION ROW)
     ========================================== */

  .annotation-picker {
    position: absolute;
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-dropdown);
    min-width: 200px;
    max-width: 280px;
    padding: var(--spacing-sm);
    box-sizing: border-box;
    top: calc(100% + var(--dropdown-offset));
    left: 0;
  }

  .annotation-picker-input {
    width: 100%;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
    box-sizing: border-box;
    transition: var(--transition-fast);
  }

  .annotation-picker-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow:
      0 0 0 1px var(--primary),
      0 0 0 3px var(--focus-ring-bg);
  }

  .annotation-picker-category {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    position: sticky;
    top: 0;
    background: var(--surface);
  }

  .annotation-picker-item {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: var(--text-base);
    color: var(--text-primary);
    transition: var(--transition-fast);
  }

  .annotation-picker-item:hover {
    background: var(--primary-light);
    color: var(--primary);
  }

  /* ==========================================
     BUTTONS
     ========================================== */

  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--button-padding-y) var(--button-padding-x);
    border: var(--border-width) solid var(--danger-border);
    border-radius: var(--radius);
    background: color-mix(in srgb, #e74c3c 8%, transparent);
    color: #e74c3c;
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: var(--transition-fast);
    box-sizing: border-box;
  }

  .reset-btn:hover {
    background: color-mix(in srgb, #e74c3c 15%, transparent);
    border-color: #e74c3c;
  }

  .apply-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--button-padding-y) var(--button-padding-x);
    border: var(--border-width) solid var(--primary);
    border-radius: var(--radius);
    background: var(--primary);
    color: var(--text-light);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: var(--transition-fast);
    box-sizing: border-box;
  }

  .apply-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
    box-shadow: 0 2px 6px var(--primary-alpha-30);
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* ==========================================
     FILTER BADGE (CONTROL-BAR)
     ========================================== */

  .filter-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: var(--primary);
    color: white;
    font-size: var(--text-sm);
    padding: 0 4px;
    box-sizing: border-box;
    font-weight: var(--font-medium);
    line-height: 1;
  }

  .filter-active {
    color: var(--primary);
    border-color: var(--primary);
    background: var(--primary-light);
  }

  /* ==========================================
     RESPONSIVE
     ========================================== */

  @media (max-width: 550px) {
    .query-builder {
      min-width: unset;
      max-width: 100%;
    }

    .condition-row {
      flex-wrap: wrap;
    }

    .annotation-select-trigger {
      min-width: 0;
      flex: 1;
    }
  }
`;
