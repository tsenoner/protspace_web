import { css } from 'lit';

export const proteinTooltipStyles = css`
  :host {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 20;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.2s ease,
      visibility 0.2s ease;
  }

  :host(.visible) {
    opacity: 1;
    visibility: visible;
  }

  .tooltip {
    background: var(--protspace-tooltip-bg, rgba(255, 255, 255, 0.95));
    border: 1px solid var(--protspace-tooltip-border, #d9e2ec);
    border-radius: 0.5rem;
    box-shadow:
      var(--protspace-tooltip-shadow, 0 6px 16px rgba(0, 0, 0, 0.08)),
      0 10px 40px rgba(0, 0, 0, 0.1);
    font-size: 0.875rem;
    min-width: 180px;
    max-width: 280px;
    word-wrap: break-word;
    overflow: hidden;
  }

  .tooltip-header {
    padding: 0.625rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #334155;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .tooltip-content {
    padding: 0.75rem;
  }

  .tooltip-protein-id {
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
  }

  .tooltip-gene-name {
    font-weight: normal;
    color: #64748b;
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
    display: flex;
    gap: 0.25rem;
  }

  .tooltip-protein-name {
    font-weight: normal;
    color: #64748b;
    font-size: 0.8125rem;
    line-height: 1.4;
    margin-bottom: 0.125rem;
    display: flex;
    gap: 0.25rem;
  }

  .tooltip-content .label {
    color: #334155;
    font-weight: 500;
    flex-shrink: 0;
  }

  .tooltip-annotations {
    border-top: 1px solid #f1f5f9;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tooltip-annotation {
    font-size: 0.75rem;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
`;
