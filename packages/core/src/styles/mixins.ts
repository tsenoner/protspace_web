import { css } from 'lit';

/**
 * Base Input/Select Styling
 * Provides consistent styling for all input and select elements
 */
export const inputMixin = css`
  /* Base input/select styling - shared across all inputs */
  select,
  input[type='text'],
  input[type='search'],
  .input-base {
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-base);
    color: var(--muted);
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
  }

  select:focus,
  input[type='text']:focus,
  input[type='search']:focus,
  .input-base:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--focus-ring);
  }

  select {
    max-width: 100%;
  }
`;

/**
 * Base Button Component
 * Provides consistent styling and states for all button elements
 */
export const buttonMixin = css`
  /* Base button component - shared across all buttons */
  .btn,
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--button-padding-y) var(--button-padding-x);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--muted);
    font-size: var(--text-base);
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--shadow-sm);
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .btn:hover:not(:disabled),
  button:hover:not(:disabled) {
    background: var(--primary-light);
  }

  .btn:disabled,
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Active/selected state - SAME EVERYWHERE: white text on blue background */
  .btn.active,
  .btn.selected,
  button.active,
  button.selected {
    background: var(--primary);
    color: var(--text-light);
    border-color: var(--primary);
    fill: var(--text-light);
  }

  .btn.active:hover:not(:disabled),
  .btn.selected:hover:not(:disabled),
  button.active:hover:not(:disabled),
  button.selected:hover:not(:disabled) {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  /* Legacy support for existing classes */
  .right-controls-button {
    /* Inherits from button base styles above */
  }
`;

/**
 * Dropdown System
 * Provides consistent dropdown trigger, menu, and item styling
 */
export const dropdownMixin = css`
  /* ==========================================
      UNIFIED DROPDOWN SYSTEM
     ========================================== */

  /* Dropdown containers share common styling */
  .export-container,
  .filter-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  /* Projection container - similar to annotation-select-container */
  .projection-container {
    position: relative;
    display: inline-flex;
  }

  /* Master dropdown trigger class - used by all dropdowns */
  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-xs);
    padding: var(--input-padding-y) var(--input-padding-x);
    min-width: 10rem;
    max-width: 100%;
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
    overflow: hidden;
  }

  /* Compact dropdown triggers (for buttons with icons like Filter/Export) */
  .filter-container .dropdown-trigger,
  .export-container .dropdown-trigger {
    min-width: auto;
    padding: var(--button-padding-y) var(--spacing-sm);
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

  /* Unified chevron icon for all dropdowns */
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

  /* Master dropdown menu class - shared by all dropdown menus */
  .dropdown-menu,
  .filter-menu,
  .export-menu {
    position: absolute;
    top: calc(100% + var(--dropdown-offset));
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: var(--dropdown-z);
    display: flex;
    flex-direction: column;
    max-height: 50vh;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
  }

  .dropdown-menu {
    min-width: 100%; /* Match trigger width minimum */
    width: max-content; /* Expand if content is wider */
    max-width: 20rem; /* But don't get too wide */
  }

  /* Left-aligned dropdowns (projection, annotation) */
  .dropdown-menu.align-left {
    left: 0;
  }

  /* Projection dropdown - match trigger width exactly like annotation dropdown */
  .projection-container .dropdown-menu.align-left {
    min-width: 100%; /* Match trigger width */
    width: max-content; /* Allow expansion if content is wider */
  }

  /* Right-aligned dropdowns (filter, export) */
  .dropdown-menu.align-right,
  .filter-menu,
  .export-menu {
    right: 0;
  }

  /* Master dropdown item class */
  .dropdown-item {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--text-base);
    color: var(--muted);
    cursor: pointer;
    transition: var(--transition-fast);
    border-left: var(--border-width) solid transparent;
  }

  .dropdown-item:hover,
  .dropdown-item.highlighted {
    background: var(--primary-light);
    border-left-color: var(--primary);
  }

  .dropdown-item.selected {
    font-weight: var(--font-semibold);
    color: var(--primary);
  }

  .dropdown-item.selected:hover,
  .dropdown-item.selected.highlighted {
    background: var(--primary-light);
  }

  /* List wrapper for dropdown items */
  .dropdown-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
`;

/**
 * Icon Styling
 * Consistent icon sizing and appearance
 */
export const iconMixin = css`
  .icon {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }
`;
