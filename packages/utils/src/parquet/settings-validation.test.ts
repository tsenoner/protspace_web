import { describe, it, expect } from 'vitest';
import {
  isLegacyBundleSettings,
  isNormalizedBundleSettings,
  isValidBundleSettings,
  isValidLegendSettings,
  isValidPersistedCategoryData,
  isValidPersistedExportOptions,
  isValidSortMode,
  normalizeBundleSettings,
} from './settings-validation';
import type {
  BundleSettings,
  LegacyBundleSettings,
  LegendPersistedSettings,
  PersistedExportOptions,
} from '../types';

const createValidLegendSettings = (): LegendPersistedSettings => ({
  maxVisibleValues: 10,
  includeShapes: true,
  shapeSize: 24,
  sortMode: 'size-desc',
  hiddenValues: ['unknown'],
  categories: {
    human: { zOrder: 0, color: '#ff0000', shape: 'circle' },
  },
  enableDuplicateStackUI: false,
  selectedPaletteId: 'kellys',
});

const createValidExportOptions = (): PersistedExportOptions => ({
  imageWidth: 2048,
  imageHeight: 1024,
  lockAspectRatio: true,
  legendWidthPercent: 25,
  legendFontSizePx: 24,
  includeLegendSettings: true,
  includeExportOptions: true,
});

const createNormalizedBundleSettings = (): BundleSettings => ({
  legendSettings: {
    organism: createValidLegendSettings(),
  },
  exportOptions: {
    organism: createValidExportOptions(),
  },
});

describe('settings-validation', () => {
  describe('isValidSortMode', () => {
    it('accepts valid sort modes', () => {
      expect(isValidSortMode('size-asc')).toBe(true);
      expect(isValidSortMode('size-desc')).toBe(true);
      expect(isValidSortMode('alpha-asc')).toBe(true);
      expect(isValidSortMode('alpha-desc')).toBe(true);
      expect(isValidSortMode('manual')).toBe(true);
      expect(isValidSortMode('manual-reverse')).toBe(true);
    });

    it('rejects invalid sort modes', () => {
      expect(isValidSortMode('invalid')).toBe(false);
      expect(isValidSortMode(123)).toBe(false);
      expect(isValidSortMode(null)).toBe(false);
    });
  });

  describe('isValidPersistedCategoryData', () => {
    it('accepts valid category data', () => {
      expect(isValidPersistedCategoryData({ zOrder: 0, color: '#ff0000', shape: 'circle' })).toBe(
        true,
      );
    });

    it('rejects invalid category data', () => {
      expect(isValidPersistedCategoryData({ zOrder: '0', color: '#ff0000', shape: 'circle' })).toBe(
        false,
      );
      expect(isValidPersistedCategoryData(null)).toBe(false);
    });
  });

  describe('isValidLegendSettings', () => {
    it('accepts valid settings', () => {
      expect(isValidLegendSettings(createValidLegendSettings())).toBe(true);
    });

    it('accepts extra fields for forward compatibility', () => {
      expect(
        isValidLegendSettings({
          ...createValidLegendSettings(),
          futureField: { enabled: true },
        }),
      ).toBe(true);
    });

    it('rejects invalid settings', () => {
      expect(
        isValidLegendSettings({
          ...createValidLegendSettings(),
          categories: [],
        }),
      ).toBe(false);
    });
  });

  describe('isValidPersistedExportOptions', () => {
    it('accepts valid export options', () => {
      expect(isValidPersistedExportOptions(createValidExportOptions())).toBe(true);
    });

    it('rejects invalid export options', () => {
      expect(
        isValidPersistedExportOptions({
          ...createValidExportOptions(),
          includeExportOptions: 'yes',
        }),
      ).toBe(false);
      expect(isValidPersistedExportOptions(null)).toBe(false);
    });
  });

  describe('bundle settings formats', () => {
    it('accepts normalized bundle settings', () => {
      const settings = createNormalizedBundleSettings();
      expect(isNormalizedBundleSettings(settings)).toBe(true);
      expect(isValidBundleSettings(settings)).toBe(true);
    });

    it('accepts legacy legend-only bundle settings', () => {
      const legacy: LegacyBundleSettings = {
        organism: createValidLegendSettings(),
        family: createValidLegendSettings(),
      };

      expect(isLegacyBundleSettings(legacy)).toBe(true);
      expect(isValidBundleSettings(legacy)).toBe(true);
    });

    it('rejects malformed normalized bundle settings', () => {
      expect(
        isNormalizedBundleSettings({
          legendSettings: { organism: createValidLegendSettings() },
          exportOptions: { organism: { bad: true } },
        }),
      ).toBe(false);
      expect(isValidBundleSettings({ legendSettings: [], exportOptions: {} })).toBe(false);
    });

    it('normalizes legacy settings to the current shape', () => {
      const legacy: LegacyBundleSettings = {
        organism: createValidLegendSettings(),
      };

      expect(normalizeBundleSettings(legacy)).toEqual({
        legendSettings: legacy,
        exportOptions: {},
      });
    });

    it('returns normalized settings unchanged', () => {
      const settings = createNormalizedBundleSettings();
      expect(normalizeBundleSettings(settings)).toEqual(settings);
    });

    it('returns empty normalized settings for malformed settings objects', () => {
      expect(normalizeBundleSettings({ nope: true })).toEqual({
        legendSettings: {},
        exportOptions: {},
      });
      expect(normalizeBundleSettings(null)).toBeNull();
    });

    it('drops invalid numeric settings but preserves the rest of the annotation settings', () => {
      expect(
        normalizeBundleSettings({
          legendSettings: {
            length: {
              ...createValidLegendSettings(),
              selectedPaletteId: 'viridis',
              numericSettings: {
                strategy: 'log',
                signature: 'old-sig',
              },
            },
          },
          exportOptions: {},
        }),
      ).toEqual({
        legendSettings: {
          length: {
            ...createValidLegendSettings(),
            selectedPaletteId: 'viridis',
          },
        },
        exportOptions: {},
      });
    });
  });

  describe('publishState in BundleSettings', () => {
    it('accepts BundleSettings with publishState', () => {
      const settings = {
        legendSettings: {},
        exportOptions: {},
        publishState: { widthPx: 2048, heightPx: 1024 },
      };
      expect(isNormalizedBundleSettings(settings)).toBe(true);
    });

    it('accepts BundleSettings without publishState', () => {
      const settings = {
        legendSettings: {},
        exportOptions: {},
      };
      expect(isNormalizedBundleSettings(settings)).toBe(true);
    });

    it('rejects publishState that is not an object', () => {
      const settings = {
        legendSettings: {},
        exportOptions: {},
        publishState: 'invalid',
      };
      expect(isNormalizedBundleSettings(settings)).toBe(false);
    });

    it('rejects publishState that is an array', () => {
      const settings = {
        legendSettings: {},
        exportOptions: {},
        publishState: [1, 2, 3],
      };
      expect(isNormalizedBundleSettings(settings)).toBe(false);
    });

    it('normalizes bundle with publishState', () => {
      const raw = {
        legendSettings: {},
        exportOptions: {},
        publishState: { widthPx: 1051, dpi: 300, annotations: [] },
      };
      const result = normalizeBundleSettings(raw);
      expect(result).not.toBeNull();
      expect(result!.publishState).toEqual({ widthPx: 1051, dpi: 300, annotations: [] });
    });
  });
});
