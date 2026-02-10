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

export class DragController implements ReactiveController {
  private host: ReactiveControllerHost;
  private callbacks: DragCallbacks;
  private sortableInstance: Sortable | null = null;
  private containerEl: HTMLElement | null = null;

  private preDragChildNodes: Node[] = [];

  constructor(host: ReactiveControllerHost, callbacks: DragCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    host.addController(this);
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

      onStart: (evt) => this.handleDragStart(evt),
      onEnd: (evt) => this.handleDragEnd(evt),
    });
  }

  private handleDragStart(evt: Sortable.SortableEvent): void {
    this.preDragChildNodes = Array.from(evt.from.childNodes);
  }

  private handleDragEnd(evt: Sortable.SortableEvent): void {
    const { oldIndex, newIndex, item } = evt;

    // Validate indices
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
      this.restoreDom(evt.from);
      return;
    }

    // Get the dragged item's value from data attribute
    const draggedValue = item.getAttribute('data-value');
    if (!draggedValue) {
      console.warn('[DragController] Dragged item missing data-value attribute');
      this.restoreDom(evt.from);
      return;
    }

    // Get current legend items sorted by zOrder (visual order)
    const items = this.callbacks.getLegendItems();
    const sortedItems = [...items].sort((a, b) => a.zOrder - b.zOrder);

    // Find the dragged item
    const draggedItem = sortedItems.find((i) => i.value === draggedValue);
    if (!draggedItem) {
      console.warn('[DragController] Could not find dragged item in legend items');
      this.restoreDom(evt.from);
      return;
    }

    // Check if dropping onto "Other" category (merge operation)
    const targetItem = sortedItems[newIndex];
    if (targetItem?.value === LEGEND_VALUES.OTHER && draggedValue !== LEGEND_VALUES.OTHER) {
      // Restore DOM first, then trigger merge
      this.restoreDom(evt.from);
      this.callbacks.onMergeToOther?.(draggedValue);
      return;
    }

    // Prevent dropping below "Other" (Other must stay at bottom)
    const otherIndex = sortedItems.findIndex((i) => i.value === LEGEND_VALUES.OTHER);
    if (otherIndex !== -1 && newIndex >= otherIndex && draggedValue !== LEGEND_VALUES.OTHER) {
      // Restore DOM - can't drop at or after "Other"
      this.restoreDom(evt.from);
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
    const reorderedItems = newOrder.map((reorderedItem, idx) => ({
      ...reorderedItem,
      zOrder: idx,
    }));

    // Restore DOM to pre-drag state so Lit's internal tracking is intact
    this.restoreDom(evt.from);

    // Update state - Lit will re-render with correct order
    this.callbacks.setLegendItems(reorderedItems);
    this.callbacks.onSortModeChange?.('manual');
    this.callbacks.onReorder();
  }

  private restoreDom(container: HTMLElement): void {
    // Temporarily disable Sortable to prevent interference
    if (this.sortableInstance) {
      this.sortableInstance.option('disabled', true);
    }

    // Restore all child nodes (including Lit comment markers) to pre-drag order
    if (this.preDragChildNodes.length > 0) {
      for (const node of this.preDragChildNodes) {
        container.appendChild(node);
      }
      this.preDragChildNodes = [];
    }

    // Force Lit to re-render with correct state
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
    this.preDragChildNodes = [];
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
