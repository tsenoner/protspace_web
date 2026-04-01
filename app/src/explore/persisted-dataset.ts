import type { DataLoader as ProtspaceDataLoader } from '@protspace/core';
import { notify } from '../lib/notify';
import {
  StoredDatasetCorruptError,
  clearLastImportedFile,
  loadLastImportedFile,
} from './opfs-dataset-store';
import { getCorruptedPersistedDatasetNotification } from './notifications';
import type { DatasetLoadKind } from './types';

interface PersistedDatasetOptions {
  dataLoader: ProtspaceDataLoader;
  defaultDatasetName: string;
  registerFileLoad(file: File, kind: DatasetLoadKind): void;
  setCurrentDatasetIsDemo(isDemo: boolean): void;
  setCurrentDatasetName(name: string): void;
}

export function createPersistedDatasetController({
  dataLoader,
  defaultDatasetName,
  registerFileLoad,
  setCurrentDatasetIsDemo,
  setCurrentDatasetName,
}: PersistedDatasetOptions) {
  const clearCorruptedPersistedDataset = async (context: string) => {
    try {
      await clearLastImportedFile();
    } catch (clearError) {
      console.warn('Failed to clear invalid persisted dataset:', clearError);
    }
    notify.warning(getCorruptedPersistedDatasetNotification(context));
  };

  const loadDefaultDataset = async () => {
    try {
      setCurrentDatasetName(defaultDatasetName);
      setCurrentDatasetIsDemo(true);
      console.log('Loading data from data.parquetbundle...');

      const response = await fetch('./data.parquetbundle');
      if (!response.ok) {
        throw new Error(`File not found: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], 'data.parquetbundle', {
        type: 'application/octet-stream',
      });

      console.log(`File loaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      registerFileLoad(file, 'default');
      await dataLoader.loadFromFile(file, { source: 'auto' });
    } catch (error) {
      console.error('Failed to load data from file:', error);
      console.log('Make sure data.parquetbundle exists in the public directory');
      console.log(
        'Alternative: You can drag and drop the data.parquetbundle file onto the data loader component',
      );

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Auto-load failed: ${errorMessage}`);
      console.log(
        'The data loader is ready for drag-and-drop. Simply drag the data.parquetbundle file onto the component.',
      );
    }
  };

  const recoverFromCorruptedPersistedDataset = async (context: string) => {
    await clearCorruptedPersistedDataset(context);
    await loadDefaultDataset();
  };

  const loadPersistedOrDefaultDataset = async () => {
    try {
      const persistedFile = await loadLastImportedFile();
      if (persistedFile) {
        console.log(`Restoring persisted dataset from OPFS: ${persistedFile.name}`);
        registerFileLoad(persistedFile, 'opfs');
        setCurrentDatasetName(persistedFile.name);
        setCurrentDatasetIsDemo(false);
        await dataLoader.loadFromFile(persistedFile, { source: 'auto' });
        return;
      }
    } catch (error) {
      console.error('Failed to restore persisted dataset:', error);
      if (error instanceof StoredDatasetCorruptError) {
        await recoverFromCorruptedPersistedDataset('in browser storage is corrupted');
        return;
      }
    }

    await loadDefaultDataset();
  };

  const loadDefaultDatasetAndClearPersistedFile = async () => {
    try {
      await clearLastImportedFile();
    } catch (error) {
      console.warn('Failed to clear persisted dataset before loading the default dataset:', error);
    }
    await loadDefaultDataset();
  };

  return {
    clearCorruptedPersistedDataset,
    loadDefaultDataset,
    loadPersistedOrDefaultDataset,
    loadDefaultDatasetAndClearPersistedFile,
    recoverFromCorruptedPersistedDataset,
  };
}
