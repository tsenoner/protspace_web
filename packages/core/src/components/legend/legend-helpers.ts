import type {
  LegendItem,
  OtherItem,
  LegendSortMode,
  LegendPersistedSettings,
  ItemAction,
} from './types';
import { LEGEND_DEFAULTS, FIRST_NUMBER_SORT_ANNOTATIONS, LEGEND_VALUES } from './config';

// Re-export ItemAction for backwards compatibility
export type { ItemAction };

/**
 * Pure helper functions for legend component.
 * These are extracted to enable easier unit testing.
 */

/**
 * Converts a legend item value to its string key representation.
 * Null values are converted to the 'null' string constant.
 */
export function valueToKey(value: string | null): string {
  return value === null ? LEGEND_VALUES.NULL_STRING : value;
}

/**
 * Expands hidden values by resolving the "Other" bucket to its concrete values.
 */
export function expandHiddenValues(hiddenValues: string[], otherItems: OtherItem[]): string[] {
  const expanded: string[] = [];

  for (const value of hiddenValues) {
    if (value === LEGEND_VALUES.OTHER) {
      // Expand the synthetic Other bucket to its actual values
      for (const otherItem of otherItems) {
        expanded.push(valueToKey(otherItem.value));
      }
    } else {
      expanded.push(value);
    }
  }

  // De-duplicate in case of overlaps
  return Array.from(new Set(expanded));
}

/**
 * Computes list of concrete values that belong to the synthetic "Other" bucket.
 */
export function computeOtherConcreteValues(otherItems: OtherItem[]): string[] {
  return otherItems.map((item) => valueToKey(item.value));
}

/**
 * Reverses z-order of legend items, keeping "Other" at the end.
 */
export function reverseZOrderKeepOtherLast(items: LegendItem[]): LegendItem[] {
  if (!items || items.length <= 1) return items;

  // Start from current rendered order (zOrder), not array order
  const sorted = [...items].sort((a, b) => a.zOrder - b.zOrder);
  const otherItem = sorted.find((i) => i.value === LEGEND_VALUES.OTHER) ?? null;

  const reversed = sorted.filter((i) => i.value !== LEGEND_VALUES.OTHER).reverse();
  const reordered = otherItem ? [...reversed, otherItem] : reversed;

  return reordered.map((item, idx) => ({ ...item, zOrder: idx }));
}

/**
 * Builds a z-order mapping from legend items.
 */
export function buildZOrderMapping(items: LegendItem[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  items.forEach((item) => {
    if (item.value !== null) {
      mapping[item.value] = item.zOrder;
    }
  });
  return mapping;
}

/**
 * Builds color and shape mappings from legend items.
 */
export function buildColorShapeMappings(items: LegendItem[]): {
  colorMapping: Record<string, string>;
  shapeMapping: Record<string, string>;
} {
  const colorMapping: Record<string, string> = {};
  const shapeMapping: Record<string, string> = {};

  items.forEach((item) => {
    const key = valueToKey(item.value);
    colorMapping[key] = item.color;
    shapeMapping[key] = item.shape;
  });

  return { colorMapping, shapeMapping };
}

/**
 * Calculates scatterplot point size from legend shape size.
 */
export function calculatePointSize(shapeSize: number): number {
  return Math.max(10, Math.round(shapeSize * LEGEND_DEFAULTS.symbolSizeMultiplier));
}

/**
 * Creates default persisted settings for an annotation.
 */
export function createDefaultSettings(selectedAnnotation: string): LegendPersistedSettings {
  return {
    maxVisibleValues: LEGEND_DEFAULTS.maxVisibleValues,
    includeShapes: LEGEND_DEFAULTS.includeShapes,
    shapeSize: LEGEND_DEFAULTS.symbolSize,
    sortMode: FIRST_NUMBER_SORT_ANNOTATIONS.has(selectedAnnotation) ? 'alpha-asc' : 'size-desc',
    hiddenValues: [],
    zOrderMapping: {},
    enableDuplicateStackUI: LEGEND_DEFAULTS.enableDuplicateStackUI,
  };
}

/**
 * Gets the default sort mode for an annotation.
 */
export function getDefaultSortMode(annotationName: string): LegendSortMode {
  return FIRST_NUMBER_SORT_ANNOTATIONS.has(annotationName) ? 'alpha-asc' : 'size-desc';
}

/**
 * Determines CSS classes for a legend item.
 */
export function getItemClasses(item: LegendItem, isSelected: boolean, isDragging: boolean): string {
  const classes = ['legend-item'];

  if (!item.isVisible) classes.push('hidden');
  if (isDragging) classes.push('dragging');
  if (isSelected) classes.push('selected');

  return classes.join(' ');
}

/**
 * Checks if an item is selected based on selectedItems array.
 */
export function isItemSelected(item: LegendItem, selectedItems: string[]): boolean {
  return (
    (item.value === null &&
      selectedItems.includes(LEGEND_VALUES.NULL_STRING) &&
      selectedItems.length > 0) ||
    (item.value !== null &&
      item.value !== LEGEND_VALUES.OTHER &&
      selectedItems.includes(item.value))
  );
}

/**
 * Creates a CustomEvent for item actions with consistent options.
 * Events use bubbles: true and composed: true for Shadow DOM compatibility.
 */
export function createItemActionEvent(
  eventName: string,
  value: string | null,
  action: ItemAction,
): CustomEvent<{ value: string | null; action: ItemAction }> {
  return new CustomEvent(eventName, {
    detail: { value, action },
    bubbles: true,
    composed: true,
  });
}

/**
 * Updates item visibility and returns updated items with new hidden values.
 * If all items would be hidden, returns all visible instead.
 */
export function updateItemsVisibility(
  items: LegendItem[],
  hiddenValues: string[],
  valueToToggle: string,
): { items: LegendItem[]; hiddenValues: string[] } {
  const valueKey = valueToToggle;

  // Compute proposed hidden values
  const proposedHiddenValues = hiddenValues.includes(valueKey)
    ? hiddenValues.filter((v) => v !== valueKey)
    : [...hiddenValues, valueKey];

  // Compute visibility after the toggle
  const proposedItems = items.map((item) => ({
    ...item,
    isVisible: !proposedHiddenValues.includes(valueToKey(item.value)),
  }));

  // If no items would remain visible, reset to show everything
  const anyVisible = proposedItems.some((item) => item.isVisible);
  if (!anyVisible) {
    return {
      items: items.map((item) => ({ ...item, isVisible: true })),
      hiddenValues: [],
    };
  }

  return {
    items: proposedItems,
    hiddenValues: proposedHiddenValues,
  };
}

/**
 * Isolates an item (shows only it) or shows all if it's already isolated.
 * Returns updated items and hidden values.
 */
export function isolateItem(
  items: LegendItem[],
  valueToIsolate: string | null,
): { items: LegendItem[]; hiddenValues: string[] } {
  const clickedItem = items.find((item) => item.value === valueToIsolate);
  if (!clickedItem) {
    return { items, hiddenValues: [] };
  }

  const visibleItems = items.filter((item) => item.isVisible);
  const isOnlyVisible = visibleItems.length === 1 && visibleItems[0].value === valueToIsolate;

  let updatedItems: LegendItem[];

  if (isOnlyVisible) {
    // Show all items
    updatedItems = items.map((item) => ({ ...item, isVisible: true }));
  } else {
    // Show only this item
    updatedItems = items.map((item) => ({
      ...item,
      isVisible: item.value === valueToIsolate,
    }));
  }

  // Compute hidden values from visibility state
  const hiddenValues = updatedItems
    .filter((item) => !item.isVisible)
    .map((item) => valueToKey(item.value));

  return { items: updatedItems, hiddenValues };
}
