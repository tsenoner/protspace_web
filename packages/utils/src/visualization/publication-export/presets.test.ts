import { describe, it, expect } from 'vitest';
import { FIGURE_LAYOUTS, type FigureLayoutId } from './presets';

describe('FIGURE_LAYOUTS', () => {
  const ids: FigureLayoutId[] = [
    'one_column_below',
    'two_column_right',
    'two_column_below',
    'full_page_top',
  ];

  it.each(ids)('has a layout entry for %s', (id) => {
    const layout = FIGURE_LAYOUTS[id];
    expect(layout).toBeDefined();
    expect(layout.id).toBe(id);
    expect(layout.widthMm).toBeGreaterThan(0);
    expect(layout.heightMm).toBeGreaterThan(0);
    expect(layout.paddingMm).toBeGreaterThan(0);
    expect(layout.legendBandMm).toBeGreaterThan(0);
    expect(layout.scatterAspect).toBeGreaterThan(0);
    expect([1, 2, 3]).toContain(layout.legend.columns);
    expect(['top', 'right', 'below']).toContain(layout.legend.placement);
  });

  it('matches the expected (placement, columns) pairs', () => {
    expect(FIGURE_LAYOUTS.one_column_below.legend).toEqual({ placement: 'below', columns: 2 });
    expect(FIGURE_LAYOUTS.two_column_right.legend).toEqual({ placement: 'right', columns: 1 });
    expect(FIGURE_LAYOUTS.two_column_below.legend).toEqual({ placement: 'below', columns: 3 });
    expect(FIGURE_LAYOUTS.full_page_top.legend).toEqual({ placement: 'top', columns: 3 });
  });
});
