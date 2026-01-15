import { css } from 'lit';

export const searchStyles = css`
  :host {
    display: block;
    min-width: 12rem;
    width: 100%;
  }

  .search-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-width: none;
    margin: 0 1.5rem;
  }

  .search-chips {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.25rem;
    border: 1px solid var(--border);
    padding: 0.1rem 0.2rem;
    border-radius: 0.25rem;
    background: var(--surface);
    min-height: 1.6rem;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar) transparent;
  }

  .search-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    background: var(--primary-light);
    color: var(--text-dark);
    border: var(--border-width) solid var(--border-light);
    border-radius: 999px;
    padding: 0.04rem var(--spacing-sm);
    font-size: var(--text-sm);
    flex: 0 0 auto;
  }

  .search-chip-remove {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--muted);
    font-weight: var(--font-bold);
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-chip-remove:hover {
    color: var(--text-dark);
  }

  .search-input {
    position: relative;
    flex: 1 1 auto;
    min-width: 9rem;
    border: none;
    outline: none;
    padding: 0.1rem var(--spacing-xs);
    font-size: var(--text-base);
    background: transparent;
    color: var(--muted);
  }

  .search-keyboard-shortcut-hint {
    position: absolute;
    right: var(--spacing-xs);
    top: 50%;
    transform: translateY(-50%);
    color: var(--hint);
    font-size: var(--text-sm);
    letter-spacing: 0.125rem;
    pointer-events: none;
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    padding: 0rem var(--spacing-xs);
  }

  /* Dropdown menu - inherits shared dropdown styles from control-bar */
  .search-suggestions {
    /* Shared dropdown menu styles */
    position: absolute;
    background: var(--surface);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: var(--dropdown-z);

    /* Component-specific positioning */
    top: calc(100% + var(--dropdown-offset));
    left: 0;
    right: 0;
    max-height: 13.75rem;
    overflow-y: auto;
  }

  /* Dropdown items - inherit from .dropdown-item base class */
  .search-suggestion {
    /* All base styles come from CSS variables */
    padding: var(--spacing-sm) var(--spacing-md);
    cursor: pointer;
    font-size: var(--text-base);
    color: var(--muted);
    transition: var(--transition-fast);
    border-left: 2px solid transparent;
  }

  .search-suggestion:hover {
    background: var(--primary-light);
  }

  .search-suggestion.active,
  .search-suggestion:focus {
    background: var(--primary-light);
    border-left-color: var(--primary);
  }

  .no-results {
    padding: var(--spacing-md);
    color: var(--muted);
    font-size: var(--text-base);
    text-align: center;
  }
`;
