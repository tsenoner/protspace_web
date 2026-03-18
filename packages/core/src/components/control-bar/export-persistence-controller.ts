import {
  buildStorageKey,
  generateDatasetHash,
  getStorageItem,
  removeAllStorageItemsByHash,
  setStorageItem,
  type ExportOptionsMap,
  type PersistedExportOptions,
} from '@protspace/utils';
import { createDefaultExportOptions } from './control-bar-helpers';

export interface ExportPersistenceCallbacks {
  onSettingsLoaded: (settings: PersistedExportOptions) => void;
  getCurrentSettings: () => PersistedExportOptions;
}

export class ExportPersistenceController {
  private callbacks: ExportPersistenceCallbacks;

  private _datasetHash: string = '';
  private _selectedAnnotation: string = '';
  private _settingsLoaded: boolean = false;
  private _fileSettings: ExportOptionsMap | null = null;
  private _appliedFileAnnotations: Set<string> = new Set();

  constructor(callbacks: ExportPersistenceCallbacks) {
    this.callbacks = callbacks;
  }

  get settingsLoaded(): boolean {
    return this._settingsLoaded;
  }

  get hasFileSettings(): boolean {
    return this._fileSettings !== null;
  }

  updateDatasetHash(proteinIds: string[]): boolean {
    const newHash = generateDatasetHash(proteinIds);
    if (newHash !== this._datasetHash) {
      this._datasetHash = newHash;
      this._settingsLoaded = false;
      return true;
    }
    return false;
  }

  updateSelectedAnnotation(annotation: string): boolean {
    if (annotation !== this._selectedAnnotation) {
      this._selectedAnnotation = annotation;
      this._settingsLoaded = false;
      return true;
    }
    return false;
  }

  loadSettings(): void {
    const key = this._getStorageKey();
    if (!key) return;

    const defaultSettings = createDefaultExportOptions();
    let mergedSettings: PersistedExportOptions;

    if (
      this._fileSettings?.[this._selectedAnnotation] &&
      !this._appliedFileAnnotations.has(this._selectedAnnotation)
    ) {
      mergedSettings = {
        ...defaultSettings,
        ...this._fileSettings[this._selectedAnnotation],
      };
      this._appliedFileAnnotations.add(this._selectedAnnotation);
    } else {
      const saved = getStorageItem<Partial<PersistedExportOptions>>(key, defaultSettings);
      mergedSettings = {
        ...defaultSettings,
        ...saved,
      };
    }

    this.callbacks.onSettingsLoaded(mergedSettings);
    this._settingsLoaded = true;
  }

  saveSettings(): void {
    const key = this._getStorageKey();
    if (!key) return;

    setStorageItem(key, this.callbacks.getCurrentSettings());
  }

  setFileSettings(
    settings: ExportOptionsMap | null,
    datasetHash?: string,
    clearExistingStorage: boolean = true,
  ): void {
    this._fileSettings = settings;
    this._appliedFileAnnotations.clear();

    const hashToUse = datasetHash || this._datasetHash;

    if (settings && hashToUse) {
      if (clearExistingStorage) {
        removeAllStorageItemsByHash(hashToUse);
      }

      for (const [annotationName, annotationSettings] of Object.entries(settings)) {
        const key = buildStorageKey('control-bar', hashToUse, annotationName);
        setStorageItem(key, annotationSettings);
      }
    }

    if (settings && this._selectedAnnotation && settings[this._selectedAnnotation]) {
      this._settingsLoaded = false;
    }
  }

  clearForNewDataset(datasetHash: string, clearPersistedState: boolean = true): void {
    if (clearPersistedState) {
      removeAllStorageItemsByHash(datasetHash);
    }

    this._datasetHash = '';
    this._selectedAnnotation = '';
    this._settingsLoaded = false;
    this._fileSettings = null;
    this._appliedFileAnnotations.clear();
  }

  hasFileSettingsForAnnotation(annotation: string): boolean {
    return this._fileSettings !== null && annotation in this._fileSettings;
  }

  getCurrentSettingsForExport(): PersistedExportOptions {
    return this.callbacks.getCurrentSettings();
  }

  getAllSettingsForExport(annotationNames: string[]): ExportOptionsMap {
    const result: ExportOptionsMap = {};

    if (this._selectedAnnotation) {
      result[this._selectedAnnotation] = this.getCurrentSettingsForExport();
    }

    for (const annotation of annotationNames) {
      if (annotation === this._selectedAnnotation) continue;

      const key = buildStorageKey('control-bar', this._datasetHash, annotation);
      const saved = getStorageItem<Partial<PersistedExportOptions>>(key, {});

      if (Object.keys(saved).length > 0) {
        result[annotation] = {
          ...createDefaultExportOptions(),
          ...saved,
        };
      }
    }

    return result;
  }

  private _getStorageKey(): string | null {
    if (!this._datasetHash || !this._selectedAnnotation) {
      return null;
    }

    return buildStorageKey('control-bar', this._datasetHash, this._selectedAnnotation);
  }
}
