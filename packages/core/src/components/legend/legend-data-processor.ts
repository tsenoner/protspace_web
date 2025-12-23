import type { LegendItem, OtherItem, LegendSortMode } from './types';
import { getVisualEncoding, SlotTracker } from './visual-encoding';

/**
 * Processes legend data with slot-based visual encoding.
 *
 * Slot assignment:
 * - Initial: slots 0, 1, 2, ... assigned by frequency (most frequent = slot 0)
 * - Subsequent: existing slots persist; only freed when items move to "Other"
 * - Extracted items reuse freed slots or get the next available
 */
export class LegendDataProcessor {
  private static slotTracker = new SlotTracker();
  private static currentFeature: string | null = null;

  private static resetIfFeatureChanged(featureName: string): void {
    if (this.currentFeature !== featureName) {
      this.slotTracker.reset();
      this.currentFeature = featureName;
    }
  }

  /**
   * Get the slot tracker instance (for external access if needed).
   */
  static getSlotTracker(): SlotTracker {
    return this.slotTracker;
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

  static countFeatureFrequencies(
    featureValues: (string | null)[],
    isolationMode: boolean,
    isolationHistory: string[][],
    filteredIndices: Set<number>,
  ): Map<string | null, number> {
    const freq = new Map<string | null, number>();

    if (isolationMode && isolationHistory?.length) {
      featureValues.forEach((value, index) => {
        if (filteredIndices.has(index)) {
          freq.set(value, (freq.get(value) || 0) + 1);
        }
      });
    } else {
      featureValues.forEach((value) => {
        freq.set(value, (freq.get(value) || 0) + 1);
      });
    }

    return freq;
  }

  static sortAndLimitItems(
    frequencyMap: Map<string | null, number>,
    maxVisibleValues: number,
    isolationMode: boolean,
    manuallyOtherValues: Set<string>,
    sortMode: LegendSortMode,
  ): {
    topItems: Array<[string | null, number]>;
    otherItems: OtherItem[];
    otherCount: number;
  } {
    const getFirstNumber = (val: string | null): number => {
      if (val === null) return Number.POSITIVE_INFINITY;
      const match = String(val).match(/-?\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : Number.POSITIVE_INFINITY;
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
      if (sortMode === 'alpha') {
        const an = getFirstNumber(a[0]),
          bn = getFirstNumber(b[0]);
        if (an !== bn) return an - bn;
        const ar = getPatternRank(a[0]),
          br = getPatternRank(b[0]);
        if (ar !== br) return ar - br;
        return (b[1] ?? 0) - (a[1] ?? 0);
      } else if (sortMode === 'alpha-desc') {
        const an = getFirstNumber(a[0]),
          bn = getFirstNumber(b[0]);
        if (an !== bn) return bn - an;
        const ar = getPatternRank(a[0]),
          br = getPatternRank(b[0]);
        if (ar !== br) return br - ar;
        return (b[1] ?? 0) - (a[1] ?? 0);
      } else if (sortMode === 'size-asc') {
        return a[1] - b[1];
      }
      return b[1] - a[1]; // 'size' default
    };

    const entries = Array.from(frequencyMap.entries());
    const sortedItems = [...entries].sort(sortFn);

    const manualCountInTop = [...entries]
      .sort(sortFn)
      .slice(0, maxVisibleValues)
      .filter(([v]) => v !== null && manuallyOtherValues.has(String(v))).length;

    const effectiveCap = Math.max(0, maxVisibleValues - manualCountInTop);

    const filtered = (
      isolationMode ? sortedItems.filter(([v]) => frequencyMap.has(v)) : sortedItems
    ).filter(([v]) => v === null || !manuallyOtherValues.has(String(v)));

    const topItems = filtered.slice(0, effectiveCap);

    const beyondCap = sortedItems.slice(maxVisibleValues).filter(([v]) => v !== null);
    const manualPairs = sortedItems.filter(
      ([v]) => v !== null && manuallyOtherValues.has(String(v)),
    );

    const seen = new Set<string>();
    const otherItemsArray = [...beyondCap, ...manualPairs].filter(([v]) => {
      const key = String(v);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      topItems,
      otherItems: otherItemsArray.map(([value, count]) => ({ value, count })),
      otherCount: otherItemsArray.reduce((sum, [, count]) => sum + count, 0),
    };
  }

  static createLegendItems(
    topItems: Array<[string | null, number]>,
    otherCount: number,
    isolationMode: boolean,
    includeOthers: boolean,
    existingLegendItems: LegendItem[],
    shapesEnabled: boolean,
  ): LegendItem[] {
    const existingZOrders = new Map<string | null, number>();
    existingLegendItems.forEach((item) => {
      if (item.value !== 'Other' || item.extractedFromOther) {
        existingZOrders.set(item.value, item.zOrder);
      }
    });

    // Get current visible category names
    const visibleCategoryNames = topItems.map(([value]) => (value === null ? 'N/A' : value));

    if (this.slotTracker.isEmpty()) {
      // Initial: assign slots by frequency order
      this.slotTracker.reassignSlots(visibleCategoryNames);
    } else {
      // Subsequent: preserve slots, only free those that moved to Others
      const currentVisibleSet = new Set(visibleCategoryNames);
      const previousVisible = existingLegendItems
        .filter((i) => i.value !== 'Other' && !i.extractedFromOther)
        .map((i) => (i.value === null ? 'N/A' : i.value));

      for (const category of previousVisible) {
        if (!currentVisibleSet.has(category)) {
          this.slotTracker.freeSlot(category);
        }
      }
    }

    const items: LegendItem[] = topItems.map(([value, count], index) => {
      const categoryName = value === null ? 'N/A' : value;
      const zOrder = existingZOrders.get(value) ?? index;
      const slot = this.slotTracker.getSlot(categoryName);
      const encoding = getVisualEncoding(slot, shapesEnabled, categoryName);

      return {
        value,
        color: encoding.color,
        shape: encoding.shape,
        count,
        isVisible: true,
        zOrder,
      };
    });

    if (otherCount > 0 && includeOthers && !isolationMode) {
      const existingOther = existingLegendItems.find((i) => i.value === 'Other');
      const encoding = getVisualEncoding(-1, shapesEnabled, 'Others');

      items.push({
        value: 'Other',
        color: encoding.color,
        shape: encoding.shape,
        count: otherCount,
        isVisible: true,
        zOrder: existingOther?.zOrder ?? items.length,
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
      const encoding = getVisualEncoding(-2, shapesEnabled, 'N/A');

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

  static addExtractedItems(
    items: LegendItem[],
    frequencyMap: Map<string | null, number>,
    existingLegendItems: LegendItem[],
    shapesEnabled: boolean,
  ): void {
    const extracted = existingLegendItems.filter((i) => i.extractedFromOther);

    extracted.forEach((extractedItem) => {
      if (
        extractedItem.value !== null &&
        !items.some((i) => i.value === extractedItem.value) &&
        frequencyMap.has(extractedItem.value)
      ) {
        const count = frequencyMap.get(extractedItem.value)!;
        const slot = this.slotTracker.getSlot(extractedItem.value);
        const encoding = getVisualEncoding(slot, shapesEnabled, extractedItem.value);

        items.push({
          value: extractedItem.value,
          color: encoding.color,
          shape: encoding.shape,
          count,
          isVisible: true,
          zOrder: extractedItem.zOrder,
          extractedFromOther: true,
        });
      }
    });
  }

  static processLegendItems(
    featureName: string,
    featureValues: (string | null)[],
    proteinIds: string[],
    maxVisibleValues: number,
    isolationMode: boolean,
    isolationHistory: string[][],
    existingLegendItems: LegendItem[],
    includeOthers: boolean,
    manuallyOtherValues: string[] = [],
    sortMode: LegendSortMode = 'size',
    shapesEnabled: boolean = false,
  ): { legendItems: LegendItem[]; otherItems: OtherItem[] } {
    this.resetIfFeatureChanged(featureName);

    const manualOtherSet = new Set(manuallyOtherValues);
    const filteredIndices = this.getFilteredIndices(isolationMode, isolationHistory, proteinIds);
    const frequencyMap = this.countFeatureFrequencies(
      featureValues,
      isolationMode,
      isolationHistory,
      filteredIndices,
    );

    const effectiveMax = includeOthers ? maxVisibleValues : Number.MAX_SAFE_INTEGER;
    const { topItems, otherItems, otherCount } = this.sortAndLimitItems(
      frequencyMap,
      effectiveMax,
      isolationMode,
      manualOtherSet,
      sortMode,
    );

    const items = this.createLegendItems(
      topItems,
      otherCount,
      isolationMode,
      includeOthers,
      existingLegendItems,
      shapesEnabled,
    );

    this.addNullEntry(items, frequencyMap, topItems, existingLegendItems, shapesEnabled);
    this.addExtractedItems(items, frequencyMap, existingLegendItems, shapesEnabled);

    if (includeOthers && !isolationMode) {
      const shownValues = new Set(
        items.map((i) => i.value).filter((v): v is string => v !== null && v !== 'Other'),
      );
      const filteredOther = otherItems
        .filter((oi) => oi.value !== null)
        .filter((oi) => !shownValues.has(oi.value!));
      const newOtherCount = filteredOther.reduce((sum, oi) => sum + oi.count, 0);

      const otherIdx = items.findIndex((i) => i.value === 'Other');
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
