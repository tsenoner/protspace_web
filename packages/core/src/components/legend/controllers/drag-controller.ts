import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LegendItem, LegendSortMode } from '../types';
import { LEGEND_DEFAULTS, LEGEND_VALUES } from '../config';

/**
 * Callback interface for drag events
 */
export interface DragCallbacks {
  getLegendItems: () => LegendItem[];
  setLegendItems: (items: LegendItem[]) => void;
  onReorder: () => void;
  onMergeToOther?: (value: string | null) => void;
  onSortModeChange?: (mode: LegendSortMode) => void;
}

/**
 * Reactive controller for managing drag and drop functionality.
 * Handles reordering legend items.
 */
export class DragController implements ReactiveController {
  private callbacks: DragCallbacks;

  private _draggedItemIndex: number = -1;
  private _dragTimeout: number | null = null;

  constructor(host: ReactiveControllerHost, callbacks: DragCallbacks) {
    this.callbacks = callbacks;
    host.addController(this);
  }

  hostConnected(): void {
    // No initialization needed
  }

  hostDisconnected(): void {
    this._clearTimeout();
  }

  /**
   * Get the currently dragged item index
   */
  get draggedItemIndex(): number {
    return this._draggedItemIndex;
  }

  /**
   * Check if an item is currently being dragged
   */
  isDragging(itemIndex: number): boolean {
    return this._draggedItemIndex === itemIndex && this._draggedItemIndex !== -1;
  }

  /**
   * Handle drag start
   */
  handleDragStart(item: LegendItem): void {
    const legendItems = this.callbacks.getLegendItems();
    const index = legendItems.findIndex((i) => i.value === item.value);
    this._draggedItemIndex = index !== -1 ? index : -1;
    this._clearTimeout();
  }

  /**
   * Handle drag over another item
   */
  handleDragOver(event: DragEvent, targetItem: LegendItem): void {
    event.preventDefault();

    if (this._draggedItemIndex === -1) return;

    const legendItems = this.callbacks.getLegendItems();
    const targetIndex = legendItems.findIndex((i) => i.value === targetItem.value);
    if (this._draggedItemIndex === targetIndex) return;

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    this._clearTimeout();
    this._dragTimeout = window.setTimeout(() => {
      this._performReorder(targetItem);
    }, LEGEND_DEFAULTS.dragTimeout);
  }

  /**
   * Handle drop on a target item
   */
  handleDrop(event: DragEvent, targetItem: LegendItem): void {
    event.preventDefault();

    // If dropping on "Other", merge the dragged item into Other
    if (targetItem.value === LEGEND_VALUES.OTHER && this._draggedItemIndex !== -1) {
      const legendItems = this.callbacks.getLegendItems();
      const draggedItem = legendItems[this._draggedItemIndex];
      // Allow merging any item except "Other" itself (including null/N/A)
      if (draggedItem && draggedItem.value !== LEGEND_VALUES.OTHER) {
        this.callbacks.onMergeToOther?.(draggedItem.value);
      }
    }

    this.handleDragEnd();
  }

  /**
   * Handle drag end
   */
  handleDragEnd(): void {
    this._draggedItemIndex = -1;
    this._clearTimeout();
  }

  private _performReorder(targetItem: LegendItem): void {
    const legendItems = this.callbacks.getLegendItems();
    const targetIdx = legendItems.findIndex((i) => i.value === targetItem.value);

    if (this._draggedItemIndex === -1 || targetIdx === -1) return;

    // Don't reorder onto "Other" - that's handled by handleDrop for merge
    if (targetItem.value === LEGEND_VALUES.OTHER) return;

    const newItems = [...legendItems];
    const [movedItem] = newItems.splice(this._draggedItemIndex, 1);

    const adjustedTargetIdx = targetIdx > this._draggedItemIndex ? targetIdx - 1 : targetIdx;
    newItems.splice(adjustedTargetIdx, 0, movedItem);

    const reorderedItems = newItems.map((item, idx) => ({
      ...item,
      zOrder: idx,
    }));

    this.callbacks.setLegendItems(reorderedItems);
    this._draggedItemIndex = adjustedTargetIdx;

    // Switch to manual sort mode when user manually reorders
    this.callbacks.onSortModeChange?.('manual');
    this.callbacks.onReorder();
  }

  private _clearTimeout(): void {
    if (this._dragTimeout) {
      clearTimeout(this._dragTimeout);
      this._dragTimeout = null;
    }
  }
}
