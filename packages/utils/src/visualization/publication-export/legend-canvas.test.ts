// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { drawPublicationLegend } from './legend-canvas';
import { FIGURE_LAYOUTS, type FigureLayoutId } from './presets';
import { maxLegendItemsForLayout } from './legend-caps';
import type { PublicationLegendModel, PublicationLegendRow } from './legend-model';
import { mmToPx } from './typography';
import { mmRectToPx } from './pixel-rect';
import { computePublicationLayout } from './layout';

beforeAll(() => {
  if (typeof globalThis.Path2D === 'undefined') {
    class Path2DStub {
      constructor(_d?: string) {}
    }
    Object.defineProperty(globalThis, 'Path2D', { value: Path2DStub, writable: true });
  }

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: '',
    textAlign: '',
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D,
  );
});

function makeRow(i: number, label = `Item ${i}`): PublicationLegendRow {
  return {
    value: `v${i}`,
    displayLabel: label,
    color: '#3366cc',
    shape: 'circle',
    count: 100 + i,
    isVisible: true,
    zOrder: i,
  };
}

function makeModel(rows: PublicationLegendRow[]): PublicationLegendModel {
  return {
    annotationTitle: 'Test annotation',
    includeShapes: true,
    otherItemsCount: 0,
    items: rows,
  };
}

function newCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const dpi = 300;

describe('drawPublicationLegend', () => {
  const ids: FigureLayoutId[] = Object.keys(FIGURE_LAYOUTS) as FigureLayoutId[];

  it.each(ids)('renders without throwing for %s with N=1', async (id) => {
    const layout = FIGURE_LAYOUTS[id];
    const computed = computePublicationLayout(layout);
    const figW = Math.round(mmToPx(layout.widthMm, dpi));
    const figH = Math.round(mmToPx(layout.heightMm, dpi));
    const canvas = newCanvas(figW, figH);
    const ctx = canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    const legendPx = mmRectToPx(computed.legendMm, dpi);
    await drawPublicationLegend(ctx!, legendPx, makeModel([makeRow(0)]), {
      dpi,
      layoutId: id,
    });
  });

  it.each(ids)('renders without throwing for %s with N=cap+5', async (id) => {
    const layout = FIGURE_LAYOUTS[id];
    const computed = computePublicationLayout(layout);
    const figW = Math.round(mmToPx(layout.widthMm, dpi));
    const figH = Math.round(mmToPx(layout.heightMm, dpi));
    const canvas = newCanvas(figW, figH);
    const ctx = canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    const legendPx = mmRectToPx(computed.legendMm, dpi);
    const cap = maxLegendItemsForLayout(id);
    const rows = Array.from({ length: cap + 5 }, (_, i) => makeRow(i));
    await drawPublicationLegend(ctx!, legendPx, makeModel(rows), {
      dpi,
      layoutId: id,
    });
  });
});
