import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  generateDatasetHash,
  buildStorageKey,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from '@protspace/utils';
import type { LegendPersistedSettings, LegendItem, LegendSortMode } from '../types';
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
  private _pendingZOrderMapping: Record<string, number> = {};

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
   * Get pending z-order mapping (to apply after legend items are created)
   */
  get pendingZOrderMapping(): Record<string, number> {
    return this._pendingZOrderMapping;
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

    this._pendingZOrderMapping = mergedSettings.zOrderMapping;
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

    // Build z-order mapping from current legend items
    const zOrderMapping: Record<string, number> = {};
    legendItems.forEach((item) => {
      if (item.value !== null) {
        zOrderMapping[item.value] = item.zOrder;
      }
    });

    const settings: LegendPersistedSettings = {
      maxVisibleValues: currentSettings.maxVisibleValues,
      includeShapes: currentSettings.includeShapes,
      shapeSize: currentSettings.shapeSize,
      sortMode: currentSettings.sortMode,
      hiddenValues: this.callbacks.getHiddenValues(),
      zOrderMapping,
      enableDuplicateStackUI: currentSettings.enableDuplicateStackUI,
    };

    setStorageItem(key, settings);
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
   * Set pending z-order mapping (used when extracting items from Other)
   */
  setPendingZOrder(zOrderMapping: Record<string, number>): void {
    this._pendingZOrderMapping = zOrderMapping;
  }

  /**
   * Clear pending z-order mapping after it's been applied
   */
  clearPendingZOrder(): void {
    this._pendingZOrderMapping = {};
  }

  /**
   * Check if there's a pending z-order mapping to apply
   */
  hasPendingZOrder(): boolean {
    return Object.keys(this._pendingZOrderMapping).length > 0;
  }

  /**
   * Apply pending z-order mapping to legend items
   */
  applyPendingZOrder(legendItems: LegendItem[]): LegendItem[] {
    if (!this.hasPendingZOrder() || legendItems.length === 0) {
      return legendItems;
    }

    const hasMapping = legendItems.some(
      (item) => item.value !== null && this._pendingZOrderMapping[item.value] !== undefined,
    );

    if (!hasMapping) {
      this._pendingZOrderMapping = {};
      return legendItems;
    }

    const updatedItems = legendItems.map((item) => {
      if (item.value !== null && this._pendingZOrderMapping[item.value] !== undefined) {
        return { ...item, zOrder: this._pendingZOrderMapping[item.value] };
      }
      return item;
    });

    this._pendingZOrderMapping = {};
    return updatedItems;
  }

  private _getStorageKey(): string | null {
    if (!this._datasetHash || !this._selectedAnnotation) {
      return null;
    }
    return buildStorageKey('legend', this._datasetHash, this._selectedAnnotation);
  }
}
