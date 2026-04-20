// packages/core/src/components/scatter-plot/context-menu.styles.ts
import { css } from 'lit';

export const contextMenuStyles = css`
  :host {
    position: absolute;
    z-index: 200;
    pointer-events: auto;
  }

  .menu {
    background: var(--surface-overlay, #1e1e2e);
    border: 1px solid var(--border-color, #444);
    border-radius: 8px;
    padding: 4px 0;
    min-width: 180px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    font-size: 12px;
    font-family: inherit;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    color: var(--text-primary, #ddd);
    cursor: pointer;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font: inherit;
  }

  .menu-item:hover {
    background: var(--surface-hover, #2a3a5a);
  }

  .menu-item[aria-disabled='true'] {
    color: var(--text-disabled, #555);
    cursor: default;
    pointer-events: none;
  }

  .menu-item .icon {
    width: 16px;
    text-align: center;
    font-size: 13px;
    flex-shrink: 0;
  }

  .menu-item .shortcut {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-secondary, #667);
  }

  .separator {
    height: 1px;
    background: var(--border-color, #333);
    margin: 4px 0;
  }
`;
