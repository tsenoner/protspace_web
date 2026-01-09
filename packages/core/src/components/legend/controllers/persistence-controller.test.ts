import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactiveControllerHost } from 'lit';
import { PersistenceController, type PersistenceCallbacks } from './persistence-controller';
import type { LegendItem } from '../types';

/**
 * Creates a test legend item with required properties
 */
function createTestItem(value: string | null, zOrder: number): LegendItem {
  return {
    value,
    zOrder,
    color: '#000000',
    shape: 'circle',
    count: 1,
    isVisible: true,
  };
}

// Mock the @protspace/utils module
vi.mock('@protspace/utils', () => ({
  generateDatasetHash: vi.fn((ids: string[]) => `hash_${ids.join('_')}`),
  buildStorageKey: vi.fn(
    (prefix: string, hash: string, feature: string) => `${prefix}_${hash}_${feature}`,
  ),
  getStorageItem: vi.fn(),
  setStorageItem: vi.fn(),
  removeStorageItem: vi.fn(),
}));

import {
  generateDatasetHash,
  buildStorageKey,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from '@protspace/utils';

describe('PersistenceController', () => {
  let controller: PersistenceController;
  let mockHost: ReactiveControllerHost;
  let mockCallbacks: PersistenceCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();

    mockHost = {
      addController: vi.fn(),
      removeController: vi.fn(),
      requestUpdate: vi.fn(),
      updateComplete: Promise.resolve(true),
    };

    mockCallbacks = {
      onSettingsLoaded: vi.fn(),
      getLegendItems: vi.fn().mockReturnValue([]),
      getHiddenValues: vi.fn().mockReturnValue([]),
      getCurrentSettings: vi.fn().mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc' as const,
        enableDuplicateStackUI: false,
      }),
    };

    controller = new PersistenceController(mockHost, mockCallbacks);
  });

  describe('constructor', () => {
    it('adds itself to the host controller', () => {
      expect(mockHost.addController).toHaveBeenCalledWith(controller);
    });
  });

  describe('hostConnected/hostDisconnected', () => {
    it('hostConnected does not throw', () => {
      expect(() => controller.hostConnected()).not.toThrow();
    });

    it('hostDisconnected does not throw', () => {
      expect(() => controller.hostDisconnected()).not.toThrow();
    });
  });

  describe('updateDatasetHash', () => {
    it('returns true when hash changes', () => {
      const result = controller.updateDatasetHash(['protein1', 'protein2']);
      expect(result).toBe(true);
      expect(generateDatasetHash).toHaveBeenCalledWith(['protein1', 'protein2']);
    });

    it('returns false when hash is the same', () => {
      controller.updateDatasetHash(['protein1']);
      // Same input should produce same hash, returning false
      const result = controller.updateDatasetHash(['protein1']);
      expect(result).toBe(false);
    });

    it('resets settingsLoaded when hash changes', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: {},
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();
      expect(controller.settingsLoaded).toBe(true);

      controller.updateDatasetHash(['protein2']);
      expect(controller.settingsLoaded).toBe(false);
    });
  });

  describe('updateSelectedAnnotation', () => {
    it('returns true when annotation changes', () => {
      const result = controller.updateSelectedAnnotation('annotation1');
      expect(result).toBe(true);
    });

    it('returns false when annotation is the same', () => {
      controller.updateSelectedAnnotation('annotation1');
      const result = controller.updateSelectedAnnotation('annotation1');
      expect(result).toBe(false);
    });

    it('resets settingsLoaded when annotation changes', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: {},
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();
      expect(controller.settingsLoaded).toBe(true);

      controller.updateSelectedAnnotation('annotation2');
      expect(controller.settingsLoaded).toBe(false);
    });
  });

  describe('loadSettings', () => {
    it('does nothing without dataset hash', () => {
      controller.updateSelectedAnnotation('annotation1');
      controller.loadSettings();
      expect(getStorageItem).not.toHaveBeenCalled();
    });

    it('does nothing without selected annotation', () => {
      controller.updateDatasetHash(['protein1']);
      controller.loadSettings();
      expect(getStorageItem).not.toHaveBeenCalled();
    });

    it('loads settings with correct key', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 15,
        includeShapes: true,
        shapeSize: 20,
        sortMode: 'alpha-asc',
        hiddenValues: ['hidden1'],
        zOrderMapping: { cat1: 0, cat2: 1 },
        enableDuplicateStackUI: true,
      });

      controller.loadSettings();

      expect(buildStorageKey).toHaveBeenCalledWith('legend', 'hash_protein1', 'annotation1');
      expect(getStorageItem).toHaveBeenCalled();
    });

    it('calls onSettingsLoaded callback with loaded settings', () => {
      const savedSettings = {
        maxVisibleValues: 15,
        includeShapes: true,
        shapeSize: 20,
        sortMode: 'alpha-asc' as const,
        hiddenValues: ['hidden1'],
        zOrderMapping: { cat1: 0, cat2: 1 },
        enableDuplicateStackUI: true,
      };

      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue(savedSettings);

      controller.loadSettings();

      expect(mockCallbacks.onSettingsLoaded).toHaveBeenCalledWith(savedSettings);
    });

    it('stores pending z-order mapping', () => {
      const zOrderMapping = { cat1: 2, cat2: 1, cat3: 0 };
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping,
        enableDuplicateStackUI: false,
      });

      controller.loadSettings();

      expect(controller.pendingZOrderMapping).toEqual(zOrderMapping);
    });

    it('sets settingsLoaded to true', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: {},
        enableDuplicateStackUI: false,
      });

      expect(controller.settingsLoaded).toBe(false);
      controller.loadSettings();
      expect(controller.settingsLoaded).toBe(true);
    });
  });

  describe('saveSettings', () => {
    it('does nothing without storage key', () => {
      controller.saveSettings();
      expect(setStorageItem).not.toHaveBeenCalled();
    });

    it('saves settings with correct key and values', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');

      mockCallbacks.getLegendItems = vi.fn().mockReturnValue([
        { value: 'cat1', zOrder: 0 },
        { value: 'cat2', zOrder: 1 },
        { value: null, zOrder: 2 }, // Others item
      ]);
      mockCallbacks.getHiddenValues = vi.fn().mockReturnValue(['hidden1']);
      mockCallbacks.getCurrentSettings = vi.fn().mockReturnValue({
        maxVisibleValues: 15,
        includeShapes: true,
        shapeSize: 20,
        sortMode: 'alpha-asc' as const,
        enableDuplicateStackUI: true,
      });

      controller.saveSettings();

      expect(setStorageItem).toHaveBeenCalledWith('legend_hash_protein1_annotation1', {
        maxVisibleValues: 15,
        includeShapes: true,
        shapeSize: 20,
        sortMode: 'alpha-asc',
        hiddenValues: ['hidden1'],
        zOrderMapping: { cat1: 0, cat2: 1 },
        enableDuplicateStackUI: true,
      });
    });

    it('excludes null values from z-order mapping', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');

      mockCallbacks.getLegendItems = vi.fn().mockReturnValue([
        { value: 'cat1', zOrder: 0 },
        { value: null, zOrder: 1 },
      ]);

      controller.saveSettings();

      const savedSettings = vi.mocked(setStorageItem).mock.calls[0][1];
      expect(savedSettings.zOrderMapping).toEqual({ cat1: 0 });
    });
  });

  describe('removeSettings', () => {
    it('does nothing without storage key', () => {
      controller.removeSettings();
      expect(removeStorageItem).not.toHaveBeenCalled();
    });

    it('removes settings with correct key', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');

      controller.removeSettings();

      expect(removeStorageItem).toHaveBeenCalledWith('legend_hash_protein1_annotation1');
    });
  });

  describe('hasPersistedSettings', () => {
    const mockGetItem = vi.fn();
    const originalLocalStorage = global.localStorage;

    beforeEach(() => {
      // Mock localStorage for this test suite
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
          length: 0,
          key: vi.fn(),
        },
        configurable: true,
      });
      mockGetItem.mockReset();
    });

    afterEach(() => {
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
      });
    });

    it('returns false without storage key', () => {
      expect(controller.hasPersistedSettings()).toBe(false);
    });

    it('returns false when no item in localStorage', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      mockGetItem.mockReturnValue(null);

      expect(controller.hasPersistedSettings()).toBe(false);
    });

    it('returns true when item exists in localStorage', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      mockGetItem.mockReturnValue('{"some": "data"}');

      expect(controller.hasPersistedSettings()).toBe(true);
    });

    it('checks the correct storage key', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      mockGetItem.mockReturnValue(null);

      controller.hasPersistedSettings();

      expect(mockGetItem).toHaveBeenCalledWith('legend_hash_protein1_annotation1');
    });
  });

  describe('pendingZOrderMapping', () => {
    it('starts empty', () => {
      expect(controller.pendingZOrderMapping).toEqual({});
    });

    it('clearPendingZOrder clears the mapping', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: { cat1: 0 },
        enableDuplicateStackUI: false,
      });

      controller.loadSettings();
      expect(controller.pendingZOrderMapping).toEqual({ cat1: 0 });

      controller.clearPendingZOrder();
      expect(controller.pendingZOrderMapping).toEqual({});
    });
  });

  describe('hasPendingZOrder', () => {
    it('returns false when empty', () => {
      expect(controller.hasPendingZOrder()).toBe(false);
    });

    it('returns true when has pending mapping', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: { cat1: 0 },
        enableDuplicateStackUI: false,
      });

      controller.loadSettings();
      expect(controller.hasPendingZOrder()).toBe(true);
    });
  });

  describe('applyPendingZOrder', () => {
    it('returns items unchanged when no pending mapping', () => {
      const items: LegendItem[] = [createTestItem('cat1', 0), createTestItem('cat2', 1)];

      const result = controller.applyPendingZOrder(items);
      expect(result).toBe(items);
    });

    it('returns items unchanged when items array is empty', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: { cat1: 0 },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();

      const result = controller.applyPendingZOrder([]);
      expect(result).toEqual([]);
    });

    it('applies z-order mapping to matching items', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: { cat1: 2, cat2: 0 },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();

      const items: LegendItem[] = [
        createTestItem('cat1', 0),
        createTestItem('cat2', 1),
        createTestItem('cat3', 2),
      ];

      const result = controller.applyPendingZOrder(items);

      expect(result[0].zOrder).toBe(2); // cat1: 0 -> 2
      expect(result[1].zOrder).toBe(0); // cat2: 1 -> 0
      expect(result[2].zOrder).toBe(2); // cat3: unchanged
    });

    it('clears pending mapping after applying', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: { cat1: 2 },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();

      const items: LegendItem[] = [createTestItem('cat1', 0)];
      controller.applyPendingZOrder(items);

      expect(controller.hasPendingZOrder()).toBe(false);
    });

    it('clears mapping when no items match', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: { cat1: 2 },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();

      const items: LegendItem[] = [createTestItem('differentCat', 0)];
      const result = controller.applyPendingZOrder(items);

      expect(result).toBe(items); // Returns original array
      expect(controller.hasPendingZOrder()).toBe(false);
    });

    it('skips items with null value', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        zOrderMapping: { cat1: 2 },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();

      const items: LegendItem[] = [createTestItem(null, 0), createTestItem('cat1', 1)];

      const result = controller.applyPendingZOrder(items);

      expect(result[0].zOrder).toBe(0); // null value unchanged
      expect(result[1].zOrder).toBe(2); // cat1 updated
    });
  });
});
