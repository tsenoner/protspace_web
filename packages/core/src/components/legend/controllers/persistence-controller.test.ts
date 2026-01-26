import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactiveControllerHost } from 'lit';
import { PersistenceController, type PersistenceCallbacks } from './persistence-controller';
import type { LegendItem } from '../types';
import { LEGEND_VALUES } from '../config';

function createTestItem(value: string, zOrder: number): LegendItem {
  return {
    value,
    zOrder,
    color: '#000000',
    shape: 'circle',
    count: 1,
    isVisible: true,
  };
}

vi.mock('@protspace/utils', () => ({
  generateDatasetHash: vi.fn((ids: string[]) => `hash_${ids.join('_')}`),
  buildStorageKey: vi.fn(
    (prefix: string, hash: string, annotation: string) => `${prefix}_${hash}_${annotation}`,
  ),
  getStorageItem: vi.fn(),
  setStorageItem: vi.fn(),
  removeStorageItem: vi.fn(),
  LEGEND_VALUES: {
    OTHER: 'Other',
    OTHERS: 'Others',
    NA_DISPLAY: 'N/A',
    NA_VALUE: '__NA__',
  },
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

  describe('updateDatasetHash', () => {
    it('returns true when hash changes, false when same', () => {
      expect(controller.updateDatasetHash(['protein1', 'protein2'])).toBe(true);
      expect(generateDatasetHash).toHaveBeenCalledWith(['protein1', 'protein2']);
      expect(controller.updateDatasetHash(['protein1', 'protein2'])).toBe(false);
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
        categories: {},
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();
      expect(controller.settingsLoaded).toBe(true);

      controller.updateDatasetHash(['protein2']);
      expect(controller.settingsLoaded).toBe(false);
    });
  });

  describe('updateSelectedAnnotation', () => {
    it('returns true when annotation changes, false when same', () => {
      expect(controller.updateSelectedAnnotation('annotation1')).toBe(true);
      expect(controller.updateSelectedAnnotation('annotation1')).toBe(false);
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
        categories: {},
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

    it('loads settings and calls callback', () => {
      const savedSettings = {
        maxVisibleValues: 15,
        includeShapes: true,
        shapeSize: 20,
        sortMode: 'alpha-asc' as const,
        hiddenValues: ['hidden1'],
        categories: {
          cat1: { zOrder: 0, color: '#000', shape: 'circle' },
          cat2: { zOrder: 1, color: '#fff', shape: 'square' },
        },
        enableDuplicateStackUI: true,
      };

      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue(savedSettings);

      controller.loadSettings();

      expect(buildStorageKey).toHaveBeenCalledWith('legend', 'hash_protein1', 'annotation1');
      expect(mockCallbacks.onSettingsLoaded).toHaveBeenCalledWith({
        ...savedSettings,
        selectedPaletteId: 'kellys',
      });
      expect(controller.settingsLoaded).toBe(true);
      expect(controller.pendingCategories).toEqual(savedSettings.categories);
    });
  });

  describe('saveSettings', () => {
    it('does nothing without storage key', () => {
      controller.saveSettings();
      expect(setStorageItem).not.toHaveBeenCalled();
    });

    it('saves settings excluding Other from categories (N/A uses __NA__)', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');

      mockCallbacks.getLegendItems = vi.fn().mockReturnValue([
        { value: 'cat1', zOrder: 0, color: '#f00', shape: 'circle' },
        { value: LEGEND_VALUES.NA_VALUE, zOrder: 1, color: '#888', shape: 'circle' },
        { value: 'Other', zOrder: 2, color: '#888', shape: 'circle' },
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

      // N/A items are included with __NA__ key, Other is excluded
      expect(setStorageItem).toHaveBeenCalledWith('legend_hash_protein1_annotation1', {
        maxVisibleValues: 15,
        includeShapes: true,
        shapeSize: 20,
        sortMode: 'alpha-asc',
        hiddenValues: ['hidden1'],
        categories: {
          cat1: { zOrder: 0, color: '#f00', shape: 'circle' },
          [LEGEND_VALUES.NA_VALUE]: { zOrder: 1, color: '#888', shape: 'circle' },
        },
        enableDuplicateStackUI: true,
      });
    });
  });

  describe('removeSettings', () => {
    it('removes settings with correct key', () => {
      controller.removeSettings();
      expect(removeStorageItem).not.toHaveBeenCalled();

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

    it('returns false without storage key or when no item exists', () => {
      expect(controller.hasPersistedSettings()).toBe(false);

      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      mockGetItem.mockReturnValue(null);
      expect(controller.hasPersistedSettings()).toBe(false);
    });

    it('returns true when item exists', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      mockGetItem.mockReturnValue('{"some": "data"}');
      expect(controller.hasPersistedSettings()).toBe(true);
      expect(mockGetItem).toHaveBeenCalledWith('legend_hash_protein1_annotation1');
    });
  });

  describe('pendingCategories', () => {
    it('starts empty and clears correctly', () => {
      expect(controller.pendingCategories).toEqual({});
      expect(controller.hasPendingCategories()).toBe(false);

      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        categories: { cat1: { zOrder: 0, color: '#f00', shape: 'circle' } },
        enableDuplicateStackUI: false,
      });

      controller.loadSettings();
      expect(controller.hasPendingCategories()).toBe(true);

      controller.clearPendingCategories();
      expect(controller.pendingCategories).toEqual({});
      expect(controller.hasPendingCategories()).toBe(false);
    });
  });

  describe('applyPendingZOrder', () => {
    it('returns items unchanged when no pending categories or empty items', () => {
      const items = [createTestItem('cat1', 0), createTestItem('cat2', 1)];
      expect(controller.applyPendingZOrder(items)).toBe(items);

      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        categories: { cat1: { zOrder: 0, color: '#f00', shape: 'circle' } },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();
      expect(controller.applyPendingZOrder([])).toEqual([]);
    });

    it('applies z-order from categories without clearing them', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        categories: {
          cat1: { zOrder: 2, color: '#f00', shape: 'circle' },
          cat2: { zOrder: 0, color: '#0f0', shape: 'square' },
        },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();

      const items = [
        createTestItem('cat1', 0),
        createTestItem('cat2', 1),
        createTestItem('cat3', 2),
        createTestItem(LEGEND_VALUES.NA_VALUE, 3),
      ];

      const result = controller.applyPendingZOrder(items);

      expect(result[0].zOrder).toBe(2); // cat1: 0 -> 2
      expect(result[1].zOrder).toBe(0); // cat2: 1 -> 0
      expect(result[2].zOrder).toBe(2); // cat3: unchanged
      expect(result[3].zOrder).toBe(3); // N/A: unchanged (not in persisted categories)
      // pendingCategories are NOT cleared - they're needed for _visibleValues in subsequent updates
      expect(controller.hasPendingCategories()).toBe(true);
    });

    it('applies z-order to N/A items using __NA__ key', () => {
      controller.updateDatasetHash(['protein1']);
      controller.updateSelectedAnnotation('annotation1');
      vi.mocked(getStorageItem).mockReturnValue({
        maxVisibleValues: 10,
        includeShapes: false,
        shapeSize: 16,
        sortMode: 'size-desc',
        hiddenValues: [],
        categories: {
          cat1: { zOrder: 1, color: '#f00', shape: 'circle' },
          [LEGEND_VALUES.NA_VALUE]: { zOrder: 0, color: '#888', shape: 'circle' }, // N/A with __NA__ key
        },
        enableDuplicateStackUI: false,
      });
      controller.loadSettings();

      const items = [
        createTestItem('cat1', 0),
        createTestItem(LEGEND_VALUES.NA_VALUE, 1), // N/A item with __NA__ value
      ];

      const result = controller.applyPendingZOrder(items);

      expect(result[0].zOrder).toBe(1); // cat1: 0 -> 1
      expect(result[1].zOrder).toBe(0); // N/A: 1 -> 0 (from __NA__ key in categories)
    });
  });
});
