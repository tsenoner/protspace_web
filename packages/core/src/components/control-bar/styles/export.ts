import { css } from 'lit';

/**
 * Export Menu Styles
 *
 * Simplified export menu with consistent spacing throughout.
 */
export const exportStyles = css`
  .export-menu {
    width: 280px;
    padding: var(--spacing-md);
    font-family: var(--font-family);
    font-size: var(--text-base);
  }

  .export-menu-header {
    padding-bottom: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    border-bottom: var(--border-width) solid var(--border);
  }

  .export-menu-header span {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--muted);
  }

  .export-option-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  .export-option-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--muted);
  }

  .export-option-value {
    font-weight: var(--font-medium);
    color: var(--text-dark);
  }

  .export-format-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-xs);
  }

  .export-slider {
    width: 100%;
    height: 3px;
    background: var(--border);
    border-radius: calc(var(--radius) / 2);
    outline: none;
    cursor: pointer;
    appearance: none;
  }

  .export-slider::-webkit-slider-thumb,
  .export-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: var(--primary);
    border: 2px solid var(--surface);
    border-radius: 50%;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    appearance: none;
  }

  .export-slider::-webkit-slider-thumb:hover,
  .export-slider::-moz-range-thumb:hover {
    background: var(--primary-hover);
  }

  .export-slider-labels {
    display: flex;
    justify-content: space-between;
    margin-top: var(--spacing-xs);
    font-size: var(--text-xs);
    color: var(--muted);
    opacity: 0.7;
  }

  .export-dimensions-group {
    padding-bottom: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    border-bottom: var(--border-width) solid var(--border);
  }

  .export-aspect-lock {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-xs);
    color: var(--muted);
    cursor: pointer;
    user-select: none;
  }

  .export-actions {
    display: flex;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-sm);
    border-top: var(--border-width) solid var(--border);
  }

  .export-action-btn {
    flex: 1;
  }
`;
