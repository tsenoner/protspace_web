import { describe, it, expect } from 'vitest';
import {
  isValidLegendSettings,
  isValidBundleSettings,
  isValidPersistedCategoryData,
  isValidSortMode,
} from './settings-validation';
import type { LegendPersistedSettings, BundleSettings } from '../types';

describe('settings-validation', () => {
  // Helper to create a valid settings object
  const createValidSettings = (): LegendPersistedSettings => ({
    maxVisibleValues: 10,
    includeShapes: true,
    shapeSize: 24,
    sortMode: 'size-desc',
    hiddenValues: ['unknown'],
    categories: {
      human: { zOrder: 0, color: '#ff0000', shape: 'circle' },
    },
    enableDuplicateStackUI: false,
  });

  describe('isValidSortMode', () => {
    it('should accept valid sort modes', () => {
      expect(isValidSortMode('size-asc')).toBe(true);
      expect(isValidSortMode('size-desc')).toBe(true);
      expect(isValidSortMode('alpha-asc')).toBe(true);
      expect(isValidSortMode('alpha-desc')).toBe(true);
      expect(isValidSortMode('manual')).toBe(true);
      expect(isValidSortMode('manual-reverse')).toBe(true);
    });

    it('should reject invalid sort modes', () => {
      expect(isValidSortMode('invalid')).toBe(false);
      expect(isValidSortMode('')).toBe(false);
      expect(isValidSortMode(123)).toBe(false);
      expect(isValidSortMode(null)).toBe(false);
      expect(isValidSortMode(undefined)).toBe(false);
    });
  });

  describe('isValidPersistedCategoryData', () => {
    it('should accept valid category data', () => {
      expect(isValidPersistedCategoryData({ zOrder: 0, color: '#ff0000', shape: 'circle' })).toBe(
        true,
      );
      expect(isValidPersistedCategoryData({ zOrder: 100, color: 'red', shape: 'square' })).toBe(
        true,
      );
    });

    it('should reject invalid category data', () => {
      expect(isValidPersistedCategoryData(null)).toBe(false);
      expect(isValidPersistedCategoryData(undefined)).toBe(false);
      expect(isValidPersistedCategoryData('string')).toBe(false);
      expect(isValidPersistedCategoryData(123)).toBe(false);
      expect(isValidPersistedCategoryData([])).toBe(false);
    });

    it('should reject category data with missing fields', () => {
      expect(isValidPersistedCategoryData({ zOrder: 0, color: '#ff0000' })).toBe(false);
      expect(isValidPersistedCategoryData({ zOrder: 0, shape: 'circle' })).toBe(false);
      expect(isValidPersistedCategoryData({ color: '#ff0000', shape: 'circle' })).toBe(false);
    });

    it('should reject category data with wrong field types', () => {
      expect(isValidPersistedCategoryData({ zOrder: '0', color: '#ff0000', shape: 'circle' })).toBe(
        false,
      );
      expect(isValidPersistedCategoryData({ zOrder: 0, color: 123, shape: 'circle' })).toBe(false);
      expect(isValidPersistedCategoryData({ zOrder: 0, color: '#ff0000', shape: 123 })).toBe(false);
    });
  });

  describe('isValidLegendSettings', () => {
    it('should accept valid settings', () => {
      expect(isValidLegendSettings(createValidSettings())).toBe(true);
    });

    it('should accept settings with empty categories', () => {
      const settings = createValidSettings();
      settings.categories = {};
      expect(isValidLegendSettings(settings)).toBe(true);
    });

    it('should accept settings with empty hiddenValues', () => {
      const settings = createValidSettings();
      settings.hiddenValues = [];
      expect(isValidLegendSettings(settings)).toBe(true);
    });

    it('should accept settings with extra/unknown fields (forward compatibility)', () => {
      const settings = {
        ...createValidSettings(),
        unknownField: 'value',
        anotherNewField: { nested: true },
        futureFeature: 42,
      };
      expect(isValidLegendSettings(settings)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isValidLegendSettings(null)).toBe(false);
      expect(isValidLegendSettings(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isValidLegendSettings('string')).toBe(false);
      expect(isValidLegendSettings(123)).toBe(false);
      expect(isValidLegendSettings([])).toBe(false);
      expect(isValidLegendSettings(true)).toBe(false);
    });

    it('should reject settings with wrong maxVisibleValues type', () => {
      const settings = { ...createValidSettings(), maxVisibleValues: '10' };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with wrong includeShapes type', () => {
      const settings = { ...createValidSettings(), includeShapes: 'true' };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with wrong shapeSize type', () => {
      const settings = { ...createValidSettings(), shapeSize: '24' };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with invalid sortMode', () => {
      const settings = { ...createValidSettings(), sortMode: 'invalid' };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with wrong enableDuplicateStackUI type', () => {
      const settings = { ...createValidSettings(), enableDuplicateStackUI: 'false' };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with non-array hiddenValues', () => {
      const settings = { ...createValidSettings(), hiddenValues: 'unknown' };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with non-string items in hiddenValues', () => {
      const settings = { ...createValidSettings(), hiddenValues: [123, 'valid'] };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with non-object categories', () => {
      const settings = { ...createValidSettings(), categories: 'invalid' };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with array categories', () => {
      const settings = { ...createValidSettings(), categories: [] };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject settings with invalid category data', () => {
      const settings = {
        ...createValidSettings(),
        categories: {
          human: { zOrder: 0, color: '#ff0000' }, // missing shape
        },
      };
      expect(isValidLegendSettings(settings)).toBe(false);
    });

    it('should reject partially valid settings (missing required fields)', () => {
      // Missing maxVisibleValues
      expect(
        isValidLegendSettings({
          includeShapes: true,
          shapeSize: 24,
          sortMode: 'size-desc',
          hiddenValues: [],
          categories: {},
          enableDuplicateStackUI: false,
        }),
      ).toBe(false);

      // Missing sortMode
      expect(
        isValidLegendSettings({
          maxVisibleValues: 10,
          includeShapes: true,
          shapeSize: 24,
          hiddenValues: [],
          categories: {},
          enableDuplicateStackUI: false,
        }),
      ).toBe(false);

      // Missing categories
      expect(
        isValidLegendSettings({
          maxVisibleValues: 10,
          includeShapes: true,
          shapeSize: 24,
          sortMode: 'size-desc',
          hiddenValues: [],
          enableDuplicateStackUI: false,
        }),
      ).toBe(false);
    });
  });

  describe('isValidBundleSettings', () => {
    it('should accept valid bundle settings', () => {
      const bundleSettings: BundleSettings = {
        organism: createValidSettings(),
        family: createValidSettings(),
      };
      expect(isValidBundleSettings(bundleSettings)).toBe(true);
    });

    it('should accept empty bundle settings', () => {
      expect(isValidBundleSettings({})).toBe(true);
    });

    it('should accept settings with extra/unknown fields in individual settings', () => {
      const bundleSettings = {
        organism: {
          ...createValidSettings(),
          unknownField: 'value',
        },
      };
      expect(isValidBundleSettings(bundleSettings)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isValidBundleSettings(null)).toBe(false);
      expect(isValidBundleSettings(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isValidBundleSettings('string')).toBe(false);
      expect(isValidBundleSettings(123)).toBe(false);
      expect(isValidBundleSettings([])).toBe(false);
    });

    it('should reject bundle settings with invalid legend settings', () => {
      const bundleSettings = {
        organism: createValidSettings(),
        family: { invalid: true }, // Not a valid LegendPersistedSettings
      };
      expect(isValidBundleSettings(bundleSettings)).toBe(false);
    });

    it('should reject bundle settings with partially valid legend settings', () => {
      const bundleSettings = {
        organism: {
          maxVisibleValues: 10,
          // Missing other required fields
        },
      };
      expect(isValidBundleSettings(bundleSettings)).toBe(false);
    });
  });
});
