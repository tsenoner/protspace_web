import '@protspace/core'; // Registers all web components
import { startProductTour } from '../tour/product-tour';
import { createAnnotationController } from './annotation-controller';
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
    exportStudio,
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

  const loadQueue = createLoadQueue({
    isDisposed: lifecycle.isDisposed,
  });
  dataLoader.loadFromFileHandler = (file, options, next) =>
    loadQueue.enqueueLoadFromFile(file, options, next);
  lifecycle.addCleanup(() => {
    dataLoader.loadFromFileHandler = undefined;
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

  const annotationController = createAnnotationController({
    onChange() {
      plotElement.indicators = annotationController.getIndicators();
      plotElement.insets = annotationController.getInsets();
      plotElement.insetStep = annotationController.getInsetStep();
      if (exportStudio) {
        exportStudio.indicators = annotationController.getIndicators();
        exportStudio.insets = annotationController.getInsets();
      }
    },
  });

  if (exportStudio) {
    addTrackedEventListener(lifecycle, exportStudio, 'export-studio-close', () => {
      exportStudio.open = false;
    });

    // Handle IDs/Parquet export from within the Export Studio
    addTrackedEventListener(lifecycle, exportStudio, 'export-action', (event: Event) => {
      const { type } = (event as CustomEvent).detail;
      controlBar.dispatchEvent(
        new CustomEvent('export', {
          detail: { type },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

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
    exportStudio,
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

  addTrackedEventListener(lifecycle, plotElement, 'context-menu-action', (event: Event) => {
    const action = (event as CustomEvent).detail;
    switch (action.type) {
      case 'indicate':
        if (action.proteinId && action.dataCoords) {
          annotationController.addIndicator({
            proteinId: action.proteinId,
            label: action.proteinId,
            dataCoords: action.dataCoords,
          });
        }
        break;
      case 'select':
        if (action.proteinId) {
          const current = plotElement.selectedProteinIds ?? [];
          const updated = [...current, action.proteinId];
          plotElement.selectedProteinIds = updated;

          // Activate selection mode so Escape clears and the UI reflects it
          if (!plotElement.selectionMode) {
            plotElement.selectionMode = true;
            controlBar.selectionMode = true;
          }
          controlBar.selectedProteinsCount = updated.length;
        }
        break;
      case 'copy-id':
        if (action.proteinId) {
          void navigator.clipboard.writeText(action.proteinId);
        }
        break;
      case 'view-uniprot':
        if (action.proteinId) {
          window.open(`https://www.uniprot.org/uniprot/${action.proteinId}`, '_blank');
        }
        break;
      case 'add-inset': {
        // Save current zoom/pan so we can restore after snap
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = (plotElement as Record<string, any>)._transform ?? { x: 0, y: 0, k: 1 };
        preFramingTransform = { x: t.x, y: t.y, k: t.k };
        annotationController.startInsetFraming();
        break;
      }
    }
  });

  addTrackedEventListener(lifecycle, plotElement, 'indicator-update', (event: Event) => {
    const { id, ...patch } = (event as CustomEvent).detail;
    annotationController.updateIndicator(id, patch);
  });

  addTrackedEventListener(lifecycle, plotElement, 'indicator-remove', (event: Event) => {
    const { id } = (event as CustomEvent).detail;
    annotationController.removeIndicator(id);
  });

  // ── Inset tool events ──
  // Saved transform from before framing started, so we can restore after snap
  let preFramingTransform: { x: number; y: number; k: number } | null = null;

  // Lens confirms with the drawn region — capture that region and create the inset
  addTrackedEventListener(lifecycle, plotElement, 'inset-frame-drawn', (event: Event) => {
    const { x, y, width, height, zoom } = (event as CustomEvent).detail;
    const plotEl = plotElement as HTMLElement & {
      captureAtResolution?: (...args: unknown[]) => HTMLCanvasElement;
    };

    // Capture the full scatter at high res, then crop the lens region
    const fullW = plotElement.clientWidth * 2;
    const fullH = plotElement.clientHeight * 2;
    const fullCanvas = plotEl.captureAtResolution
      ? (plotEl.captureAtResolution(fullW, fullH, {
          backgroundColor: '#ffffff',
          skipAnnotations: true,
        }) as HTMLCanvasElement)
      : null;

    let capturedCanvas: HTMLCanvasElement | null = null;
    if (fullCanvas) {
      // The lens shows a zoomed view: it reads a (1/zoom)-sized region centered
      // on the lens and stretches it to the lens size. Replicate that here.
      const lensW = width * fullW;
      const lensH = height * fullH;
      const lensCenterX = (x + width / 2) * fullW;
      const lensCenterY = (y + height / 2) * fullH;

      // Source region is smaller by the zoom factor
      const srcW = lensW / zoom;
      const srcH = lensH / zoom;
      const srcX = lensCenterX - srcW / 2;
      const srcY = lensCenterY - srcH / 2;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.round(lensW);
      cropCanvas.height = Math.round(lensH);
      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          fullCanvas,
          Math.round(srcX),
          Math.round(srcY),
          Math.round(srcW),
          Math.round(srcH),
          0,
          0,
          cropCanvas.width,
          cropCanvas.height,
        );
      }
      capturedCanvas = cropCanvas;
    }

    // Lens confirm is a single action: snap + confirm in one go
    // Use the exact lens position and size so the inset stays where it was
    annotationController.snapInset({
      sourceTransform: { x: 0, y: 0, scale: zoom },
      capturedCanvas,
      zoomFactor: zoom,
      position: { x, y },
      size: { width, height },
    });
    annotationController.confirmInset();
    preFramingTransform = null;
  });

  addTrackedEventListener(lifecycle, plotElement, 'inset-reposition', (event: Event) => {
    const { id, position } = (event as CustomEvent).detail;
    const insets = annotationController.getInsets();
    const idx = insets.findIndex((i) => i.id === id);
    if (idx >= 0) {
      insets[idx] = { ...insets[idx], position };
      // Direct mutation + notify via a remove+re-add would be heavy;
      // instead, poke the plot element directly for immediate feedback
      plotElement.insets = [...insets];
      if (exportStudio) exportStudio.insets = [...insets];
    }
  });

  addTrackedEventListener(lifecycle, plotElement, 'inset-cancel', () => {
    // Restore pre-framing zoom if cancelled during framing
    if (preFramingTransform) {
      plotElement.dispatchEvent(
        new CustomEvent('restore-transform', {
          detail: preFramingTransform,
        }),
      );
    }
    preFramingTransform = null;
    annotationController.cancelInset();
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

  /* eslint-disable no-console */
  console.log('ProtSpace components loaded and connected!');
  console.log('Data will be loaded from OPFS when available, otherwise from data.parquetbundle');
  console.log('Use the control bar to change annotations and toggle selection modes!');
  /* eslint-enable no-console */

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
