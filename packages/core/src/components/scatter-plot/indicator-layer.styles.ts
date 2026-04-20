// packages/core/src/components/scatter-plot/indicator-layer.styles.ts
import { css } from 'lit';

export const indicatorLayerStyles = css`
  :host {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 4;
    overflow: hidden;
  }

  .indicator {
    position: absolute;
    pointer-events: auto;
    cursor: grab;
  }

  .indicator:active {
    cursor: grabbing;
  }

  .arrow-shaft {
    width: 2px;
    height: 32px;
    background: #111;
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
  }

  .arrow-head {
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 9px solid #111;
    position: absolute;
    bottom: -9px;
    left: 50%;
    transform: translateX(-50%);
  }

  .arrow-label {
    position: absolute;
    bottom: 34px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 600;
    color: #111;
    background: rgba(255, 255, 255, 0.9);
    padding: 1px 6px;
    border-radius: 3px;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    cursor: text;
  }

  .arrow-label[contenteditable='true']:focus {
    outline: 2px solid var(--accent-color, #5b8fd9);
    outline-offset: 1px;
  }
`;
