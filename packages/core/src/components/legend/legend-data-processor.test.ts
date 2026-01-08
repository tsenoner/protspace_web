import { describe, it, expect, beforeEach } from 'vitest';
import {
  LegendDataProcessor,
  createProcessorContext,
  type LegendProcessorContext,
} from './legend-data-processor';
import type { LegendItem } from './types';

describe('legend-data-processor', () => {
  let ctx: LegendProcessorContext;

  beforeEach(() => {
    ctx = createProcessorContext();
  });

  describe('createProcessorContext', () => {
    it('creates a new context with empty slot tracker', () => {
      const context = createProcessorContext();
      expect(context.slotTracker).toBeDefined();
      expect(context.slotTracker.isEmpty()).toBe(true);
      expect(context.currentFeature).toBeNull();
    });
  });

  describe('getFilteredIndices', () => {
    it('returns empty set when not in isolation mode', () => {
      const result = LegendDataProcessor.getFilteredIndices(
        false,
        [['id1', 'id2']],
        ['id1', 'id2', 'id3'],
      );
      expect(result.size).toBe(0);
    });

    it('returns empty set when isolation history is empty', () => {
      const result = LegendDataProcessor.getFilteredIndices(true, [], ['id1', 'id2', 'id3']);
      expect(result.size).toBe(0);
    });

    it('filters indices based on isolation history', () => {
      const result = LegendDataProcessor.getFilteredIndices(
        true,
        [['id1', 'id2']],
        ['id1', 'id2', 'id3'],
      );
      expect(result.has(0)).toBe(true);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(false);
    });

    it('handles multiple isolation history levels', () => {
      const result = LegendDataProcessor.getFilteredIndices(
        true,
        [
          ['id1', 'id2', 'id3'],
          ['id1', 'id2'],
        ],
        ['id1', 'id2', 'id3'],
      );
      // Only id1 and id2 are in both histories
      expect(result.has(0)).toBe(true);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(false);
    });
  });

  describe('countFeatureFrequencies', () => {
    it('counts all values when not in isolation mode', () => {
      const values = ['a', 'b', 'a', 'c', 'a'];
      const result = LegendDataProcessor.countFeatureFrequencies(values, false, [], new Set());
      expect(result.get('a')).toBe(3);
      expect(result.get('b')).toBe(1);
      expect(result.get('c')).toBe(1);
    });

    it('handles null values', () => {
      const values = ['a', null, 'a', null];
      const result = LegendDataProcessor.countFeatureFrequencies(values, false, [], new Set());
      expect(result.get('a')).toBe(2);
      expect(result.get(null)).toBe(2);
    });

    it('filters by indices in isolation mode', () => {
      const values = ['a', 'b', 'a', 'c', 'a'];
      const filtered = new Set([0, 2, 4]);
      const result = LegendDataProcessor.countFeatureFrequencies(values, true, [['id1']], filtered);
      expect(result.get('a')).toBe(3);
      expect(result.has('b')).toBe(false);
      expect(result.has('c')).toBe(false);
    });
  });

  describe('sortAndLimitItems', () => {
    it('sorts by size (descending) by default', () => {
      const freq = new Map<string | null, number>([
        ['small', 5],
        ['large', 20],
        ['medium', 10],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, new Set(), 'size');
      expect(result.topItems[0][0]).toBe('large');
      expect(result.topItems[1][0]).toBe('medium');
      expect(result.topItems[2][0]).toBe('small');
    });

    it('sorts by size ascending with size-asc', () => {
      const freq = new Map<string | null, number>([
        ['small', 5],
        ['large', 20],
        ['medium', 10],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, new Set(), 'size-asc');
      expect(result.topItems[0][0]).toBe('small');
      expect(result.topItems[1][0]).toBe('medium');
      expect(result.topItems[2][0]).toBe('large');
    });

    it('sorts alphabetically with alpha mode', () => {
      const freq = new Map<string | null, number>([
        ['10-20', 5],
        ['1-5', 10],
        ['5-10', 8],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, new Set(), 'alpha');
      expect(result.topItems[0][0]).toBe('1-5');
      expect(result.topItems[1][0]).toBe('5-10');
      expect(result.topItems[2][0]).toBe('10-20');
    });

    it('limits items to maxVisibleValues', () => {
      const freq = new Map<string | null, number>([
        ['a', 10],
        ['b', 9],
        ['c', 8],
        ['d', 7],
        ['e', 6],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 3, false, new Set(), 'size');
      expect(result.topItems).toHaveLength(3);
      expect(result.otherItems).toHaveLength(2);
    });

    it('calculates other count correctly', () => {
      const freq = new Map<string | null, number>([
        ['a', 10],
        ['b', 9],
        ['c', 8],
        ['d', 7],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 2, false, new Set(), 'size');
      expect(result.otherCount).toBe(15); // 8 + 7
    });

    it('respects manually set other values', () => {
      const freq = new Map<string | null, number>([
        ['keep', 10],
        ['manual-other', 9],
        ['also-keep', 8],
      ]);
      const manualOther = new Set(['manual-other']);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 3, false, manualOther, 'size');
      // manual-other should be in otherItems even though it would fit
      expect(result.otherItems.some((i) => i.value === 'manual-other')).toBe(true);
    });

    it('handles null values in sorting', () => {
      const freq = new Map<string | null, number>([
        ['a', 10],
        [null, 5],
        ['b', 8],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, new Set(), 'size');
      expect(result.topItems.some(([v]) => v === null)).toBe(true);
    });
  });

  describe('createLegendItems', () => {
    it('creates legend items with correct properties', () => {
      const topItems: Array<[string | null, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 0, false, true, [], false);
      expect(items).toHaveLength(2);
      expect(items[0].value).toBe('category1');
      expect(items[0].count).toBe(10);
      expect(items[0].isVisible).toBe(true);
      expect(items[0].color).toBeDefined();
      expect(items[0].shape).toBe('circle');
    });

    it('adds Other item when otherCount > 0 and includeOthers', () => {
      const topItems: Array<[string | null, number]> = [['category1', 10]];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 5, false, true, [], false);
      expect(items.some((i) => i.value === 'Other')).toBe(true);
    });

    it('does not add Other item when includeOthers is false', () => {
      const topItems: Array<[string | null, number]> = [['category1', 10]];
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        5,
        false,
        false,
        [],
        false,
      );
      expect(items.some((i) => i.value === 'Other')).toBe(false);
    });

    it('does not add Other item in isolation mode', () => {
      const topItems: Array<[string | null, number]> = [['category1', 10]];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 5, true, true, [], false);
      expect(items.some((i) => i.value === 'Other')).toBe(false);
    });

    it('preserves existing z-order', () => {
      const topItems: Array<[string | null, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const existing: LegendItem[] = [
        {
          value: 'category2',
          color: '#000',
          shape: 'circle',
          count: 5,
          isVisible: true,
          zOrder: 99,
        },
      ];
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        true,
        existing,
        false,
      );
      const cat2 = items.find((i) => i.value === 'category2');
      expect(cat2?.zOrder).toBe(99);
    });

    it('includes shapes when shapesEnabled', () => {
      const topItems: Array<[string | null, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 0, false, true, [], true);
      const shapes = new Set(items.map((i) => i.shape));
      expect(shapes.size).toBeGreaterThan(1);
    });
  });

  describe('createExtractedItem', () => {
    it('creates an extracted item with correct properties', () => {
      const item = LegendDataProcessor.createExtractedItem(ctx, 'extracted', 5, 10, false);
      expect(item.value).toBe('extracted');
      expect(item.count).toBe(5);
      expect(item.zOrder).toBe(10);
      expect(item.isVisible).toBe(true);
      expect(item.extractedFromOther).toBe(true);
      expect(item.color).toBeDefined();
    });

    it('assigns consistent slots for same value', () => {
      const item1 = LegendDataProcessor.createExtractedItem(ctx, 'same', 5, 10, false);
      const item2 = LegendDataProcessor.createExtractedItem(ctx, 'same', 5, 11, false);
      expect(item1.color).toBe(item2.color);
    });
  });

  describe('addNullEntry', () => {
    it('adds null entry when in frequency but not in top items', () => {
      const items: LegendItem[] = [];
      const freq = new Map<string | null, number>([
        ['a', 10],
        [null, 5],
      ]);
      const topItems: Array<[string | null, number]> = [['a', 10]];
      LegendDataProcessor.addNullEntry(items, freq, topItems, [], false);
      expect(items.some((i) => i.value === null)).toBe(true);
    });

    it('does not add null entry when already in top items', () => {
      const items: LegendItem[] = [];
      const freq = new Map<string | null, number>([
        ['a', 10],
        [null, 5],
      ]);
      const topItems: Array<[string | null, number]> = [
        ['a', 10],
        [null, 5],
      ];
      LegendDataProcessor.addNullEntry(items, freq, topItems, [], false);
      expect(items).toHaveLength(0);
    });

    it('preserves existing null z-order', () => {
      const items: LegendItem[] = [];
      const freq = new Map<string | null, number>([[null, 5]]);
      const topItems: Array<[string | null, number]> = [];
      const existing: LegendItem[] = [
        { value: null, color: '#000', shape: 'circle', count: 5, isVisible: true, zOrder: 99 },
      ];
      LegendDataProcessor.addNullEntry(items, freq, topItems, existing, false);
      expect(items[0]?.zOrder).toBe(99);
    });
  });

  describe('addExtractedItems', () => {
    it('re-adds extracted items from existing', () => {
      const items: LegendItem[] = [];
      const freq = new Map<string | null, number>([['extracted', 5]]);
      const existing: LegendItem[] = [
        {
          value: 'extracted',
          color: '#000',
          shape: 'circle',
          count: 5,
          isVisible: true,
          zOrder: 10,
          extractedFromOther: true,
        },
      ];
      LegendDataProcessor.addExtractedItems(ctx, items, freq, existing, false);
      expect(items.some((i) => i.value === 'extracted')).toBe(true);
      expect(items[0].extractedFromOther).toBe(true);
    });

    it('does not duplicate items already in the list', () => {
      const items: LegendItem[] = [
        {
          value: 'extracted',
          color: '#000',
          shape: 'circle',
          count: 5,
          isVisible: true,
          zOrder: 5,
        },
      ];
      const freq = new Map<string | null, number>([['extracted', 5]]);
      const existing: LegendItem[] = [
        {
          value: 'extracted',
          color: '#000',
          shape: 'circle',
          count: 5,
          isVisible: true,
          zOrder: 10,
          extractedFromOther: true,
        },
      ];
      LegendDataProcessor.addExtractedItems(ctx, items, freq, existing, false);
      expect(items).toHaveLength(1);
    });

    it('does not add extracted items not in frequency map', () => {
      const items: LegendItem[] = [];
      const freq = new Map<string | null, number>([['other', 5]]);
      const existing: LegendItem[] = [
        {
          value: 'extracted',
          color: '#000',
          shape: 'circle',
          count: 5,
          isVisible: true,
          zOrder: 10,
          extractedFromOther: true,
        },
      ];
      LegendDataProcessor.addExtractedItems(ctx, items, freq, existing, false);
      expect(items).toHaveLength(0);
    });
  });

  describe('processLegendItems', () => {
    it('processes basic feature values', () => {
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'feature1',
        ['a', 'b', 'a', 'c', 'a', 'b'],
        ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
        10,
        false,
        [],
        [],
        true,
        [],
        'size',
        false,
      );
      expect(result.legendItems.length).toBeGreaterThan(0);
      expect(result.legendItems.find((i) => i.value === 'a')?.count).toBe(3);
    });

    it('resets slot tracker on feature change', () => {
      LegendDataProcessor.processLegendItems(
        ctx,
        'feature1',
        ['a', 'b'],
        ['p1', 'p2'],
        10,
        false,
        [],
        [],
        true,
        [],
        'size',
        false,
      );
      expect(ctx.currentFeature).toBe('feature1');

      LegendDataProcessor.processLegendItems(
        ctx,
        'feature2',
        ['c', 'd'],
        ['p1', 'p2'],
        10,
        false,
        [],
        [],
        true,
        [],
        'size',
        false,
      );
      expect(ctx.currentFeature).toBe('feature2');
    });

    it('creates Other bucket when exceeding max visible', () => {
      const values = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'feature1',
        values,
        values.map((_, i) => `p${i}`),
        3,
        false,
        [],
        [],
        true,
        [],
        'size',
        false,
      );
      expect(result.legendItems.some((i) => i.value === 'Other')).toBe(true);
      expect(result.otherItems.length).toBeGreaterThan(0);
    });

    it('handles isolation mode', () => {
      const values = ['a', 'b', 'a', 'c'];
      const proteinIds = ['p1', 'p2', 'p3', 'p4'];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'feature1',
        values,
        proteinIds,
        10,
        true,
        [['p1', 'p3']],
        [],
        true,
        [],
        'size',
        false,
      );
      // Only p1 and p3 are in isolation, both have value 'a'
      expect(result.legendItems.find((i) => i.value === 'a')?.count).toBe(2);
    });

    it('respects includeOthers setting', () => {
      const values = ['a', 'b', 'c', 'd', 'e'];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'feature1',
        values,
        values.map((_, i) => `p${i}`),
        2,
        false,
        [],
        [],
        false, // includeOthers = false
        [],
        'size',
        false,
      );
      expect(result.legendItems.some((i) => i.value === 'Other')).toBe(false);
    });

    it('handles manuallyOtherValues', () => {
      const values = ['a', 'b', 'c'];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'feature1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        [],
        true,
        ['b'], // manually put 'b' in Other
        'size',
        false,
      );
      expect(result.otherItems.some((i) => i.value === 'b')).toBe(true);
    });

    it('preserves extracted items across processing', () => {
      const values = ['a', 'b', 'c'];
      const existing: LegendItem[] = [
        {
          value: 'c',
          color: '#000',
          shape: 'circle',
          count: 1,
          isVisible: true,
          zOrder: 5,
          extractedFromOther: true,
        },
      ];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'feature1',
        values,
        values.map((_, i) => `p${i}`),
        2,
        false,
        [],
        existing,
        true,
        [],
        'size',
        false,
      );
      expect(result.legendItems.some((i) => i.value === 'c' && i.extractedFromOther)).toBe(true);
    });
  });
});
