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
    border: 1px solid var(--up-border, #d9e2ec);
    padding: 0.1rem 0.2rem;
    border-radius: 0.25rem;
    background: var(--up-surface, #ffffff);
    min-height: 1.6rem;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e0 transparent;
  }

  .search-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #eef6fb;
    color: #0b0f19;
    border: 1px solid #cfe8f5;
    border-radius: 999px;
    padding: 0.04rem 0.35rem;
    font-size: 0.75rem;
    flex: 0 0 auto;
  }

  .search-chip-remove {
    border: none;
    background: transparent;
    cursor: pointer;
    color: #6b7280;
    font-weight: 700;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-chip-remove:hover {
    color: #111827;
  }

  .search-input {
    flex: 1 1 auto;
    min-width: 9rem;
    border: none;
    outline: none;
    padding: 0.1rem 0.25rem;
    font-size: 0.875rem;
    background: transparent;
  }

  .search-suggestions {
    position: absolute;
    top: calc(100% + 0.125rem);
    left: 0;
    right: 0;
    z-index: 60;
    background: var(--up-surface, #ffffff);
    border: 1px solid var(--up-border, #d9e2ec);
    border-radius: 0.25rem;
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
    max-height: 13.75rem;
    overflow-y: auto;
  }

  .search-suggestion {
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .search-suggestion:hover,
  .search-suggestion.active {
    background: #f6f8fb;
  }

  .no-results {
    padding: 0.6rem;
    color: #6b7280;
    font-size: 0.875rem;
    text-align: center;
  }
`;
