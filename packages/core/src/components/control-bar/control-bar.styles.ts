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
    flex-wrap: wrap;
    row-gap: 0.5rem;
    border-radius: 5px;
  }

  @media (max-width: 1050px) {
    .control-bar {
      row-gap: 0.9rem;
      flex-direction: column-reverse;
    }
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
    color: #ffffff !important;
    border-color: var(--up-primary);
    box-shadow: inset 1px 1px 3px 0px #d8d8d8 !important;
    fill: #fff;

    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: 5px;
    padding: 0.3rem 0.45rem 0.3rem 0.5rem;
    border: 1px solid var(--up-border);
    border-radius: 5px;
    outline-style: unset;
    outline-width: unset;
    outline-color: rgba(57, 57, 57, 0);
    box-shadow: rgb(216, 216, 216) -1px -1px 3px 0px inset;
    transition: 0.3s;
  }

  /* Make Filter button text more visible even when not active */
  .right-controls .export-container > button {
    color: #0b0f19; /* very dark text for light mode */
    font-weight: 400;
  }
  @media (prefers-color-scheme: dark) {
  }

  /* High-contrast labels inside filter panel */
  .export-menu .filter-label {
    color: #0b0f19;
    font-weight: 400;
  }
  @media (prefers-color-scheme: dark) {
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
  .filter-container {
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
    transition: 0.3s;
  }
  .export-container {
    position: relative;
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
    padding: 0.45rem 0.25rem 0.25rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    cursor: auto;
    row-gap: 17px;
    width: 100%;
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
    justify-content: flex-start;
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
    position: absolute;
    right: 0;
    top: calc(100% - 28px);
    width: max-content;
    background: var(--up-surface);
    border: 1px solid var(--up-border);
    border-radius: 0.25rem;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    display: flex;
    z-index: 50;
    flex-direction: column;
    row-gap: 14px;
    padding: 9px 10px 14px;
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
    transition: 0.3s;
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
    transition: 0.3s;
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
    transition: 0.3s;
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
    transition: 0.3s;
  }
  .filter-menu-buttons > button.active:hover {
    background-color: #3ff2ff !important;
    color: #000 !important;
  }

  .filter-menu button:hover {
    background: #f6f8fb;
  }

  .export-menu {
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
    padding: 10px 10px 14px;
  }

  .export-menu-list {
    margin: 0;
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    row-gap: 10px;
  }
  .export-menu-list-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
  .export-menu-list-item-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    border: 1px solid #3afcf3;
    border-radius: 5px;
    padding: 0.35rem 0.9rem;
    cursor: pointer;
    box-shadow: inset -1px -1px 2px -1px #969696c9;
  }

  .export-menu-list-item-button:hover {
    border: 1px solid #3afcf3;
    background-color: #58e9f3;
    box-shadow: inset -1px -1px 2px -1px #e9e9e9c9;
    color: #fff;
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
  @media (max-width: 680px) {
    .control-bar {
      flex-direction: column-reverse;
    }
    .right-controls-select {
      order: 6;
    }

    .right-controls-clear {
      order: 5;
    }
    .right-controls-split {
      order: 4;
    }
    .right-controls-filter {
      order: 3;
    }

    .right-controls-export {
      order: 2;
    }

    .right-controls-data {
      order: 1;
      display: flex;
    }

    .left-controls,
    .right-controls {
      width: 100%;
      justify-content: center;
    }

    .control-group {
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
  }
`;
