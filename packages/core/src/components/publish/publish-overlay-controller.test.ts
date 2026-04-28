/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishOverlayController } from './publish-overlay-controller';
import type { Overlay, Inset } from './publish-state';

// ── Mock canvas context ─────────────────────────────────────
// jsdom doesn't support CanvasRenderingContext2D, so we provide a stub.

function createMockCtx(): CanvasRenderingContext2D {
  const noop = vi.fn();
  return {
    save: noop,
    restore: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    drawImage: noop,
    fillText: noop,
    measureText: vi.fn(() => ({ width: 50 })),
    setLineDash: noop,
    translate: noop,
    rotate: noop,
    closePath: noop,
    set font(_: string) {},
    set fillStyle(_: string) {},
    set strokeStyle(_: string) {},
    set lineWidth(_: number) {},
    set lineCap(_: string) {},
    set textBaseline(_: string) {},
    set textAlign(_: string) {},
    set globalAlpha(_: number) {},
  } as unknown as CanvasRenderingContext2D;
}

// ── Test helpers ────────────────────────────────────────────

function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 500;
  // Mock getBoundingClientRect to match canvas dimensions (1:1 scale)
  canvas.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
      right: 1000,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => {},
    }) as DOMRect;
  // jsdom doesn't implement pointer capture
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  return canvas;
}

function createCallbacks() {
  return {
    getPlotRect: vi.fn(() => ({ x: 0, y: 0, w: 1000, h: 500 })),
    getOverlays: vi.fn((): Overlay[] => []),
    getInsets: vi.fn((): Inset[] => []),
    getLegendRect: vi.fn(() => null),
    onOverlayAdded: vi.fn(),
    onOverlayUpdated: vi.fn(),
    onInsetAdded: vi.fn(),
    onInsetUpdated: vi.fn(),
    onSelectionChanged: vi.fn(),
    onLegendMoved: vi.fn(),
    requestRedraw: vi.fn(),
  };
}

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    bubbles: true,
  });
}

// ── Tests ───────────────────────────────────────────────────

describe('PublishOverlayController', () => {
  let canvas: HTMLCanvasElement;
  let callbacks: ReturnType<typeof createCallbacks>;
  let controller: PublishOverlayController;

  beforeEach(() => {
    canvas = createMockCanvas();
    callbacks = createCallbacks();
    controller = new PublishOverlayController(canvas, callbacks);
  });

  describe('tool management', () => {
    it('defaults to select tool', () => {
      expect(controller.tool).toBe('select');
    });

    it('changes cursor to crosshair for drawing tools', () => {
      controller.tool = 'circle';
      expect(controller.tool).toBe('circle');
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('changes cursor to default for select tool', () => {
      controller.tool = 'circle';
      controller.tool = 'select';
      expect(canvas.style.cursor).toBe('default');
    });

    it('sets all drawing tool types', () => {
      const tools = ['select', 'circle', 'arrow', 'label', 'inset-source', 'inset-target'] as const;
      for (const tool of tools) {
        controller.tool = tool;
        expect(controller.tool).toBe(tool);
      }
    });
  });

  describe('circle creation', () => {
    it('creates a circle overlay on drag', () => {
      controller.tool = 'circle';
      // Drag from center to right — 200px drag on a 1000x500 canvas
      canvas.dispatchEvent(pointerEvent('pointerdown', 500, 250));
      canvas.dispatchEvent(pointerEvent('pointermove', 700, 250));
      canvas.dispatchEvent(pointerEvent('pointerup', 700, 250));

      expect(callbacks.onOverlayAdded).toHaveBeenCalledTimes(1);
      const overlay = callbacks.onOverlayAdded.mock.calls[0][0];
      expect(overlay.type).toBe('circle');
      expect(overlay.cx).toBeCloseTo(0.5, 1);
      expect(overlay.cy).toBeCloseTo(0.5, 1);
      expect(overlay.rx).toBeGreaterThan(0);
      expect(overlay.ry).toBeGreaterThan(0);
      expect(overlay.color).toBe('#000000');
      expect(overlay.strokeWidth).toBe(2);
      expect(overlay.rotation).toBe(0);
    });

    it('does not create a circle for very small drags', () => {
      controller.tool = 'circle';
      canvas.dispatchEvent(pointerEvent('pointerdown', 500, 250));
      canvas.dispatchEvent(pointerEvent('pointerup', 501, 250));

      expect(callbacks.onOverlayAdded).not.toHaveBeenCalled();
    });
  });

  describe('arrow creation', () => {
    it('creates an arrow overlay on drag', () => {
      controller.tool = 'arrow';
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointermove', 500, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 500, 300));

      expect(callbacks.onOverlayAdded).toHaveBeenCalledTimes(1);
      const overlay = callbacks.onOverlayAdded.mock.calls[0][0];
      expect(overlay.type).toBe('arrow');
      expect(overlay.x1).toBeCloseTo(0.1, 1);
      expect(overlay.y1).toBeCloseTo(0.2, 1);
      expect(overlay.x2).toBeCloseTo(0.5, 1);
      expect(overlay.y2).toBeCloseTo(0.6, 1);
      expect(overlay.color).toBe('#000000');
      expect(overlay.width).toBe(2);
    });

    it('does not create an arrow for very short drags', () => {
      controller.tool = 'arrow';
      canvas.dispatchEvent(pointerEvent('pointerdown', 500, 250));
      canvas.dispatchEvent(pointerEvent('pointerup', 501, 250));

      expect(callbacks.onOverlayAdded).not.toHaveBeenCalled();
    });
  });

  describe('label creation', () => {
    it('creates a label overlay on click', () => {
      controller.tool = 'label';
      canvas.dispatchEvent(pointerEvent('pointerdown', 300, 200));
      canvas.dispatchEvent(pointerEvent('pointerup', 300, 200));

      expect(callbacks.onOverlayAdded).toHaveBeenCalledTimes(1);
      const overlay = callbacks.onOverlayAdded.mock.calls[0][0];
      expect(overlay.type).toBe('label');
      expect(overlay.text).toBe('Label');
      expect(overlay.fontSize).toBe(16);
      expect(overlay.rotation).toBe(0);
      expect(overlay.color).toBe('#000000');
    });

    it('places label at click position', () => {
      controller.tool = 'label';
      canvas.dispatchEvent(pointerEvent('pointerdown', 500, 250));
      canvas.dispatchEvent(pointerEvent('pointerup', 500, 250));

      const overlay = callbacks.onOverlayAdded.mock.calls[0][0];
      expect(overlay.x).toBeCloseTo(0.5, 1);
      expect(overlay.y).toBeCloseTo(0.5, 1);
    });
  });

  describe('inset creation', () => {
    it('creates source then target rectangles in two-phase workflow', () => {
      controller.tool = 'inset-source';

      // Phase 1: draw source rect
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointermove', 300, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 300, 300));

      // Tool should auto-switch to inset-target
      expect(controller.tool).toBe('inset-target');
      expect(callbacks.onInsetAdded).not.toHaveBeenCalled();

      // Phase 2: draw target rect
      canvas.dispatchEvent(pointerEvent('pointerdown', 600, 50));
      canvas.dispatchEvent(pointerEvent('pointermove', 900, 350));
      canvas.dispatchEvent(pointerEvent('pointerup', 900, 350));

      expect(callbacks.onInsetAdded).toHaveBeenCalledTimes(1);
      const inset = callbacks.onInsetAdded.mock.calls[0][0];
      expect(inset.sourceRect.w).toBeGreaterThan(0);
      expect(inset.sourceRect.h).toBeGreaterThan(0);
      expect(inset.targetRect.w).toBeGreaterThan(0);
      expect(inset.targetRect.h).toBeGreaterThan(0);
      expect(inset.border).toBe(2);
      expect(inset.connector).toBe('lines');
      expect(controller.tool).toBe('select');
    });

    it('does not create inset source for tiny rects', () => {
      controller.tool = 'inset-source';
      canvas.dispatchEvent(pointerEvent('pointerdown', 500, 250));
      canvas.dispatchEvent(pointerEvent('pointerup', 502, 251));

      expect(controller.tool).toBe('inset-source');
      expect(callbacks.onInsetAdded).not.toHaveBeenCalled();
    });

    it('constrains target aspect ratio to match source', () => {
      controller.tool = 'inset-source';

      // Draw a square source: 200x200 px on a 1000x500 canvas
      // In norm coords: w=0.2, h=0.4 → pixel aspect = (0.2*1000)/(0.4*500) = 200/200 = 1.0
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 50));
      canvas.dispatchEvent(pointerEvent('pointerup', 300, 250));

      expect(controller.tool).toBe('inset-target');

      // Draw target wider than source would allow
      canvas.dispatchEvent(pointerEvent('pointerdown', 600, 50));
      canvas.dispatchEvent(pointerEvent('pointerup', 900, 350));

      expect(callbacks.onInsetAdded).toHaveBeenCalledTimes(1);
      const inset = callbacks.onInsetAdded.mock.calls[0][0];

      // Pixel aspect ratios should match
      const plotW = 1000;
      const plotH = 500;
      const srcAspect = (inset.sourceRect.w * plotW) / (inset.sourceRect.h * plotH);
      const tgtAspect = (inset.targetRect.w * plotW) / (inset.targetRect.h * plotH);
      expect(tgtAspect).toBeCloseTo(srcAspect, 2);
    });

    it('normalizes source rect regardless of drag direction', () => {
      controller.tool = 'inset-source';

      // Drag from bottom-right to top-left
      canvas.dispatchEvent(pointerEvent('pointerdown', 400, 400));
      canvas.dispatchEvent(pointerEvent('pointerup', 100, 100));

      // Should have valid rect with positive w/h
      expect(controller.tool).toBe('inset-target');
    });
  });

  describe('select mode — hit testing and selection', () => {
    it('selects a circle overlay when clicking on its boundary', () => {
      const circle: Overlay = {
        type: 'circle',
        cx: 0.5,
        cy: 0.5,
        rx: 0.1,
        ry: 0.1,
        rotation: 0,
        color: '#000000',
        strokeWidth: 2,
      };
      callbacks.getOverlays.mockReturnValue([circle]);
      controller.tool = 'select';

      // Click on the circle boundary: cx=0.5 (500px), rx=0.1 (100px), so boundary at 600px
      canvas.dispatchEvent(pointerEvent('pointerdown', 600, 250));
      canvas.dispatchEvent(pointerEvent('pointerup', 600, 250));

      expect(callbacks.onSelectionChanged).toHaveBeenCalledWith('overlay', 0);
    });

    it('deselects when clicking empty space', () => {
      callbacks.getOverlays.mockReturnValue([]);
      callbacks.getInsets.mockReturnValue([]);
      controller.tool = 'select';

      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointerup', 100, 100));

      expect(callbacks.onSelectionChanged).toHaveBeenCalledWith(null, -1);
    });

    it('selects an inset target when clicking inside it', () => {
      const inset: Inset = {
        sourceRect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
        targetRect: { x: 0.6, y: 0.1, w: 0.3, h: 0.3 },
        border: 2,
        connector: 'lines',
      };
      callbacks.getInsets.mockReturnValue([inset]);
      controller.tool = 'select';

      // Click inside target rect (0.6-0.9, 0.1-0.4) → px (600-900, 50-200)
      canvas.dispatchEvent(pointerEvent('pointerdown', 750, 125));
      canvas.dispatchEvent(pointerEvent('pointerup', 750, 125));

      expect(callbacks.onSelectionChanged).toHaveBeenCalledWith('inset', 0);
    });

    it('prefers insets over overlays (drawn on top)', () => {
      const circle: Overlay = {
        type: 'circle',
        cx: 0.7,
        cy: 0.25,
        rx: 0.1,
        ry: 0.1,
        rotation: 0,
        color: '#000000',
        strokeWidth: 2,
      };
      const inset: Inset = {
        sourceRect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
        targetRect: { x: 0.6, y: 0.1, w: 0.3, h: 0.3 },
        border: 2,
        connector: 'lines',
      };
      callbacks.getOverlays.mockReturnValue([circle]);
      callbacks.getInsets.mockReturnValue([inset]);
      controller.tool = 'select';

      // Click on area where both overlap
      canvas.dispatchEvent(pointerEvent('pointerdown', 750, 125));
      canvas.dispatchEvent(pointerEvent('pointerup', 750, 125));

      // Should select inset, not overlay
      expect(callbacks.onSelectionChanged).toHaveBeenCalledWith('inset', 0);
    });

    it('selects the last (topmost) overlay when multiple overlap', () => {
      const circle1: Overlay = {
        type: 'circle',
        cx: 0.5,
        cy: 0.5,
        rx: 0.15,
        ry: 0.15,
        rotation: 0,
        color: '#ff0000',
        strokeWidth: 2,
      };
      const circle2: Overlay = {
        type: 'circle',
        cx: 0.52,
        cy: 0.5,
        rx: 0.15,
        ry: 0.15,
        rotation: 0,
        color: '#0000ff',
        strokeWidth: 2,
      };
      callbacks.getOverlays.mockReturnValue([circle1, circle2]);
      controller.tool = 'select';

      // Click near their shared boundary
      canvas.dispatchEvent(pointerEvent('pointerdown', 670, 250));
      canvas.dispatchEvent(pointerEvent('pointerup', 670, 250));

      // Should select index 1 (last drawn = topmost)
      expect(callbacks.onSelectionChanged).toHaveBeenCalledWith('overlay', 1);
    });
  });

  describe('select mode — movement', () => {
    it('moves a circle overlay when dragging', () => {
      const circle: Overlay = {
        type: 'circle',
        cx: 0.5,
        cy: 0.5,
        rx: 0.1,
        ry: 0.1,
        rotation: 0,
        color: '#000000',
        strokeWidth: 2,
      };
      callbacks.getOverlays.mockReturnValue([circle]);
      controller.tool = 'select';

      // Click on circle boundary, then drag
      canvas.dispatchEvent(pointerEvent('pointerdown', 600, 250));
      canvas.dispatchEvent(pointerEvent('pointermove', 700, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 700, 300));

      expect(callbacks.onOverlayUpdated).toHaveBeenCalled();
      const updated = callbacks.onOverlayUpdated.mock.calls[0][1];
      expect(updated.type).toBe('circle');
    });

    it('moves a label overlay when dragging', () => {
      const label: Overlay = {
        type: 'label',
        x: 0.5,
        y: 0.5,
        text: 'Test',
        fontSize: 16,
        rotation: 0,
        color: '#000000',
      };
      callbacks.getOverlays.mockReturnValue([label]);
      controller.tool = 'select';

      canvas.dispatchEvent(pointerEvent('pointerdown', 500, 250));
      canvas.dispatchEvent(pointerEvent('pointermove', 600, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 600, 300));

      expect(callbacks.onOverlayUpdated).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('removes event listeners on destroy', () => {
      const spy = vi.spyOn(canvas, 'removeEventListener');
      controller.destroy();
      expect(spy).toHaveBeenCalledTimes(4);
      expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('pointercancel', expect.any(Function));
    });
  });

  describe('drawDragIndicator', () => {
    it('does nothing when no drag is active', () => {
      const ctx = createMockCtx();
      controller.drawDragIndicator(ctx);
      expect(ctx.save).not.toHaveBeenCalled();
    });
  });

  describe('drawSelectionHandles', () => {
    it('does nothing when nothing is selected', () => {
      const ctx = createMockCtx();
      controller.drawSelectionHandles(ctx);
      expect(ctx.save).not.toHaveBeenCalled();
    });
  });

  describe('request redraw', () => {
    it('calls requestRedraw during drag', () => {
      controller.tool = 'circle';
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointermove', 200, 200));

      expect(callbacks.requestRedraw).toHaveBeenCalled();
    });

    it('calls requestRedraw on pointer up', () => {
      controller.tool = 'circle';
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      callbacks.requestRedraw.mockClear();
      canvas.dispatchEvent(pointerEvent('pointerup', 200, 200));

      expect(callbacks.requestRedraw).toHaveBeenCalled();
    });
  });

  describe('pointer lifecycle', () => {
    it('aborts drag and releases pointer capture on pointercancel', () => {
      controller.tool = 'circle';
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointermove', 200, 200));

      const cancel = pointerEvent('pointercancel', 200, 200);
      canvas.dispatchEvent(cancel);

      // Subsequent pointermove must not mutate state
      canvas.dispatchEvent(pointerEvent('pointermove', 400, 400));
      canvas.dispatchEvent(pointerEvent('pointerup', 400, 400));

      expect(callbacks.onOverlayAdded).not.toHaveBeenCalled();
      expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('destroy() releases pointer capture and clears drag state mid-drag', () => {
      controller.tool = 'circle';
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointermove', 200, 200));

      controller.destroy();

      expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
      // Further events are no-ops because listeners were removed
      canvas.dispatchEvent(pointerEvent('pointerup', 400, 400));
      expect(callbacks.onOverlayAdded).not.toHaveBeenCalled();
    });
  });

  describe('arrow handle drag', () => {
    it('does not clamp arrow endpoint coords past plot edge', () => {
      controller.tool = 'arrow';
      // Create an arrow well inside the plot
      canvas.dispatchEvent(pointerEvent('pointerdown', 200, 200));
      canvas.dispatchEvent(pointerEvent('pointermove', 400, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 400, 300));
      expect(callbacks.onOverlayAdded).toHaveBeenCalledTimes(1);

      // Seed callbacks.getOverlays with the created arrow + select it
      const arrow = callbacks.onOverlayAdded.mock.calls[0][0];
      callbacks.getOverlays.mockReturnValue([arrow]);
      controller.tool = 'select';

      // First click: select the arrow (its line is hit at the endpoint)
      canvas.dispatchEvent(pointerEvent('pointerdown', 400, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 400, 300));

      // Second click hits the end handle (now that arrow is selected)
      canvas.dispatchEvent(pointerEvent('pointerdown', 400, 300));
      // Drag past the right edge (canvas width = 1000, plot ends at 1000)
      canvas.dispatchEvent(pointerEvent('pointermove', 1500, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 1500, 300));

      // Last update call should have nx > 1 (unclamped during drag)
      const updates = callbacks.onOverlayUpdated.mock.calls;
      expect(updates.length).toBeGreaterThan(0);
      const last = updates[updates.length - 1][1];
      expect(last.x2).toBeGreaterThan(1);
    });
  });
});
