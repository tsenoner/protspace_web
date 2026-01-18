import { css } from 'lit';
import { tokens } from '../../styles/tokens';
import { overlayMixins } from '../../styles/overlay-mixins';
import { buttonMixin } from '../../styles/mixins';

const legendStylesCore = css`
  :host {
    --legend-bg: var(--surface);
    --legend-bg-dark: var(--surface-dark);
    --legend-border: var(--border);
    --legend-border-dark: var(--border-dark);
    --legend-border-radius: 6px;
    --legend-padding: var(--spacing-md);
    --legend-item-padding: 0.625rem;
    --legend-item-gap: var(--spacing-sm);
    --legend-text-color: var(--text-primary);
    --legend-text-color-dark: #f9fafb;
    --legend-text-secondary: var(--text-secondary);
    --legend-text-secondary-dark: #9ca3af;
    --legend-hover-bg: var(--disabled-bg);
    --legend-hover-bg-dark: var(--border-dark);
    --legend-hidden-bg: var(--disabled-bg);
    --legend-hidden-bg-dark: var(--border-dark);
    --legend-hidden-opacity: 0.5;
    --legend-active-bg: var(--active-bg);
    --legend-active-bg-dark: #1e3a8a;
    --legend-drag-bg: var(--primary-light);
    --legend-drag-bg-dark: #1e3a8a;
    --legend-selected-ring: var(--primary);

    display: flex;
    user-select: none;
    flex-direction: column;
    width: 100%;

    border: 1px solid var(--legend-border);
    background: var(--legend-bg);
    border-radius: var(--legend-border-radius);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    padding: 5px 2px 9px 2px;
    flex-shrink: 1;
    flex-grow: 1;
    height: calc(50% - 1rem);
  }

  @media (max-width: 950px) {
    :host {
      max-width: unset;
    }
  }

  .legend-container {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding-bottom: 8px;
    flex-shrink: 1;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .legend-header {
    display: flex;
    justify-content: space-between;
    flex-direction: row;
    width: 100%;
    align-items: center;
    padding: 3px 6px 0px 1.2rem;
    margin-bottom: 0.25rem;
    box-sizing: border-box;
  }

  .legend-header-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .legend-title {
    font-weight: 500;
    font-size: 1rem;
    color: var(--legend-text-color);
    margin: 0;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: var(--legend-item-gap);
    width: 100%;
    max-height: calc(100vh - 10rem);
    overflow-y: scroll;
    scrollbar-width: thin;
    padding: 5px 6px 4px 9px;
    box-sizing: border-box;
    flex-grow: 1;
    flex-shrink: 1;
  }

  .legend-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px 6px 2px;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--legend-hover-bg);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  .legend-item:hover {
    background: var(--legend-hover-bg);
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
  }

  .legend-item:active {
    background: var(--legend-active-bg);
  }

  .legend-item.hidden {
    opacity: var(--legend-hidden-opacity);
    background: var(--legend-hidden-bg);
  }

  .legend-item.dragging {
    background: var(--legend-drag-bg);
    transform: scale(1.02);
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.15);
    border: 2px solid var(--accent-purple) !important;
    border-radius: 0.5rem;
  }

  .legend-item.selected {
    box-shadow: 0 0 0 2px var(--legend-selected-ring);
  }

  .legend-item:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--legend-selected-ring);
  }

  .legend-item:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--legend-selected-ring);
  }

  /* Drag-and-drop visual hints */
  .legend-item.dragging {
    opacity: 0.8;
    z-index: var(--z-modal);
    position: relative;
  }

  .legend-item-content {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    box-sizing: border-box;
  }

  .drag-handle {
    display: flex;
    align-items: center;
    padding: 0.25rem;
    border-radius: 0.25rem;
    cursor: grab;
    color: var(--legend-text-secondary);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .legend-symbol {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mr-2 {
    margin-right: 0.5rem;
  }

  .legend-text {
    font-size: 0.875rem;
    color: var(--legend-text-color);
    width: 100%;
    overflow-wrap: anywhere;
  }

  .legend-count {
    font-size: 0.875rem;
    color: var(--legend-text-secondary);
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 0 0 9px;
  }

  .legend-empty {
    text-align: center;
    color: var(--legend-text-secondary);
    font-style: italic;
    padding: 1rem 0;
  }

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
  }

  .modal-content > div {
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
`;

export const legendStyles = [tokens, overlayMixins, buttonMixin, legendStylesCore];
