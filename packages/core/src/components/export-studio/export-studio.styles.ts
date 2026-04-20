import { css } from 'lit';

export const exportStudioStyles = css`
  :host {
    display: block;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
    display: flex;
    backdrop-filter: blur(2px);
  }

  .studio {
    display: flex;
    width: 100%;
    height: 100%;
  }

  .preview-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-base, #111);
    position: relative;
    overflow: hidden;
  }

  .checkerboard {
    position: absolute;
    inset: 0;
    opacity: 0.03;
    background-image: repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%);
    background-size: 20px 20px;
    pointer-events: none;
  }

  .figure-frame {
    position: relative;
    background: #fff;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }

  .dim-badge {
    position: absolute;
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: #aaa;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.6);
    padding: 2px 8px;
    border-radius: 3px;
  }

  .controls-panel {
    width: 280px;
    background: var(--surface-elevated, #16213e);
    border-left: 1px solid var(--border-color, #333);
    overflow-y: auto;
    flex-shrink: 0;
  }

  .studio-header {
    padding: 12px 16px;
    background: var(--surface-elevated, #16213e);
    border-bottom: 1px solid var(--border-color, #333);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .studio-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    margin: 0;
  }

  .studio-header .close-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    font-size: 18px;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .studio-header .close-btn:hover {
    background: var(--surface-hover, #2a3a5a);
    color: var(--text-primary, #fff);
  }

  .control-section {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-subtle, #2a2a4a);
  }

  .control-section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-secondary, #8899aa);
    margin: 0 0 10px;
  }

  .btn-row {
    display: flex;
    gap: 8px;
    padding: 14px 16px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-primary {
    background: var(--accent-color, #5b8fd9);
    color: #fff;
    flex: 1;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--surface-hover, #2a2a4a);
    color: var(--text-secondary, #aab);
    border: 1px solid var(--border-color, #444);
  }

  .btn-secondary:hover {
    background: var(--surface-active, #3a3a5a);
  }
`;
