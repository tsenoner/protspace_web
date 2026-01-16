import { css } from 'lit';

/**
 * Filter Menu Styles
 *
 * Simplified filter menu with consistent spacing throughout.
 */
export const filterStyles = css`
  .filter-menu {
    padding: var(--spacing-md);
    min-width: max-content;
    overflow-y: visible;
    overflow-x: hidden;
  }

  .filter-menu-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    width: 100%;
    max-height: 50vh;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
  }

  .filter-menu-list-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    width: 100%;
  }

  .filter-menu-list-item > label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    color: var(--text-dark);
    font-weight: var(--font-normal);
    cursor: pointer;
  }

  .filter-menu-list-item > button {
    margin-left: var(--spacing-lg);
    padding: var(--button-padding-y) var(--spacing-md);
  }

  .filter-menu-list-item-options {
    width: 100%;
    max-width: 100%;
    margin-top: var(--spacing-xs);
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-selection {
    display: flex;
    gap: var(--spacing-sm);
    width: 100%;
  }

  .filter-menu-list-item-options-selection > button {
    padding: var(--spacing-xs) var(--spacing-md);
    flex: 1;
    min-width: 0;
    /* Hover behavior inherited from buttonMixin */
  }

  /* Danger button styling for "None" button */
  .filter-menu-list-item-options-selection > button:last-child {
    background: var(--danger);
    border-color: var(--danger-border);
    color: var(--text-light);
    font-weight: var(--font-bold);
  }

  .filter-menu-list-item-options-selection > button:last-child:hover:not(:disabled) {
    background: var(--danger-hover);
  }

  .filter-menu-list-item-options-inputs {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    max-height: 10rem;
    min-width: 0;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-xs);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--border) var(--surface);
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-inputs > label {
    display: flex;
    flex-direction: row-reverse;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-left: var(--border-width) solid transparent;
    transition: var(--transition-fast);
    cursor: pointer;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-inputs > label > span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-menu-list-item-options-inputs > label:hover {
    background: var(--primary-light);
    border-left-color: var(--primary);
  }

  .filter-menu-list-item-options-done {
    width: 100%;
  }

  .filter-menu-list-item-options-done > button {
    width: 100%;
    padding: var(--button-padding-y) var(--spacing-lg);
    font-weight: var(--font-bold);
    /* Use .active class for primary button styling - inherits from buttonMixin */
  }

  .filter-menu-buttons {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  .filter-menu-buttons > button {
    padding: var(--button-padding-y) var(--spacing-lg);
    /* Hover behavior inherited from buttonMixin */
  }
`;
