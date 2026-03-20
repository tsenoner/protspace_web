import { describe, it, expect } from 'vitest';
import { sliceLegendItemsForLayout } from './legend-slice';
import { maxLegendItemsForLayout } from './legend-caps';
import type { FigurePresetId, LegendPlacement } from './presets';

describe('sliceLegendItemsForLayout', () => {
  it('returns all items when under cap', () => {
    const items = ['a', 'b', 'c'];
    const r = sliceLegendItemsForLayout(items, 'one_column', 'right');
    expect(r.visible).toEqual(items);
    expect(r.omittedCount).toBe(0);
  });

  it('truncates to cap with omitted count', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const preset: FigurePresetId = 'two_column';
    const placement: LegendPlacement = 'right';
    const cap = maxLegendItemsForLayout(preset, placement);
    const r = sliceLegendItemsForLayout(items, preset, placement);
    expect(r.visible.length).toBe(cap);
    expect(r.omittedCount).toBe(50 - cap);
  });
});
