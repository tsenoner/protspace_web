import { describe, it, expect } from 'vitest';
import {
  isLegacyBundleSettings,
  isNormalizedBundleSettings,
  isValidBundleSettings,
  isValidLegendSettings,
  isValidPersistedCategoryData,
  isValidPersistedExportOptions,
  isValidSortMode,
  migratePublicationLayoutId,
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
  layoutId: 'two_column_below',
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

    it('accepts export options without layoutId', () => {
      const { layoutId: _l, ...legacy } = createValidExportOptions();
      expect(isValidPersistedExportOptions(legacy)).toBe(true);
    });

    it('rejects invalid layoutId', () => {
      const bad: Record<string, unknown> = {
        ...createValidExportOptions(),
        layoutId: 'wide',
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

describe('migratePublicationLayoutId', () => {
  it('returns the new id when raw uses {layoutId}', () => {
    expect(migratePublicationLayoutId({ layoutId: 'full_page_top' })).toBe('full_page_top');
  });

  it.each([
    ['one_column', 'right', 'one_column_below'],
    ['one_column', 'below', 'one_column_below'],
    ['two_column', 'right', 'two_column_right'],
    ['two_column', 'below', 'two_column_below'],
    ['full_page', 'right', 'full_page_top'],
    ['full_page', 'below', 'full_page_top'],
  ])('migrates legacy (%s, %s) → %s', (preset, placement, expected) => {
    expect(
      migratePublicationLayoutId({ publicationPresetId: preset, legendPlacement: placement }),
    ).toBe(expected);
  });

  it('returns undefined when input has neither shape', () => {
    expect(migratePublicationLayoutId({ imageWidth: 1024 })).toBeUndefined();
  });
});
