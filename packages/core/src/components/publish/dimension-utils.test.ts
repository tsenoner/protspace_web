import { describe, it, expect } from 'vitest';
import {
  pxToMm,
  mmToPx,
  adjustDpiForWidthMm,
  adjustWidthPxForDpi,
  clampHeight,
  SIZE_MODE_WIDTH_MM,
  type SizeMode,
} from './dimension-utils';

describe('dimension-utils', () => {
  describe('pxToMm', () => {
    it('converts 300px at 300 DPI to 25.4mm', () => {
      expect(pxToMm(300, 300)).toBeCloseTo(25.4, 1);
    });

    it('converts 1051px at 300 DPI to ~89mm', () => {
      expect(pxToMm(1051, 300)).toBeCloseTo(89, 0);
    });

    it('converts 2161px at 300 DPI to ~183mm', () => {
      expect(pxToMm(2161, 300)).toBeCloseTo(183, 0);
    });
  });

  describe('mmToPx', () => {
    it('converts 89mm at 300 DPI to 1051px', () => {
      expect(mmToPx(89, 300)).toBe(1051);
    });

    it('converts 183mm at 300 DPI to 2161px', () => {
      expect(mmToPx(183, 300)).toBe(2161);
    });
  });

  describe('adjustDpiForWidthMm', () => {
    it('calculates DPI needed for 89mm at 1051px', () => {
      const dpi = adjustDpiForWidthMm(1051, 89);
      expect(dpi).toBeCloseTo(300, 0);
    });

    it('calculates DPI needed for 183mm at 2161px', () => {
      const dpi = adjustDpiForWidthMm(2161, 183);
      expect(dpi).toBeCloseTo(300, 0);
    });
  });

  describe('adjustWidthPxForDpi', () => {
    it('calculates width px for 89mm at 300 DPI', () => {
      expect(adjustWidthPxForDpi(89, 300)).toBe(1051);
    });

    it('calculates width px for 89mm at 150 DPI', () => {
      expect(adjustWidthPxForDpi(89, 150)).toBe(526);
    });
  });

  describe('clampHeight', () => {
    it('clamps to max 170mm equivalent at given DPI', () => {
      const maxPx = clampHeight(3000, 300, 170);
      expect(maxPx).toBe(2008);
    });

    it('returns original height if below max', () => {
      expect(clampHeight(1000, 300, 170)).toBe(1000);
    });

    it('returns original when maxMm is undefined', () => {
      expect(clampHeight(5000, 300, undefined)).toBe(5000);
    });
  });

  describe('SIZE_MODE_WIDTH_MM', () => {
    it('1-column mode is 89mm', () => {
      expect(SIZE_MODE_WIDTH_MM['1-column']).toBe(89);
    });

    it('2-column mode is 183mm', () => {
      expect(SIZE_MODE_WIDTH_MM['2-column']).toBe(183);
    });

    it('flexible mode is undefined', () => {
      expect(SIZE_MODE_WIDTH_MM['flexible']).toBeUndefined();
    });
  });
});
