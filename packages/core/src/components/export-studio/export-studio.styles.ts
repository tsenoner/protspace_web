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
    z-index: 1;
    width: calc(100% - 60px);
    height: calc(100% - 60px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dim-badge {
    position: absolute;
    bottom: -4px;
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
    display: flex;
    flex-direction: column;
  }

  .studio-header {
    padding: 12px 16px;
    background: var(--surface-elevated, #16213e);
    border-bottom: 1px solid var(--border-color, #333);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
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

  .preset-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .mode-grid {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
  }

  .mode-grid .preset-btn {
    flex: 1;
    text-align: center;
  }

  .preset-btn {
    padding: 5px 8px;
    font-size: 10px;
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    background: var(--surface-hover, #2a2a4a);
    color: var(--text-secondary, #aab);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .preset-btn:hover {
    background: var(--surface-active, #3a3a5a);
    color: var(--text-primary, #fff);
  }

  .preset-btn.active {
    background: var(--accent-color, #5b8fd9);
    color: #fff;
    border-color: var(--accent-color, #5b8fd9);
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-secondary, #aab);
    margin-bottom: 6px;
  }

  .control-label {
    color: var(--text-secondary, #aab);
    font-size: 11px;
  }

  .control-value {
    color: var(--accent-color, #5b8fd9);
    font-size: 11px;
  }

  .info-text {
    font-size: 10px;
    color: var(--text-disabled, #667);
    margin: 6px 0 0;
    line-height: 1.4;
  }

  .annotation-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 11px;
    color: var(--text-primary, #ddd);
  }

  .annotation-icon {
    flex-shrink: 0;
  }

  .num-input {
    width: 72px;
    padding: 4px 6px;
    font-size: 11px;
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    background: var(--surface-base, #111);
    color: var(--text-primary, #fff);
    text-align: right;
  }

  .num-input:focus {
    outline: none;
    border-color: var(--accent-color, #5b8fd9);
  }

  .select-input {
    padding: 4px 6px;
    font-size: 11px;
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    background: var(--surface-base, #111);
    color: var(--text-primary, #fff);
    cursor: pointer;
  }

  .select-input:focus {
    outline: none;
    border-color: var(--accent-color, #5b8fd9);
  }

  .btn-row {
    display: flex;
    gap: 8px;
    padding: 14px 16px;
    margin-top: auto;
    flex-shrink: 0;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent-color, #5b8fd9);
    color: #fff;
    flex: 1;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--surface-hover, #2a2a4a);
    color: var(--text-secondary, #aab);
    border: 1px solid var(--border-color, #444);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-active, #3a3a5a);
  }
`;
