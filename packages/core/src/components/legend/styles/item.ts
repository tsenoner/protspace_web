import { css } from 'lit';

/**
 * Legend Item Styles
 *
 * Styles for individual legend items including:
 * - Base legend item
 * - Item states (hover, active, hidden, selected, dragging)
 * - Drag handle
 * - Symbol, text, and count
 */
export const itemStyles = css`
  .legend-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px 6px 2px;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--legend-hover-bg);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  .legend-item:hover {
    background: var(--legend-hover-bg);
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
  }

  .legend-item:active {
    background: var(--legend-active-bg);
  }

  .legend-item.hidden {
    opacity: var(--legend-hidden-opacity);
    background: var(--legend-hidden-bg);
  }

  /* Drag-and-drop visual hints - consolidated single definition */
  .legend-item.dragging {
    background: var(--legend-drag-bg);
    transform: scale(1.02);
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.15);
    border: 2px solid var(--accent-purple) !important;
    border-radius: 0.5rem;
    opacity: 0.8;
    z-index: var(--z-modal);
    position: relative;
  }

  .legend-item.selected {
    box-shadow: 0 0 0 2px var(--legend-selected-ring);
  }

  .legend-item:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--legend-selected-ring);
  }

  .legend-item:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--legend-selected-ring);
  }

  .legend-item-content {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    box-sizing: border-box;
  }

  .drag-handle {
    display: flex;
    align-items: center;
    padding: 0.25rem;
    border-radius: 0.25rem;
    cursor: grab;
    color: var(--legend-text-secondary);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .legend-symbol {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mr-2 {
    margin-right: 0.5rem;
  }

  .legend-text {
    font-size: 0.875rem;
    color: var(--legend-text-color);
    width: 100%;
    overflow-wrap: anywhere;
  }

  .legend-item-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .legend-item-actions protspace-color-picker {
    flex-shrink: 0;
  }

  .legend-count {
    font-size: 0.875rem;
    color: var(--legend-text-secondary);
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 0 0 9px;
  }
`;
