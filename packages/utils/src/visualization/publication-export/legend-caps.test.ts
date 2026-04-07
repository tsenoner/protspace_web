import { describe, it, expect } from 'vitest';
import { MAX_LEGEND_ITEMS, maxLegendItemsForLayout } from './legend-caps';
import { FIGURE_LAYOUTS, type FigureLayoutId } from './presets';

describe('MAX_LEGEND_ITEMS', () => {
  const ids: FigureLayoutId[] = Object.keys(FIGURE_LAYOUTS) as FigureLayoutId[];

  it.each(ids)('has a positive cap for %s', (id) => {
    expect(MAX_LEGEND_ITEMS[id]).toBeGreaterThan(0);
  });

  it('exposes maxLegendItemsForLayout returning the same numbers', () => {
    for (const id of ids) {
      expect(maxLegendItemsForLayout(id)).toBe(MAX_LEGEND_ITEMS[id]);
    }
  });
});
