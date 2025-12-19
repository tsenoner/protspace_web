import type { LegendItem, OtherItem, LegendFeatureData, LegendSortMode } from './types';
import { DEFAULT_STYLES } from './config';

/**
 * Utility class for processing legend data and creating legend items
 */
export class LegendDataProcessor {
  /**
   * Get filtered indices based on isolation history for isolation mode
   */
  static getFilteredIndices(
    isolationMode: boolean,
    isolationHistory: string[][],
    proteinIds: string[],
  ): Set<number> {
    const filteredIndices = new Set<number>();

    if (isolationMode && isolationHistory && isolationHistory.length > 0 && proteinIds) {
      proteinIds.forEach((id, index) => {
        // For the first isolation, check if the protein is in the first selection
        let isIncluded = isolationHistory[0].includes(id);

        // For each subsequent isolation, check if the protein is also in that selection
        if (isIncluded && isolationHistory.length > 1) {
          for (let i = 1; i < isolationHistory.length; i++) {
            if (!isolationHistory[i].includes(id)) {
              isIncluded = false;
              break;
            }
          }
        }

        if (isIncluded) {
          filteredIndices.add(index);
        }
      });
    }

    return filteredIndices;
  }

  /**
   * Count feature frequencies with optional filtering
   */
  static countFeatureFrequencies(
    featureValues: (string | null)[],
    isolationMode: boolean,
    isolationHistory: string[][],
    filteredIndices: Set<number>,
  ): Map<string | null, number> {
    const frequencyMap = new Map<string | null, number>();

    if (isolationMode && isolationHistory && isolationHistory.length > 0) {
      // Only count values from proteins that pass the isolation filter
      featureValues.forEach((value, index) => {
        if (filteredIndices.has(index)) {
          frequencyMap.set(value, (frequencyMap.get(value) || 0) + 1);
        }
      });
    } else {
      // Count all values when not in isolation mode
      featureValues.forEach((value) => {
        frequencyMap.set(value, (frequencyMap.get(value) || 0) + 1);
      });
    }

    return frequencyMap;
  }

  /**
   * Sort and limit items based on frequency
   */
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
    // Helper functions for alphabetic/numeric sorting
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

    // Convert to array and sort based on the sort mode
    const entries = Array.from(frequencyMap.entries());
    const sortedItems = entries.sort((a, b) => {
      if (sortMode === 'alpha') {
        // Alphabetic/numeric ascending
        const an = getFirstNumber(a[0]);
        const bn = getFirstNumber(b[0]);
        if (an !== bn) return an - bn;
        const ar = getPatternRank(a[0]);
        const br = getPatternRank(b[0]);
        if (ar !== br) return ar - br;
        // Final tie-break by count desc to have a stable, meaningful secondary order
        return (b[1] ?? 0) - (a[1] ?? 0);
      } else if (sortMode === 'alpha-desc') {
        // Alphabetic/numeric descending
        const an = getFirstNumber(a[0]);
        const bn = getFirstNumber(b[0]);
        if (an !== bn) return bn - an; // Reversed
        const ar = getPatternRank(a[0]);
        const br = getPatternRank(b[0]);
        if (ar !== br) return br - ar; // Reversed
        // Final tie-break by count desc
        return (b[1] ?? 0) - (a[1] ?? 0);
      } else if (sortMode === 'size-asc') {
        // Size ascending
        return a[1] - b[1];
      } else {
        // 'size' - Size descending (default)
        return b[1] - a[1];
      }
    });

    // When in isolation mode, we only show the values that actually appear in the data
    // Count how many of the original top-N are being manually assigned to Other
    const manualCountInOriginalTop = Array.from(frequencyMap.entries())
      .sort((a, b) => {
        if (sortMode === 'alpha') {
          const an = getFirstNumber(a[0]);
          const bn = getFirstNumber(b[0]);
          if (an !== bn) return an - bn;
          const ar = getPatternRank(a[0]);
          const br = getPatternRank(b[0]);
          if (ar !== br) return ar - br;
          return (b[1] ?? 0) - (a[1] ?? 0);
        } else if (sortMode === 'alpha-desc') {
          const an = getFirstNumber(a[0]);
          const bn = getFirstNumber(b[0]);
          if (an !== bn) return bn - an;
          const ar = getPatternRank(a[0]);
          const br = getPatternRank(b[0]);
          if (ar !== br) return br - ar;
          return (b[1] ?? 0) - (a[1] ?? 0);
        } else if (sortMode === 'size-asc') {
          return a[1] - b[1];
        } else {
          return b[1] - a[1];
        }
      })
      .slice(0, maxVisibleValues)
      .filter(([value]) => value !== null && manuallyOtherValues.has(String(value))).length;

    // Reduce effective capacity by the number of manual top items to avoid backfilling
    const effectiveTopCap = Math.max(0, maxVisibleValues - manualCountInOriginalTop);

    const filteredSortedItems = (
      isolationMode ? sortedItems.filter(([value]) => frequencyMap.has(value)) : sortedItems
    ).filter(([value]) => {
      // Always allow null; otherwise, if value is manually assigned to Other, exclude from top selection
      if (value === null) return true;
      return !manuallyOtherValues.has(String(value));
    });

    // Take the top items using the reduced cap to prevent backfilling
    const topItems = filteredSortedItems.slice(0, effectiveTopCap);

    // Get items that will go into the "Other" category (excluding null)
    // Build Other array as: everything beyond top cap + all manual-to-Other values, deduped
    const beyondCap = sortedItems.slice(maxVisibleValues).filter(([value]) => value !== null);
    const manualPairs = sortedItems.filter(
      ([value]) => value !== null && manuallyOtherValues.has(String(value)),
    );
    const seen = new Set<string>();
    const otherItemsArray = [...beyondCap, ...manualPairs].filter(([value]) => {
      const key = String(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Store "Other" items for the dialog
    const otherItems = otherItemsArray.map(([value, count]) => ({
      value,
      count,
    }));

    // Calculate count for "Other" category
    const otherCount = otherItemsArray.reduce((sum, [, count]) => sum + count, 0);

    return { topItems, otherItems, otherCount };
  }

  /**
   * Create legend items from sorted data
   */
  static createLegendItems(
    topItems: Array<[string | null, number]>,
    otherCount: number,
    isolationMode: boolean,
    featureData: LegendFeatureData,
    includeOthers: boolean,
    existingLegendItems: LegendItem[] = [],
  ): LegendItem[] {
    // Create a map of existing z-orders for preservation
    const existingZOrderMap = new Map<string | null, number>();
    existingLegendItems.forEach((item) => {
      if (item.value !== 'Other' || item.extractedFromOther) {
        existingZOrderMap.set(item.value, item.zOrder);
      }
    });

    // Create legend items with preserved z-order when possible
    const items: LegendItem[] = topItems.map(([value, count], index) => {
      const valueIndex =
        value !== null
          ? featureData.values.indexOf(value)
          : featureData.values.findIndex((v) => v === null);

      // Try to preserve existing z-order, otherwise use sequential
      const preservedZOrder = existingZOrderMap.get(value);
      const zOrder = preservedZOrder !== undefined ? preservedZOrder : index;

      // Use the same logic as scatter plot for finding configured null colors
      let itemColor: string;
      if (value === null) {
        // For null values, use the same logic as scatter plot
        let nullishConfiguredColor: string | null = null;
        if (Array.isArray(featureData.values)) {
          for (let i = 0; i < featureData.values.length; i++) {
            const v = featureData.values[i];
            if (
              (v === null || (typeof v === 'string' && v.trim() === '')) &&
              featureData.colors?.[i]
            ) {
              nullishConfiguredColor = featureData.colors[i];
              break;
            }
          }
        }
        itemColor = nullishConfiguredColor || DEFAULT_STYLES.null.color;
      } else {
        itemColor =
          valueIndex !== -1
            ? featureData.colors?.[valueIndex] || DEFAULT_STYLES.null.color
            : DEFAULT_STYLES.null.color;
      }

      return {
        value,
        color: itemColor,
        shape:
          valueIndex !== -1
            ? featureData.shapes?.[valueIndex] || DEFAULT_STYLES.null.shape
            : DEFAULT_STYLES.null.shape,
        count,
        isVisible: true,
        zOrder,
      };
    });

    // Add "Other" if needed, enabled, and if we're not in isolation mode
    if (otherCount > 0 && includeOthers && !isolationMode) {
      // Try to preserve existing z-order for "Other", otherwise use next available
      const existingOtherItem = existingLegendItems.find((item) => item.value === 'Other');
      const otherZOrder = existingOtherItem ? existingOtherItem.zOrder : items.length;

      items.push({
        value: 'Other',
        color: DEFAULT_STYLES.other.color,
        shape: DEFAULT_STYLES.other.shape,
        count: otherCount,
        isVisible: true,
        zOrder: otherZOrder,
      });
    }

    return items;
  }

  /**
   * Add null entry if not already included in top items
   */
  static addNullEntry(
    items: LegendItem[],
    frequencyMap: Map<string | null, number>,
    topItems: Array<[string | null, number]>,
    featureData: LegendFeatureData,
    existingLegendItems: LegendItem[] = [],
  ): void {
    // Find null entry
    const nullEntry = Array.from(frequencyMap.entries()).find(([value]) => value === null);

    // Add null if not already included in top items
    if (nullEntry && !topItems.some(([value]) => value === null)) {
      const valueIndex = featureData.values.findIndex((v) => v === null);

      // Try to preserve existing z-order for null entry
      const existingNullItem = existingLegendItems.find((item) => item.value === null);
      const nullZOrder = existingNullItem ? existingNullItem.zOrder : items.length;

      // Use the same logic as scatter plot for finding configured null colors
      let nullishConfiguredColor: string | null = null;
      if (Array.isArray(featureData.values)) {
        for (let i = 0; i < featureData.values.length; i++) {
          const v = featureData.values[i];
          if (
            (v === null || (typeof v === 'string' && v.trim() === '')) &&
            featureData.colors?.[i]
          ) {
            nullishConfiguredColor = featureData.colors[i];
            break;
          }
        }
      }

      items.push({
        value: null,
        color: nullishConfiguredColor || DEFAULT_STYLES.null.color,
        shape:
          valueIndex !== -1
            ? featureData.shapes?.[valueIndex] || DEFAULT_STYLES.null.shape
            : DEFAULT_STYLES.null.shape,
        count: nullEntry[1],
        isVisible: true,
        zOrder: nullZOrder,
      });
    }
  }

  /**
   * Add extracted items that were previously extracted from "Other"
   */
  static addExtractedItems(
    items: LegendItem[],
    frequencyMap: Map<string | null, number>,
    existingLegendItems: LegendItem[],
  ): void {
    // Get previously extracted items
    const extractedItems = existingLegendItems.filter((item) => item.extractedFromOther);

    // Add extracted items, but only if they exist in the current data
    const itemsToAdd: LegendItem[] = [];
    extractedItems.forEach((extractedItem) => {
      // Only add if not already in the list and if they exist in the current frequencies
      if (
        extractedItem.value !== null &&
        !items.some((item) => item.value === extractedItem.value) &&
        frequencyMap.has(extractedItem.value)
      ) {
        // Find the original frequency of this item
        const sortedItems = Array.from(frequencyMap.entries()).sort((a, b) => b[1] - a[1]);
        const itemFrequency = sortedItems.find(([value]) => value === extractedItem.value);

        if (itemFrequency) {
          itemsToAdd.push({
            ...extractedItem,
            count: itemFrequency[1],
            zOrder: extractedItem.zOrder, // Preserve existing z-order
          });
        }
      }
    });

    // Add the extracted items
    items.push(...itemsToAdd);
  }

  /**
   * Process all legend items - main entry point
   */
  static processLegendItems(
    featureData: LegendFeatureData,
    featureValues: (string | null)[],
    proteinIds: string[],
    maxVisibleValues: number,
    isolationMode: boolean,
    isolationHistory: string[][],
    existingLegendItems: LegendItem[],
    includeOthers: boolean,
    manuallyOtherValues: string[] = [],
    sortMode: LegendSortMode = 'size',
  ): {
    legendItems: LegendItem[];
    otherItems: OtherItem[];
  } {
    const manualOtherSet = new Set<string>(manuallyOtherValues);
    // Get filtered indices based on isolation history
    const filteredIndices = this.getFilteredIndices(isolationMode, isolationHistory, proteinIds);

    // Count frequencies with filtering
    const frequencyMap = this.countFeatureFrequencies(
      featureValues,
      isolationMode,
      isolationHistory,
      filteredIndices,
    );

    // Determine effective cap. When Others is disabled, show all categories
    const effectiveMaxVisibleValues = includeOthers ? maxVisibleValues : Number.MAX_SAFE_INTEGER;

    // Sort and limit items
    const { topItems, otherItems, otherCount } = this.sortAndLimitItems(
      frequencyMap,
      effectiveMaxVisibleValues,
      isolationMode,
      manualOtherSet,
      sortMode,
    );

    // Create legend items
    const items = this.createLegendItems(
      topItems,
      otherCount,
      isolationMode,
      featureData,
      includeOthers,
      existingLegendItems,
    );

    // Add null entry if needed
    this.addNullEntry(items, frequencyMap, topItems, featureData, existingLegendItems);

    // Add extracted items
    this.addExtractedItems(items, frequencyMap, existingLegendItems);

    if (includeOthers && !isolationMode) {
      // Build a set of values already shown individually (exclude null and the synthetic "Other")
      const individuallyShownValues = new Set(
        items.map((i) => i.value).filter((v): v is string => v !== null && v !== 'Other'),
      );

      // Filter Other dialog items by removing already extracted/visible ones
      const filteredOtherItems = otherItems
        .filter((oi) => oi.value !== null)
        .filter((oi) => !individuallyShownValues.has(oi.value!));

      // Recompute Other count
      const newOtherCount = filteredOtherItems.reduce((sum, oi) => sum + oi.count, 0);

      // Update the "Other" legend item count or remove it if empty
      const otherIndex = items.findIndex((i) => i.value === 'Other');
      if (otherIndex !== -1) {
        if (newOtherCount > 0) {
          items[otherIndex] = { ...items[otherIndex], count: newOtherCount };
        } else {
          // Remove the Other item entirely when no remaining entries
          items.splice(otherIndex, 1);
        }
      }

      // Return with filtered otherItems list
      return { legendItems: items, otherItems: filteredOtherItems };
    }

    // If Others is disabled or we're in isolation mode, ensure otherItems is empty
    return { legendItems: items, otherItems: [] };
  }
}
