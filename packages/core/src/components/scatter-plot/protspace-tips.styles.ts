import { css } from 'lit';

export const protspaceTipsStyles = css`
  :host {
    position: absolute;
    top: 0.5rem;
    left: 3rem;
    z-index: 10;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: var(--protspace-tooltip-bg, rgba(255, 255, 255, 0.95));
    border: 1px solid var(--protspace-tooltip-border, #d9e2ec);
    border-radius: 0.375rem;
    cursor: pointer;
    box-shadow: var(--protspace-tooltip-shadow, 0 6px 16px rgba(0, 0, 0, 0.08));
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .trigger:hover {
    background: rgba(255, 255, 255, 1);
    border-color: var(--protspace-highlight-color, #00a3e0);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    transform: scale(1.05);
  }

  .trigger:focus-visible {
    outline: 2px solid rgba(0, 163, 224, 0.3);
    outline-offset: 2px;
  }

  .trigger.active {
    background: rgba(255, 255, 255, 1);
    border-color: var(--protspace-highlight-color, #00a3e0);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    transform: scale(1.05);
  }

  .trigger .icon {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
    color: #475569;
    transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .trigger:hover .icon,
  .trigger:focus-visible .icon {
    color: var(--protspace-highlight-color, #00a3e0);
  }

  .content {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    min-width: 18rem;
    max-width: min(24rem, calc(100vw - 2rem));
    background: var(--protspace-tooltip-bg, rgba(255, 255, 255, 0.95));
    border: 1px solid var(--protspace-tooltip-border, #d9e2ec);
    border-radius: 0.5rem;
    box-shadow:
      var(--protspace-tooltip-shadow, 0 6px 16px rgba(0, 0, 0, 0.08)),
      0 10px 40px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-0.25rem);
    transition:
      opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0.2s;
    z-index: 1000;
  }

  .content.visible {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  /* Fallback hover support for mouse users */
  :host(:hover) .content {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  /* Responsive design for mobile */
  @media (max-width: 640px) {
    :host {
      left: 0.5rem;
      top: 0.5rem;
    }

    .content {
      left: -0.5rem;
      min-width: calc(100vw - 1rem);
      max-width: calc(100vw - 1rem);
    }
  }

  .header {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #334155;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 0.5rem 0.5rem 0 0;
  }

  .tips-section {
    padding: 1rem;
  }

  .tips-group {
    margin-bottom: 1.5rem;
  }

  .tips-group:last-child {
    margin-bottom: 0;
  }

  .tips-group-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tips-group-title::before {
    content: '💡';
    font-size: 0.75rem;
  }

  .tips-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tips-list li {
    font-size: 0.75rem;
    color: #64748b;
    line-height: 1.5;
    margin-bottom: 0.375rem;
    padding-left: 0.75rem;
    position: relative;
  }

  .tips-list li:last-child {
    margin-bottom: 0;
  }

  .tips-list li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: var(--protspace-highlight-color, #00a3e0);
    font-weight: bold;
  }

  kbd {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: #475569;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  }
`;
