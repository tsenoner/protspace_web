// packages/core/src/components/scatter-plot/indicator-layer.test.ts
import { describe, it, expect } from 'vitest';
import { computeArrowScreenPosition } from './indicator-layer';
import type { Indicator } from './annotation-types';

describe('indicator-layer', () => {
  describe('computeArrowScreenPosition', () => {
    const transform = { x: 0, y: 0, k: 1 };
    const scaleX = (v: number) => v * 10;
    const scaleY = (v: number) => v * 10;

    it('computes screen position from data coords and transform', () => {
      const indicator: Indicator = {
        id: 'ind-1',
        proteinId: 'P1',
        label: 'P1',
        dataCoords: [5, 8],
        offsetPx: [0, 0],
      };
      const pos = computeArrowScreenPosition(indicator, scaleX, scaleY, transform);
      expect(pos.tipX).toBe(50);
      expect(pos.tipY).toBe(80);
    });

    it('applies pixel offset to shaft but not tip', () => {
      const indicator: Indicator = {
        id: 'ind-1',
        proteinId: 'P1',
        label: 'P1',
        dataCoords: [5, 8],
        offsetPx: [20, -15],
      };
      const pos = computeArrowScreenPosition(indicator, scaleX, scaleY, transform);
      expect(pos.tipX).toBe(50);
      expect(pos.tipY).toBe(80);
      expect(pos.shaftX).toBe(70);
      expect(pos.shaftY).toBe(65);
    });

    it('applies zoom transform', () => {
      const indicator: Indicator = {
        id: 'ind-1',
        proteinId: 'P1',
        label: 'P1',
        dataCoords: [5, 8],
        offsetPx: [0, 0],
      };
      const zoomed = { x: 100, y: 50, k: 2 };
      const pos = computeArrowScreenPosition(indicator, scaleX, scaleY, zoomed);
      expect(pos.tipX).toBe(200);
      expect(pos.tipY).toBe(210);
    });
  });
});
