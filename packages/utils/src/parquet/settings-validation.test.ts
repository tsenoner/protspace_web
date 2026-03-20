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
  publicationPresetId: 'two_column',
  legendPlacement: 'right',
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

    it('accepts legacy export options without publication fields', () => {
      const {
        publicationPresetId: _p,
        legendPlacement: _l,
        ...legacy
      } = createValidExportOptions();
      expect(isValidPersistedExportOptions(legacy)).toBe(true);
    });

    it('rejects invalid publication preset id', () => {
      const bad: Record<string, unknown> = {
        ...createValidExportOptions(),
        publicationPresetId: 'wide',
      };
      expect(isValidPersistedExportOptions(bad)).toBe(false);
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

    it('returns null for invalid settings', () => {
      expect(normalizeBundleSettings({ nope: true })).toBeNull();
      expect(normalizeBundleSettings(null)).toBeNull();
    });
  });
});
