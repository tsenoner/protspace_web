import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExportPersistenceController,
  type ExportPersistenceCallbacks,
} from './export-persistence-controller';
import type { PersistedExportOptions } from '@protspace/utils';

vi.mock('@protspace/utils', () => ({
  buildStorageKey: vi.fn(
    (component: string, hash: string, annotation: string) => `${component}_${hash}_${annotation}`,
  ),
  generateDatasetHash: vi.fn((ids: string[]) => `hash_${ids.join('_')}`),
  getStorageItem: vi.fn(),
  migratePublicationLayoutId: vi.fn(),
  removeAllStorageItemsByHash: vi.fn(),
  setStorageItem: vi.fn(),
}));

import {
  buildStorageKey,
  generateDatasetHash,
  getStorageItem,
  migratePublicationLayoutId,
  removeAllStorageItemsByHash,
  setStorageItem,
} from '@protspace/utils';

const createSettings = (
  overrides: Partial<PersistedExportOptions> = {},
): PersistedExportOptions => ({
  imageWidth: 2048,
  imageHeight: 1024,
  lockAspectRatio: true,
  legendWidthPercent: 20,
  legendFontSizePx: 15,
  includeLegendSettings: true,
  includeExportOptions: true,
  layoutId: 'two_column_below',
  ...overrides,
});

describe('ExportPersistenceController', () => {
  let controller: ExportPersistenceController;
  let callbacks: ExportPersistenceCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(migratePublicationLayoutId).mockReturnValue(undefined);

    callbacks = {
      onSettingsLoaded: vi.fn(),
      getCurrentSettings: vi.fn().mockReturnValue(createSettings()),
    };

    controller = new ExportPersistenceController(callbacks);
  });

  it('loads persisted settings per dataset and annotation', () => {
    vi.mocked(getStorageItem).mockReturnValue(createSettings({ imageWidth: 4096 }));

    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');
    controller.loadSettings();

    expect(generateDatasetHash).toHaveBeenCalledWith(['P1']);
    expect(buildStorageKey).toHaveBeenCalledWith('control-bar', 'hash_P1', 'organism');
    expect(callbacks.onSettingsLoaded).toHaveBeenCalledWith(createSettings({ imageWidth: 4096 }));
    expect(setStorageItem).not.toHaveBeenCalled();
  });

  it('switches annotations without writing localStorage', () => {
    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');

    controller.updateSelectedAnnotation('family');
    vi.mocked(getStorageItem).mockReturnValue(createSettings({ imageHeight: 2048 }));
    controller.loadSettings();

    expect(getStorageItem).toHaveBeenCalledWith(
      'control-bar_hash_P1_family',
      expect.objectContaining({ imageWidth: 2048 }),
    );
    expect(setStorageItem).not.toHaveBeenCalled();
  });

  it('persists default settings when the current export settings are reset', () => {
    vi.mocked(callbacks.getCurrentSettings).mockReturnValue(createSettings());

    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');
    controller.saveSettings();

    expect(setStorageItem).toHaveBeenCalledWith('control-bar_hash_P1_organism', createSettings());
  });

  it('writes imported file settings to localStorage immediately', () => {
    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');

    controller.setFileSettings({
      organism: createSettings({ legendFontSizePx: 32 }),
      family: createSettings({ imageWidth: 4096 }),
    });

    expect(removeAllStorageItemsByHash).toHaveBeenCalledWith('hash_P1');
    expect(setStorageItem).toHaveBeenCalledWith(
      'control-bar_hash_P1_organism',
      createSettings({ legendFontSizePx: 32 }),
    );
    expect(setStorageItem).toHaveBeenCalledWith(
      'control-bar_hash_P1_family',
      createSettings({ imageWidth: 4096 }),
    );
  });

  it('prioritizes file settings over local storage on first load only', () => {
    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');

    controller.setFileSettings({
      organism: createSettings({ legendFontSizePx: 32 }),
    });

    vi.mocked(getStorageItem).mockReturnValue(createSettings({ legendFontSizePx: 18 }));

    controller.loadSettings();
    controller.loadSettings();

    expect(callbacks.onSettingsLoaded).toHaveBeenNthCalledWith(
      1,
      createSettings({ legendFontSizePx: 32 }),
    );
    expect(callbacks.onSettingsLoaded).toHaveBeenNthCalledWith(
      2,
      createSettings({ legendFontSizePx: 18 }),
    );
  });

  it('returns current annotation live state and other annotations from localStorage for export', () => {
    vi.mocked(callbacks.getCurrentSettings).mockReturnValue(createSettings({ imageWidth: 3000 }));
    vi.mocked(getStorageItem).mockImplementation((key: string) => {
      if (key === 'control-bar_hash_P1_family') {
        return { legendFontSizePx: 36 };
      }
      return {};
    });

    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');

    expect(controller.getAllSettingsForExport(['organism', 'family', 'pathway'])).toEqual({
      organism: createSettings({ imageWidth: 3000 }),
      family: createSettings({ legendFontSizePx: 36 }),
    });
  });

  it('clears persisted state for a new dataset', () => {
    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');
    controller.setFileSettings({
      organism: createSettings(),
    });

    controller.clearForNewDataset('hash_NEW');

    expect(removeAllStorageItemsByHash).toHaveBeenCalledWith('hash_NEW');
    expect(controller.hasFileSettings).toBe(false);
    expect(controller.settingsLoaded).toBe(false);
  });

  describe('hasFileSettings getter', () => {
    it('returns false initially', () => {
      expect(controller.hasFileSettings).toBe(false);
    });

    it('returns true after setting file settings', () => {
      controller.setFileSettings({ organism: createSettings() });
      expect(controller.hasFileSettings).toBe(true);
    });

    it('returns false after clearing with null', () => {
      controller.setFileSettings({ organism: createSettings() });
      controller.setFileSettings(null);
      expect(controller.hasFileSettings).toBe(false);
    });

    it('returns false after clearForNewDataset', () => {
      controller.updateDatasetHash(['P1']);
      controller.setFileSettings({ organism: createSettings() });
      controller.clearForNewDataset('hash_NEW');
      expect(controller.hasFileSettings).toBe(false);
    });
  });

  it('getAllSettingsForExport with mixed annotations (some in storage, some not)', () => {
    vi.mocked(callbacks.getCurrentSettings).mockReturnValue(createSettings({ imageWidth: 3000 }));
    vi.mocked(getStorageItem).mockImplementation((key: string) => {
      if (key === 'control-bar_hash_P1_family') {
        return { legendFontSizePx: 36 };
      }
      if (key === 'control-bar_hash_P1_pathway') {
        return {};
      }
      if (key === 'control-bar_hash_P1_taxonomy') {
        return {};
      }
      return {};
    });

    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');

    const result = controller.getAllSettingsForExport([
      'organism',
      'family',
      'pathway',
      'taxonomy',
    ]);

    // organism: live settings (current annotation)
    expect(result.organism).toEqual(createSettings({ imageWidth: 3000 }));
    // family: merged from localStorage
    expect(result.family).toEqual(createSettings({ legendFontSizePx: 36 }));
    // pathway & taxonomy: empty in storage, should be excluded
    expect(result.pathway).toBeUndefined();
    expect(result.taxonomy).toBeUndefined();
  });

  it('migrates legacy (publicationPresetId, legendPlacement) on load', () => {
    vi.mocked(getStorageItem).mockReturnValue({
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
    vi.mocked(migratePublicationLayoutId).mockReturnValue('two_column_right');

    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');
    controller.loadSettings();

    expect(callbacks.onSettingsLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ layoutId: 'two_column_right' }),
    );
  });

  it('clearForNewDataset followed by setFileSettings works correctly', () => {
    controller.updateDatasetHash(['P1']);
    controller.updateSelectedAnnotation('organism');
    controller.setFileSettings({ organism: createSettings({ imageWidth: 4096 }) });

    controller.clearForNewDataset('hash_NEW');
    vi.clearAllMocks();

    // Start new dataset lifecycle
    controller.updateDatasetHash(['P2']);
    controller.updateSelectedAnnotation('family');
    controller.setFileSettings({ family: createSettings({ legendFontSizePx: 48 }) }, 'hash_P2');

    expect(removeAllStorageItemsByHash).toHaveBeenCalledWith('hash_P2');
    expect(setStorageItem).toHaveBeenCalledWith(
      'control-bar_hash_P2_family',
      createSettings({ legendFontSizePx: 48 }),
    );
    expect(controller.hasFileSettings).toBe(true);
    expect(controller.hasFileSettingsForAnnotation('family')).toBe(true);
    expect(controller.hasFileSettingsForAnnotation('organism')).toBe(false);
  });
});
