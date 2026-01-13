import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  generateDatasetHash,
  buildStorageKey,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
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
  };
}

/**
 * Reactive controller for managing localStorage persistence.
 * Handles saving and loading legend settings per dataset/annotation combination.
 */
export class PersistenceController implements ReactiveController {
  private callbacks: PersistenceCallbacks;

  private _datasetHash: string = '';
  private _selectedAnnotation: string = '';
  private _settingsLoaded: boolean = false;
  private _pendingCategories: Record<string, PersistedCategoryData> = {};

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
   * Update dataset hash from protein IDs
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
   * Load persisted settings for current dataset/annotation
   */
  loadSettings(): void {
    const key = this._getStorageKey();
    if (!key) return;

    const defaultSettings = createDefaultSettings(this._selectedAnnotation);
    const saved = getStorageItem<Partial<LegendPersistedSettings>>(key, defaultSettings);

    // Merge with defaults to handle old localStorage data missing new fields
    const mergedSettings: LegendPersistedSettings = {
      ...defaultSettings,
      ...saved,
    };

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

    const legendItems = this.callbacks.getLegendItems();
    const currentSettings = this.callbacks.getCurrentSettings();

    // Build categories from current legend items
    const categories: Record<string, PersistedCategoryData> = {};
    legendItems.forEach((item) => {
      if (item.value !== null && item.value !== LEGEND_VALUES.OTHER) {
        categories[item.value] = {
          zOrder: item.zOrder,
          color: item.color,
          shape: item.shape,
        };
      }
    });

    const settings: LegendPersistedSettings = {
      maxVisibleValues: currentSettings.maxVisibleValues,
      includeShapes: currentSettings.includeShapes,
      shapeSize: currentSettings.shapeSize,
      sortMode: currentSettings.sortMode,
      hiddenValues: this.callbacks.getHiddenValues(),
      categories,
      enableDuplicateStackUI: currentSettings.enableDuplicateStackUI,
    };

    setStorageItem(key, settings);

    // Update pending categories to match the saved state
    // This ensures subsequent _updateLegendItems() calls use the current data
    this._pendingCategories = categories;
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
   * Apply pending categories (z-order only) to legend items
   * Color/shape are applied during legend item creation in the processor
   */
  applyPendingZOrder(legendItems: LegendItem[]): LegendItem[] {
    if (!this.hasPendingCategories() || legendItems.length === 0) {
      return legendItems;
    }

    const hasMapping = legendItems.some(
      (item) => item.value !== null && this._pendingCategories[item.value] !== undefined,
    );

    if (!hasMapping) {
      this._pendingCategories = {};
      return legendItems;
    }

    const updatedItems = legendItems.map((item) => {
      if (item.value !== null && this._pendingCategories[item.value] !== undefined) {
        return { ...item, zOrder: this._pendingCategories[item.value].zOrder };
      }
      return item;
    });

    this._pendingCategories = {};
    return updatedItems;
  }

  private _getStorageKey(): string | null {
    if (!this._datasetHash || !this._selectedAnnotation) {
      return null;
    }
    return buildStorageKey('legend', this._datasetHash, this._selectedAnnotation);
  }
}
