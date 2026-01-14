import type { LegendItem, OtherItem, LegendSortMode, PersistedCategoryData } from './types';
import { getVisualEncoding, SlotTracker } from './visual-encoding';
import { LEGEND_VALUES, toInternalValue, toDisplayValue, isNAValue } from './config';

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

  /**
   * Count frequencies of annotation values.
   * Raw null/empty values are converted to LEGEND_VALUES.NA_VALUE.
   */
  static countAnnotationFrequencies(
    annotationValues: (string | null)[],
    isolationMode: boolean,
    isolationHistory: string[][],
    filteredIndices: Set<number>,
  ): Map<string, number> {
    const freq = new Map<string, number>();

    const countValue = (rawValue: string | null) => {
      const value = toInternalValue(rawValue);
      freq.set(value, (freq.get(value) || 0) + 1);
    };

    if (isolationMode && isolationHistory?.length) {
      annotationValues.forEach((value, index) => {
        if (filteredIndices.has(index)) {
          countValue(value);
        }
      });
    } else {
      annotationValues.forEach(countValue);
    }

    return freq;
  }

  /**
   * Sort and limit items to maxVisibleValues.
   * All values are internal format (N/A is '__NA__').
   */
  static sortAndLimitItems(
    frequencyMap: Map<string, number>,
    maxVisibleValues: number,
    isolationMode: boolean,
    sortMode: LegendSortMode,
    existingZOrders: Map<string, number> = new Map(),
    visibleValues: Set<string> = new Set(),
    pendingExtract?: string,
    pendingMerge?: string,
  ): {
    topItems: Array<[string, number]>;
    otherItems: OtherItem[];
    otherCount: number;
  } {
    const getFirstNumber = (val: string): number | null => {
      if (isNAValue(val)) return null;
      const match = val.match(/-?\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : null;
    };

    const getPatternRank = (val: string): number => {
      if (isNAValue(val)) return 99;
      const s = val.trim();
      if (/^[<>]/.test(s)) return 0;
      if (/^\d+\s*-\s*\d+/.test(s)) return 1;
      if (/^\d+\s*\+/.test(s)) return 2;
      return 3;
    };

    const sortFn = (a: [string, number], b: [string, number]) => {
      if (sortMode === 'manual' || sortMode === 'manual-reverse') {
        const aOrder = existingZOrders.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = existingZOrders.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        return sortMode === 'manual' ? aOrder - bOrder : bOrder - aOrder;
      } else if (sortMode === 'alpha-asc' || sortMode === 'alpha-desc') {
        const isAsc = sortMode === 'alpha-asc';
        const an = getFirstNumber(a[0]);
        const bn = getFirstNumber(b[0]);

        if (an !== null && bn !== null && an !== bn) {
          return isAsc ? an - bn : bn - an;
        }
        if (an !== null && bn === null) return isAsc ? -1 : 1;
        if (an === null && bn !== null) return isAsc ? 1 : -1;

        const ar = getPatternRank(a[0]);
        const br = getPatternRank(b[0]);
        if (ar !== br) return isAsc ? ar - br : br - ar;

        const aStr = a[0].toLowerCase();
        const bStr = b[0].toLowerCase();
        if (aStr !== bStr) {
          return isAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        }

        return b[1] - a[1];
      } else if (sortMode === 'size-asc') {
        return a[1] - b[1];
      }
      return b[1] - a[1]; // 'size-desc' default
    };

    const entries = Array.from(frequencyMap.entries());

    // Build working set of visible values, applying pending extract/merge
    const workingVisible = new Set(visibleValues);
    if (pendingExtract !== undefined) {
      workingVisible.add(pendingExtract);
    }
    if (pendingMerge !== undefined) {
      workingVisible.delete(pendingMerge);
    }

    let topItems: Array<[string, number]>;

    // Check if N/A is being extracted or merged
    const extractingNA = pendingExtract === LEGEND_VALUES.NA_VALUE;
    const mergingNA = pendingMerge === LEGEND_VALUES.NA_VALUE;

    if (workingVisible.size > 0) {
      // Filter to visible items, handling N/A specially
      const visibleEntries = entries.filter(([v]) => {
        if (isNAValue(v)) {
          if (extractingNA) return true;
          if (mergingNA) return false;
          return workingVisible.has(v);
        }
        return workingVisible.has(v);
      });

      const sorted = [...visibleEntries].sort(sortFn);
      topItems = sorted.slice(0, maxVisibleValues);
    } else {
      // Initial load: sort all and take top N
      let filtered = [...entries];
      if (mergingNA) {
        filtered = filtered.filter(([v]) => !isNAValue(v));
      }
      const sorted = filtered.sort(sortFn);
      topItems = (isolationMode ? sorted.filter(([v]) => frequencyMap.has(v)) : sorted).slice(
        0,
        maxVisibleValues,
      );
    }

    // Items beyond the cap go to "Other" (excluding N/A which is handled separately)
    const topValuesSet = new Set(topItems.map(([v]) => v));
    const beyondCap = entries.filter(([v]) => !topValuesSet.has(v));

    return {
      topItems,
      otherItems: beyondCap.map(([value, count]) => ({ value, count })),
      otherCount: beyondCap.reduce((sum, [, count]) => sum + count, 0),
    };
  }

  /**
   * Create legend items from sorted top items.
   * All values are internal format (N/A is '__NA__').
   */
  static createLegendItems(
    ctx: LegendProcessorContext,
    topItems: Array<[string, number]>,
    otherCount: number,
    isolationMode: boolean,
    existingLegendItems: LegendItem[],
    shapesEnabled: boolean,
    sortMode: LegendSortMode = 'size-desc',
    passedZOrders: Map<string, number> = new Map(),
    persistedCategories: Record<string, PersistedCategoryData> = {},
  ): LegendItem[] {
    // Use passed zOrders if available, otherwise extract from existingLegendItems
    let existingZOrders: Map<string, number>;
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
    const existingColors = new Map<string, { color: string; shape: string }>();
    existingLegendItems.forEach((item) => {
      if (item.value !== LEGEND_VALUES.OTHER) {
        existingColors.set(item.value, { color: item.color, shape: item.shape });
      }
    });

    // Get current visible category names (for slot tracking, use display names)
    const visibleCategoryNames = topItems.map(([value]) => toDisplayValue(value));

    if (ctx.slotTracker.isEmpty()) {
      ctx.slotTracker.reassignSlots(visibleCategoryNames);
    } else {
      const currentVisibleSet = new Set(visibleCategoryNames);
      const previousVisible = existingLegendItems
        .filter((i) => i.value !== LEGEND_VALUES.OTHER)
        .map((i) => toDisplayValue(i.value));

      for (const category of previousVisible) {
        if (!currentVisibleSet.has(category)) {
          ctx.slotTracker.freeSlot(category);
        }
      }
    }

    // In 'manual' mode, shift existing zOrders to make room for newly extracted items
    if (sortMode === 'manual' && existingZOrders.size > 0) {
      const existingZOrderValues = Array.from(existingZOrders.values()).sort((a, b) => a - b);
      const isConsecutive =
        existingZOrderValues[0] === 0 && existingZOrderValues.every((v, i) => v === i);

      if (isConsecutive) {
        const newItems: Array<{ value: string; targetIndex: number }> = [];
        topItems.forEach(([value], index) => {
          if (!existingZOrders.has(value)) {
            newItems.push({ value, targetIndex: index });
          }
        });

        newItems.sort((a, b) => b.targetIndex - a.targetIndex);
        for (const newItem of newItems) {
          existingZOrders.forEach((zOrder, key) => {
            if (zOrder >= newItem.targetIndex) {
              existingZOrders.set(key, zOrder + 1);
            }
          });
          if (existingOtherZOrder !== null && existingOtherZOrder >= newItem.targetIndex) {
            existingOtherZOrder = existingOtherZOrder + 1;
          }
        }
      }
    }

    const items: LegendItem[] = topItems.map(([value, count], index) => {
      const displayName = toDisplayValue(value);
      const zOrder = sortMode === 'manual' ? (existingZOrders.get(value) ?? index) : index;
      const slot = ctx.slotTracker.getSlot(displayName);

      let encoding = getVisualEncoding(slot, shapesEnabled, displayName);

      // Priority: persisted > existing > default encoding
      const persisted = persistedCategories[value];
      const existing = existingColors.get(value);

      if (persisted?.color) {
        encoding = { color: persisted.color, shape: encoding.shape };
      } else if (existing) {
        encoding = { color: existing.color, shape: encoding.shape };
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

    // Add "Other" if there are items beyond the cap
    if (otherCount > 0 && !isolationMode) {
      const encoding = getVisualEncoding(-1, shapesEnabled, LEGEND_VALUES.OTHERS);
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

  /**
   * Main entry point for processing legend items.
   * Converts raw annotation values to internal format, sorts, and creates legend items.
   */
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
    const existingZOrders = new Map<string, number>();
    // First apply persisted categories
    for (const [key, data] of Object.entries(persistedCategories)) {
      existingZOrders.set(key, data.zOrder);
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

    // Filter "Other" items to exclude any that are already shown
    if (!isolationMode) {
      const shownValues = new Set(
        items.map((i) => i.value).filter((v) => v !== LEGEND_VALUES.OTHER),
      );
      const filteredOther = otherItems.filter((oi) => !shownValues.has(oi.value));
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
