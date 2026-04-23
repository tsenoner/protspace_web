import { css } from 'lit';

/**
 * Export Studio Styles
 *
 * Layout-only styles for the export studio modal. Visual primitives
 * (buttons, inputs, overlays) come from shared mixins via style composition.
 *
 * The preview canvas area stays dark (functional: figure contrast).
 * Controls panel uses the standard light design system.
 */
export const exportStudioStyles = css`
  :host {
    display: block;
  }

  /* Override modal-overlay: full-bleed studio, not centered dialog */
  .modal-overlay {
    align-items: normal;
    justify-content: normal;
    backdrop-filter: blur(2px);
    background: rgba(0, 0, 0, 0.6);
  }

  .studio {
    display: flex;
    width: 100%;
    height: 100%;
  }

  /* ── Preview (dark canvas — functional need for figure contrast) ── */

  .preview-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
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
    font-size: var(--text-xs);
    color: #aaa;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.6);
    padding: 2px 8px;
    border-radius: var(--radius);
  }

  /* ── Controls panel (standard light theme) ── */

  .controls-panel {
    width: 280px;
    background: var(--surface);
    border-left: var(--border-width) solid var(--border);
    overflow-y: auto;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .studio-header {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--surface);
    border-bottom: var(--border-width) solid var(--border);
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .studio-header h2 {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .studio-header .btn-close {
    margin-left: auto;
  }

  /* ── Sections ── */

  .control-section {
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: var(--border-width) solid var(--border-light);
  }

  .control-section h3 {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-secondary);
    margin: 0 0 var(--spacing-sm);
  }

  /* ── Presets ── */

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
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--text-sm);
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .preset-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .preset-btn.active {
    background: var(--primary);
    color: var(--text-light);
    border-color: var(--primary);
  }

  /* ── Controls ── */

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .control-value {
    color: var(--primary);
    font-size: var(--text-sm);
  }

  .info-text {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    margin: var(--spacing-xs) 0 0;
    line-height: 1.4;
  }

  /* ── Annotations list ── */

  .annotation-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-2xs) 0;
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .annotation-icon {
    flex-shrink: 0;
  }

  /* ── Inputs (extend inputMixin base) ── */

  .num-input {
    width: 72px;
    text-align: right;
    font-size: var(--text-sm);
  }

  /* ── Download row ── */

  .btn-row {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    margin-top: auto;
    flex-shrink: 0;
  }

  .btn-row .btn-primary {
    flex: 1;
  }
`;
