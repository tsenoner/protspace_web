import { describe, it, expect, beforeEach } from 'vitest';
import {
  LegendDataProcessor,
  createProcessorContext,
  type LegendProcessorContext,
} from './legend-data-processor';
import type { LegendItem } from './types';
import { LEGEND_VALUES } from './config';

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

    it('handles null values (converts to __NA__)', () => {
      const values = ['a', null, 'a', null];
      const result = LegendDataProcessor.countAnnotationFrequencies(values, false, [], new Set());
      expect(result.get('a')).toBe(2);
      // Null values are converted to '__NA__' internally
      expect(result.get(LEGEND_VALUES.NA_VALUE)).toBe(2);
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
      const freq = new Map<string, number>([
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
      const freq = new Map<string, number>([
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
      const freq = new Map<string, number>([
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
      const freq = new Map<string, number>([
        ['a', 10],
        ['b', 9],
        ['c', 8],
        ['d', 7],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 2, false, 'size-desc');
      expect(result.otherCount).toBe(15); // 8 + 7
    });

    it('handles N/A values in sorting (uses __NA__)', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        [LEGEND_VALUES.NA_VALUE, 5],
        ['b', 8],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, 'size-desc');
      expect(result.topItems.some(([v]) => v === LEGEND_VALUES.NA_VALUE)).toBe(true);
    });

    it('sorts by size ascending', () => {
      const freq = new Map<string, number>([
        ['small', 5],
        ['large', 20],
        ['medium', 10],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, 'size-asc');
      expect(result.topItems[0][0]).toBe('small');
      expect(result.topItems[1][0]).toBe('medium');
      expect(result.topItems[2][0]).toBe('large');
    });

    it('sorts alphabetically descending', () => {
      const freq = new Map<string, number>([
        ['apple', 5],
        ['cherry', 10],
        ['banana', 8],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, 'alpha-desc');
      expect(result.topItems[0][0]).toBe('cherry');
      expect(result.topItems[1][0]).toBe('banana');
      expect(result.topItems[2][0]).toBe('apple');
    });

    it('handles pattern ranking in alpha sort (ranges before regular)', () => {
      const freq = new Map<string, number>([
        ['regular', 5],
        ['<10', 5],
        ['10-20', 5],
        ['20+', 5],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(freq, 10, false, 'alpha-asc');
      // < patterns come first, then ranges, then +, then regular
      expect(result.topItems[0][0]).toBe('<10');
      expect(result.topItems[1][0]).toBe('10-20');
      expect(result.topItems[2][0]).toBe('20+');
      expect(result.topItems[3][0]).toBe('regular');
    });

    it('uses visibleValues to prioritize items and expands when maxVisibleValues allows', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        ['b', 8],
        ['c', 6],
        ['d', 4],
      ]);
      const visibleValues = new Set(['a', 'c']);
      const result = LegendDataProcessor.sortAndLimitItems(
        freq,
        10, // maxVisibleValues > visibleValues.size, so should expand
        false,
        'size-desc',
        new Map(),
        visibleValues,
      );
      // Should include all 4 items since maxVisibleValues=10 allows expansion
      expect(result.topItems).toHaveLength(4);
      // Visible values should come first (in sort order), followed by expanded items
      expect(result.topItems.map(([v]) => v)).toContain('a');
      expect(result.topItems.map(([v]) => v)).toContain('c');
      expect(result.topItems.map(([v]) => v)).toContain('b');
      expect(result.topItems.map(([v]) => v)).toContain('d');
    });

    it('includes pendingExtract item in visible set', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        ['b', 8],
        ['c', 6],
      ]);
      const visibleValues = new Set(['a']);
      const result = LegendDataProcessor.sortAndLimitItems(
        freq,
        10,
        false,
        'size-desc',
        new Map(),
        visibleValues,
        'b', // pendingExtract
      );
      expect(result.topItems.map(([v]) => v)).toContain('b');
    });

    it('excludes pendingMerge item from visible set', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        ['b', 8],
        ['c', 6],
      ]);
      const visibleValues = new Set(['a', 'b']);
      const result = LegendDataProcessor.sortAndLimitItems(
        freq,
        10,
        false,
        'size-desc',
        new Map(),
        visibleValues,
        undefined,
        'b', // pendingMerge
      );
      expect(result.topItems.map(([v]) => v)).not.toContain('b');
    });

    it('handles N/A extraction via pendingExtract', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        [LEGEND_VALUES.NA_VALUE, 5],
      ]);
      const visibleValues = new Set(['a']);
      const result = LegendDataProcessor.sortAndLimitItems(
        freq,
        10,
        false,
        'size-desc',
        new Map(),
        visibleValues,
        LEGEND_VALUES.NA_VALUE, // Extract N/A
      );
      expect(result.topItems.map(([v]) => v)).toContain(LEGEND_VALUES.NA_VALUE);
    });

    it('handles N/A merge via pendingMerge', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        [LEGEND_VALUES.NA_VALUE, 5],
      ]);
      const visibleValues = new Set(['a', LEGEND_VALUES.NA_VALUE]);
      const result = LegendDataProcessor.sortAndLimitItems(
        freq,
        10,
        false,
        'size-desc',
        new Map(),
        visibleValues,
        undefined,
        LEGEND_VALUES.NA_VALUE, // Merge N/A back
      );
      expect(result.topItems.map(([v]) => v)).not.toContain(LEGEND_VALUES.NA_VALUE);
    });

    it('uses existing zOrders for manual sort mode', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        ['b', 8],
        ['c', 6],
      ]);
      const existingZOrders = new Map([
        ['c', 0],
        ['a', 1],
        ['b', 2],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(
        freq,
        10,
        false,
        'manual',
        existingZOrders,
      );
      expect(result.topItems[0][0]).toBe('c');
      expect(result.topItems[1][0]).toBe('a');
      expect(result.topItems[2][0]).toBe('b');
    });

    it('uses existing zOrders reversed for manual-reverse sort mode', () => {
      const freq = new Map<string, number>([
        ['a', 10],
        ['b', 8],
        ['c', 6],
      ]);
      const existingZOrders = new Map([
        ['c', 0],
        ['a', 1],
        ['b', 2],
      ]);
      const result = LegendDataProcessor.sortAndLimitItems(
        freq,
        10,
        false,
        'manual-reverse',
        existingZOrders,
      );
      expect(result.topItems[0][0]).toBe('b');
      expect(result.topItems[1][0]).toBe('a');
      expect(result.topItems[2][0]).toBe('c');
    });
  });

  describe('createLegendItems', () => {
    it('creates legend items with correct properties', () => {
      const topItems: Array<[string, number]> = [
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
      const topItems: Array<[string, number]> = [['category1', 10]];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 5, false, [], false);
      expect(items.some((i) => i.value === 'Other')).toBe(true);
    });

    it('does not add Other item in isolation mode', () => {
      const topItems: Array<[string, number]> = [['category1', 10]];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 5, true, [], false);
      expect(items.some((i) => i.value === 'Other')).toBe(false);
    });

    it('preserves existing z-order in manual mode', () => {
      const topItems: Array<[string, number]> = [
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
      const topItems: Array<[string, number]> = [
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
      const topItems: Array<[string, number]> = [
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
      const topItems: Array<[string, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const items = LegendDataProcessor.createLegendItems(ctx, topItems, 0, false, [], true);
      const shapes = new Set(items.map((i) => i.shape));
      expect(shapes.size).toBeGreaterThan(1);
    });

    it('applies colors from persistedCategories', () => {
      const topItems: Array<[string, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const persistedCategories = {
        category1: { zOrder: 0, color: '#custom1', shape: 'circle' },
        category2: { zOrder: 1, color: '#custom2', shape: 'square' },
      };
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        [],
        false,
        'size-desc',
        new Map(),
        persistedCategories,
      );
      expect(items[0].color).toBe('#custom1');
      expect(items[1].color).toBe('#custom2');
    });

    it('prefers persisted colors over existing colors', () => {
      const topItems: Array<[string, number]> = [['category1', 10]];
      const existing: LegendItem[] = [
        {
          value: 'category1',
          color: '#existing',
          shape: 'circle',
          count: 10,
          isVisible: true,
          zOrder: 0,
        },
      ];
      const persistedCategories = {
        category1: { zOrder: 0, color: '#persisted', shape: 'circle' },
      };
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        existing,
        false,
        'size-desc',
        new Map(),
        persistedCategories,
      );
      expect(items[0].color).toBe('#persisted');
    });

    it('applies persisted colors to N/A items using __NA__ key', () => {
      const topItems: Array<[string, number]> = [[LEGEND_VALUES.NA_VALUE, 10]];
      const persistedCategories = {
        [LEGEND_VALUES.NA_VALUE]: { zOrder: 0, color: '#na-color', shape: 'circle' },
      };
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        [],
        false,
        'size-desc',
        new Map(),
        persistedCategories,
      );
      expect(items[0].color).toBe('#na-color');
    });

    it('uses existing colors when no persisted categories', () => {
      const topItems: Array<[string, number]> = [['category1', 10]];
      const existing: LegendItem[] = [
        {
          value: 'category1',
          color: '#existing',
          shape: 'square',
          count: 10,
          isVisible: true,
          zOrder: 0,
        },
      ];
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        existing,
        false,
        'size-desc',
        new Map(),
        {}, // empty persisted
      );
      expect(items[0].color).toBe('#existing');
    });

    it('applies shapes from persistedCategories', () => {
      const topItems: Array<[string, number]> = [
        ['category1', 10],
        ['category2', 5],
      ];
      const persistedCategories = {
        category1: { zOrder: 0, color: '#custom1', shape: 'diamond' },
        category2: { zOrder: 1, color: '#custom2', shape: 'triangle-up' },
      };
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        [],
        false,
        'size-desc',
        new Map(),
        persistedCategories,
      );
      expect(items[0].shape).toBe('diamond');
      expect(items[1].shape).toBe('triangle-up');
    });

    it('preserves shapes from existing items when no persisted categories', () => {
      const topItems: Array<[string, number]> = [['category1', 10]];
      const existing: LegendItem[] = [
        {
          value: 'category1',
          color: '#existing',
          shape: 'square',
          count: 10,
          isVisible: true,
          zOrder: 0,
        },
      ];
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        existing,
        false,
        'size-desc',
        new Map(),
        {}, // empty persisted
      );
      expect(items[0].shape).toBe('square');
    });

    it('prefers persisted shapes over existing shapes', () => {
      const topItems: Array<[string, number]> = [['category1', 10]];
      const existing: LegendItem[] = [
        {
          value: 'category1',
          color: '#existing',
          shape: 'square',
          count: 10,
          isVisible: true,
          zOrder: 0,
        },
      ];
      const persistedCategories = {
        category1: { zOrder: 0, color: '#persisted', shape: 'diamond' },
      };
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        existing,
        false,
        'size-desc',
        new Map(),
        persistedCategories,
      );
      expect(items[0].shape).toBe('diamond');
    });

    it('preserves shapes when only persisted shape is set (no persisted color)', () => {
      const topItems: Array<[string, number]> = [['category1', 10]];
      const persistedCategories = {
        category1: { zOrder: 0, color: '', shape: 'triangle-down' },
      };
      const items = LegendDataProcessor.createLegendItems(
        ctx,
        topItems,
        0,
        false,
        [],
        false,
        'size-desc',
        new Map(),
        persistedCategories,
      );
      expect(items[0].shape).toBe('triangle-down');
      // Color should fall back to default encoding since persisted.color is empty
      expect(items[0].color).toBeDefined();
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

    it('applies persisted categories to legend items', () => {
      const values = ['a', 'b'];
      const persistedCategories = {
        a: { zOrder: 0, color: '#custom-a', shape: 'circle' },
        b: { zOrder: 1, color: '#custom-b', shape: 'square' },
      };
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        [],
        'size-desc',
        false,
        persistedCategories,
      );
      const itemA = result.legendItems.find((i) => i.value === 'a');
      const itemB = result.legendItems.find((i) => i.value === 'b');
      expect(itemA?.color).toBe('#custom-a');
      expect(itemB?.color).toBe('#custom-b');
    });

    it('uses visibleValues to restore specific categories', () => {
      const values = ['a', 'b', 'c', 'd', 'e'];
      const visibleValues = new Set(['a', 'c']);
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        [],
        'size-desc',
        false,
        {},
        visibleValues,
      );
      // Should only include visible values (plus Other for the rest)
      const visibleLegendValues = result.legendItems
        .filter((i) => i.value !== 'Other')
        .map((i) => i.value);
      expect(visibleLegendValues).toContain('a');
      expect(visibleLegendValues).toContain('c');
    });

    it('handles pendingExtract to add new item', () => {
      const values = ['a', 'b', 'c'];
      const visibleValues = new Set(['a']);
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        [],
        'size-desc',
        false,
        {},
        visibleValues,
        'b', // pendingExtract
      );
      const legendValues = result.legendItems.map((i) => i.value);
      expect(legendValues).toContain('a');
      expect(legendValues).toContain('b');
    });

    it('handles pendingMerge to remove item', () => {
      const values = ['a', 'b', 'c'];
      const visibleValues = new Set(['a', 'b']);
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        [],
        'size-desc',
        false,
        {},
        visibleValues,
        undefined,
        'b', // pendingMerge
      );
      const legendValues = result.legendItems
        .filter((i) => i.value !== 'Other')
        .map((i) => i.value);
      expect(legendValues).toContain('a');
      expect(legendValues).not.toContain('b');
    });

    it('converts null annotation values to __NA__', () => {
      const values: (string | null)[] = ['a', null, 'b', null];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10,
        false,
        [],
        [],
        'size-desc',
        false,
      );
      const naItem = result.legendItems.find((i) => i.value === LEGEND_VALUES.NA_VALUE);
      expect(naItem).toBeDefined();
      expect(naItem?.count).toBe(2);
    });

    it('removes Other item when otherItems become empty after filtering', () => {
      const values = ['a', 'b'];
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        10, // High max, so no Other needed
        false,
        [],
        [],
        'size-desc',
        false,
      );
      const otherItem = result.legendItems.find((i) => i.value === 'Other');
      expect(otherItem).toBeUndefined();
      expect(result.otherItems).toHaveLength(0);
    });

    it('expands categories when maxVisibleValues increases beyond visibleValues size', () => {
      const values = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e', 'f', 'g'];
      const visibleValues = new Set(['a', 'b']); // Only 2 visible
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        5, // maxVisibleValues = 5, but visibleValues only has 2
        false,
        [],
        [],
        'size-desc',
        false,
        {},
        visibleValues,
      );
      // Should have 5 items (not 2) plus Other
      const legendValues = result.legendItems
        .filter((i) => i.value !== 'Other')
        .map((i) => i.value);
      expect(legendValues.length).toBe(5);
      expect(legendValues).toContain('a');
      expect(legendValues).toContain('b');
      // Should include next highest frequency items from "Other"
    });

    it('contracts categories when maxVisibleValues decreases', () => {
      const values = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e'];
      const visibleValues = new Set(['a', 'b', 'c', 'd', 'e']); // 5 visible
      const result = LegendDataProcessor.processLegendItems(
        ctx,
        'annotation1',
        values,
        values.map((_, i) => `p${i}`),
        3, // maxVisibleValues = 3
        false,
        [],
        [],
        'size-desc',
        false,
        {},
        visibleValues,
      );
      // Should have only 3 items plus Other
      const legendValues = result.legendItems
        .filter((i) => i.value !== 'Other')
        .map((i) => i.value);
      expect(legendValues.length).toBe(3);
    });
  });
});
