/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  computeInsetBoost,
  capturePlotCanvas,
  clampCaptureSize,
  MAX_CANVAS_DIM,
  MAX_CANVAS_PIXELS,
} from './publish-compositor';
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

    it('br corner places legend in bottom-right', () => {
      const { legendRect } = computeLayout(W, H, makeLegend({ position: 'br' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.x + legendRect!.w).toBe(W);
      expect(legendRect!.y + legendRect!.h).toBe(H);
    });

    it('tl corner places legend in top-left', () => {
      const { legendRect } = computeLayout(W, H, makeLegend({ position: 'tl' }));
      expect(legendRect).not.toBeNull();
      expect(legendRect!.x).toBe(0);
      expect(legendRect!.y).toBe(0);
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

    it('top position uses widthPercent as height fraction', () => {
      const pct = 25;
      const { legendRect } = computeLayout(
        W,
        H,
        makeLegend({ position: 'top', widthPercent: pct }),
      );
      expect(legendRect).not.toBeNull();
      expect(legendRect!.h).toBe(Math.round(H * (pct / 100)));
      expect(legendRect!.w).toBe(W);
    });

    it('bottom position uses widthPercent as height fraction', () => {
      const pct = 30;
      const { legendRect } = computeLayout(
        W,
        H,
        makeLegend({ position: 'bottom', widthPercent: pct }),
      );
      expect(legendRect).not.toBeNull();
      expect(legendRect!.h).toBe(Math.round(H * (pct / 100)));
    });

    it('all side positions correctly sum to full width/height', () => {
      for (const pos of ['right', 'left'] as const) {
        const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: pos }));
        expect(plotRect.w + legendRect!.w).toBe(W);
        expect(plotRect.h).toBe(H);
        expect(legendRect!.h).toBe(H);
      }
      for (const pos of ['top', 'bottom'] as const) {
        const { plotRect, legendRect } = computeLayout(W, H, makeLegend({ position: pos }));
        expect(plotRect.h + legendRect!.h).toBe(H);
        expect(plotRect.w).toBe(W);
        expect(legendRect!.w).toBe(W);
      }
    });

    it('corner legend height uses visibleItemCount when provided', () => {
      const { legendRect: noCount } = computeLayout(
        W,
        H,
        makeLegend({ position: 'tr', widthPercent: 20 }),
      );
      const { legendRect: withCount } = computeLayout(
        W,
        H,
        makeLegend({ position: 'tr', widthPercent: 20 }),
        3,
      );
      expect(noCount).not.toBeNull();
      expect(withCount).not.toBeNull();
      // With only 3 items, the legend should be shorter (tight) than the fallback 50%
      expect(withCount!.h).toBeLessThanOrEqual(noCount!.h);
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

    it('free legend uses tight height with visibleItemCount', () => {
      const { legendRect } = computeLayout(
        2000,
        1000,
        makeLegend({ position: 'free', widthPercent: 20 }),
        5,
      );
      expect(legendRect).not.toBeNull();
      // Should be tighter than 50% of canvas
      expect(legendRect!.h).toBeLessThan(500);
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

    it('uses max of width and height ratios', () => {
      const insets = [
        {
          sourceRect: { x: 0, y: 0, w: 0.1, h: 0.2 },
          targetRect: { x: 0.5, y: 0.5, w: 0.2, h: 0.6 },
          border: 2,
          connector: 'lines' as const,
        },
      ];
      // width ratio: 0.2/0.1 = 2x, height ratio: 0.6/0.2 = 3x → boost = 3
      expect(computeInsetBoost(insets)).toBe(3);
    });

    it('returns 1 when target is smaller than source', () => {
      const insets = [
        {
          sourceRect: { x: 0, y: 0, w: 0.5, h: 0.5 },
          targetRect: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
          border: 2,
          connector: 'lines' as const,
        },
      ];
      expect(computeInsetBoost(insets)).toBe(1);
    });
  });

  describe('capturePlotCanvas', () => {
    it('uses captureAtResolution when available', () => {
      const mockCanvas = document.createElement('canvas');
      mockCanvas.width = 800;
      mockCanvas.height = 400;

      const plotEl = document.createElement('div') as HTMLElement & {
        captureAtResolution?: () => HTMLCanvasElement;
      };
      plotEl.captureAtResolution = () => mockCanvas;

      const result = capturePlotCanvas(plotEl, {
        width: 800,
        height: 400,
        backgroundColor: '#ffffff',
      });
      expect(result).toBe(mockCanvas);
    });
  });
});

describe('clampCaptureSize', () => {
  it('passes through dimensions that are within limits', () => {
    expect(clampCaptureSize(2048, 1024)).toEqual({ width: 2048, height: 1024, scaledDown: false });
  });

  it('clamps a single dimension above MAX_CANVAS_DIM', () => {
    const result = clampCaptureSize(MAX_CANVAS_DIM + 5000, 1024);
    expect(result.width).toBeLessThanOrEqual(MAX_CANVAS_DIM);
    expect(result.scaledDown).toBe(true);
    // Aspect ratio preserved
    expect(result.width / result.height).toBeCloseTo((MAX_CANVAS_DIM + 5000) / 1024, 1);
  });

  it('clamps total area above MAX_CANVAS_PIXELS', () => {
    const w = 20000;
    const h = 20000;
    const result = clampCaptureSize(w, h);
    expect(result.width * result.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(result.scaledDown).toBe(true);
  });

  it('returns positive integer dimensions', () => {
    const result = clampCaptureSize(20000, 30000);
    expect(Number.isInteger(result.width)).toBe(true);
    expect(Number.isInteger(result.height)).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});

describe('waitForFonts', () => {
  it('resolves immediately when document.fonts.ready resolves', async () => {
    // jsdom doesn't ship a real FontFaceSet; we stub one.
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
    const { waitForFonts } = await import('./publish-compositor');
    await expect(waitForFonts()).resolves.toBeUndefined();
  });

  it('resolves when document.fonts is missing', async () => {
    Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
    const { waitForFonts } = await import('./publish-compositor');
    await expect(waitForFonts()).resolves.toBeUndefined();
  });
});
