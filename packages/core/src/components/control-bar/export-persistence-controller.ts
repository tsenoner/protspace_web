import {
  migratePublicationLayoutId,
  setStorageItem,
  type ExportOptionsMap,
  type PersistedExportOptions,
} from '@protspace/utils';
import { BasePersistenceController } from '../../controllers/base-persistence-controller';
import { createDefaultExportOptions } from './control-bar-helpers';

export interface ExportPersistenceCallbacks {
  onSettingsLoaded: (settings: PersistedExportOptions) => void;
  getCurrentSettings: () => PersistedExportOptions;
}

export class ExportPersistenceController extends BasePersistenceController<
  PersistedExportOptions,
  ExportOptionsMap
> {
  protected readonly storageKeyPrefix = 'control-bar';
  private callbacks: ExportPersistenceCallbacks;

  constructor(callbacks: ExportPersistenceCallbacks) {
    super();
    this.callbacks = callbacks;
  }

  protected createDefaults(): PersistedExportOptions {
    return createDefaultExportOptions();
  }

  getCurrentSettingsForExport(): PersistedExportOptions {
    return this.callbacks.getCurrentSettings();
  }

  loadSettings(): void {
    const fileSettings = this.tryLoadFileSettings();
    if (fileSettings) {
      const migratedLayoutId = migratePublicationLayoutId(fileSettings);
      const settings: PersistedExportOptions = migratedLayoutId
        ? { ...fileSettings, layoutId: migratedLayoutId }
        : fileSettings;
      this.callbacks.onSettingsLoaded(settings);
      this._settingsLoaded = true;
      return;
    }

    const storageSettings = this.loadFromStorage();
    if (storageSettings) {
      const migratedLayoutId = migratePublicationLayoutId(storageSettings);
      const settings: PersistedExportOptions = migratedLayoutId
        ? { ...storageSettings, layoutId: migratedLayoutId }
        : storageSettings;
      this.callbacks.onSettingsLoaded(settings);
      this._settingsLoaded = true;
    }
  }

  saveSettings(): void {
    const key = this._getStorageKey();
    if (!key) return;

    setStorageItem(key, this.callbacks.getCurrentSettings());
  }
}
