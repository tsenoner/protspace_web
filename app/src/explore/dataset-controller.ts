import type {
  ProtspaceControlBar,
  ProtspaceLegend,
  ProtspaceScatterplot,
  ProtspaceStructureViewer,
  DataLoadedEventDetail,
  DataErrorEventDetail,
  DataLoader as ProtspaceDataLoader,
} from '@protspace/core';
import { generateDatasetHash } from '@protspace/utils';
import { notify } from '../lib/notify';
import {
  getDataLoadFailureNotification,
  getDatasetPersistenceFailureNotification,
} from './notifications';
import { saveLastImportedFile } from './opfs-dataset-store';
import { createDataRenderer } from './data-renderer';
import type { InteractionController } from './interaction-controller';
import type { LoadQueue } from './load-queue';
import { createPersistedDatasetController } from './persisted-dataset';
import type { ViewController } from './view-controller';

interface DatasetControllerOptions {
  controlBar: ProtspaceControlBar;
  dataLoader: ProtspaceDataLoader;
  defaultDatasetName: string;
  getIsDisposed: () => boolean;
  interactionController: InteractionController;
  legendElement: ProtspaceLegend;
  loadQueue: LoadQueue;
  overlayController: {
    update(show: boolean, progress?: number, message?: string, subMessage?: string): void;
  };
  plotElement: ProtspaceScatterplot;
  setCurrentDatasetIsDemo(isDemo: boolean): void;
  setCurrentDatasetName(name: string): void;
  structureViewer: ProtspaceStructureViewer;
  viewController: ViewController;
}

export interface DatasetController {
  loadDefaultDatasetAndClearPersistedFile(): Promise<void>;
  loadPersistedOrDefaultDataset(): Promise<void>;
  handleLoadingStart(): void;
  handleLoadingProgress(event: Event): void;
  handleDataLoaded(event: Event): Promise<void>;
  handleDataError(event: Event): Promise<void>;
}

export function createDatasetController({
  controlBar,
  dataLoader,
  defaultDatasetName,
  getIsDisposed,
  interactionController,
  legendElement,
  loadQueue,
  overlayController,
  plotElement,
  setCurrentDatasetIsDemo,
  setCurrentDatasetName,
  structureViewer,
  viewController,
}: DatasetControllerOptions): DatasetController {
  const loadData = createDataRenderer({
    controlBar,
    getIsDisposed,
    interactionController,
    legendElement,
    overlayController,
    plotElement,
    structureViewer,
  });

  const persistedDatasetController = createPersistedDatasetController({
    dataLoader,
    defaultDatasetName,
    registerFileLoad(file, kind) {
      loadQueue.registerFileLoad(file, kind);
    },
    setCurrentDatasetIsDemo,
    setCurrentDatasetName,
  });

  const handleDataLoaded = async (event: Event) => {
    let loadSequence: number | null = null;

    try {
      const customEvent = event as CustomEvent<DataLoadedEventDetail>;
      const { data, settings, source, file } = customEvent.detail;
      const runningLoadMeta = loadQueue.getRunningLoadMeta();
      const loadMeta = (file ? loadQueue.getLoadMetaForFile(file) : undefined) ??
        runningLoadMeta ?? {
          sequence: 0,
          kind: source === 'auto' ? 'default' : 'user',
        };
      loadSequence = loadMeta.sequence;

      if (runningLoadMeta && loadMeta.sequence !== runningLoadMeta.sequence) {
        console.log('Ignoring stale data load result:', {
          source,
          fileName: file?.name ?? null,
          loadKind: loadMeta.kind,
        });
        return;
      }

      if (loadMeta.kind === 'user' && file) {
        overlayController.update(
          true,
          20,
          'Saving imported dataset...',
          'Preparing reload support...',
        );
        try {
          await saveLastImportedFile(file);
        } catch (error) {
          console.error('Failed to persist imported dataset in OPFS:', error);
          notify.warning(getDatasetPersistenceFailureNotification(error));
        }
      }

      const datasetHash = generateDatasetHash(data);
      const shouldClearPersistedState =
        loadMeta.kind === 'default' || (loadMeta.kind === 'user' && settings != null);

      legendElement.clearForNewDataset(datasetHash, shouldClearPersistedState);
      controlBar.clearForNewDataset(datasetHash, shouldClearPersistedState);

      const initialView = viewController.resolveLatestView(data);
      interactionController.setLastKnownAnnotation(
        initialView?.annotation ?? Object.keys(data.annotations)[0] ?? '',
      );

      await loadData(data, initialView);

      const shouldApplyEmbeddedFileSettings = settings && loadMeta.kind !== 'opfs';
      if (shouldApplyEmbeddedFileSettings) {
        legendElement.setFileSettings(settings.legendSettings, datasetHash, true);
        controlBar.setFileSettings(settings.exportOptions, datasetHash, false);
      }

      controlBar.hasFileSettings =
        settings != null &&
        (Object.keys(settings.legendSettings).length > 0 ||
          Object.keys(settings.exportOptions).length > 0);

      if ((loadMeta.kind === 'user' || loadMeta.kind === 'opfs') && file) {
        setCurrentDatasetName(file.name);
        setCurrentDatasetIsDemo(false);
      } else if (loadMeta.kind === 'default') {
        setCurrentDatasetName(defaultDatasetName);
        setCurrentDatasetIsDemo(true);
      }

      viewController.applyLatestViewForDatasetLoad(data);
    } catch (error) {
      console.error('Failed to finalize loaded dataset state:', error);
    } finally {
      if (loadSequence !== null) {
        loadQueue.resolvePendingLoadFinalization(loadSequence);
      }
    }
  };

  const handleDataError = async (event: Event) => {
    const customEvent = event as CustomEvent<DataErrorEventDetail>;
    console.error('❌ Data loading error:', customEvent.detail.message);
    const runningLoadMeta = loadQueue.getRunningLoadMeta();
    const loadSequence = runningLoadMeta?.sequence ?? null;

    if (runningLoadMeta?.kind === 'opfs') {
      if (loadSequence !== null) {
        loadQueue.resolvePendingLoadFinalization(loadSequence);
      }

      if (loadSequence !== null && loadQueue.getLatestSequence() > loadSequence) {
        await persistedDatasetController.clearCorruptedPersistedDataset('could not be loaded');
        return;
      }

      await persistedDatasetController.recoverFromCorruptedPersistedDataset('could not be loaded');
      return;
    }

    notify.error(getDataLoadFailureNotification(customEvent.detail));

    if (loadSequence !== null) {
      loadQueue.resolvePendingLoadFinalization(loadSequence);
    }
  };

  return {
    loadDefaultDatasetAndClearPersistedFile:
      persistedDatasetController.loadDefaultDatasetAndClearPersistedFile,
    loadPersistedOrDefaultDataset: persistedDatasetController.loadPersistedOrDefaultDataset,
    handleLoadingStart() {
      console.log('Data loading started');
      overlayController.update(true, 5, 'Analyzing file structure...', 'Starting upload...');
    },
    handleLoadingProgress(event: Event) {
      const customEvent = event as CustomEvent<{ percentage?: number }>;
      const percentage = Number(customEvent.detail.percentage ?? 0);
      const visualProgress = Math.min(20, Math.max(5, percentage * 0.2));
      overlayController.update(true, visualProgress, 'Reading protein data...', 'Uploading...');
    },
    handleDataLoaded,
    handleDataError,
  };
}
