import { css } from 'lit';

export const insetToolStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  /* ── Lens (draggable magnifying overlay) ── */

  .lens {
    position: absolute;
    border: 3px solid var(--primary, #00a3e0);
    border-radius: 8px;
    background: #fff;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    cursor: grab;
    pointer-events: auto;
    z-index: 10;
  }

  .lens:active {
    cursor: grabbing;
  }

  .lens-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .lens-zoom-label {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
  }

  .lens-resize-handle {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 14px;
    height: 14px;
    background: var(--primary, #00a3e0);
    border: 2px solid #fff;
    border-radius: 50%;
    cursor: nwse-resize;
    pointer-events: auto;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .lens-confirm {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #fff;
    background: var(--primary, #00a3e0);
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
  }

  .lens-confirm:hover {
    background: #0090c0;
    transform: scale(1.1);
  }

  /* ── Confirmed inset boxes ── */

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
    background: var(--primary, #00a3e0);
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

  .toolbar-hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 30, 46, 0.9);
    color: #ddd;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 11;
  }

  .toolbar-hint kbd {
    background: #334;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    color: #ddd;
    border: 1px solid #444;
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
`;
