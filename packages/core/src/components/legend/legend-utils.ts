import type { LegendItem, LegendFeatureData, ScatterplotElement } from './types';

/**
 * Utility class for legend state management and operations
 */
export class LegendUtils {
  /**
   * Check if an item is selected based on selected items array
   */
  static isItemSelected(item: LegendItem, selectedItems: string[]): boolean {
    return (
      (item.value === null && selectedItems.includes('null') && selectedItems.length > 0) ||
      (item.value !== null && item.value !== 'Other' && selectedItems.includes(item.value))
    );
  }

  /**
   * Generate CSS classes for a legend item based on its state
   */
  static getItemClasses(
    item: LegendItem,
    isItemSelected: boolean,
    draggedItem: string | null
  ): string {
    const classes = ['legend-item'];

    if (!item.isVisible) classes.push('hidden');
    if (draggedItem === item.value && item.value !== null) classes.push('dragging');
    if (isItemSelected) classes.push('selected');
    if (item.extractedFromOther) classes.push('extracted');

    return classes.join(' ');
  }

  /**
   * Perform drag reorder operation on legend items
   */
  static performDragReorder(
    legendItems: LegendItem[],
    draggedItem: string | null,
    targetItem: LegendItem
  ): LegendItem[] | null {
    // Find the indices
    const draggedIdx = legendItems.findIndex((i) => i.value === draggedItem);
    const targetIdx = legendItems.findIndex((i) => i.value === targetItem.value);

    if (draggedIdx === -1 || targetIdx === -1) return null;

    // Create a new array with the item moved
    const newItems = [...legendItems];
    const [movedItem] = newItems.splice(draggedIdx, 1);
    newItems.splice(targetIdx, 0, movedItem);

    // Update z-order
    return newItems.map((item, idx) => ({
      ...item,
      zOrder: idx,
    }));
  }

  /**
   * Create z-order mapping from legend items for event dispatching
   */
  static createZOrderMapping(legendItems: LegendItem[]): Record<string, number> {
    const zOrderMap: Record<string, number> = {};
    legendItems.forEach((legendItem) => {
      if (legendItem.value !== null && legendItem.value !== 'Other') {
        zOrderMap[legendItem.value] = legendItem.zOrder;
      }
    });
    return zOrderMap;
  }

  /**
   * Update feature data from scatterplot data
   */
  static updateFeatureData(currentData: any, selectedFeature: string): LegendFeatureData {
    return {
      name: selectedFeature,
      values: currentData.features[selectedFeature].values,
      colors: currentData.features[selectedFeature].colors,
      shapes: currentData.features[selectedFeature].shapes,
    };
  }

  /**
   * Extract feature values for current data
   */
  static updateFeatureValues(currentData: any, selectedFeature: string): (string | null)[] {
    return currentData.protein_ids.flatMap((_: string, index: number) => {
      const featureIdxArray = currentData.feature_data[selectedFeature][index];

      return featureIdxArray.map((featureIdx: number) => {
        return currentData.features[selectedFeature].values[featureIdx];
      });
    });
  }

  /**
   * Get current data from scatterplot element
   */
  static getCurrentScatterplotData(scatterplotElement: Element | null): {
    currentData: any;
    selectedFeature: string;
  } | null {
    if (!scatterplotElement || !('getCurrentData' in scatterplotElement)) {
      return null;
    }

    const currentData = (scatterplotElement as ScatterplotElement).getCurrentData();
    const selectedFeature = (scatterplotElement as ScatterplotElement).selectedFeature;

    if (!currentData || !selectedFeature) {
      return null;
    }

    return { currentData, selectedFeature };
  }

  /**
   * Toggle hidden state for a value
   */
  static toggleHiddenValue(hiddenValues: string[], value: string | null): string[] {
    const valueKey = value === null ? 'null' : value;

    if (hiddenValues.includes(valueKey)) {
      return hiddenValues.filter((v) => v !== valueKey);
    } else {
      return [...hiddenValues, valueKey];
    }
  }

  /**
   * Update legend items visibility based on hidden values
   */
  static updateItemsVisibility(legendItems: LegendItem[], hiddenValues: string[]): LegendItem[] {
    return legendItems.map((item) => ({
      ...item,
      isVisible: !hiddenValues.includes(item.value === null ? 'null' : item.value!),
    }));
  }

  /**
   * Handle item double-click isolation logic
   */
  static handleItemIsolation(legendItems: LegendItem[], targetValue: string | null): LegendItem[] {
    // Get the clicked item
    const clickedItem = legendItems.find((item) => item.value === targetValue);
    if (!clickedItem) return legendItems;

    // Check if it's the only visible item
    const visibleItems = legendItems.filter((item) => item.isVisible);
    const isOnlyVisible = visibleItems.length === 1 && visibleItems[0].value === targetValue;

    // Case 1: It's the only visible item - show all
    if (isOnlyVisible) {
      return legendItems.map((item) => ({
        ...item,
        isVisible: true,
      }));
    }
    // Case 2: Show only this item
    else {
      return legendItems.map((item) => ({
        ...item,
        isVisible: item.value === targetValue,
      }));
    }
  }

  /**
   * Create new extracted legend item
   */
  static createExtractedItem(
    value: string,
    count: number,
    featureData: LegendFeatureData,
    zOrder: number
  ): LegendItem {
    // Find the valueIndex for color and shape
    const valueIndex = featureData.values.indexOf(value);

    return {
      value,
      color: valueIndex !== -1 ? featureData.colors[valueIndex] : '#888',
      shape: valueIndex !== -1 ? featureData.shapes[valueIndex] : 'circle',
      count,
      isVisible: true,
      zOrder,
      extractedFromOther: true,
    };
  }

  /**
   * Update scatterplot hidden values if auto-hide is enabled
   */
  static updateScatterplotHiddenValues(
    scatterplotElement: Element | null,
    hiddenValues: string[],
    autoHide: boolean
  ): void {
    if (autoHide && scatterplotElement && 'hiddenFeatureValues' in scatterplotElement) {
      (scatterplotElement as ScatterplotElement).hiddenFeatureValues = [...hiddenValues];
    }
  }
}
