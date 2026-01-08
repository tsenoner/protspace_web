import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LegendItem } from '../types';
import { LEGEND_DEFAULTS, LEGEND_VALUES } from '../config';

/**
 * Callback interface for drag events
 */
export interface DragCallbacks {
  getLegendItems: () => LegendItem[];
  setLegendItems: (items: LegendItem[]) => void;
  getManualOtherValues: () => string[];
  setManualOtherValues: (values: string[]) => void;
  onReorder: () => void;
  onMergeToOther: (value: string) => void;
  updateLegendItems: () => void;
}

/**
 * Reactive controller for managing drag and drop functionality.
 * Handles reordering legend items and merging items into the "Other" bucket.
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

    if (targetItem.value === LEGEND_VALUES.OTHER && this._draggedItemIndex !== -1) {
      const legendItems = this.callbacks.getLegendItems();
      const draggedItem = legendItems[this._draggedItemIndex];

      if (draggedItem) {
        if (draggedItem.extractedFromOther && draggedItem.value) {
          this._mergeExtractedBackToOther(draggedItem.value);
        } else if (draggedItem.value && draggedItem.value !== LEGEND_VALUES.OTHER) {
          this._mergeToOther(draggedItem.value);
        }
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
    this.callbacks.onReorder();
  }

  private _mergeExtractedBackToOther(value: string): void {
    const legendItems = this.callbacks.getLegendItems();
    const filteredItems = legendItems.filter((i) => i.value !== value);
    this.callbacks.setLegendItems(filteredItems);
    this.callbacks.updateLegendItems();
    this.callbacks.onMergeToOther(value);
  }

  private _mergeToOther(value: string): void {
    const manualOtherValues = this.callbacks.getManualOtherValues();
    if (!manualOtherValues.includes(value)) {
      this.callbacks.setManualOtherValues([...manualOtherValues, value]);
    }
    this.callbacks.updateLegendItems();
    this.callbacks.onMergeToOther(value);
  }

  private _clearTimeout(): void {
    if (this._dragTimeout) {
      clearTimeout(this._dragTimeout);
      this._dragTimeout = null;
    }
  }
}
