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
      expect(context.currentAnnotation).toBeNull();
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

  describe('countAnnotationFrequencies', () => {
    it('counts all values when not in isolation mode', () => {
      const values = ['a', 'b', 'a', 'c', 'a'];
      const result = LegendDataProcessor.countAnnotationFrequencies(values, false, [], new Set());
      expect(result.get('a')).toBe(3);
      expect(result.get('b')).toBe(1);
      expect(result.get('c')).toBe(1);
    });

    it('handles null values', () => {
      const values = ['a', null, 'a', null];
      const result = LegendDataProcessor.countAnnotationFrequencies(values, false, [], new Set());
      expect(result.get('a')).toBe(2);
      expect(result.get(null)).toBe(2);
    });

    it('filters by indices in isolation mode', () => {
      const values = ['a', 'b', 'a', 'c', 'a'];
      const filtered = new Set([0, 2, 4]);
      const result = LegendDataProcessor.countAnnotationFrequencies(
        values,
        true,
        [['id1']],
        filtered,
      );
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
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, 'size-desc');
      expect(result.topItems[0][0]).toBe('large');
      expect(result.topItems[1][0]).toBe('medium');
      expect(result.topItems[2][0]).toBe('small');
    });

    it('sorts alphabetically with alpha mode', () => {
      const freq = new Map<string | null, number>([
        ['10-20', 5],
        ['1-5', 10],
        ['5-10', 8],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, 'alpha-asc');
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
      const result = LegendDataProcessor.sortAndLimitItems(freq, 3, false, 'size-desc');
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
      const result = LegendDataProcessor.sortAndLimitItems(freq, 2, false, 'size-desc');
      expect(result.otherCount).toBe(15); // 8 + 7
    });

    it('handles null values in sorting', () => {
      const freq = new Map<string | null, number>([
        ['a', 10],
        [null, 5],
        ['b', 8],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, 'size-desc');
      expect(result.topItems.some(([v]) => v === null)).toBe(true);
    });
  });

  describe('createLegendItems', () => {
    it('creates legend items with correct properties', () => {
      const topItems: Array<[string | null, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 0, false, [], false);
      expect(items).toHaveLength(2);
      expect(items[0].value).toBe('category1');
      expect(items[0].count).toBe(10);
      expect(items[0].isVisible).toBe(true);
      expect(items[0].color).toBeDefined();
      expect(items[0].shape).toBe('circle');
    });

    it('adds Other item when otherCount > 0', () => {
      const topItems: Array<[string | null, number]> = [['category1', 10]];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 5, false, [], false);
      expect(items.some((i) => i.value === 'Other')).toBe(true);
    });

    it('does not add Other item in isolation mode', () => {
      const topItems: Array<[string | null, number]> = [['category1', 10]];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 5, true, [], false);
      expect(items.some((i) => i.value === 'Other')).toBe(false);
    });

    it('preserves existing z-order in manual mode', () => {
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
      // In manual mode, existing zOrders should be preserved
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        existing,
        false,
        'manual',
      );
      const cat2 = items.find((i) => i.value === 'category2');
      expect(cat2?.zOrder).toBe(99);
    });

    it('uses sorted index for z-order in non-manual modes', () => {
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
      // In size mode, zOrder should be based on sorted index, not existing
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        existing,
        false,
        'size-desc',
      );
      const cat1 = items.find((i) => i.value === 'category1');
      const cat2 = items.find((i) => i.value === 'category2');
      expect(cat1?.zOrder).toBe(0); // First in sorted order
      expect(cat2?.zOrder).toBe(1); // Second in sorted order
    });

    it('reassigns z-order based on reversed position in manual-reverse mode', () => {
      // Items are passed in reverse order (as sortAndLimitItems would sort them)
      const topItems: Array<[string | null, number]> = [
        ['category2', 5], // Was at zOrder 1, now first
        ['category1', 10], // Was at zOrder 0, now second
      ];
      const existing: LegendItem[] = [
        {
          value: 'category1',
          color: '#000',
          shape: 'circle',
          count: 10,
          isVisible: true,
          zOrder: 0,
        },
        {
          value: 'category2',
          color: '#000',
          shape: 'circle',
          count: 5,
          isVisible: true,
          zOrder: 1,
        },
      ];
      // In manual-reverse mode, zOrder should be based on sorted index (reversed position)
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        existing,
        false,
        'manual-reverse',
      );
      const cat1 = items.find((i) => i.value === 'category1');
      const cat2 = items.find((i) => i.value === 'category2');
      expect(cat2?.zOrder).toBe(0); // First in reversed order
      expect(cat1?.zOrder).toBe(1); // Second in reversed order
    });

    it('includes shapes when shapesEnabled', () => {
      const topItems: Array<[string | null, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 0, false, [], true);
      const shapes = new Set(items.map((i) => i.shape));
      expect(shapes.size).toBeGreaterThan(1);
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

  describe('processLegendItems', () => {
    it('processes basic annotation values', () => {
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        ['a', 'b', 'a', 'c', 'a', 'b'],
        ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
        10,
        false,
        [],
        [],
        'size-desc',
        false,
      );
      expect(result.legendItems.length).toBeGreaterThan(0);
      expect(result.legendItems.find((i) => i.value === 'a')?.count).toBe(3);
    });

    it('resets slot tracker on annotation change', () => {
      LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        ['a', 'b'],
        ['p1', 'p2'],
        10,
        false,
        [],
        [],
        'size-desc',
        false,
      );
      expect(ctx.currentAnnotation).toBe('annotation1');

      LegendDataProcessor.processLegendItems(
        ctx,
        'annotation2',
        ['c', 'd'],
        ['p1', 'p2'],
        10,
        false,
        [],
        [],
        'size-desc',
        false,
      );
      expect(ctx.currentAnnotation).toBe('annotation2');
    });

    it('creates Other bucket when exceeding max visible', () => {
      const values = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        3,
        false,
        [],
        [],
        'size-desc',
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
        'annotation1',
        values,
        proteinIds,
        10,
        true,
        [['p1', 'p3']],
        [],
        'size-desc',
        false,
      );
      // Only p1 and p3 are in isolation, both have value 'a'
      expect(result.legendItems.find((i) => i.value === 'a')?.count).toBe(2);
    });

    it('preserves existing z-order across processing in manual mode', () => {
      const values = ['a', 'b', 'c'];
      const existing: LegendItem[] = [
        {
          value: 'a',
          color: '#000',
          shape: 'circle',
          count: 1,
          isVisible: true,
          zOrder: 99,
        },
      ];
      // In manual mode, existing zOrders should be preserved
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        existing,
        'manual',
        false,
      );
      expect(result.legendItems.find((i) => i.value === 'a')?.zOrder).toBe(99);
    });

    it('uses sorted index for z-order across processing in non-manual modes', () => {
      const values = ['a', 'b', 'c'];
      const existing: LegendItem[] = [
        {
          value: 'a',
          color: '#000',
          shape: 'circle',
          count: 1,
          isVisible: true,
          zOrder: 99,
        },
      ];
      // In size mode, zOrder should be based on sorted position
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        existing,
        'size-desc',
        false,
      );
      // All items have count 1, so they're equal in size; order depends on implementation
      const itemA = result.legendItems.find((i) => i.value === 'a');
      expect(itemA?.zOrder).toBeGreaterThanOrEqual(0);
      expect(itemA?.zOrder).toBeLessThan(3);
    });
  });
});
