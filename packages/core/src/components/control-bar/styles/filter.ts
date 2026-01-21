import { css } from 'lit';

/**
 * Filter Menu Styles
 *
 * Simplified filter menu with consistent spacing throughout.
 */
export const filterStyles = css`
  /* Container */
  .filter-menu {
    padding: var(--spacing-md);
    min-width: 280px;
    max-width: 400px;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .filter-menu-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    max-height: 50vh;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    box-sizing: border-box;
  }

  /* Filter items - minimal design */
  .filter-menu-list-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-sm);
    border-left: 3px solid transparent;
    transition: var(--transition-fast);
    box-sizing: border-box;
  }

  .filter-menu-list-item.filter-enabled {
    border-left-color: var(--primary);
  }

  .filter-menu-list-item.highlighted {
    background: var(--primary-light);
  }

  .filter-menu-list-item:not(.filter-enabled) {
    opacity: 0.6;
  }

  /* Filter item header */
  .filter-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    box-sizing: border-box;
  }

  .filter-item-checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    flex: 1;
    min-width: 0;
  }

  .filter-item-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--primary);
    flex-shrink: 0;
  }

  .filter-item-name {
    font-size: var(--text-base);
    color: var(--text-primary);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-item-badge {
    display: inline-flex;
    align-items: center;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .filter-item-values-button {
    width: 100%;
    justify-content: space-between;
    box-sizing: border-box;
  }

  /* Submenu */
  .filter-menu-list-item-options {
    width: 100%;
    margin-top: var(--spacing-xs);
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-selection {
    display: flex;
    gap: var(--spacing-sm);
    width: 100%;
    padding-bottom: var(--spacing-sm);
    border-bottom: var(--border-width) solid var(--border);
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-selection > button {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-inputs {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 12rem;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    box-sizing: border-box;
  }

  .filter-value-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius);
    transition: var(--transition-fast);
    cursor: pointer;
    box-sizing: border-box;
  }

  .filter-value-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--primary);
    flex-shrink: 0;
  }

  .filter-value-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-base);
    color: var(--text-primary);
  }

  .filter-value-label:hover {
    background: var(--primary-light);
  }

  .filter-value-label:has(input:checked) .filter-value-text {
    color: var(--primary);
    font-weight: var(--font-medium);
  }

  .filter-menu-list-item-options-done {
    width: 100%;
    padding-top: var(--spacing-sm);
    border-top: var(--border-width) solid var(--border);
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-done > button {
    width: 100%;
    box-sizing: border-box;
  }

  /* Bottom actions */
  .filter-menu-buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-md);
    margin-top: var(--spacing-sm);
    border-top: var(--border-width) solid var(--border);
    box-sizing: border-box;
  }

  .filter-menu-buttons > button {
    min-width: 5rem;
    box-sizing: border-box;
  }

  /* Responsive */
  @media (max-width: 550px) {
    .filter-menu {
      max-width: 100%;
    }

    .filter-item-header {
      flex-wrap: wrap;
    }
  }
`;
