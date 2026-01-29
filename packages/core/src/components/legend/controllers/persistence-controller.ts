import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  generateDatasetHash,
  buildStorageKey,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  removeAllStorageItemsByHash,
  type BundleSettings,
} from '@protspace/utils';
import type {
  LegendPersistedSettings,
  LegendItem,
  LegendSortMode,
  PersistedCategoryData,
} from '../types';
import { LEGEND_VALUES } from '../config';
import { createDefaultSettings } from '../legend-helpers';

/**
 * Callback interface for persistence events
 */
export interface PersistenceCallbacks {
  onSettingsLoaded: (settings: LegendPersistedSettings) => void;
  getLegendItems: () => LegendItem[];
  getHiddenValues: () => string[];
  getCurrentSettings: () => {
    maxVisibleValues: number;
    includeShapes: boolean;
    shapeSize: number;
    sortMode: LegendSortMode;
    enableDuplicateStackUI: boolean;
    selectedPaletteId: string;
  };
}

/**
 * Reactive controller for managing localStorage persistence.
 * Handles saving and loading legend settings per dataset/annotation combination.
 * Also supports file-based persistence for parquetbundle export/import.
 */
export class PersistenceController implements ReactiveController {
  private callbacks: PersistenceCallbacks;

  private _datasetHash: string = '';
  private _selectedAnnotation: string = '';
  private _settingsLoaded: boolean = false;
  private _pendingCategories: Record<string, PersistedCategoryData> = {};

  /**
   * File-based settings loaded from a parquetbundle.
   * These take priority over localStorage when present.
   */
  private _fileSettings: BundleSettings | null = null;

  /**
   * Track which annotations have had their file settings applied.
   */
  private _appliedFileAnnotations: Set<string> = new Set();

  constructor(host: ReactiveControllerHost, callbacks: PersistenceCallbacks) {
    this.callbacks = callbacks;
    host.addController(this);
  }

  hostConnected(): void {
    // No initialization needed on connect
  }

  hostDisconnected(): void {
    // No cleanup needed
  }

  /**
   * Get pending categories (to apply after legend items are created)
   */
  get pendingCategories(): Record<string, PersistedCategoryData> {
    return this._pendingCategories;
  }

  /**
   * Check if settings have been loaded for current annotation
   */
  get settingsLoaded(): boolean {
    return this._settingsLoaded;
  }

  /**
   * Update dataset hash from protein IDs.
   */
  updateDatasetHash(proteinIds: string[]): boolean {
    const newHash = generateDatasetHash(proteinIds);
    if (newHash !== this._datasetHash) {
      this._datasetHash = newHash;
      this._settingsLoaded = false;
      return true; // Hash changed
    }
    return false; // No change
  }

  /**
   * Update selected annotation and reset settings loaded flag if changed
   */
  updateSelectedAnnotation(annotation: string): boolean {
    if (annotation !== this._selectedAnnotation) {
      this._selectedAnnotation = annotation;
      this._settingsLoaded = false;
      return true; // Annotation changed
    }
    return false; // No change
  }

  /**
   * Load persisted settings for current dataset/annotation.
   * Prioritizes file-based settings over localStorage if available.
   */
  loadSettings(): void {
    if (!this._selectedAnnotation) return;

    const defaultSettings = createDefaultSettings(this._selectedAnnotation);
    let mergedSettings: LegendPersistedSettings;

    // Check for file-based settings first (priority over localStorage)
    if (
      this._fileSettings?.[this._selectedAnnotation] &&
      !this._appliedFileAnnotations.has(this._selectedAnnotation)
    ) {
      const fileSettings = this._fileSettings[this._selectedAnnotation];
      mergedSettings = {
        ...defaultSettings,
        ...fileSettings,
      };
      // Mark as applied so subsequent loads use localStorage
      this._appliedFileAnnotations.add(this._selectedAnnotation);
    } else {
      // Fall back to localStorage
      const key = this._getStorageKey();
      if (!key) return;

      const saved = getStorageItem<Partial<LegendPersistedSettings>>(key, defaultSettings);
      mergedSettings = {
        ...defaultSettings,
        ...saved,
      };
    }

    this._pendingCategories = mergedSettings.categories;
    this._settingsLoaded = true;

    this.callbacks.onSettingsLoaded(mergedSettings);
  }

  /**
   * Persist current settings to localStorage
   */
  saveSettings(): void {
    const key = this._getStorageKey();
    if (!key) return;

    const currentSettings = this.callbacks.getCurrentSettings();
    const categories = this._buildCategoriesFromItems();

    const settings: LegendPersistedSettings = {
      maxVisibleValues: currentSettings.maxVisibleValues,
      includeShapes: currentSettings.includeShapes,
      shapeSize: currentSettings.shapeSize,
      sortMode: currentSettings.sortMode,
      hiddenValues: this.callbacks.getHiddenValues(),
      categories,
      enableDuplicateStackUI: currentSettings.enableDuplicateStackUI,
      selectedPaletteId: currentSettings.selectedPaletteId,
    };

    setStorageItem(key, settings);

    // Update pending categories to match the saved state
    // This ensures subsequent _updateLegendItems() calls use the current data
    this._pendingCategories = categories;
  }

  /**
   * Build categories from current legend items (excluding "Other" which is synthetic)
   */
  private _buildCategoriesFromItems(): Record<string, PersistedCategoryData> {
    const legendItems = this.callbacks.getLegendItems();
    const categories: Record<string, PersistedCategoryData> = {};
    legendItems.forEach((item) => {
      if (item.value !== LEGEND_VALUES.OTHER) {
        categories[item.value] = {
          zOrder: item.zOrder,
          color: item.color,
          shape: item.shape,
        };
      }
    });
    return categories;
  }

  /**
   * Check if there are persisted settings for current dataset/annotation
   */
  hasPersistedSettings(): boolean {
    const key = this._getStorageKey();
    if (!key) return false;
    return localStorage.getItem(key) !== null;
  }

  /**
   * Remove persisted settings for current dataset/annotation
   */
  removeSettings(): void {
    const key = this._getStorageKey();
    if (key) {
      removeStorageItem(key);
    }
  }

  /**
   * Set pending categories (used when extracting items from Other)
   */
  setPendingCategories(categories: Record<string, PersistedCategoryData>): void {
    this._pendingCategories = categories;
  }

  /**
   * Clear pending categories after they've been applied
   */
  clearPendingCategories(): void {
    this._pendingCategories = {};
  }

  /**
   * Check if there are pending categories to apply
   */
  hasPendingCategories(): boolean {
    return Object.keys(this._pendingCategories).length > 0;
  }

  /**
   * Apply pending categories (z-order only) to legend items.
   * Color/shape are applied during legend item creation in the processor.
   * N/A items use '__NA__' as their value.
   *
   * Note: This method does NOT clear pendingCategories because subsequent update
   * cycles (triggered by property changes in _applyPersistedSettings) need them
   * for _visibleValues to work correctly. Categories are naturally overwritten
   * when loadSettings() is called for a different annotation.
   */
  applyPendingZOrder(legendItems: LegendItem[]): LegendItem[] {
    if (!this.hasPendingCategories() || legendItems.length === 0) {
      return legendItems;
    }

    const hasMapping = legendItems.some(
      (item) => this._pendingCategories[item.value] !== undefined,
    );

    if (!hasMapping) {
      return legendItems;
    }

    return legendItems.map((item) => {
      const persisted = this._pendingCategories[item.value];
      if (persisted !== undefined) {
        return { ...item, zOrder: persisted.zOrder };
      }
      return item;
    });
  }

  private _getStorageKey(): string | null {
    if (!this._datasetHash || !this._selectedAnnotation) {
      return null;
    }
    return buildStorageKey('legend', this._datasetHash, this._selectedAnnotation);
  }

  // ─────────────────────────────────────────────────────────────────
  // File-based persistence (parquetbundle export/import)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check if file-based settings are currently loaded.
   */
  get hasFileSettings(): boolean {
    return this._fileSettings !== null;
  }

  /**
   * Set file-based settings loaded from a parquetbundle.
   * These will be used instead of localStorage for annotations that have settings.
   * Also persists all settings to localStorage so they're available for future exports.
   *
   * When settings are provided, ALL existing localStorage entries for this dataset hash
   * are cleared first. This ensures the imported file is the single source of truth
   * and the visualization renders exactly as it was exported.
   *
   * @param settings - All annotation settings from the file, or null to clear
   * @param datasetHash - Optional dataset hash to use for localStorage keys (required when
   *                      the component's hash isn't yet computed from the new data)
   */
  setFileSettings(settings: BundleSettings | null, datasetHash?: string): void {
    this._fileSettings = settings;
    this._appliedFileAnnotations.clear();

    const hashToUse = datasetHash || this._datasetHash;

    if (settings && hashToUse) {
      // Clear ALL existing settings for this hash before applying imported settings
      // This ensures the imported file is the single source of truth
      removeAllStorageItemsByHash(hashToUse);

      // Persist all settings to localStorage so they're available for future exports
      for (const [annotationName, annotationSettings] of Object.entries(settings)) {
        const key = buildStorageKey('legend', hashToUse, annotationName);
        setStorageItem(key, annotationSettings);
      }
    }

    // If we have file settings for the current annotation, trigger reload
    if (settings && this._selectedAnnotation && settings[this._selectedAnnotation]) {
      this._settingsLoaded = false;
    }
  }

  /**
   * Clear all persistence state in preparation for loading a new dataset.
   * Removes localStorage entries for the specified dataset hash and resets internal state.
   *
   * @param datasetHash - The hash of the NEW dataset to clear localStorage for
   */
  clearForNewDataset(datasetHash: string): void {
    // Clear localStorage for the new dataset hash
    removeAllStorageItemsByHash(datasetHash);

    // Reset internal state
    this._datasetHash = '';
    this._selectedAnnotation = '';
    this._settingsLoaded = false;
    this._pendingCategories = {};
    this._fileSettings = null;
    this._appliedFileAnnotations.clear();
  }

  /**
   * Check if file settings exist for a specific annotation.
   */
  hasFileSettingsForAnnotation(annotation: string): boolean {
    return this._fileSettings !== null && annotation in this._fileSettings;
  }

  /**
   * Get the current settings for the selected annotation.
   * Returns the current state built from legend items and component settings.
   */
  getCurrentSettingsForExport(): LegendPersistedSettings {
    const currentSettings = this.callbacks.getCurrentSettings();

    return {
      maxVisibleValues: currentSettings.maxVisibleValues,
      includeShapes: currentSettings.includeShapes,
      shapeSize: currentSettings.shapeSize,
      sortMode: currentSettings.sortMode,
      hiddenValues: this.callbacks.getHiddenValues(),
      categories: this._buildCategoriesFromItems(),
      enableDuplicateStackUI: currentSettings.enableDuplicateStackUI,
      selectedPaletteId: currentSettings.selectedPaletteId,
    };
  }

  /**
   * Get all annotation settings from localStorage for export.
   * This collects settings for all annotations that have been persisted.
   *
   * @param annotationNames - List of all available annotation names
   * @returns All persisted settings mapped by annotation name
   */
  getAllSettingsForExport(annotationNames: string[]): BundleSettings {
    const result: BundleSettings = {};

    // First, add the current annotation's settings (from live state)
    if (this._selectedAnnotation) {
      result[this._selectedAnnotation] = this.getCurrentSettingsForExport();
    }

    // Then, add settings for other annotations from localStorage
    for (const annotation of annotationNames) {
      if (annotation === this._selectedAnnotation) continue; // Already added

      const key = buildStorageKey('legend', this._datasetHash, annotation);
      if (!key) continue;

      const defaultSettings = createDefaultSettings(annotation);
      const saved = getStorageItem<Partial<LegendPersistedSettings>>(key, {});

      // Only include if there are actual persisted settings
      if (Object.keys(saved).length > 0) {
        result[annotation] = { ...defaultSettings, ...saved };
      }
    }

    return result;
  }
}
