import { css } from 'lit';

export const annotationSelectStyles = css`
  :host {
    display: inline-flex;
    position: relative;
  }

  .annotation-select-container {
    position: relative;
    display: inline-flex;
  }

  /* Master dropdown trigger - must be copied here due to shadow DOM boundary */
  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--input-padding-y) 30px var(--input-padding-y) var(--input-padding-x);
    min-width: 10rem;
    width: max-content;
    cursor: pointer;
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--muted);
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  .dropdown-trigger:hover {
    background: var(--hover-bg);
  }

  .dropdown-trigger:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--focus-ring);
  }

  .dropdown-trigger.open {
    border-color: var(--primary);
  }

  /* Text wrapper for dropdown triggers */
  .dropdown-trigger-text {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Unified chevron icon */
  .chevron-down {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
    flex-shrink: 0;
    transition: var(--transition-fast);
  }

  .dropdown-trigger.open .chevron-down {
    transform: rotate(180deg);
  }

  /* Dropdown menu - inherits shared dropdown styles from control-bar */
  .annotation-select-menu {
    /* Shared dropdown menu styles */
    position: absolute;
    top: calc(100% + var(--dropdown-offset));
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: var(--dropdown-z);
    display: flex;
    flex-direction: column;

    /* Component-specific positioning */
    left: 0;
    min-width: 100%;
    width: max-content;
    max-width: 20rem;
    max-height: 24rem;
    overflow: hidden;
  }

  .annotation-search-container {
    padding: var(--spacing-sm);
    border-bottom: var(--border-width) solid var(--border);
  }

  /* Search input inherits from .input-base */
  .annotation-search-input {
    width: 100%;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-base);
    background: var(--surface);
    color: var(--muted);
    box-sizing: border-box;
    transition: var(--transition);
  }

  .annotation-search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--focus-ring);
  }

  .annotation-list-container {
    overflow-y: auto;
    scrollbar-width: thin;
    max-height: 20rem;
  }

  .annotation-section {
    display: flex;
    flex-direction: column;
  }

  .annotation-section-header {
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: var(--border-width) solid var(--border);
  }

  .annotation-section-items {
    display: flex;
    flex-direction: column;
  }

  /* Dropdown items - inherit from .dropdown-item base class */
  .annotation-item {
    /* All base styles come from CSS variables defined in control-bar */
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--text-base);
    color: var(--muted);
    cursor: pointer;
    transition: var(--transition-fast);
    border-left: 2px solid transparent;
  }

  .annotation-item:hover {
    background: var(--primary-light);
  }

  .annotation-item.highlighted {
    background: var(--primary-light);
    border-left-color: var(--primary);
  }

  .annotation-item.selected {
    font-weight: var(--font-semibold);
    color: var(--primary);
  }

  .annotation-item.selected.highlighted,
  .annotation-item.selected:hover {
    background: var(--primary-light);
  }

  .no-results {
    padding: var(--spacing-lg);
    text-align: center;
    color: var(--muted);
    font-size: var(--text-base);
  }

  /* Responsive: ensure dropdown doesn't overflow on small screens */
  @media (max-width: 1024px) {
    :host {
      width: 100%;
    }

    .annotation-select-container {
      width: 100%;
    }

    .dropdown-trigger {
      width: 100%;
    }

    .annotation-select-menu {
      max-width: calc(100vw - 2rem);
    }
  }
`;
