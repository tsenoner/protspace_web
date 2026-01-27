import type { ReactiveController, ReactiveControllerHost } from 'lit';
import Sortable from 'sortablejs';
import type { LegendItem, LegendSortMode } from '../types';
import { LEGEND_VALUES } from '../config';

/**
 * Callback interface for drag events
 */
export interface DragCallbacks {
  getLegendItems: () => LegendItem[];
  setLegendItems: (items: LegendItem[]) => void;
  onReorder: () => void;
  onMergeToOther?: (value: string) => void;
  onSortModeChange?: (mode: LegendSortMode) => void;
}

/**
 * Reactive controller for managing drag and drop functionality using Sortable.js.
 * Provides smooth animations, clear drop indicators, and reliable reordering.
 */
export class DragController implements ReactiveController {
  private callbacks: DragCallbacks;
  private host: ReactiveControllerHost;
  private sortableInstance: Sortable | null = null;

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
   * Initialize Sortable on the legend items container
   */
  initialize(container: HTMLElement): void {
    if (this.sortableInstance) {
      this.destroy();
    }

    this.sortableInstance = new Sortable(container, {
      animation: 200,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      ghostClass: 'legend-item-ghost',
      chosenClass: 'legend-item-chosen',
      dragClass: 'legend-item-drag',
      handle: '.drag-handle',
      forceFallback: false,
      fallbackClass: 'legend-item-fallback',
      fallbackOnBody: false,
      swapThreshold: 0.65,
      direction: 'vertical',

      onEnd: (evt) => {
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;

        // No reordering if indices are the same or invalid
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
          return;
        }

        // Get current legend items
        const legendItems = this.callbacks.getLegendItems();

        // Check if dropping on "Other" - handle merge
        const targetItem = legendItems[newIndex];
        const draggedItem = legendItems[oldIndex];

        if (
          targetItem?.value === LEGEND_VALUES.OTHER &&
          draggedItem?.value !== LEGEND_VALUES.OTHER
        ) {
          // Merge the dragged item to Other
          this.callbacks.onMergeToOther?.(draggedItem.value);

          // Revert the DOM change since we're merging, not reordering
          if (evt.item.parentElement) {
            this.sortableInstance?.option('disabled', true);
            // Force re-render by requesting update on host
            this.host.requestUpdate();
            requestAnimationFrame(() => {
              this.sortableInstance?.option('disabled', false);
            });
          }
          return;
        }

        // Perform reordering
        const newItems = [...legendItems];
        const [movedItem] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, movedItem);

        // Update z-orders
        const reorderedItems = newItems.map((item, idx) => ({
          ...item,
          zOrder: idx,
        }));

        this.callbacks.setLegendItems(reorderedItems);

        // Switch to manual sort mode when user manually reorders
        this.callbacks.onSortModeChange?.('manual');
        this.callbacks.onReorder();
      },
    });
  }

  /**
   * Destroy the Sortable instance
   */
  destroy(): void {
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }
  }

  /**
   * Get the Sortable instance (for testing or advanced use)
   */
  getInstance(): Sortable | null {
    return this.sortableInstance;
  }

  /**
   * Check if an item is currently being dragged (kept for backward compatibility)
   */
  isDragging(_itemIndex: number): boolean {
    // With Sortable.js, we use CSS classes instead
    return false;
  }
}
