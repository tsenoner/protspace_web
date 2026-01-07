import { css } from 'lit';

export const legendStyles = css`
  :host {
    --legend-bg: #ffffff;
    --legend-bg-dark: #1f2937;
    --legend-border: #d9e2ec; /* softer border for UniProt */
    --legend-border-dark: #374151;
    --legend-border-radius: 6px;
    --legend-padding: 0.75rem;
    --legend-item-padding: 0.625rem;
    --legend-item-gap: 0.5rem;
    --legend-text-color: #334155;
    --legend-text-color-dark: #f9fafb;
    --legend-text-secondary: #5b6b7a;
    --legend-text-secondary-dark: #9ca3af;
    --legend-hover-bg: #f6f8fb;
    --legend-hover-bg-dark: #374151;
    --legend-hidden-bg: #f6f8fb;
    --legend-hidden-bg-dark: #374151;
    --legend-hidden-opacity: 0.5;
    --legend-active-bg: #e6f1f8;
    --legend-active-bg-dark: #1e3a8a;
    --legend-drag-bg: #eaf4fb;
    --legend-drag-bg-dark: #1e3a8a;
    --legend-selected-ring: #00a3e0; /* UniProt lighter azure */
    --legend-extracted-border: #10b981;

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

  .customize-button {
    background: none;
    border: none;
    color: var(--legend-text-secondary);
    cursor: pointer;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    transition:
      color 0.15s ease,
      background-color 0.4s ease;
  }

  .customize-button:hover {
    color: #ffffffff;
    background-color: #979595ff;
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
    border: 2px solid #7c3aed !important;
    border-radius: 0.5rem;
  }

  .legend-item.selected {
    box-shadow: 0 0 0 2px var(--legend-selected-ring);
  }

  /* Drag-and-drop visual hints */
  .legend-item.dragging {
    opacity: 0.8;
    z-index: 1000;
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

  .legend-text {
    font-size: 0.875rem;
    color: var(--legend-text-color);
    width: 100%;
    overflow-wrap: anywhere;
  }

  @media (prefers-color-scheme: dark) {
    .legend-text {
    }
  }

  .view-button {
    background: none;
    border: none;
    color: #00a3e0;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    margin-left: 0.25rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    transition: color 0.2s ease;
  }

  .view-button:hover {
    color: #008ec4;
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

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--legend-bg);
    padding: 1.5rem 1.75rem;
    display: flex;
    border-radius: 0.75rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: min(90vw, 32rem);
    max-height: 85vh;
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
    background: #f0f4f8;
    border-color: #b8c5d0;
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
    border-color: #b8c5d0;
  }

  .other-items-list-item-input:focus,
  .other-items-list-item-input:focus-visible {
    outline: none;
    border-color: #00a3e0;
    box-shadow: 0 0 0 3px rgba(0, 163, 224, 0.1);
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
    background: #f0f4f8;
    border-color: #b8c5d0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .other-items-list-label input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #00a3e0;
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
    padding-bottom: 8px;
    border-bottom: 2px solid var(--legend-border);
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
    background: #f0f4f8;
    border-color: #b8c5d0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .other-items-list-item-sorting-container-item-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--legend-text-color);
    margin-bottom: 4px;
    font-family: 'Courier New', monospace;
    background: #e8eef4;
    padding: 4px 8px;
    border-radius: 4px;
    width: fit-content;
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
    color: #4a5568;
    user-select: none;
    white-space: nowrap;
  }

  .other-items-list-item-sorting-container-item-container-label:hover,
  .other-items-list-item-sorting-container-item-container label:hover {
    background: rgba(0, 163, 224, 0.08);
    color: #00a3e0;
  }

  .other-items-list-item-sorting-container-item-container-input,
  .other-items-list-item-sorting-container-item-container input[type='radio'],
  .other-items-list-item-sorting-container-item-container input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #00a3e0;
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
    background: rgba(0, 163, 224, 0.12);
    color: #00a3e0;
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

  @media (prefers-color-scheme: dark) {
    .modal-title {
    }
  }

  .close-button {
    background: none;
    border: none;
    color: var(--legend-text-secondary);
    cursor: pointer;
    padding: 0.4rem 0.5rem;
    border-radius: 0.25rem;
    transition: color 0.2s ease;
  }
  .close-button:hover {
    color: var(--protspace-viewer-text);
    background: rgba(0, 0, 0, 0.04);
  }

  .close-button:hover {
    color: var(--legend-text-color);
  }

  @media (prefers-color-scheme: dark) {
    .close-button {
    }
    .close-button:hover {
    }
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

  .other-item .extract-button {
    background: none;
    border: none;
    color: #00a3e0;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: color 0.2s ease;
  }

  .other-item .extract-button:hover {
    color: #008ec4;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--legend-border);
    margin-top: 8px;
  }

  .modal-reset-button {
    background: transparent;
    border: 1px solid #dc2626;
    color: #dc2626;
    cursor: pointer;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.2s ease;
    font-size: 0.875rem;
    margin-inline-end: auto;
  }

  .modal-reset-button:hover {
    background: #dc2626;
    color: white;
    box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
  }

  .modal-close-button {
    background: var(--legend-hover-bg);
    border: 1px solid var(--legend-border);
    color: var(--legend-text-color);
    cursor: pointer;
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .modal-close-button:hover {
    background: var(--legend-hidden-bg);
    border-color: #b8c5d0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .extract-button {
    background: #00a3e0;
    border: 1px solid #00a3e0;
    color: white;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 1.5rem;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
  }

  .extract-button:hover {
    background: #008ec4;
    border-color: #008ec4;
    box-shadow: 0 2px 6px rgba(0, 163, 224, 0.3);
  }
`;
