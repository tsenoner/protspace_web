import { describe, it, expect } from 'vitest';
import { computePublicationLayout } from './layout';
import { FIGURE_PRESETS, type FigurePresetId, type LegendPlacement } from './presets';

function assertLayoutInvariants(presetId: FigurePresetId, placement: LegendPlacement): void {
  const preset = FIGURE_PRESETS[presetId];
  const layout = computePublicationLayout(preset, placement);
  const pad = preset.paddingMm;
  const innerW = preset.widthMm - 2 * pad;
  const innerH = preset.heightMm - 2 * pad;

  expect(layout.figureMm.width).toBe(preset.widthMm);
  expect(layout.figureMm.height).toBe(preset.heightMm);

  const { scatterMm, legendMm } = layout;
  expect(scatterMm.x).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(scatterMm.y).toBeGreaterThanOrEqual(pad - 1e-6);
  expect(scatterMm.width).toBeGreaterThan(0);
  expect(scatterMm.height).toBeGreaterThan(0);
  expect(scatterMm.width / scatterMm.height).toBeCloseTo(preset.scatterAspect, 5);

  if (placement === 'right') {
    expect(legendMm.width).toBe(preset.legendBandMm.right);
    expect(legendMm.height).toBeCloseTo(innerH, 5);
    expect(legendMm.x).toBeCloseTo(pad + innerW - legendMm.width, 5);
    expect(scatterMm.x + scatterMm.width).toBeLessThanOrEqual(legendMm.x + 1e-6);
    expect(legendMm.x + legendMm.width).toBeCloseTo(pad + innerW, 5);
  } else {
    expect(legendMm.height).toBe(preset.legendBandMm.below);
    expect(legendMm.width).toBeCloseTo(innerW, 5);
    expect(scatterMm.y + scatterMm.height).toBeCloseTo(legendMm.y, 5);
    expect(legendMm.y + legendMm.height).toBeCloseTo(pad + innerH, 5);
  }
}

describe('computePublicationLayout', () => {
  const presets: FigurePresetId[] = ['one_column', 'two_column', 'full_page'];
  const placements: LegendPlacement[] = ['right', 'below'];

  it.each(presets.flatMap((p) => placements.map((pl) => [p, pl] as const)))(
    'invariants for %s / %s',
    (presetId, placement) => {
      assertLayoutInvariants(presetId, placement);
    },
  );

  it('matches frozen snapshot for two_column / right', () => {
    const layout = computePublicationLayout(FIGURE_PRESETS.two_column, 'right');
    expect(layout).toEqual({
      figureMm: { width: 178, height: 95 },
      scatterMm: { x: 7, y: 2.5, width: 120, height: 90 },
      legendMm: { x: 131.5, y: 2.5, width: 44, height: 90 },
    });
  });
});
