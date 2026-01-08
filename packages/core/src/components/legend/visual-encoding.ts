/**
 * Visual encoding for legend categories.
 * Assigns colors and shapes based on slot index.
 *
 * Key principles:
 * - Visible items always get the most distinct colors (slots 0, 1, 2, ...)
 * - Items in "Other" bucket don't consume slots
 * - Special categories (Others, N/A) have fixed colors and always use circles
 * - Slot recycling ensures extracted items get available slots
 */

import { COLOR_SCHEMES, NA_GRAY, OTHER_GRAY } from '@protspace/utils';

const KELLYS_COLORS = COLOR_SCHEMES.kellys;
const SHAPES = ['circle', 'square', 'diamond', 'plus', 'triangle-up', 'triangle-down'] as const;

/** Special slot values for reserved categories */
export const SPECIAL_SLOTS = {
  OTHERS: -1,
  NA: -2,
} as const;

/** Special colors for reserved categories */
const SPECIAL_COLORS: Record<string, string> = {
  Others: OTHER_GRAY,
  'N/A': NA_GRAY,
};

export interface VisualEncoding {
  color: string;
  shape: string;
}

/**
 * Get visual encoding for a category based on its slot.
 */
export function getVisualEncoding(
  slot: number,
  shapesEnabled: boolean,
  categoryName?: string,
): VisualEncoding {
  // Special categories get fixed colors and always circle shape
  if (categoryName && categoryName in SPECIAL_COLORS) {
    return {
      color: SPECIAL_COLORS[categoryName],
      shape: 'circle',
    };
  }

  // Handle negative slots (special categories) - shouldn't normally reach here
  if (slot < 0) {
    return {
      color: OTHER_GRAY,
      shape: 'circle',
    };
  }

  // Regular categories: cycle through colors and optionally shapes
  const color = KELLYS_COLORS[slot % KELLYS_COLORS.length];
  const shape = shapesEnabled ? SHAPES[slot % SHAPES.length] : 'circle';

  return { color, shape };
}

/**
 * Slot manager with recycling support.
 *
 * Ensures visible items get the most distinct colors by:
 * 1. Assigning slots 0, 1, 2, ... to visible items in order
 * 2. Tracking freed slots when items move to Others
 * 3. Reusing lowest freed slot for newly visible/extracted items
 */
export class SlotTracker {
  /** Map from category name to assigned slot */
  private slots = new Map<string, number>();
  /** Pool of freed slots available for reuse (kept sorted ascending) */
  private freedSlots: number[] = [];
  /** Next slot to assign if no freed slots available */
  private nextSlot = 0;

  /**
   * Get or assign a slot for a category.
   * - Special categories (Others, N/A) get reserved negative slots
   * - Regular categories get the lowest available slot
   */
  getSlot(categoryName: string): number {
    // Special categories get fixed slots
    if (categoryName === 'Others') {
      return SPECIAL_SLOTS.OTHERS;
    }
    if (categoryName === 'N/A') {
      return SPECIAL_SLOTS.NA;
    }

    // Return existing slot if already assigned
    if (this.slots.has(categoryName)) {
      return this.slots.get(categoryName)!;
    }

    // Assign new slot: prefer recycled slots, otherwise use next available
    let slot: number;
    if (this.freedSlots.length > 0) {
      slot = this.freedSlots.shift()!; // Take lowest freed slot
    } else {
      slot = this.nextSlot++;
    }

    this.slots.set(categoryName, slot);
    return slot;
  }

  /**
   * Free a slot when a category moves to Others.
   * The slot will be recycled for future use.
   */
  freeSlot(categoryName: string): void {
    if (categoryName === 'Others' || categoryName === 'N/A') {
      return; // Special categories don't have freeable slots
    }

    const slot = this.slots.get(categoryName);
    if (slot !== undefined) {
      this.slots.delete(categoryName);
      // Insert into freed slots maintaining sorted order
      const insertIdx = this.freedSlots.findIndex((s) => s > slot);
      if (insertIdx === -1) {
        this.freedSlots.push(slot);
      } else {
        this.freedSlots.splice(insertIdx, 0, slot);
      }
    }
  }

  /**
   * Bulk update: reassign slots to match the given visible items order.
   * This ensures visible items always have slots 0, 1, 2, ... in display order.
   *
   * @param visibleCategories - Category names in their display order (most frequent first)
   */
  reassignSlots(visibleCategories: string[]): void {
    // Track which slots are being used
    const oldSlots = new Map(this.slots);
    const newSlots = new Map<string, number>();

    // Assign slots 0, 1, 2, ... to visible items in order
    visibleCategories.forEach((category, index) => {
      if (category !== 'Others' && category !== 'N/A' && category !== 'Other') {
        newSlots.set(category, index);
      }
    });

    // Find slots that were freed (categories that are no longer visible)
    const freedFromOld: number[] = [];
    for (const [category, slot] of oldSlots) {
      if (!newSlots.has(category)) {
        freedFromOld.push(slot);
      }
    }

    // Update state
    this.slots = newSlots;
    this.nextSlot = visibleCategories.filter(
      (c) => c !== 'Others' && c !== 'N/A' && c !== 'Other',
    ).length;

    // Freed slots are those beyond the visible count
    this.freedSlots = freedFromOld.filter((s) => s >= this.nextSlot).sort((a, b) => a - b);
  }

  /**
   * Reset the tracker completely.
   */
  reset(): void {
    this.slots.clear();
    this.freedSlots = [];
    this.nextSlot = 0;
  }

  /**
   * Check if the tracker is empty (no slots assigned).
   */
  isEmpty(): boolean {
    return this.slots.size === 0;
  }
}
