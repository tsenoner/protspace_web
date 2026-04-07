import { describe, it, expect } from 'vitest';
import { computePublicationLayout } from './layout';
import { FIGURE_LAYOUTS, type FigureLayoutId } from './presets';

function assertInvariants(layoutId: FigureLayoutId): void {
  const layoutDef = FIGURE_LAYOUTS[layoutId];
  const computed = computePublicationLayout(layoutDef);
  const pad = layoutDef.paddingMm;
  const innerW = layoutDef.widthMm - 2 * pad;
  const innerH = layoutDef.heightMm - 2 * pad;

  expect(computed.figureMm.width).toBe(layoutDef.widthMm);
  expect(computed.figureMm.height).toBe(layoutDef.heightMm);

  const { scatterMm, legendMm } = computed;
  expect(scatterMm.width).toBeGreaterThan(0);
  expect(scatterMm.height).toBeGreaterThan(0);
  expect(scatterMm.width / scatterMm.height).toBeCloseTo(layoutDef.scatterAspect, 5);

  expect(scatterMm.x).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(scatterMm.y).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(scatterMm.x + scatterMm.width).toBeLessThanOrEqual(pad + innerW + 1e-6);
  expect(scatterMm.y + scatterMm.height).toBeLessThanOrEqual(pad + innerH + 1e-6);
  expect(legendMm.x).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(legendMm.y).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(legendMm.x + legendMm.width).toBeLessThanOrEqual(pad + innerW + 1e-6);
  expect(legendMm.y + legendMm.height).toBeLessThanOrEqual(pad + innerH + 1e-6);

  const overlap =
    scatterMm.x < legendMm.x + legendMm.width &&
    scatterMm.x + scatterMm.width > legendMm.x &&
    scatterMm.y < legendMm.y + legendMm.height &&
    scatterMm.y + scatterMm.height > legendMm.y;
  expect(overlap).toBe(false);

  switch (layoutDef.legend.placement) {
    case 'right':
      expect(legendMm.width).toBe(layoutDef.legendBandMm);
      expect(legendMm.height).toBeCloseTo(innerH, 5);
      expect(legendMm.x + legendMm.width).toBeCloseTo(pad + innerW, 5);
      break;
    case 'below':
      expect(legendMm.height).toBe(layoutDef.legendBandMm);
      expect(legendMm.width).toBeCloseTo(innerW, 5);
      expect(legendMm.y + legendMm.height).toBeCloseTo(pad + innerH, 5);
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

  it('matches frozen snapshot for two_column_right', () => {
    const c = computePublicationLayout(FIGURE_LAYOUTS.two_column_right);
    expect(c).toEqual({
      figureMm: { width: 178, height: 95 },
      scatterMm: { x: 7, y: 2.5, width: 120, height: 90 },
      legendMm: { x: 131.5, y: 2.5, width: 44, height: 90 },
    });
  });
});
