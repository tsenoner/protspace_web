import type { LegendItem, OtherItem, LegendSortMode, PersistedCategoryData } from './types';
import { getVisualEncoding, SlotTracker } from './visual-encoding';
import { LEGEND_VALUES } from './config';

/**
 * Context object for legend data processing.
 * Each legend component should have its own context to avoid state conflicts.
 */
export interface LegendProcessorContext {
  slotTracker: SlotTracker;
  currentAnnotation: string | null;
}

/**
 * Creates a new processor context for a legend instance.
 * Each legend component should create its own context.
 */
export function createProcessorContext(): LegendProcessorContext {
  return {
    slotTracker: new SlotTracker(),
    currentAnnotation: null,
  };
}

/**
 * Processes legend data with slot-based visual encoding.
 *
 * Slot assignment:
 * - Initial: slots 0, 1, 2, ... assigned by frequency (most frequent = slot 0)
 * - Subsequent: existing slots persist; only freed when items move to "Other"
 * - Extracted items reuse freed slots or get the next available
 *
 * Note: All methods that need slot tracking now require a context parameter
 * to support multiple legend instances on the same page.
 */
export class LegendDataProcessor {
  private static resetIfAnnotationChanged(
    ctx: LegendProcessorContext,
    annotationName: string,
  ): void {
    if (ctx.currentAnnotation !== annotationName) {
      ctx.slotTracker.reset();
      ctx.currentAnnotation = annotationName;
    }
  }

  static getFilteredIndices(
    isolationMode: boolean,
    isolationHistory: string[][],
    proteinIds: string[],
  ): Set<number> {
    const filtered = new Set<number>();
    if (!isolationMode || !isolationHistory?.length || !proteinIds) return filtered;

    proteinIds.forEach((id, index) => {
      const isIncluded = isolationHistory.every((history) => history.includes(id));
      if (isIncluded) filtered.add(index);
    });

    return filtered;
  }

  static countAnnotationFrequencies(
    annotationValues: (string | null)[],
    isolationMode: boolean,
    isolationHistory: string[][],
    filteredIndices: Set<number>,
  ): Map<string | null, number> {
    const freq = new Map<string | null, number>();

    if (isolationMode && isolationHistory?.length) {
      annotationValues.forEach((value, index) => {
        if (filteredIndices.has(index)) {
          freq.set(value, (freq.get(value) || 0) + 1);
        }
      });
    } else {
      annotationValues.forEach((value) => {
        freq.set(value, (freq.get(value) || 0) + 1);
      });
    }

    return freq;
  }

  static sortAndLimitItems(
    frequencyMap: Map<string | null, number>,
    maxVisibleValues: number,
    isolationMode: boolean,
    sortMode: LegendSortMode,
    existingZOrders: Map<string | null, number> = new Map(),
    visibleValues: Set<string> = new Set(),
    pendingExtract?: string,
    pendingMerge?: string,
  ): {
    topItems: Array<[string | null, number]>;
    otherItems: OtherItem[];
    otherCount: number;
  } {
    const getFirstNumber = (val: string | null): number | null => {
      if (val === null) return null;
      const match = String(val).match(/-?\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : null;
    };

    const getPatternRank = (val: string | null): number => {
      if (val === null) return 99;
      const s = String(val).trim();
      if (/^[<>]/.test(s)) return 0; // e.g., ">50" or "<50" should come first
      if (/^\d+\s*-\s*\d+/.test(s)) return 1; // range like "50-100"
      if (/^\d+\s*\+/.test(s)) return 2; // plus like "2000+"
      return 3; // anything else
    };

    const sortFn = (a: [string | null, number], b: [string | null, number]) => {
      if (sortMode === 'manual' || sortMode === 'manual-reverse') {
        // In manual mode, sort by existing zOrder
        const aOrder = existingZOrders.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = existingZOrders.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        return sortMode === 'manual' ? aOrder - bOrder : bOrder - aOrder;
      } else if (sortMode === 'alpha-asc' || sortMode === 'alpha-desc') {
        const isAsc = sortMode === 'alpha-asc';
        const an = getFirstNumber(a[0]);
        const bn = getFirstNumber(b[0]);

        // If both have numbers, compare numerically
        if (an !== null && bn !== null && an !== bn) {
          return isAsc ? an - bn : bn - an;
        }

        // If only one has a number, number comes first in asc, last in desc
        if (an !== null && bn === null) return isAsc ? -1 : 1;
        if (an === null && bn !== null) return isAsc ? 1 : -1;

        // Both have same number or no number - check pattern rank
        const ar = getPatternRank(a[0]);
        const br = getPatternRank(b[0]);
        if (ar !== br) return isAsc ? ar - br : br - ar;

        // Finally, compare alphabetically (case-insensitive)
        const aStr = String(a[0] ?? '').toLowerCase();
        const bStr = String(b[0] ?? '').toLowerCase();
        if (aStr !== bStr) {
          return isAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        }

        // Ultimate tie-breaker: size descending
        return (b[1] ?? 0) - (a[1] ?? 0);
      } else if (sortMode === 'size-asc') {
        return a[1] - b[1];
      }
      return b[1] - a[1]; // 'size-desc' default
    };

    const entries = Array.from(frequencyMap.entries());

    // Build working set of visible values, applying pending extract/merge
    const workingVisible = new Set(visibleValues);
    if (pendingExtract) {
      workingVisible.add(pendingExtract);
    }
    if (pendingMerge) {
      workingVisible.delete(pendingMerge);
    }

    let topItems: Array<[string | null, number]>;

    // If we have existing visible items (from persisted state or current session),
    // filter to those items first, then apply maxVisibleValues limit
    if (workingVisible.size > 0) {
      // Get entries for visible items only (plus null if present)
      const visibleEntries = entries.filter(
        ([v]) => v === null || (typeof v === 'string' && workingVisible.has(v)),
      );

      // Sort visible entries by sort mode and apply maxVisibleValues limit
      const sorted = [...visibleEntries].sort(sortFn);
      topItems = sorted.slice(0, maxVisibleValues);
    } else {
      // Initial load (no persisted state): sort all and take top N based on maxVisibleValues
      const sorted = [...entries].sort(sortFn);
      topItems = (isolationMode ? sorted.filter(([v]) => frequencyMap.has(v)) : sorted).slice(
        0,
        maxVisibleValues,
      );
    }

    // Items beyond the cap go to "Other"
    const topValuesSet = new Set(topItems.map(([v]) => v));
    const beyondCap = entries.filter(([v]) => v !== null && !topValuesSet.has(v));

    return {
      topItems,
      otherItems: beyondCap.map(([value, count]) => ({ value, count })),
      otherCount: beyondCap.reduce((sum, [, count]) => sum + count, 0),
    };
  }

  static createLegendItems(
    ctx: LegendProcessorContext,
    topItems: Array<[string | null, number]>,
    otherCount: number,
    isolationMode: boolean,
    existingLegendItems: LegendItem[],
    shapesEnabled: boolean,
    sortMode: LegendSortMode = 'size-desc',
    passedZOrders: Map<string | null, number> = new Map(),
    persistedCategories: Record<string, PersistedCategoryData> = {},
  ): LegendItem[] {
    // Use passed zOrders if available, otherwise extract from existingLegendItems
    // This allows both processLegendItems (which builds a combined map) and direct calls to work
    let existingZOrders: Map<string | null, number>;
    let existingOtherZOrder: number | null = null;

    if (passedZOrders.size > 0) {
      existingZOrders = passedZOrders;
      const existingOther = existingLegendItems.find((i) => i.value === LEGEND_VALUES.OTHER);
      existingOtherZOrder = existingOther?.zOrder ?? null;
    } else {
      existingZOrders = new Map();
      existingLegendItems.forEach((item) => {
        if (item.value === LEGEND_VALUES.OTHER) {
          existingOtherZOrder = item.zOrder;
        } else {
          existingZOrders.set(item.value, item.zOrder);
        }
      });
    }

    // Build a map of existing colors/shapes from existingLegendItems
    // This preserves colors/shapes that were set during the session
    const existingColors = new Map<string | null, { color: string; shape: string }>();
    existingLegendItems.forEach((item) => {
      if (item.value !== LEGEND_VALUES.OTHER) {
        existingColors.set(item.value, { color: item.color, shape: item.shape });
      }
    });

    // Get current visible category names
    const visibleCategoryNames = topItems.map(([value]) =>
      value === null ? LEGEND_VALUES.NA_DISPLAY : value,
    );

    if (ctx.slotTracker.isEmpty()) {
      // Initial: assign slots by frequency order
      ctx.slotTracker.reassignSlots(visibleCategoryNames);
    } else {
      // Subsequent: preserve slots, only free those that moved to Others
      const currentVisibleSet = new Set(visibleCategoryNames);
      const previousVisible = existingLegendItems
        .filter((i) => i.value !== LEGEND_VALUES.OTHER)
        .map((i) => (i.value === null ? LEGEND_VALUES.NA_DISPLAY : i.value));

      for (const category of previousVisible) {
        if (!currentVisibleSet.has(category)) {
          ctx.slotTracker.freeSlot(category);
        }
      }
    }

    // In 'manual' mode (not 'manual-reverse'), when extracting new items, shift existing zOrders to make room
    // Only apply when zOrders are consecutive (0, 1, 2, ...) - typical during normal operation
    if (sortMode === 'manual' && existingZOrders.size > 0) {
      const existingZOrderValues = Array.from(existingZOrders.values()).sort((a, b) => a - b);
      const isConsecutive =
        existingZOrderValues[0] === 0 && existingZOrderValues.every((v, i) => v === i);

      if (isConsecutive) {
        // Find newly extracted items (items without existing zOrder)
        const newItems: Array<{ value: string | null; targetIndex: number }> = [];
        topItems.forEach(([value], index) => {
          if (!existingZOrders.has(value)) {
            newItems.push({ value, targetIndex: index });
          }
        });

        // For each new item, shift existing zOrders (including Others) that are >= target position
        // Process in reverse order to avoid double-shifting
        newItems.sort((a, b) => b.targetIndex - a.targetIndex);
        for (const newItem of newItems) {
          existingZOrders.forEach((zOrder, key) => {
            if (zOrder >= newItem.targetIndex) {
              existingZOrders.set(key, zOrder + 1);
            }
          });
          // Also shift "Other" zOrder if needed
          if (existingOtherZOrder !== null && existingOtherZOrder >= newItem.targetIndex) {
            existingOtherZOrder = existingOtherZOrder + 1;
          }
        }
      }
    }

    const items: LegendItem[] = topItems.map(([value, count], index) => {
      const categoryName = value === null ? LEGEND_VALUES.NA_DISPLAY : value;
      // In 'manual' mode, preserve existing zOrders
      // In 'manual-reverse' mode, use the sorted index (items are already sorted in reverse)
      // In other modes, use sorted index
      const zOrder = sortMode === 'manual' ? (existingZOrders.get(value) ?? index) : index;
      const slot = ctx.slotTracker.getSlot(categoryName);

      // Get encoding from slot as default
      let encoding = getVisualEncoding(slot, shapesEnabled, categoryName);

      // Priority for colors/shapes:
      // 1. persistedCategories (from localStorage) - for initial load/annotation switch
      // 2. existingColors (from current _legendItems) - for preserving session state
      // 3. default encoding from slot
      const persisted = value !== null ? persistedCategories[value] : undefined;
      const existing = existingColors.get(value);

      if (persisted?.color) {
        encoding = { color: persisted.color, shape: persisted.shape || encoding.shape };
      } else if (existing) {
        encoding = { color: existing.color, shape: existing.shape };
      }

      return {
        value,
        color: encoding.color,
        shape: encoding.shape,
        count,
        isVisible: true,
        zOrder,
      };
    });

    // Always include "Other" when there are items beyond the cap and not in isolation mode
    if (otherCount > 0 && !isolationMode) {
      const encoding = getVisualEncoding(-1, shapesEnabled, LEGEND_VALUES.OTHERS);
      // Only preserve existing "Other" zOrder in 'manual' mode; otherwise put at end
      const otherZOrder =
        sortMode === 'manual' ? (existingOtherZOrder ?? items.length) : items.length;

      items.push({
        value: LEGEND_VALUES.OTHER,
        color: encoding.color,
        shape: encoding.shape,
        count: otherCount,
        isVisible: true,
        zOrder: otherZOrder,
      });
    }

    return items;
  }

  static addNullEntry(
    items: LegendItem[],
    frequencyMap: Map<string | null, number>,
    topItems: Array<[string | null, number]>,
    existingLegendItems: LegendItem[],
    shapesEnabled: boolean,
  ): void {
    const nullEntry = Array.from(frequencyMap.entries()).find(([v]) => v === null);

    if (nullEntry && !topItems.some(([v]) => v === null)) {
      const existingNull = existingLegendItems.find((i) => i.value === null);
      const encoding = getVisualEncoding(-2, shapesEnabled, LEGEND_VALUES.NA_DISPLAY);

      items.push({
        value: null,
        color: encoding.color,
        shape: encoding.shape,
        count: nullEntry[1],
        isVisible: true,
        zOrder: existingNull?.zOrder ?? items.length,
      });
    }
  }

  static processLegendItems(
    ctx: LegendProcessorContext,
    annotationName: string,
    annotationValues: (string | null)[],
    proteinIds: string[],
    maxVisibleValues: number,
    isolationMode: boolean,
    isolationHistory: string[][],
    existingLegendItems: LegendItem[],
    sortMode: LegendSortMode = 'size-desc',
    shapesEnabled: boolean = false,
    persistedCategories: Record<string, PersistedCategoryData> = {},
    visibleValues: Set<string> = new Set(),
    pendingExtract?: string,
    pendingMerge?: string,
  ): { legendItems: LegendItem[]; otherItems: OtherItem[] } {
    this.resetIfAnnotationChanged(ctx, annotationName);

    const filteredIndices = this.getFilteredIndices(isolationMode, isolationHistory, proteinIds);
    const frequencyMap = this.countAnnotationFrequencies(
      annotationValues,
      isolationMode,
      isolationHistory,
      filteredIndices,
    );

    // Build existing zOrder map for manual sorting
    // Extract zOrders from persisted categories, then override with current legend items
    const existingZOrders = new Map<string | null, number>();
    // First apply persisted categories
    for (const [key, data] of Object.entries(persistedCategories)) {
      existingZOrders.set(key === 'null' ? null : key, data.zOrder);
    }
    // Then override with current legend items if they exist
    existingLegendItems.forEach((item) => {
      if (item.value !== LEGEND_VALUES.OTHER) {
        existingZOrders.set(item.value, item.zOrder);
      }
    });

    const { topItems, otherItems, otherCount } = this.sortAndLimitItems(
      frequencyMap,
      maxVisibleValues,
      isolationMode,
      sortMode,
      existingZOrders,
      visibleValues,
      pendingExtract,
      pendingMerge,
    );

    // Pass a copy of existingZOrders since createLegendItems may modify it for shifting
    const items = this.createLegendItems(
      ctx,
      topItems,
      otherCount,
      isolationMode,
      existingLegendItems,
      shapesEnabled,
      sortMode,
      new Map(existingZOrders),
      persistedCategories,
    );

    this.addNullEntry(items, frequencyMap, topItems, existingLegendItems, shapesEnabled);

    if (!isolationMode) {
      const shownValues = new Set(
        items
          .map((i) => i.value)
          .filter((v): v is string => v !== null && v !== LEGEND_VALUES.OTHER),
      );
      const filteredOther = otherItems
        .filter((oi) => oi.value !== null)
        .filter((oi) => !shownValues.has(oi.value!));
      const newOtherCount = filteredOther.reduce((sum, oi) => sum + oi.count, 0);

      const otherIdx = items.findIndex((i) => i.value === LEGEND_VALUES.OTHER);
      if (otherIdx !== -1) {
        if (newOtherCount > 0) {
          items[otherIdx] = { ...items[otherIdx], count: newOtherCount };
        } else {
          items.splice(otherIdx, 1);
        }
      }

      return { legendItems: items, otherItems: filteredOther };
    }

    return { legendItems: items, otherItems: [] };
  }
}
