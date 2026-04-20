import { describe, it, expect } from 'vitest';
import { computePreviewDimensions } from './export-studio';

describe('export-studio', () => {
  describe('computePreviewDimensions', () => {
    it('scales figure to fit within preview area maintaining aspect ratio', () => {
      const result = computePreviewDimensions(
        { widthMm: 183, heightMm: 120 },
        { width: 800, height: 600 },
      );
      expect(result.width).toBeCloseTo(800, 0);
      expect(result.height).toBeCloseTo(524.6, 0);
    });

    it('constrains by height when figure is tall', () => {
      const result = computePreviewDimensions(
        { widthMm: 89, heightMm: 247 },
        { width: 800, height: 600 },
      );
      expect(result.height).toBeCloseTo(600, 0);
      expect(result.width).toBeCloseTo(216, 0);
    });

    it('handles native preset (pixel dimensions)', () => {
      const result = computePreviewDimensions(
        { widthPx: 1920, heightPx: 1080 },
        { width: 800, height: 600 },
      );
      expect(result.width).toBeCloseTo(800, 0);
      expect(result.height).toBeCloseTo(450, 0);
    });
  });
});
