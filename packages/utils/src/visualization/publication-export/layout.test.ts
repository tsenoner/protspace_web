import { describe, it, expect } from 'vitest';
import { computePublicationLayout } from './layout';
import { FIGURE_LAYOUTS, type FigureLayoutId } from './presets';

function assertInvariants(layoutId: FigureLayoutId): void {
  const layoutDef = FIGURE_LAYOUTS[layoutId];
  const computed = computePublicationLayout(layoutDef);
  const pad = layoutDef.paddingMm;
  const innerW = layoutDef.widthMm - 2 * pad;
  const computedInnerH = computed.figureMm.height - 2 * pad;

  expect(computed.figureMm.width).toBe(layoutDef.widthMm);
  if (layoutDef.legend.placement !== 'none') {
    expect(computed.figureMm.height).toBe(layoutDef.heightMm);
  }

  const { scatterMm, legendMm } = computed;
  expect(scatterMm.width).toBeGreaterThan(0);
  expect(scatterMm.height).toBeGreaterThan(0);
  expect(scatterMm.width / scatterMm.height).toBeCloseTo(layoutDef.scatterAspect, 5);

  expect(scatterMm.x).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(scatterMm.y).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(scatterMm.x + scatterMm.width).toBeLessThanOrEqual(pad + innerW + 1e-6);
  expect(scatterMm.y + scatterMm.height).toBeLessThanOrEqual(pad + computedInnerH + 1e-6);

  if (layoutDef.legend.placement !== 'none') {
    expect(legendMm.x).toBeGreaterThanOrEqual(pad - 1e-6);
    expect(legendMm.y).toBeGreaterThanOrEqual(pad - 1e-6);
    expect(legendMm.x + legendMm.width).toBeLessThanOrEqual(pad + innerW + 1e-6);
    expect(legendMm.y + legendMm.height).toBeLessThanOrEqual(pad + computedInnerH + 1e-6);

    const overlap =
      scatterMm.x < legendMm.x + legendMm.width &&
      scatterMm.x + scatterMm.width > legendMm.x &&
      scatterMm.y < legendMm.y + legendMm.height &&
      scatterMm.y + scatterMm.height > legendMm.y;
    expect(overlap).toBe(false);
  }

  switch (layoutDef.legend.placement) {
    case 'none':
      expect(legendMm.width).toBe(0);
      expect(legendMm.height).toBe(0);
      expect(scatterMm.x).toBeCloseTo(pad, 5);
      expect(scatterMm.y).toBeCloseTo(pad, 5);
      expect(scatterMm.width).toBeCloseTo(innerW, 5);
      break;
    case 'right':
      expect(legendMm.width).toBe(layoutDef.legendBandMm);
      expect(legendMm.height).toBeCloseTo(computedInnerH, 5);
      expect(legendMm.x + legendMm.width).toBeCloseTo(pad + innerW, 5);
      break;
    case 'below':
      expect(legendMm.height).toBe(layoutDef.legendBandMm);
      expect(legendMm.width).toBeCloseTo(innerW, 5);
      expect(legendMm.y + legendMm.height).toBeCloseTo(pad + computedInnerH, 5);
      break;
    case 'top':
      expect(legendMm.height).toBe(layoutDef.legendBandMm);
      expect(legendMm.width).toBeCloseTo(innerW, 5);
      expect(legendMm.y).toBeCloseTo(pad, 5);
      expect(scatterMm.y).toBeGreaterThanOrEqual(pad + layoutDef.legendBandMm - 1e-6);
      break;
  }
}

describe('computePublicationLayout', () => {
  const ids: FigureLayoutId[] = Object.keys(FIGURE_LAYOUTS) as FigureLayoutId[];

  it.each(ids)('invariants for %s', (id) => {
    assertInvariants(id);
  });

  it('respects viewportAspect over preset scatterAspect', () => {
    const layout = FIGURE_LAYOUTS.two_column_below;
    const viewportAspect = 16 / 9;
    const computed = computePublicationLayout(layout, viewportAspect);
    const { scatterMm } = computed;
    expect(scatterMm.width / scatterMm.height).toBeCloseTo(viewportAspect, 5);
  });

  it('falls back to preset scatterAspect when viewportAspect is absent', () => {
    const layout = FIGURE_LAYOUTS.two_column_below;
    const computed = computePublicationLayout(layout);
    expect(computed.scatterMm.width / computed.scatterMm.height).toBeCloseTo(
      layout.scatterAspect,
      5,
    );
  });

  describe('scatter-only layouts', () => {
    const scatterOnlyIds: FigureLayoutId[] = [
      'one_column_scatter_only',
      'two_column_scatter_only',
      'full_page_scatter_only',
    ];

    it.each(scatterOnlyIds)('scatter fills inner area for %s', (id) => {
      const layout = FIGURE_LAYOUTS[id];
      const computed = computePublicationLayout(layout);
      const pad = layout.paddingMm;
      const innerW = layout.widthMm - 2 * pad;
      expect(computed.scatterMm.x).toBeCloseTo(pad, 5);
      expect(computed.scatterMm.y).toBeCloseTo(pad, 5);
      expect(computed.scatterMm.width).toBeCloseTo(innerW, 5);
    });

    it.each(scatterOnlyIds)('derives figure height from viewportAspect for %s', (id) => {
      const layout = FIGURE_LAYOUTS[id];
      const viewportAspect = 16 / 9;
      const computed = computePublicationLayout(layout, viewportAspect);
      const pad = layout.paddingMm;
      const innerW = layout.widthMm - 2 * pad;
      const expectedInnerH = innerW / viewportAspect;
      expect(computed.scatterMm.height).toBeCloseTo(expectedInnerH, 5);
      expect(computed.figureMm.height).toBeCloseTo(expectedInnerH + 2 * pad, 5);
    });

    it.each(scatterOnlyIds)('legend rect is zero-size for %s', (id) => {
      const layout = FIGURE_LAYOUTS[id];
      const computed = computePublicationLayout(layout);
      expect(computed.legendMm.width).toBe(0);
      expect(computed.legendMm.height).toBe(0);
    });
  });

  it('matches frozen snapshot for two_column_right', () => {
    const c = computePublicationLayout(FIGURE_LAYOUTS.two_column_right);
    expect(c).toEqual({
      figureMm: { width: 178, height: 95 },
      scatterMm: { x: 7, y: 2.5, width: 120, height: 90 },
      legendMm: { x: 131.5, y: 2.5, width: 44, height: 90 },
    });
  });
});
