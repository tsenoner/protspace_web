import { css } from 'lit';

export const controlBarStyles = css`
  :host {
    display: block;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    /* UniProt-inspired design tokens */
    --up-primary: #00a3e0; /* lighter azure */
    --up-primary-hover: #008ec4;
    --up-surface: #ffffff;
    --up-border: #d9e2ec;
    --up-muted: #4a5568;
  }

  .control-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: var(--up-surface);
    border-bottom: 1px solid var(--up-border);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    flex-wrap: nowrap;
    border-radius: 5px;
  }

  .left-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    /* Let inner controls wrap when space is tight */
    flex-wrap: wrap;
    min-width: 0;
  }

  .right-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* Let action buttons wrap when space is tight */
    flex-wrap: wrap;
    min-width: 0;
  }

  .control-group {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  /* Center search should expand to take remaining horizontal space */
  .search-group {
    flex: 1 1 12rem;
    min-width: 0;
    margin: 0 0.5rem;
    display: flex;
    align-items: center;
  }

  .search-group > protspace-protein-search {
    width: 100%;
    min-width: 0;
  }

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--up-muted);
  }

  select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    background: var(--up-surface);
    font-size: 0.875rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    max-width: 100%;
  }

  select:focus {
    outline: none;
    border-color: var(--up-primary);
    box-shadow: 0 0 0 2px rgba(0, 114, 181, 0.15);
  }

  .right-controls-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    background: var(--up-surface);
    color: var(--up-muted);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  button:hover {
    background: #f6f8fb;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button.active {
    background: var(--up-primary);
    color: #ffffff;
    border-color: var(--up-primary);
    box-shadow: inset 1px 1px 3px 0px #d8d8d8;
    fill: #fff;
  }

  /* Make Filter button text more visible even when not active */
  .right-controls .export-container > button {
    color: #0b0f19; /* very dark text for light mode */
    font-weight: 400;
  }

  /* High-contrast labels inside filter panel */
  .export-menu .filter-label {
    color: #0b0f19;
    font-weight: 400;
  }

  button.active:hover {
    background: var(--up-primary-hover);
  }

  .icon {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }

  .export-container,
  .filter-container,
  .projection-container {
    display: flex;
    position: relative;
    align-items: center;
    gap: 0.25rem;
    border: unset;
    border-radius: 0.25rem;
    background: var(--up-surface);
    color: var(--up-muted);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .export-container > button,
  .filter-container > button {
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: 5px;
    padding: 0.3rem 0.45rem 0.3rem 0.5rem;
    border: 1px solid var(--up-border);
    border-radius: 5px;
    outline: unset;
    outline-color: #39393900;
    box-shadow: inset -1px -1px 3px 0px #d8d8d8;
    transition: all 0.15s ease;
  }
  .export-container {
    position: relative;
  }

  .projection-container {
    position: relative;
  }

  .projection-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 30px 6px 9px;
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    background-color: var(--up-surface);
    font-size: 0.875rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    cursor: pointer;
    transition: all 0.15s ease;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    width: max-content;
    min-width: 120px;
  }

  .projection-trigger:hover {
    background: #f6f8fb;
  }

  .projection-trigger.active {
    border-color: var(--up-primary);
    box-shadow: 0 0 0 2px rgba(0, 114, 181, 0.15);
  }

  .projection-trigger:focus {
    outline: none;
    border-color: var(--up-primary);
    box-shadow: 0 0 0 2px rgba(0, 114, 181, 0.15);
  }

  .projection-menu {
    position: absolute;
    left: 0;
    top: calc(100% + 5px);
    width: max-content;
    min-width: 100%;
    background: var(--up-surface);
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    display: flex;
    z-index: 50;
    flex-direction: column;
    max-height: 50vh;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .projection-menu-list {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    display: flex;
    flex-direction: column;
    row-gap: 2px;
  }

  .projection-menu-list-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .projection-option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--up-muted);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .projection-option:hover {
    background: #f6f8fb;
  }

  .projection-option.active {
    background: var(--up-primary);
    color: #ffffff;
  }

  .projection-option.active:hover {
    background: var(--up-primary-hover);
  }

  .filter-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 5px);
    width: max-content;
    background: var(--up-surface);
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    display: flex;
    z-index: 50;
    flex-direction: column;
    row-gap: 20px;
    padding: 6px 10px 14px;
  }

  .filter-menu-list {
    list-style: none;
    margin: 0;
    display: flex;
    padding: 1rem 0.25rem 0.5rem;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    cursor: auto;
    row-gap: 17px;
    width: 100%;
    max-height: 50vh;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .filter-menu-list-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    row-gap: 7px;
    width: 100%;
    position: relative;
  }

  .filter-menu-list-item > label,
  .filter-menu-list-item input {
    cursor: pointer;
  }
  .filter-menu-list-item > label {
    color: #0b0f19;
    font-weight: 400;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    column-gap: 8px;
  }

  .filter-menu-list-item > button {
    display: flex;
    border: 1px solid var(--up-border);
    border-radius: 4px;
    padding: 0.3rem 0.4rem 0.3rem 0.7rem;
    align-self: flex-start;
    margin-left: 18px;
  }

  .filter-menu-list-item-options {
    position: relative;
    width: 100%;
    margin-top: 5px;
    background: var(--up-surface);
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    display: flex;
    z-index: 10;
    flex-direction: column;
    row-gap: 14px;
    padding: 9px 10px 14px;
    box-sizing: border-box;
  }

  .filter-menu-list-item-options-selection {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    column-gap: 11px;
  }

  .filter-menu-list-item-options-selection > button {
    border: 1px solid var(--up-border);
    padding: 0.25rem 0.7rem;
    border-radius: 4px;
    box-shadow: inset -1px -1px 3px 0px #7d918e78;
    transition: all 0.15s ease;
  }

  .filter-menu-list-item-options-selection > button:last-child {
    background-color: #e42121;
    box-shadow: inset -1px -1px 3px 0px #f6f6f6a8;
    border-color: #d06868;
    color: #fff;
    font-weight: 900;
  }
  .filter-menu-list-item-options-selection > button:last-child:hover {
    background-color: #c20909ff;
    box-shadow: inset -1px -1px 3px 0px #f6f6f6a8;
    border-color: #d06868;
    color: #fff;
    font-weight: 900;
  }
  .filter-menu-list-item-options-inputs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    row-gap: 8px;
    max-height: 10rem;
    overflow-y: scroll;
    scrollbar-width: thin;
    scrollbar-color: #e4e4e4 #ffffff;
    padding: 10px 5px;
  }

  .filter-menu-list-item-options-inputs > label {
    display: flex;
    flex-direction: row-reverse;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0px 1px 2px 0px #3323c41a;
    padding: 0.3rem 0.3rem 0.3rem 0.5rem;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .filter-menu-list-item-options-inputs > label:hover {
    box-shadow: 0px 1px 2px 0px #3323c498;
  }
  .filter-menu-list-item-options-done {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
  }

  .filter-menu-list-item-options-done > button {
    border: 1px solid #6ac4bf7a;
    padding: 0.35rem 1.2rem 0.42rem;
    border-radius: 4px;
    box-shadow: inset -1px -1px 3px 0px #40968c78;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    transition: all 0.15s ease;
  }

  .filter-menu-list-item-options-done > button:hover {
    background-color: #3af864 !important;
    color: #fff;
  }

  .filter-menu-buttons {
    width: 100%;
    border: none;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-direction: row;
    column-gap: 9px;
  }

  .filter-menu-buttons > button {
    border: 1px solid #bebebe;
    padding: 0.3rem 1.3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
  }
  .filter-menu-buttons > button.active:hover {
    background-color: #3ff2ff !important;
    color: #000 !important;
  }

  .filter-menu button:hover {
    background: #f6f8fb;
  }

  /* Export menu reuses filter-menu styles with minimal overrides */
  .export-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 5px);
    width: 280px;
    background: var(--up-surface);
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    display: flex;
    z-index: 50;
    flex-direction: column;
    padding: 9px 10px 14px;
  }

  .export-menu-header {
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--up-border);
    margin-bottom: 0.75rem;
  }

  .export-menu-header span {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--up-muted);
  }

  .export-option-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .export-option-label {
    font-size: 0.75rem;
    color: var(--up-muted);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .export-option-value {
    font-weight: 500;
    color: #0b0f19;
  }

  /* Reuse filter button grid style for format buttons */
  .export-format-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.375rem;
  }

  .export-format-btn {
    border: 1px solid var(--up-border);
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    background: var(--up-surface);
    color: var(--up-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: inset -1px -1px 3px 0px #d8d8d8;
  }

  .export-format-btn:hover {
    background: #f6f8fb;
  }

  .export-format-btn.active {
    background: var(--up-primary);
    color: #ffffff;
    border-color: var(--up-primary);
  }

  /* Sliders reuse standard input styles */
  .export-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 3px;
    border-radius: 1.5px;
    background: var(--up-border);
    outline: none;
    cursor: pointer;
  }

  .export-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--up-primary);
    border: 2px solid var(--up-surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    cursor: pointer;
  }

  .export-slider::-webkit-slider-thumb:hover {
    background: var(--up-primary-hover);
  }

  .export-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--up-primary);
    border: 2px solid var(--up-surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    cursor: pointer;
  }

  .export-slider::-moz-range-thumb:hover {
    background: var(--up-primary-hover);
  }

  .export-slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.625rem;
    color: var(--up-muted);
    opacity: 0.7;
    margin-top: 0.125rem;
  }

  .export-dimensions-group {
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--up-border);
    margin-bottom: 0.75rem;
  }

  .export-aspect-lock {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--up-muted);
    cursor: pointer;
    margin-top: 0.375rem;
    user-select: none;
  }

  .export-aspect-lock input[type='checkbox'] {
    cursor: pointer;
  }

  /* Reuse filter button action styles */
  .export-actions {
    display: flex;
    gap: 0.375rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--up-border);
  }

  .export-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    flex: 1;
    border: 1px solid var(--up-border);
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    background: var(--up-primary);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: inset -1px -1px 3px 0px rgba(0, 0, 0, 0.1);
  }

  .export-action-btn:hover {
    background: var(--up-primary-hover);
  }

  .export-reset-btn {
    border: 1px solid var(--up-border);
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    background: var(--up-surface);
    color: var(--up-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: inset -1px -1px 3px 0px #d8d8d8;
  }

  .export-reset-btn:hover {
    background: #f6f8fb;
  }

  .chevron-down {
    width: 1rem;
    height: 1rem;
    margin-left: 0.25rem;
  }

  .control-group select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background: url('data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"%3E%3Cpath d="M6 9L12 15L18 9" stroke="%23000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E');
    background-color: #fff;
    background-repeat: no-repeat;
    background-position: right 4px center;
    width: max-content;
    padding: 6px 30px 6px 9px;
  }
  .control-group select option {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #fff;
  }

  .right-controls-data > button {
    color: #0b0f19;
    font-weight: 400;
    padding-right: 0.9rem;
  }

  /* Responsive layout: stack controls on small screens */
  @media (max-width: 1024px) {
    .control-bar {
      flex-wrap: wrap;
      align-items: stretch;
      gap: 0.5rem 0;
    }

    /* Ensure three distinct rows in order: left, search, right */
    .left-controls,
    .search-group,
    .right-controls {
      width: 100%;
      justify-content: flex-start;
      flex-basis: 100%;
    }

    .left-controls {
      order: 1;
    }
    .search-group {
      order: 2;
    }
    .right-controls {
      order: 3;
    }

    .control-group {
      width: 100%;
    }

    /* Make selects expand to available width inside a row */
    .control-group select {
      width: 100%;
    }

    /* Make projection trigger expand to available width inside a row */
    .projection-trigger {
      width: 100%;
    }
  }
`;
