import { css } from 'lit';

export const insetToolStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  .source-region {
    position: absolute;
    border: 1.5px dashed #333;
    pointer-events: none;
  }

  .inset-box {
    position: absolute;
    border: 2.5px solid #333;
    background: #fff;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
    cursor: move;
    overflow: hidden;
  }

  .inset-box.circle {
    border-radius: 50%;
  }

  .inset-box canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .resize-handle {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 12px;
    height: 12px;
    background: var(--accent-color, #5b8fd9);
    border-radius: 50%;
    cursor: nwse-resize;
    border: 2px solid #fff;
    pointer-events: auto;
  }

  .inset-label {
    position: absolute;
    bottom: -18px;
    left: 0;
    font-size: 9px;
    font-weight: 600;
    color: #333;
    white-space: nowrap;
  }

  .connector-svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .framing-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--accent-color, #5b8fd9);
    color: #fff;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
  }

  .snap-badge {
    position: absolute;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: #2ecc71;
    color: #fff;
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(46, 204, 113, 0.3);
  }

  .toolbar-hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 30, 46, 0.9);
    color: #aaa;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
  }

  .toolbar-hint kbd {
    background: #334;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    color: #ddd;
    border: 1px solid #444;
  }
`;
