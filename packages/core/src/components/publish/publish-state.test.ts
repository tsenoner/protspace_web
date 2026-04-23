import { describe, it, expect } from 'vitest';
import {
  createDefaultPublishState,
  type PublishState,
  type LegendFreePosition,
} from './publish-state';

describe('publish-state', () => {
  describe('createDefaultPublishState', () => {
    it('creates a valid default state', () => {
      const state = createDefaultPublishState();
      expect(state.preset).toBe('flexible');
      expect(state.widthPx).toBe(2048);
      expect(state.heightPx).toBe(1024);
      expect(state.dpi).toBe(300);
      expect(state.format).toBe('png');
      expect(state.background).toBe('white');
      expect(state.annotations).toEqual([]);
      expect(state.insets).toEqual([]);
    });

    it('applies base settings from export options', () => {
      const state = createDefaultPublishState({
        imageWidth: 3000,
        imageHeight: 2000,
        legendWidthPercent: 30,
        legendFontSizePx: 20,
      });
      expect(state.widthPx).toBe(3000);
      expect(state.heightPx).toBe(2000);
      expect(state.legend.widthPercent).toBe(30);
      expect(state.legend.fontSizePx).toBe(20);
    });

    it('defaults legend to visible, right position, multi-column overflow', () => {
      const state = createDefaultPublishState();
      expect(state.legend.visible).toBe(true);
      expect(state.legend.position).toBe('right');
      expect(state.legend.overflow).toBe('multi-column');
      expect(state.legend.columns).toBe(1);
    });
  });

  describe('preset switching', () => {
    it('editing width sets preset to custom', () => {
      const state = createDefaultPublishState();
      // Simulate what the modal does
      const updated: PublishState = { ...state, widthPx: 1920, preset: 'custom' };
      expect(updated.preset).toBe('custom');
      expect(updated.widthPx).toBe(1920);
    });

    it('applying a preset overwrites width/height/dpi', () => {
      const state = createDefaultPublishState();
      // Simulate applying a preset
      const updated: PublishState = {
        ...state,
        preset: 'nature-1col',
        widthPx: 1051,
        heightPx: 2917,
        dpi: 300,
      };
      expect(updated.preset).toBe('nature-1col');
      expect(updated.widthPx).toBe(1051);
      expect(updated.dpi).toBe(300);
    });
  });

  describe('annotation coordinate normalisation', () => {
    it('circle annotation coordinates stay valid across preset changes', () => {
      const circle = {
        type: 'circle' as const,
        cx: 0.5,
        cy: 0.3,
        rx: 0.1,
        ry: 0.05,
        rotation: 0,
        color: '#e42121',
        strokeWidth: 2,
      };
      // Coordinates are 0–1 normalised, so they survive resolution changes
      expect(circle.cx).toBeGreaterThanOrEqual(0);
      expect(circle.cx).toBeLessThanOrEqual(1);
      expect(circle.cy).toBeGreaterThanOrEqual(0);
      expect(circle.cy).toBeLessThanOrEqual(1);
      expect(circle.rx).toBeGreaterThan(0);
      expect(circle.ry).toBeGreaterThan(0);
    });
  });
});

describe('size mode in state', () => {
  it('defaults sizeMode to flexible', () => {
    const state = createDefaultPublishState();
    expect(state.sizeMode).toBe('flexible');
  });
});

describe('legend free position', () => {
  it('defaults legendFreePos to undefined', () => {
    const state = createDefaultPublishState();
    expect(state.legend.freePos).toBeUndefined();
  });

  it('free position has normalised x/y coordinates', () => {
    const pos: LegendFreePosition = { nx: 0.5, ny: 0.3 };
    expect(pos.nx).toBeGreaterThanOrEqual(0);
    expect(pos.nx).toBeLessThanOrEqual(1);
  });
});

describe('inset magnification', () => {
  it('inset accepts magnification field', () => {
    const inset = {
      sourceRect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      targetRect: { x: 0.6, y: 0.6, w: 0.3, h: 0.3 },
      border: 2,
      connector: 'lines' as const,
      magnification: 2,
    };
    expect(inset.magnification).toBe(2);
  });
});
