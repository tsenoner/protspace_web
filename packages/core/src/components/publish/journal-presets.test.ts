import { describe, it, expect } from 'vitest';
import {
  JOURNAL_PRESETS,
  mmToPx,
  pxToMm,
  getPreset,
  resolvePresetDimensions,
} from './journal-presets';

describe('journal-presets', () => {
  describe('mmToPx', () => {
    it('converts 25.4mm at 300 DPI to 300px', () => {
      expect(mmToPx(25.4, 300)).toBe(300);
    });

    it('converts 89mm at 300 DPI correctly', () => {
      // 89 * 300 / 25.4 ≈ 1051
      expect(mmToPx(89, 300)).toBe(1051);
    });

    it('converts 183mm at 300 DPI correctly', () => {
      // 183 * 300 / 25.4 ≈ 2161
      expect(mmToPx(183, 300)).toBe(2161);
    });

    it('converts at 96 DPI correctly', () => {
      // 25.4mm at 96 DPI = 96px
      expect(mmToPx(25.4, 96)).toBe(96);
    });
  });

  describe('pxToMm', () => {
    it('converts 300px at 300 DPI to 25.4mm', () => {
      expect(pxToMm(300, 300)).toBeCloseTo(25.4, 1);
    });

    it('is the inverse of mmToPx', () => {
      const mm = 89;
      const dpi = 300;
      const px = mmToPx(mm, dpi);
      expect(pxToMm(px, dpi)).toBeCloseTo(mm, 0);
    });
  });

  describe('getPreset', () => {
    it('returns a preset by id', () => {
      const preset = getPreset('nature-1col');
      expect(preset).toBeDefined();
      expect(preset!.label).toBe('Nature \u00b7 1 col');
      expect(preset!.widthMm).toBe(89);
      expect(preset!.dpi).toBe(300);
    });

    it('returns undefined for unknown id', () => {
      expect(getPreset('nonexistent')).toBeUndefined();
    });
  });

  describe('resolvePresetDimensions', () => {
    it('resolves mm-based presets to pixel dimensions', () => {
      const preset = getPreset('nature-1col')!;
      const { widthPx, heightPx } = resolvePresetDimensions(preset);
      expect(widthPx).toBe(mmToPx(89, 300));
      expect(heightPx).toBe(mmToPx(247, 300)); // maxHeightMm
    });

    it('resolves px-based presets directly', () => {
      const preset = getPreset('slide-16-9')!;
      const { widthPx, heightPx } = resolvePresetDimensions(preset);
      expect(widthPx).toBe(1920);
      expect(heightPx).toBe(1080);
    });

    it('returns undefined heightPx when no maxHeightMm', () => {
      const preset = getPreset('science-1col')!;
      const { heightPx } = resolvePresetDimensions(preset);
      expect(heightPx).toBeUndefined();
    });
  });

  describe('JOURNAL_PRESETS table', () => {
    it('has at least 14 presets', () => {
      expect(JOURNAL_PRESETS.length).toBeGreaterThanOrEqual(14);
    });

    it('every preset has a unique id', () => {
      const ids = JOURNAL_PRESETS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every preset resolves to pixel width within [400, 8192]', () => {
      for (const preset of JOURNAL_PRESETS) {
        const { widthPx } = resolvePresetDimensions(preset);
        expect(widthPx).toBeGreaterThanOrEqual(400);
        expect(widthPx).toBeLessThanOrEqual(8192);
      }
    });

    it('every mm-based preset has dpi >= 200', () => {
      for (const preset of JOURNAL_PRESETS) {
        if (preset.widthMm !== undefined) {
          expect(preset.dpi).toBeGreaterThanOrEqual(200);
        }
      }
    });
  });
});
