import type { ReactiveController, ReactiveControllerHost } from 'lit';
import Sortable from 'sortablejs';
import type { LegendItem, LegendSortMode } from '../types';
import { LEGEND_VALUES } from '../config';

/**
 * Callback interface for drag events
 */
export interface DragCallbacks {
  /** Returns all legend items (will be sorted by zOrder internally) */
  getLegendItems: () => LegendItem[];
  /** Updates legend items with new z-orders */
  setLegendItems: (items: LegendItem[]) => void;
  /** Called after successful reorder */
  onReorder: () => void;
  /** Called when an item is dropped onto "Other" */
  onMergeToOther?: (value: string) => void;
  /** Called to switch to manual sort mode */
  onSortModeChange?: (mode: LegendSortMode) => void;
}

/**
 * Reactive controller for managing drag and drop functionality using Sortable.js.
 *
 * Key design principles:
 * 1. Use data-value attributes to identify items (not indices)
 * 2. Revert DOM changes immediately after drag ends (let Lit handle rendering)
 * 3. Update state based on the user's intent, then trigger re-render
 */
export class DragController implements ReactiveController {
  private host: ReactiveControllerHost;
  private callbacks: DragCallbacks;
  private sortableInstance: Sortable | null = null;
  private containerEl: HTMLElement | null = null;

  constructor(host: ReactiveControllerHost, callbacks: DragCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    host.addController(this);
  }

  hostConnected(): void {
    // Sortable will be initialized when the container is ready
  }

  hostDisconnected(): void {
    this.destroy();
  }

  /**
   * Initialize Sortable on the legend items container.
   * Should be called once when the container element is available.
   */
  initialize(container: HTMLElement): void {
    // Don't reinitialize on the same container
    if (this.sortableInstance && this.containerEl === container) {
      return;
    }

    // Destroy previous instance if exists
    if (this.sortableInstance) {
      this.destroy();
    }

    this.containerEl = container;

    this.sortableInstance = new Sortable(container, {
      animation: 200,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      ghostClass: 'legend-item-ghost',
      chosenClass: 'legend-item-chosen',
      dragClass: 'legend-item-drag',
      handle: '.drag-handle',
      swapThreshold: 0.65,
      direction: 'vertical',

      // Prevent dragging the "Other" item (always stays at bottom)
      filter: '.legend-item-other',
      preventOnFilter: true,

      onEnd: (evt) => this.handleDragEnd(evt),
    });
  }

  /**
   * Handle the end of a drag operation.
   * This is where we capture the user's intent and update the state.
   */
  private handleDragEnd(evt: Sortable.SortableEvent): void {
    const { oldIndex, newIndex, item } = evt;

    // Validate indices
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
      return;
    }

    // Get the dragged item's value from data attribute
    const draggedValue = item.getAttribute('data-value');
    if (!draggedValue) {
      console.warn('[DragController] Dragged item missing data-value attribute');
      return;
    }

    // Get current legend items sorted by zOrder (visual order)
    const items = this.callbacks.getLegendItems();
    const sortedItems = [...items].sort((a, b) => a.zOrder - b.zOrder);

    // Find the dragged item
    const draggedItem = sortedItems.find((i) => i.value === draggedValue);
    if (!draggedItem) {
      console.warn('[DragController] Could not find dragged item in legend items');
      this.revertDomChange();
      return;
    }

    // Check if dropping onto "Other" category (merge operation)
    const targetItem = sortedItems[newIndex];
    if (targetItem?.value === LEGEND_VALUES.OTHER && draggedValue !== LEGEND_VALUES.OTHER) {
      // Revert DOM first, then trigger merge
      this.revertDomChange();
      this.callbacks.onMergeToOther?.(draggedValue);
      return;
    }

    // Prevent dropping below "Other" (Other must stay at bottom)
    const otherIndex = sortedItems.findIndex((i) => i.value === LEGEND_VALUES.OTHER);
    if (otherIndex !== -1 && newIndex >= otherIndex && draggedValue !== LEGEND_VALUES.OTHER) {
      // Revert DOM - can't drop at or after "Other"
      this.revertDomChange();
      return;
    }

    // Build new order: remove dragged item, insert at new position
    const itemsWithoutDragged = sortedItems.filter((i) => i.value !== draggedValue);
    const newOrder = [
      ...itemsWithoutDragged.slice(0, newIndex),
      draggedItem,
      ...itemsWithoutDragged.slice(newIndex),
    ];

    // Assign new z-orders based on position
    const reorderedItems = newOrder.map((item, idx) => ({
      ...item,
      zOrder: idx,
    }));

    // Revert DOM change - Lit will re-render with correct order
    this.revertDomChange();

    // Update state
    this.callbacks.setLegendItems(reorderedItems);
    this.callbacks.onSortModeChange?.('manual');
    this.callbacks.onReorder();
  }

  /**
   * Revert Sortable's DOM manipulation by forcing a re-render.
   * Sortable moves DOM elements directly, but we want Lit to control the DOM.
   */
  private revertDomChange(): void {
    // Temporarily disable Sortable to prevent interference
    if (this.sortableInstance) {
      this.sortableInstance.option('disabled', true);
    }

    // Force Lit to re-render and restore correct DOM order
    this.host.requestUpdate();

    // Re-enable Sortable after render
    requestAnimationFrame(() => {
      if (this.sortableInstance) {
        this.sortableInstance.option('disabled', false);
      }
    });
  }

  /**
   * Destroy the Sortable instance and clean up
   */
  destroy(): void {
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }
    this.containerEl = null;
  }

  /**
   * Get the Sortable instance (for testing)
   */
  getInstance(): Sortable | null {
    return this.sortableInstance;
  }

  /**
   * Check if controller is initialized
   */
  isInitialized(): boolean {
    return this.sortableInstance !== null;
  }
}
