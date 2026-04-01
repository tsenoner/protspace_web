import '@protspace/core'; // Registers all web components
import { startProductTour } from '../tour/product-tour';
import { bindControlBarEvents } from './control-bar-events';
import { createDatasetController } from './dataset-controller';
import { getElements, waitForElements } from './elements';
import { createExportHandler } from './export-handler';
import { createInteractionController } from './interaction-controller';
import { createLifecycle } from './lifecycle';
import { createLoadQueue } from './load-queue';
import { createLoadingOverlayController } from './loading-overlay';
import { createPersistedLegendController } from './persisted-legend';
import { startInitialExploreLoad } from './startup';
import { NOOP_CONTROLLER, type ExploreController } from './types';
import { createViewController } from './view-controller';

const DEFAULT_DATASET_NAME = 'Demo dataset';

function addTrackedEventListener(
  lifecycle: ReturnType<typeof createLifecycle>,
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
) {
  target.addEventListener(type, listener, options);
  lifecycle.addCleanup(() => target.removeEventListener(type, listener, options));
}

export async function initializeExploreRuntime(): Promise<ExploreController> {
  await waitForElements();

  const elements = getElements();
  if (!elements) {
    return NOOP_CONTROLLER;
  }

  const {
    controlBar,
    dataLoader,
    legendElement,
    plotElement,
    selectedProteinElement,
    structureViewer,
  } = elements;
  const lifecycle = createLifecycle();

  const setCurrentDatasetName = (name: string) => {
    controlBar.currentDatasetName = name;
  };

  const setCurrentDatasetIsDemo = (isDemo: boolean) => {
    controlBar.currentDatasetIsDemo = isDemo;
  };

  const originalLoadFromFile = dataLoader.loadFromFile.bind(dataLoader);
  const loadQueue = createLoadQueue({
    isDisposed: lifecycle.isDisposed,
    loadFromFile: originalLoadFromFile,
  });
  dataLoader.loadFromFile = loadQueue.enqueueLoadFromFile;
  lifecycle.addCleanup(() => {
    dataLoader.loadFromFile = originalLoadFromFile;
    loadQueue.dispose();
  });

  const overlayController = createLoadingOverlayController();
  lifecycle.addCleanup(() => overlayController.dispose());

  const viewController = createViewController({
    plotElement,
    controlBar,
  });
  lifecycle.addCleanup(() => viewController.dispose());

  const persistedLegendController = createPersistedLegendController({
    plotElement,
  });

  const interactionController = createInteractionController({
    legendElement,
    plotElement,
    selectedProteinElement,
    structureViewer,
    clearPersistedLegendHiddenValues: persistedLegendController.clearPersistedLegendHiddenValues,
  });

  const datasetController = createDatasetController({
    controlBar,
    dataLoader,
    defaultDatasetName: DEFAULT_DATASET_NAME,
    getIsDisposed: lifecycle.isDisposed,
    interactionController,
    legendElement,
    loadQueue,
    overlayController,
    plotElement,
    structureViewer,
    setCurrentDatasetIsDemo,
    setCurrentDatasetName,
    viewController,
  });

  const handleExport = createExportHandler({
    controlBar,
    getSelectedProteins: interactionController.getSelectedProteins,
    legendElement,
    plotElement,
  });

  lifecycle.scheduleTimeout(() => {
    legendElement.autoSync = true;
    legendElement.autoHide = true;
  }, 100);

  addTrackedEventListener(
    lifecycle,
    controlBar,
    'protein-selection-change',
    interactionController.handleSelectionChange,
  );
  addTrackedEventListener(
    lifecycle,
    plotElement,
    'data-isolation',
    interactionController.updateLegend,
  );
  addTrackedEventListener(
    lifecycle,
    plotElement,
    'data-isolation-reset',
    interactionController.updateLegend,
  );
  addTrackedEventListener(
    lifecycle,
    legendElement,
    'legend-item-click',
    interactionController.handleLegendItemClick,
  );
  addTrackedEventListener(
    lifecycle,
    legendElement,
    'legend-error',
    interactionController.handleLegendError,
  );
  addTrackedEventListener(
    lifecycle,
    structureViewer,
    'structure-load',
    interactionController.handleStructureLoad,
  );
  addTrackedEventListener(
    lifecycle,
    structureViewer,
    'structure-error',
    interactionController.handleStructureError,
  );
  addTrackedEventListener(
    lifecycle,
    structureViewer,
    'structure-close',
    interactionController.handleStructureClose,
  );
  addTrackedEventListener(
    lifecycle,
    plotElement,
    'data-change',
    interactionController.handlePlotDataChange,
  );
  addTrackedEventListener(lifecycle, plotElement, 'file-dropped', (event: Event) => {
    const file = (event as CustomEvent<{ file?: File }>).detail.file;
    if (file) {
      void dataLoader.loadFromFile(file);
    }
  });
  bindControlBarEvents({
    addControlBarListener(type, listener, options) {
      addTrackedEventListener(lifecycle, controlBar, type, listener, options);
    },
    controlBar,
    datasetController,
    handleExport,
    interactionController,
    plotElement,
    viewController,
  });

  addTrackedEventListener(
    lifecycle,
    dataLoader,
    'data-loading-start',
    datasetController.handleLoadingStart,
  );
  addTrackedEventListener(
    lifecycle,
    dataLoader,
    'data-loading-progress',
    datasetController.handleLoadingProgress,
  );
  addTrackedEventListener(lifecycle, dataLoader, 'data-loaded', (event: Event) => {
    void datasetController.handleDataLoaded(event);
  });
  addTrackedEventListener(lifecycle, dataLoader, 'data-error', (event: Event) => {
    void datasetController.handleDataError(event);
  });
  addTrackedEventListener(
    lifecycle,
    dataLoader,
    'data-loaded',
    () => {
      lifecycle.scheduleTimeout(() => {
        startProductTour();
      }, 800);
    },
    { once: true },
  );

  addTrackedEventListener(lifecycle, plotElement, 'tour-start', () => {
    startProductTour({ force: true });
  });

  interactionController.updateLegend();

  void startInitialExploreLoad({ datasetController, plotElement, dataLoader });

  console.log('ProtSpace components loaded and connected!');
  console.log('Data will be loaded from OPFS when available, otherwise from data.parquetbundle');
  console.log('Use the control bar to change annotations and toggle selection modes!');

  return {
    setRequestedView(requested) {
      if (lifecycle.isDisposed()) {
        return;
      }

      viewController.setRequestedView(requested);
    },
    subscribeToViewChanges(callback) {
      return viewController.subscribeToViewChanges(callback);
    },
    dispose() {
      lifecycle.dispose();
    },
  };
}
