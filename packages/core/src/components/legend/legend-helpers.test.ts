import { describe, it, expect } from 'vitest';
import type { LegendItem, OtherItem } from './types';
import {
  valueToKey,
  normalizeSortMode,
  normalizeSortModes,
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
import { initializeFeatureSortMode } from './legend-settings-dialog';

describe('legend-helpers', () => {
  describe('valueToKey', () => {
    it('converts null to "null" string', () => {
      expect(valueToKey(null)).toBe('null');
    });

    it('returns string values unchanged', () => {
      expect(valueToKey('test')).toBe('test');
      expect(valueToKey('Other')).toBe('Other');
      expect(valueToKey('')).toBe('');
    });
  });

  describe('normalizeSortMode', () => {
    it('converts alpha-desc to alpha', () => {
      expect(normalizeSortMode('alpha-desc')).toBe('alpha');
    });

    it('converts size-asc to size', () => {
      expect(normalizeSortMode('size-asc')).toBe('size');
    });

    it('returns alpha unchanged', () => {
      expect(normalizeSortMode('alpha')).toBe('alpha');
    });

    it('returns size unchanged', () => {
      expect(normalizeSortMode('size')).toBe('size');
    });
  });

  describe('normalizeSortModes', () => {
    it('normalizes all modes in a record', () => {
      const input = {
        feature1: 'alpha-desc' as const,
        feature2: 'size-asc' as const,
        feature3: 'alpha' as const,
      };
      const result = normalizeSortModes(input);
      expect(result).toEqual({
        feature1: 'alpha',
        feature2: 'size',
        feature3: 'alpha',
      });
    });

    it('returns empty object for empty input', () => {
      expect(normalizeSortModes({})).toEqual({});
    });
  });

  describe('expandHiddenValues', () => {
    const otherItems: OtherItem[] = [
      { value: 'cat1', count: 5 },
      { value: 'cat2', count: 3 },
      { value: null, count: 2 },
    ];

    it('expands Other to concrete values', () => {
      const result = expandHiddenValues(['Other'], otherItems);
      expect(result).toEqual(['cat1', 'cat2', 'null']);
    });

    it('keeps non-Other values unchanged', () => {
      const result = expandHiddenValues(['value1', 'value2'], otherItems);
      expect(result).toEqual(['value1', 'value2']);
    });

    it('combines expanded Other with other values', () => {
      const result = expandHiddenValues(['value1', 'Other'], otherItems);
      expect(result).toEqual(['value1', 'cat1', 'cat2', 'null']);
    });

    it('deduplicates values', () => {
      const result = expandHiddenValues(['cat1', 'Other'], otherItems);
      expect(result).toEqual(['cat1', 'cat2', 'null']);
    });

    it('returns empty array for empty input', () => {
      expect(expandHiddenValues([], otherItems)).toEqual([]);
    });
  });

  describe('computeOtherConcreteValues', () => {
    it('converts other items to string keys', () => {
      const otherItems: OtherItem[] = [
        { value: 'cat1', count: 5 },
        { value: null, count: 2 },
      ];
      expect(computeOtherConcreteValues(otherItems)).toEqual(['cat1', 'null']);
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

    it('excludes null values', () => {
      const items: LegendItem[] = [
        { value: null, color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];

      expect(buildZOrderMapping(items)).toEqual({ a: 1 });
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

    it('handles null values with "null" key', () => {
      const items: LegendItem[] = [
        { value: null, color: '#888', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
      ];

      const result = buildColorShapeMappings(items);

      expect(result.colorMapping).toEqual({ null: '#888' });
      expect(result.shapeMapping).toEqual({ null: 'circle' });
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
    it('creates default settings with size sort for regular features', () => {
      const settings = createDefaultSettings('some_feature');
      expect(settings.sortMode).toBe('size');
      expect(settings.maxVisibleValues).toBe(10);
      expect(settings.includeOthers).toBe(true);
      expect(settings.hiddenValues).toEqual([]);
    });

    it('creates default settings with alpha sort for length features', () => {
      const settings = createDefaultSettings('length_fixed');
      expect(settings.sortMode).toBe('alpha');
    });
  });

  describe('getDefaultSortMode', () => {
    it('returns alpha for length_fixed', () => {
      expect(getDefaultSortMode('length_fixed')).toBe('alpha');
    });

    it('returns alpha for length_quantile', () => {
      expect(getDefaultSortMode('length_quantile')).toBe('alpha');
    });

    it('returns size for other features', () => {
      expect(getDefaultSortMode('some_feature')).toBe('size');
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

    it('adds extracted class when extractedFromOther', () => {
      const item = { ...baseItem, extractedFromOther: true };
      expect(getItemClasses(item, false, false)).toBe('legend-item extracted');
    });

    it('combines multiple classes', () => {
      const item = { ...baseItem, isVisible: false, extractedFromOther: true };
      expect(getItemClasses(item, true, true)).toBe(
        'legend-item hidden dragging selected extracted',
      );
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

    it('handles null value with "null" in selectedItems', () => {
      const item: LegendItem = {
        value: null,
        color: '#000',
        shape: 'circle',
        count: 1,
        isVisible: true,
        zOrder: 0,
      };
      expect(isItemSelected(item, ['null'])).toBe(true);
    });

    it('returns false for null value when selectedItems is empty', () => {
      const item: LegendItem = {
        value: null,
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

  describe('initializeFeatureSortMode', () => {
    it('returns unchanged modes if feature already has a mode', () => {
      const existing = { feature1: 'alpha' as const };
      const result = initializeFeatureSortMode(existing, 'feature1', {});
      expect(result).toEqual({ feature1: 'alpha' });
    });

    it('returns unchanged modes if no selected feature', () => {
      const existing = { feature1: 'size' as const };
      const result = initializeFeatureSortMode(existing, '', {});
      expect(result).toEqual({ feature1: 'size' });
    });

    it('adds normalized mode from current modes if exists', () => {
      const existing = {};
      const current = { newFeature: 'alpha-desc' as const };
      const result = initializeFeatureSortMode(existing, 'newFeature', current);
      expect(result).toEqual({ newFeature: 'alpha' });
    });

    it('defaults to size for regular features', () => {
      const result = initializeFeatureSortMode({}, 'some_feature', {});
      expect(result).toEqual({ some_feature: 'size' });
    });

    it('defaults to alpha for length_fixed feature', () => {
      const result = initializeFeatureSortMode({}, 'length_fixed', {});
      expect(result).toEqual({ length_fixed: 'alpha' });
    });

    it('defaults to alpha for length_quantile feature', () => {
      const result = initializeFeatureSortMode({}, 'length_quantile', {});
      expect(result).toEqual({ length_quantile: 'alpha' });
    });

    it('normalizes size-asc to size', () => {
      const current = { feature1: 'size-asc' as const };
      const result = initializeFeatureSortMode({}, 'feature1', current);
      expect(result).toEqual({ feature1: 'size' });
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
      const event = createItemActionEvent('legend-item-click', 'feature', 'isolate');
      expect(event.detail).toEqual({ value: 'feature', action: 'isolate' });
    });

    it('creates an extract action event', () => {
      const event = createItemActionEvent('legend-item-click', 'extracted', 'extract');
      expect(event.detail).toEqual({ value: 'extracted', action: 'extract' });
    });

    it('creates a merge-into-other action event', () => {
      const event = createItemActionEvent('legend-item-click', 'merged', 'merge-into-other');
      expect(event.detail).toEqual({ value: 'merged', action: 'merge-into-other' });
    });

    it('handles null value', () => {
      const event = createItemActionEvent('legend-item-click', null, 'toggle');
      expect(event.detail).toEqual({ value: null, action: 'toggle' });
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

    it('handles null values correctly', () => {
      const itemsWithNull: LegendItem[] = [
        { value: null, color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];
      const result = updateItemsVisibility(itemsWithNull, [], 'null');
      expect(result.items[0].isVisible).toBe(false);
      expect(result.hiddenValues).toEqual(['null']);
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

    it('handles null value correctly', () => {
      const itemsWithNull: LegendItem[] = [
        { value: null, color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 0 },
        { value: 'a', color: '#000', shape: 'circle', count: 1, isVisible: true, zOrder: 1 },
      ];
      const result = isolateItem(itemsWithNull, null);
      expect(result.items[0].isVisible).toBe(true);
      expect(result.items[1].isVisible).toBe(false);
      expect(result.hiddenValues).toEqual(['a']);
    });
  });
});
