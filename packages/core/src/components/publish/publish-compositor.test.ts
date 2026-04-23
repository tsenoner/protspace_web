import { describe, it, expect } from 'vitest';
import { computeLayout, computeInsetBoost } from './publish-compositor';
import type { LegendLayout } from './publish-state';

function makeLegend(overrides: Partial<LegendLayout> = {}): LegendLayout {
  return {
    visible: true,
    position: 'right',
    widthPercent: 20,
    fontSizePx: 15,
    columns: 1,
    overflow: 'multi-column',
    ...overrides,
  };
}

describe('publish-compositor', () => {
  describe('computeLayout', () => {
    const W = 2000;
    const H = 1000;

    it('right position reserves legend on the right', () => {
      const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: 'right' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.x).toBeGreaterThan(0);
      expect(legendRect!.x + legendRect!.w).toBe(W);
      expect(plotRect.x).toBe(0);
      expect(plotRect.w + legendRect!.w).toBe(W);
    });

    it('left position reserves legend on the left', () => {
      const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: 'left' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.x).toBe(0);
      expect(plotRect.x).toBe(legendRect!.w);
      expect(plotRect.w + legendRect!.w).toBe(W);
    });

    it('top position reserves legend at the top', () => {
      const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: 'top' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.y).toBe(0);
      expect(plotRect.y).toBe(legendRect!.h);
      expect(plotRect.h + legendRect!.h).toBe(H);
    });

    it('bottom position reserves legend at the bottom', () => {
      const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: 'bottom' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.y + legendRect!.h).toBe(H);
      expect(plotRect.y).toBe(0);
      expect(plotRect.h + legendRect!.h).toBe(H);
    });

    it('corner positions give full canvas to plot', () => {
      for (const pos of ['tl', 'tr', 'bl', 'br'] as const) {
        const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: pos }));
        expect(plotRect.x).toBe(0);
        expect(plotRect.y).toBe(0);
        expect(plotRect.w).toBe(W);
        expect(plotRect.h).toBe(H);
        expect(legendRect).not.toBeNull();
      }
    });

    it('tr corner places legend in top-right', () => {
      const { legendRect } = computeLayout(W, H, makeLegend({ position: 'tr' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.x + legendRect!.w).toBe(W);
      expect(legendRect!.y).toBe(0);
    });

    it('bl corner places legend in bottom-left', () => {
      const { legendRect } = computeLayout(W, H, makeLegend({ position: 'bl' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.x).toBe(0);
      expect(legendRect!.y + legendRect!.h).toBe(H);
    });

    it('none position returns null legendRect', () => {
      const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: 'none' }));
      expect(legendRect).toBeNull();
      expect(plotRect.w).toBe(W);
      expect(plotRect.h).toBe(H);
    });

    it('invisible legend returns null legendRect', () => {
      const { legendRect } = computeLayout(W, H, makeLegend({ visible: false }));
      expect(legendRect).toBeNull();
    });

    it('legend width respects widthPercent for side positions', () => {
      const { legendRect } = computeLayout(
        W,
        H,
        makeLegend({ position: 'right', widthPercent: 30 }),
      );
      expect(legendRect).not.toBeNull();
      expect(legendRect!.w).toBe(Math.round(W * 0.3));
    });
  });

  describe('free legend position', () => {
    it('returns full canvas for plotRect when legend is free', () => {
      const { plotRect, legendRect } = computeLayout(
        2000,
        1000,
        makeLegend({ position: 'free', widthPercent: 20 }),
      );
      expect(plotRect.w).toBe(2000);
      expect(plotRect.h).toBe(1000);
      expect(legendRect).not.toBeNull();
    });

    it('positions free legend using freePos coordinates', () => {
      const { legendRect } = computeLayout(
        2000,
        1000,
        makeLegend({
          position: 'free',
          widthPercent: 20,
          freePos: { nx: 0.5, ny: 0.3 },
        }),
      );
      expect(legendRect).not.toBeNull();
      expect(legendRect!.x).toBe(Math.round(2000 * 0.5));
      expect(legendRect!.y).toBe(Math.round(1000 * 0.3));
    });

    it('defaults free legend to center when no freePos', () => {
      const { legendRect } = computeLayout(
        2000,
        1000,
        makeLegend({ position: 'free', widthPercent: 20 }),
      );
      expect(legendRect).not.toBeNull();
      const expectedW = Math.round(2000 * 0.2);
      expect(legendRect!.x).toBe(Math.round((2000 - expectedW) / 2));
    });
  });

  describe('computeInsetBoost', () => {
    it('returns 1 when there are no insets', () => {
      expect(computeInsetBoost([])).toBe(1);
    });

    it('computes boost from target/source size ratio', () => {
      const insets = [
        {
          sourceRect: { x: 0, y: 0, w: 0.1, h: 0.1 },
          targetRect: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
          border: 2,
          connector: 'lines' as const,
        },
      ];
      // 0.3 / 0.1 = 3x zoom → boost = 3
      expect(computeInsetBoost(insets)).toBe(3);
    });

    it('caps boost at maxBoost', () => {
      const insets = [
        {
          sourceRect: { x: 0, y: 0, w: 0.05, h: 0.05 },
          targetRect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
          border: 2,
          connector: 'lines' as const,
        },
      ];
      // 0.5 / 0.05 = 10x → capped at 4
      expect(computeInsetBoost(insets)).toBe(4);
      expect(computeInsetBoost(insets, 2)).toBe(2);
    });

    it('uses the max zoom across multiple insets', () => {
      const insets = [
        {
          sourceRect: { x: 0, y: 0, w: 0.2, h: 0.2 },
          targetRect: { x: 0.5, y: 0, w: 0.3, h: 0.3 },
          border: 2,
          connector: 'lines' as const,
        },
        {
          sourceRect: { x: 0, y: 0, w: 0.1, h: 0.1 },
          targetRect: { x: 0.5, y: 0.5, w: 0.4, h: 0.4 },
          border: 2,
          connector: 'lines' as const,
        },
      ];
      // First: 0.3/0.2 = 1.5x, Second: 0.4/0.1 = 4x → boost = 4
      expect(computeInsetBoost(insets)).toBe(4);
    });
  });
});
