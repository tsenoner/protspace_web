import { describe, it, expect } from 'vitest';
import type { LegendItem, OtherItem } from './types';
import { LEGEND_VALUES } from './config';
import {
  valueToKey,
  expandHiddenValues,
  computeOtherConcreteValues,
  reverseZOrderKeepOtherLast,
  buildZOrderMapping,
  buildColorShapeMappings,
  calculatePointSize,
  createDefaultSettings,
  getDefaultSortMode,
  getItemClasses,
  isItemSelected,
  createItemActionEvent,
  updateItemsVisibility,
  isolateItem,
} from './legend-helpers';
import { initializeAnnotationSortMode } from './legend-settings-dialog';

describe('legend-helpers', () => {
  describe('valueToKey', () => {
    it('returns string values unchanged', () => {
      expect(valueToKey('test')).toBe('test');
      expect(valueToKey('Other')).toBe('Other');
      expect(valueToKey('')).toBe('');
      expect(valueToKey(LEGEND_VALUES.NA_VALUE)).toBe(LEGEND_VALUES.NA_VALUE);
    });
  });

  describe('expandHiddenValues', () => {
    const otherItems: OtherItem[] = [
      { value: 'cat1', count: 5 },
      { value: 'cat2', count: 3 },
      { value: LEGEND_VALUES.NA_VALUE, count: 2 },
    ];

    it('expands Other to concrete values', () => {
      const result = expandHiddenValues(['Other'], otherItems);
      expect(result).toEqual(['cat1', 'cat2', LEGEND_VALUES.NA_VALUE]);
    });

    it('keeps non-Other values unchanged', () => {
      const result = expandHiddenValues(['value1', 'value2'], otherItems);
      expect(result).toEqual(['value1', 'value2']);
    });

    it('combines expanded Other with other values', () => {
      const result = expandHiddenValues(['value1', 'Other'], otherItems);
      expect(result).toEqual(['value1', 'cat1', 'cat2', LEGEND_VALUES.NA_VALUE]);
    });

    it('deduplicates values', () => {
      const result = expandHiddenValues(['cat1', 'Other'], otherItems);
      expect(result).toEqual(['cat1', 'cat2', LEGEND_VALUES.NA_VALUE]);
    });

    it('returns empty array for empty input', () => {
      expect(expandHiddenValues([], otherItems)).toEqual([]);
    });
  });

  describe('computeOtherConcreteValues', () => {
    it('converts other items to string keys', () => {
      const otherItems: OtherItem[] = [
        { value: 'cat1', count: 5 },
        { value: LEGEND_VALUES.NA_VALUE, count: 2 },
      ];
      expect(computeOtherConcreteValues(otherItems)).toEqual(['cat1', LEGEND_VALUES.NA_VALUE]);
    });

    it('returns empty array for empty input', () => {
      expect(computeOtherConcreteValues([])).toEqual([]);
    });
  });

  describe('reverseZOrderKeepOtherLast', () => {
    it('reverses z-order keeping Other at the end', () => {
      const items: LegendItem[] = [
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'b', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
        { value: 'Other', color: '#888', shape: 'circle', count: 1, isVisible: true, zOrder: 2 },
      ];

      const result = reverseZOrderKeepOtherLast(items);

      expect(result[0].value).toBe('b');
      expect(result[0].zOrder).toBe(0);
      expect(result[1].value).toBe('a');
      expect(result[1].zOrder).toBe(1);
      expect(result[2].value).toBe('Other');
      expect(result[2].zOrder).toBe(2);
    });

    it('reverses z-order when no Other present', () => {
      const items: LegendItem[] = [
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'b', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];

      const result = reverseZOrderKeepOtherLast(items);

      expect(result[0].value).toBe('b');
      expect(result[1].value).toBe('a');
    });

    it('returns empty array for empty input', () => {
      expect(reverseZOrderKeepOtherLast([])).toEqual([]);
    });

    it('returns single item unchanged', () => {
      const items: LegendItem[] = [
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
      ];
      const result = reverseZOrderKeepOtherLast(items);
      expect(result).toEqual(items);
    });
  });

  describe('buildZOrderMapping', () => {
    it('builds mapping from legend items', () => {
      const items: LegendItem[] = [
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'b', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];

      expect(buildZOrderMapping(items)).toEqual({ a: 0, b: 1 });
    });

    it('includes N/A values with __NA__ key', () => {
      const items: LegendItem[] = [
        {
          value: LEGEND_VALUES.NA_VALUE,
          color: '#000',
          shape: 'circle',
          count: 1,
          isVisible: true,
          zOrder: 0,
        },
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];

      expect(buildZOrderMapping(items)).toEqual({ [LEGEND_VALUES.NA_VALUE]: 0, a: 1 });
    });
  });

  describe('buildColorShapeMappings', () => {
    it('builds color and shape mappings', () => {
      const items: LegendItem[] = [
        { value: 'a', color: '#f00', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'b', color: '#0f0', shape: 'square', count: 1, isVisible: true, zOrder: 1 },
      ];

      const result = buildColorShapeMappings(items);

      expect(result.colorMapping).toEqual({ a: '#f00', b: '#0f0' });
      expect(result.shapeMapping).toEqual({ a: 'circle', b: 'square' });
    });

    it('handles N/A values with __NA__ key', () => {
      const items: LegendItem[] = [
        {
          value: LEGEND_VALUES.NA_VALUE,
          color: '#888',
          shape: 'circle',
          count: 1,
          isVisible: true,
          zOrder: 0,
        },
      ];

      const result = buildColorShapeMappings(items);

      expect(result.colorMapping).toEqual({ [LEGEND_VALUES.NA_VALUE]: '#888' });
      expect(result.shapeMapping).toEqual({ [LEGEND_VALUES.NA_VALUE]: 'circle' });
    });
  });

  describe('calculatePointSize', () => {
    it('calculates point size from shape size', () => {
      // With symbolSizeMultiplier of 8, shape size 10 -> 80
      expect(calculatePointSize(10)).toBe(80);
    });

    it('enforces minimum of 10', () => {
      expect(calculatePointSize(1)).toBe(10);
      expect(calculatePointSize(0)).toBe(10);
    });
  });

  describe('createDefaultSettings', () => {
    it('creates default settings with size-desc sort for regular annotations', () => {
      const settings = createDefaultSettings('some_annotation');
      expect(settings.sortMode).toBe('size-desc');
      expect(settings.maxVisibleValues).toBe(10);
      expect(settings.hiddenValues).toEqual([]);
      expect(settings.categories).toEqual({});
    });

    it('creates default settings with alpha-asc sort for length annotations', () => {
      const settings = createDefaultSettings('length_fixed');
      expect(settings.sortMode).toBe('alpha-asc');
    });
  });

  describe('getDefaultSortMode', () => {
    it('returns alpha-asc for length_fixed', () => {
      expect(getDefaultSortMode('length_fixed')).toBe('alpha-asc');
    });

    it('returns alpha-asc for length_quantile', () => {
      expect(getDefaultSortMode('length_quantile')).toBe('alpha-asc');
    });

    it('returns size-desc for other annotations', () => {
      expect(getDefaultSortMode('some_annotation')).toBe('size-desc');
    });
  });

  describe('getItemClasses', () => {
    const baseItem: LegendItem = {
      value: 'test',
      color: '#000',
      shape: 'circle',
      count: 1,
      isVisible: true,
      zOrder: 0,
    };

    it('returns base class for visible, unselected item', () => {
      expect(getItemClasses(baseItem, false, false)).toBe('legend-item');
    });

    it('adds hidden class when not visible', () => {
      const item = { ...baseItem, isVisible: false };
      expect(getItemClasses(item, false, false)).toBe('legend-item hidden');
    });

    it('adds selected class when selected', () => {
      expect(getItemClasses(baseItem, true, false)).toBe('legend-item selected');
    });

    it('adds dragging class when dragging', () => {
      expect(getItemClasses(baseItem, false, true)).toBe('legend-item dragging');
    });

    it('combines multiple classes', () => {
      const item = { ...baseItem, isVisible: false };
      expect(getItemClasses(item, true, true)).toBe('legend-item hidden dragging selected');
    });
  });

  describe('isItemSelected', () => {
    it('returns true when item value is in selectedItems', () => {
      const item: LegendItem = {
        value: 'a',
        color: '#000',
        shape: 'circle',
        count: 1,
        isVisible: true,
        zOrder: 0,
      };
      expect(isItemSelected(item, ['a', 'b'])).toBe(true);
    });

    it('returns false when item value is not in selectedItems', () => {
      const item: LegendItem = {
        value: 'c',
        color: '#000',
        shape: 'circle',
        count: 1,
        isVisible: true,
        zOrder: 0,
      };
      expect(isItemSelected(item, ['a', 'b'])).toBe(false);
    });

    it('handles N/A value with __NA__ in selectedItems', () => {
      const item: LegendItem = {
        value: LEGEND_VALUES.NA_VALUE,
        color: '#000',
        shape: 'circle',
        count: 1,
        isVisible: true,
        zOrder: 0,
      };
      expect(isItemSelected(item, [LEGEND_VALUES.NA_VALUE])).toBe(true);
    });

    it('returns false for N/A value when selectedItems is empty', () => {
      const item: LegendItem = {
        value: LEGEND_VALUES.NA_VALUE,
        color: '#000',
        shape: 'circle',
        count: 1,
        isVisible: true,
        zOrder: 0,
      };
      expect(isItemSelected(item, [])).toBe(false);
    });

    it('returns false for Other item even when in selectedItems', () => {
      const item: LegendItem = {
        value: 'Other',
        color: '#888',
        shape: 'circle',
        count: 1,
        isVisible: true,
        zOrder: 0,
      };
      expect(isItemSelected(item, ['Other'])).toBe(false);
    });
  });

  describe('initializeAnnotationSortMode', () => {
    it('returns unchanged modes if annotation already has a mode', () => {
      const existing = { annotation1: 'alpha-asc' as const };
      const result = initializeAnnotationSortMode(existing, 'annotation1', {});
      expect(result).toEqual({ annotation1: 'alpha-asc' });
    });

    it('returns unchanged modes if no selected annotation', () => {
      const existing = { annotation1: 'size-desc' as const };
      const result = initializeAnnotationSortMode(existing, '', {});
      expect(result).toEqual({ annotation1: 'size-desc' });
    });

    it('uses existing mode from current modes if exists', () => {
      const existing = {};
      const current = { newAnnotation: 'alpha-desc' as const };
      const result = initializeAnnotationSortMode(existing, 'newAnnotation', current);
      expect(result).toEqual({ newAnnotation: 'alpha-desc' });
    });

    it('defaults to size-desc for regular annotations', () => {
      const result = initializeAnnotationSortMode({}, 'some_annotation', {});
      expect(result).toEqual({ some_annotation: 'size-desc' });
    });

    it('defaults to alpha-asc for length_fixed annotation', () => {
      const result = initializeAnnotationSortMode({}, 'length_fixed', {});
      expect(result).toEqual({ length_fixed: 'alpha-asc' });
    });

    it('defaults to alpha-asc for length_quantile annotation', () => {
      const result = initializeAnnotationSortMode({}, 'length_quantile', {});
      expect(result).toEqual({ length_quantile: 'alpha-asc' });
    });
  });

  describe('createItemActionEvent', () => {
    it('creates a toggle action event', () => {
      const event = createItemActionEvent('legend-item-click', 'testValue', 'toggle');
      expect(event.type).toBe('legend-item-click');
      expect(event.detail).toEqual({ value: 'testValue', action: 'toggle' });
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    });

    it('creates an isolate action event', () => {
      const event = createItemActionEvent('legend-item-click', 'category', 'isolate');
      expect(event.detail).toEqual({ value: 'category', action: 'isolate' });
    });

    it('creates an extract action event', () => {
      const event = createItemActionEvent('legend-item-click', 'extracted', 'extract');
      expect(event.detail).toEqual({ value: 'extracted', action: 'extract' });
    });

    it('handles N/A value', () => {
      const event = createItemActionEvent('legend-item-click', LEGEND_VALUES.NA_VALUE, 'toggle');
      expect(event.detail).toEqual({ value: LEGEND_VALUES.NA_VALUE, action: 'toggle' });
    });
  });

  describe('updateItemsVisibility', () => {
    const items: LegendItem[] = [
      { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
      { value: 'b', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      { value: 'c', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 2 },
    ];

    it('hides a visible item', () => {
      const result = updateItemsVisibility(items, [], 'a');
      expect(result.items[0].isVisible).toBe(false);
      expect(result.items[1].isVisible).toBe(true);
      expect(result.items[2].isVisible).toBe(true);
      expect(result.hiddenValues).toEqual(['a']);
    });

    it('shows a hidden item', () => {
      const result = updateItemsVisibility(items, ['a'], 'a');
      expect(result.items[0].isVisible).toBe(true);
      expect(result.hiddenValues).toEqual([]);
    });

    it('resets to all visible if hiding last visible item', () => {
      const hiddenItems = [
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: false, zOrder: 0 },
        { value: 'b', color: '#000', shape: 'circle', count: 1, isVisible: false, zOrder: 1 },
        { value: 'c', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 2 },
      ];
      const result = updateItemsVisibility(hiddenItems, ['a', 'b'], 'c');
      expect(result.items.every((i) => i.isVisible)).toBe(true);
      expect(result.hiddenValues).toEqual([]);
    });

    it('handles N/A values correctly', () => {
      const itemsWithNA: LegendItem[] = [
        {
          value: LEGEND_VALUES.NA_VALUE,
          color: '#000',
          shape: 'circle',
          count: 1,
          isVisible: true,
          zOrder: 0,
        },
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];
      const result = updateItemsVisibility(itemsWithNA, [], LEGEND_VALUES.NA_VALUE);
      expect(result.items[0].isVisible).toBe(false);
      expect(result.hiddenValues).toEqual([LEGEND_VALUES.NA_VALUE]);
    });
  });

  describe('isolateItem', () => {
    const items: LegendItem[] = [
      { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
      { value: 'b', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      { value: 'c', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 2 },
    ];

    it('isolates a single item (shows only that item)', () => {
      const result = isolateItem(items, 'a');
      expect(result.items[0].isVisible).toBe(true);
      expect(result.items[1].isVisible).toBe(false);
      expect(result.items[2].isVisible).toBe(false);
      expect(result.hiddenValues).toEqual(['b', 'c']);
    });

    it('shows all items when isolating an already isolated item', () => {
      const isolatedItems: LegendItem[] = [
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'b', color: '#000', shape: 'circle', count: 1, isVisible: false, zOrder: 1 },
        { value: 'c', color: '#000', shape: 'circle', count: 1, isVisible: false, zOrder: 2 },
      ];
      const result = isolateItem(isolatedItems, 'a');
      expect(result.items.every((i) => i.isVisible)).toBe(true);
      expect(result.hiddenValues).toEqual([]);
    });

    it('returns unchanged if item not found', () => {
      const result = isolateItem(items, 'nonexistent');
      expect(result.items).toBe(items);
      expect(result.hiddenValues).toEqual([]);
    });

    it('handles N/A value correctly', () => {
      const itemsWithNA: LegendItem[] = [
        {
          value: LEGEND_VALUES.NA_VALUE,
          color: '#000',
          shape: 'circle',
          count: 1,
          isVisible: true,
          zOrder: 0,
        },
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];
      const result = isolateItem(itemsWithNA, LEGEND_VALUES.NA_VALUE);
      expect(result.items[0].isVisible).toBe(true);
      expect(result.items[1].isVisible).toBe(false);
      expect(result.hiddenValues).toEqual(['a']);
    });
  });
});
