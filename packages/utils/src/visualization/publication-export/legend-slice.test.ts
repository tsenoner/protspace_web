import { describe, it, expect } from 'vitest';
import { sliceLegendItemsForLayout } from './legend-slice';
import { maxLegendItemsForLayout } from './legend-caps';

describe('sliceLegendItemsForLayout', () => {
  it('returns all items when under cap', () => {
    const items = ['a', 'b', 'c'];
    const r = sliceLegendItemsForLayout(items, 'one_column_below');
    expect(r.visible).toEqual(items);
    expect(r.omittedCount).toBe(0);
  });

  it('truncates to cap with omittedCount', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const cap = maxLegendItemsForLayout('two_column_right');
    const r = sliceLegendItemsForLayout(items, 'two_column_right');
    expect(r.visible.length).toBe(cap);
    expect(r.omittedCount).toBe(50 - cap);
  });

  it('returns omittedCount === 0 when items.length === cap', () => {
    const cap = maxLegendItemsForLayout('full_page_top');
    const items = Array.from({ length: cap }, (_, i) => i);
    const r = sliceLegendItemsForLayout(items, 'full_page_top');
    expect(r.visible.length).toBe(cap);
    expect(r.omittedCount).toBe(0);
  });
});
