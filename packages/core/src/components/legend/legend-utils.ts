import type { LegendItem, ScatterplotElement, ScatterplotData } from './types';
import { getVisualEncoding } from './visual-encoding';
import { LegendDataProcessor } from './legend-data-processor';

/**
 * Utility functions for legend state management
 */
export class LegendUtils {
  static isItemSelected(item: LegendItem, selectedItems: string[]): boolean {
    return (
      (item.value === null && selectedItems.includes('null') && selectedItems.length > 0) ||
      (item.value !== null && item.value !== 'Other' && selectedItems.includes(item.value))
    );
  }

  static getItemClasses(
    item: LegendItem,
    isItemSelected: boolean,
    draggedItemIndex: number,
    legendItems: LegendItem[],
  ): string {
    const classes = ['legend-item'];
    if (!item.isVisible) classes.push('hidden');
    const itemIndex = legendItems.findIndex((i) => i.value === item.value);
    if (draggedItemIndex === itemIndex && draggedItemIndex !== -1) classes.push('dragging');
    if (isItemSelected) classes.push('selected');
    if (item.extractedFromOther) classes.push('extracted');
    return classes.join(' ');
  }

  static performDragReorder(
    legendItems: LegendItem[],
    draggedItemIndex: number,
    targetItem: LegendItem,
  ): { reorderedItems: LegendItem[]; newDraggedIndex: number } | null {
    const targetIdx = legendItems.findIndex((i) => i.value === targetItem.value);

    if (draggedItemIndex === -1 || targetIdx === -1) return null;

    const newItems = [...legendItems];
    const [movedItem] = newItems.splice(draggedItemIndex, 1);
    
    // Adjust target index if dragging forward (target is after dragged item)
    // After removing the dragged item, items after it shift down by 1
    const adjustedTargetIdx = targetIdx > draggedItemIndex ? targetIdx - 1 : targetIdx;
    newItems.splice(adjustedTargetIdx, 0, movedItem);

    const reorderedItems = newItems.map((item, idx) => ({ ...item, zOrder: idx }));
    return { reorderedItems, newDraggedIndex: adjustedTargetIdx };
  }

  static createZOrderMapping(legendItems: LegendItem[]): Record<string, number> {
    const zOrderMap: Record<string, number> = {};
    legendItems.forEach((item) => {
      if (item.value !== null && item.value !== 'Other') {
        zOrderMap[item.value] = item.zOrder;
      }
    });
    return zOrderMap;
  }

  static updateFeatureValues(
    currentData: ScatterplotData,
    selectedFeature: string,
  ): (string | null)[] {
    return currentData.protein_ids.flatMap((_: string, index: number) => {
      const featureIdxData = currentData.feature_data[selectedFeature][index];
      const featureIdxArray = Array.isArray(featureIdxData) ? featureIdxData : [featureIdxData];

      return featureIdxArray
        .map((featureIdx: number) => currentData.features[selectedFeature].values[featureIdx])
        .filter((v) => v != null);
    });
  }

  static getCurrentScatterplotData(scatterplotElement: Element | null): {
    currentData: ScatterplotData;
    selectedFeature: string;
  } | null {
    if (!scatterplotElement || !('getCurrentData' in scatterplotElement)) return null;

    const currentData = (scatterplotElement as ScatterplotElement).getCurrentData();
    const selectedFeature = (scatterplotElement as ScatterplotElement).selectedFeature;

    if (!currentData || !selectedFeature) return null;

    return { currentData, selectedFeature };
  }

  static toggleHiddenValue(hiddenValues: string[], value: string | null): string[] {
    const valueKey = value === null ? 'null' : value;

    if (hiddenValues.includes(valueKey)) {
      return hiddenValues.filter((v) => v !== valueKey);
    }
    return [...hiddenValues, valueKey];
  }

  static updateItemsVisibility(legendItems: LegendItem[], hiddenValues: string[]): LegendItem[] {
    return legendItems.map((item) => ({
      ...item,
      isVisible: !hiddenValues.includes(item.value === null ? 'null' : item.value!),
    }));
  }

  static handleItemIsolation(legendItems: LegendItem[], targetValue: string | null): LegendItem[] {
    const clickedItem = legendItems.find((item) => item.value === targetValue);
    if (!clickedItem) return legendItems;

    const visibleItems = legendItems.filter((item) => item.isVisible);
    const isOnlyVisible = visibleItems.length === 1 && visibleItems[0].value === targetValue;

    if (isOnlyVisible) {
      return legendItems.map((item) => ({ ...item, isVisible: true }));
    }
    return legendItems.map((item) => ({ ...item, isVisible: item.value === targetValue }));
  }

  static createExtractedItem(
    value: string,
    count: number,
    zOrder: number,
    shapesEnabled: boolean = false,
  ): LegendItem {
    // Use the shared slot tracker from LegendDataProcessor
    // This ensures extracted items get recycled slots properly
    const slotTracker = LegendDataProcessor.getSlotTracker();
    const slot = slotTracker.getSlot(value);
    const encoding = getVisualEncoding(slot, shapesEnabled, value);

    return {
      value,
      color: encoding.color,
      shape: encoding.shape,
      count,
      isVisible: true,
      zOrder,
      extractedFromOther: true,
    };
  }

  static updateScatterplotHiddenValues(
    scatterplotElement: Element | null,
    hiddenValues: string[],
    autoHide: boolean,
  ): void {
    if (autoHide && scatterplotElement && 'hiddenFeatureValues' in scatterplotElement) {
      (scatterplotElement as ScatterplotElement).hiddenFeatureValues = [...hiddenValues];
    }
  }
}
