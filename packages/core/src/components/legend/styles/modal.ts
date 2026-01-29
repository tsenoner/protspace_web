import { css } from 'lit';

/**
 * Legend Modal Styles
 *
 * Styles for the legend customization modal including:
 * - Modal content and layout
 * - Other items list
 * - Sorting UI
 * - Form inputs and controls
 *
 * Note: Base modal overlay styles are provided by overlayMixins
 */
export const modalStyles = css`
  /* ----------------------------- Modal styles -------------------------------------- */
  /* Base modal styles provided by overlayMixins */

  .modal-content {
    /* Override and extend base modal-content from overlayMixins */
    padding: 1.5rem 1.75rem;
    display: flex;
    width: min(90vw, 32rem);
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    position: relative;
  }

  .modal-content > div:not(.color-palette-toast) {
    width: 100%;
  }

  .other-items-list {
    box-sizing: border-box;
    display: flex;
    border: 1px solid var(--legend-border);
    border-radius: 0.375rem;
    margin-bottom: 19px;

    overflow-y: auto;
    padding: 14px;
    flex-direction: column;
    flex-grow: 1;
    row-gap: 16px;
    scrollbar-width: thin;
  }

  .other-items-list-item {
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
    background: var(--legend-hover-bg);
    border-radius: 8px;
    border: 1px solid var(--legend-border);
    transition: all 0.2s ease;
  }

  .other-items-list-item:hover {
    background: var(--hover-bg-alt);
    border-color: var(--border-hover);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .other-items-list-item-label {
    color: var(--legend-text-color);
    margin-bottom: 8px;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .other-items-list-item-input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid var(--legend-border);
    background: white;
    font-size: 0.875rem;
    color: var(--legend-text-color);
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .other-items-list-item-input:hover {
    border-color: var(--border-hover);
  }

  .other-items-list-item-input:focus,
  .other-items-list-item-input:focus-visible {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }

  .other-items-list-label {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 14px 18px;
    justify-content: space-between;
    background: var(--legend-hover-bg);
    border-radius: 8px;
    border: 1px solid var(--legend-border);
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    font-size: 0.875rem;
    color: var(--legend-text-color);
  }

  .other-items-list-label:hover {
    background: var(--hover-bg-alt);
    border-color: var(--border-hover);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .other-items-list-label input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary);
  }
  .other-items-list-item-sorting {
    padding: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .other-items-list-item-sorting-title {
    margin-bottom: 12px;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--legend-text-color);
  }

  .other-items-list-item-sorting-container {
    display: flex;
    flex-direction: column;
    row-gap: 12px;
  }

  .other-items-list-item-sorting-container-item {
    display: flex;
    flex-direction: column;
    padding: 12px 14px;
    row-gap: 10px;
    background: var(--legend-hover-bg);
    border-radius: 8px;
    border: 1px solid var(--legend-border);
    transition: all 0.2s ease;
  }

  .other-items-list-item-sorting-container-item:hover {
    background: var(--hover-bg-alt);
    border-color: var(--border-hover);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .other-items-list-item-sorting-container-item-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  .other-items-list-item-sorting-container-item-container-label,
  .other-items-list-item-sorting-container-item-container label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    transition: all 0.15s ease;
    font-size: 0.875rem;
    color: var(--text-tertiary);
    user-select: none;
    white-space: nowrap;
  }

  .other-items-list-item-sorting-container-item-container-label:hover,
  .other-items-list-item-sorting-container-item-container label:hover {
    background: var(--focus-ring);
    color: var(--primary);
  }

  .other-items-list-item-sorting-container-item-container-input,
  .other-items-list-item-sorting-container-item-container input[type='radio'],
  .other-items-list-item-sorting-container-item-container input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--primary);
  }

  /* Special styling for the reverse checkbox */
  .other-items-list-item-sorting-container-item-container label:has(input[type='checkbox']) {
    margin-left: 8px;
    padding-left: 12px;
    border-left: 2px solid var(--legend-border);
    font-weight: 500;
  }

  /* Visual feedback when option is selected */
  .other-items-list-item-sorting-container-item-container label:has(input:checked) {
    background: var(--primary-light);
    color: var(--primary);
    font-weight: 500;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--legend-text-color);
    margin: 0;
  }

  .modal-description {
    font-size: 0.875rem;
    color: var(--legend-text-secondary);
    margin-bottom: 1.3rem;
    padding-left: 2rem;
  }

  .other-items-list {
    border: 1px solid var(--legend-border);
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    overflow-y: auto;
  }

  .other-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid var(--legend-border);
    transition: background-color 0.2s ease;
  }

  .other-item:last-child {
    border-bottom: none;
  }

  .other-item:hover {
    background: var(--legend-hover-bg);
  }

  .other-item-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .other-item-name {
    color: var(--legend-text-color);
  }

  .other-item-count {
    font-size: 0.75rem;
    color: var(--legend-text-secondary);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .modal-reset-button {
    margin-inline-end: auto;
  }

  /* ----------------------------- Color Palette Section -------------------------------------- */
  .color-palette-section {
    padding: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .color-palette-title {
    margin-bottom: 12px;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--legend-text-color);
  }

  .color-palette-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .color-palette-select {
    flex: 1;
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid var(--legend-border);
    background: white;
    font-size: 0.875rem;
    color: var(--legend-text-color);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .color-palette-select:hover {
    border-color: var(--border-hover);
  }

  .color-palette-select:focus,
  .color-palette-select:focus-visible {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }

  .color-palette-preview {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
    gap: 8px;
    padding: 14px;
    background: var(--legend-hover-bg);
    border-radius: 8px;
    border: 1px solid var(--legend-border);
  }

  .color-palette-swatch {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 6px;
    border: 1px solid var(--legend-border);
    cursor: default;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .color-palette-swatch:hover {
    transform: scale(1.15);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    z-index: 1;
  }
`;
