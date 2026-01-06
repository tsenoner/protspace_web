import { css } from 'lit';

export const featureSelectStyles = css`
  :host {
    display: inline-block;
    position: relative;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    /* Reuse control bar design tokens */
    --up-primary: #00a3e0;
    --up-primary-hover: #008ec4;
    --up-surface: #ffffff;
    --up-border: #d9e2ec;
    --up-muted: #4a5568;
  }

  .feature-select-container {
    position: relative;
    display: inline-block;
  }

  .feature-select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 6px 30px 6px 9px;
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    background: var(--up-surface);
    font-size: 0.875rem;
    color: var(--up-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 10rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    width: max-content;
  }

  .feature-select-trigger:hover {
    background: #f6f8fb;
  }

  .feature-select-trigger:focus {
    outline: none;
    border-color: var(--up-primary);
    box-shadow: 0 0 0 2px rgba(0, 114, 181, 0.15);
  }

  .feature-select-trigger.open {
    border-color: var(--up-primary);
  }

  .feature-select-text {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron-down {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .feature-select-trigger.open .chevron-down {
    transform: rotate(180deg);
  }

  .feature-select-menu {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    min-width: 100%;
    width: max-content;
    max-width: 20rem;
    background: var(--up-surface);
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    z-index: 50;
    display: flex;
    flex-direction: column;
    max-height: 24rem;
    overflow: hidden;
  }

  .feature-search-container {
    padding: 0.5rem;
    border-bottom: 1px solid var(--up-border);
  }

  .feature-search-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    background: var(--up-surface);
    color: var(--up-muted);
    box-sizing: border-box;
  }

  .feature-search-input:focus {
    outline: none;
    border-color: var(--up-primary);
    box-shadow: 0 0 0 2px rgba(0, 114, 181, 0.15);
  }

  .feature-list-container {
    overflow-y: auto;
    scrollbar-width: thin;
    max-height: 20rem;
  }

  .feature-section {
    display: flex;
    flex-direction: column;
  }

  .feature-section-header {
    padding: 0.5rem 0.75rem 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--up-muted);
    background: var(--up-surface);
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: 1px solid var(--up-border);
  }

  .feature-section-items {
    display: flex;
    flex-direction: column;
  }

  .feature-item {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: var(--up-muted);
    cursor: pointer;
    transition: background-color 0.1s ease;
    border-left: 2px solid transparent;
  }

  .feature-item:hover {
    background: #f6f8fb;
  }

  .feature-item.highlighted {
    background: #eef6fb;
    border-left-color: var(--up-primary);
  }

  .feature-item.selected {
    font-weight: 600;
    color: var(--up-primary);
  }

  .feature-item.selected.highlighted {
    background: #e0f2f8;
  }

  .no-results {
    padding: 1rem;
    text-align: center;
    color: var(--up-muted);
    font-size: 0.875rem;
  }

  /* Responsive: ensure dropdown doesn't overflow on small screens */
  @media (max-width: 1024px) {
    .feature-select-menu {
      max-width: calc(100vw - 2rem);
    }
  }
`;
