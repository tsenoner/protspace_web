import { css } from 'lit';
import { tokens } from '../../styles/tokens';
import { inputMixin, dropdownMixin } from '../../styles/mixins';

/**
 * Annotation Select Component Styles
 *
 * Uses shared dropdown system from mixins with annotation-specific overrides.
 * The annotation dropdown has a search input that stays fixed, so we override
 * the dropdown menu to hide overflow and let the inner list container scroll.
 */
export const annotationSelectStyles = [
  tokens,
  inputMixin,
  dropdownMixin,
  css`
    :host {
      display: inline-flex;
      position: relative;
      max-width: 100%;
    }

    .annotation-select-container {
      position: relative;
      display: inline-flex;
      width: 100%;
      max-width: 100%;
    }

    /* Override dropdown menu to match projection dropdown exactly */
    .dropdown-menu {
      overflow-y: auto;
      overflow-x: hidden;
      /* Match trigger width more closely */
      width: 100%;
      max-width: 20rem;
    }

    .annotation-search-container {
      padding: var(--spacing-sm);
      border-bottom: var(--border-width) solid var(--border);
    }

    .annotation-search-input {
      width: 100%;
      padding: var(--input-padding-y) var(--input-padding-x);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      font-size: var(--text-base);
      color: var(--muted);
      transition: var(--transition);
      box-sizing: border-box;
    }

    .annotation-search-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--focus-ring);
    }

    .annotation-list-container {
      max-height: 20rem;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      width: 100%;
    }

    .annotation-section {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .annotation-section-header {
      position: sticky;
      top: 0;
      padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs);
      background: var(--surface);
      border-bottom: var(--border-width) solid var(--border);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      color: var(--muted);
      z-index: 1;
      box-sizing: border-box;
    }

    .annotation-section-items {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    /* Ensure dropdown items fill the full width and show the left border */
    .dropdown-item {
      width: 100%;
      box-sizing: border-box;
      margin: 0;
    }

    .no-results {
      padding: var(--spacing-lg);
      text-align: center;
      font-size: var(--text-base);
      color: var(--muted);
    }

    @media (max-width: 1200px) {
      :host,
      .annotation-select-container,
      .dropdown-trigger {
        width: 100%;
      }

      .dropdown-menu {
        left: 0;
        right: 0;
        width: 100%;
        max-width: 100%;
      }
    }
  `,
];
