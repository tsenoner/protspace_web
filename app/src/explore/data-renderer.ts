import type {
  ProtspaceControlBar,
  ProtspaceLegend,
  ProtspaceScatterplot,
  ProtspaceStructureViewer,
} from '@protspace/core';
import type { VisualizationData } from '@protspace/utils';
import type { InteractionController } from './interaction-controller';
import type { EffectiveExploreView } from './view-state';

interface DataRendererOptions {
  controlBar: ProtspaceControlBar;
  getIsDisposed: () => boolean;
  interactionController: InteractionController;
  legendElement: ProtspaceLegend;
  overlayController: {
    update(show: boolean, progress?: number, message?: string, subMessage?: string): void;
  };
  plotElement: ProtspaceScatterplot;
  structureViewer: ProtspaceStructureViewer;
}

export function createDataRenderer({
  controlBar,
  getIsDisposed,
  interactionController,
  legendElement,
  overlayController,
  plotElement,
  structureViewer,
}: DataRendererOptions) {
  const performanceMetrics = {
    lastDataSize: 0,
    loadingTime: 0,
  };

  const yieldToBrowser = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  return async function loadData(
    newData: VisualizationData,
    initialView?: EffectiveExploreView | null,
  ) {
    if (getIsDisposed()) {
      return;
    }

    console.log('Loading new data:', newData);
    const startTime = performance.now();
    const dataSize = newData.protein_ids.length;
    performanceMetrics.lastDataSize = dataSize;
    const isLargeDataset = dataSize > 1000;

    console.log('Dataset analysis:', {
      size: dataSize.toLocaleString(),
      willUseProgressiveLoading: isLargeDataset,
    });

    if (isLargeDataset) {
      console.log(
        `Large dataset detected (${dataSize.toLocaleString()} proteins) - using optimized loading pipeline`,
      );
      overlayController.update(
        true,
        20,
        'Preparing visualization...',
        `Found ${dataSize.toLocaleString()} proteins`,
      );
    } else {
      overlayController.update(false);
    }

    try {
      if (isLargeDataset) {
        overlayController.update(
          true,
          20,
          'Rendering scatterplot points...',
          `Visualizing ${dataSize.toLocaleString()} proteins`,
        );
      }

      await yieldToBrowser();

      console.log('Updating scatterplot with new data...');
      plotElement.clearIsolationState();
      controlBar.autoSync = false;
      legendElement.autoSync = false;
      const oldData = plotElement.data;
      const initialProjectionName = initialView?.projection ?? newData.projections[0]?.name ?? '';
      const initialProjectionIndex = Math.max(
        0,
        newData.projections.findIndex((projection) => projection.name === initialProjectionName),
      );
      const firstAnnotationKey = Object.keys(newData.annotations)[0] || '';
      const initialAnnotation = initialView?.annotation ?? firstAnnotationKey;

      plotElement.data = newData;
      plotElement.selectedProjectionIndex = initialProjectionIndex;
      plotElement.selectedAnnotation = initialAnnotation;
      plotElement.selectedProteinIds = [];
      plotElement.selectionMode = false;
      plotElement.hiddenAnnotationValues = [];
      plotElement.requestUpdate('data', oldData);

      controlBar.selectedProjection = initialProjectionName;
      controlBar.selectedAnnotation = initialAnnotation;
      controlBar.selectionMode = false;
      controlBar.selectedProteinsCount = 0;
      controlBar.requestUpdate();

      if (isLargeDataset) {
        overlayController.update(
          true,
          40,
          'Configuring controls and filters...',
          `Visualizing ${dataSize.toLocaleString()} proteins`,
        );
      }

      await yieldToBrowser();
      await yieldToBrowser();

      controlBar.autoSync = true;

      if (isLargeDataset) {
        overlayController.update(
          true,
          60,
          'Organizing color categories...',
          `Visualizing ${dataSize.toLocaleString()} proteins`,
        );
      }

      await yieldToBrowser();

      await new Promise<void>((resolve) => {
        setTimeout(
          () => {
            legendElement.autoSync = true;
            legendElement.autoHide = true;
            interactionController.updateLegend();
            resolve();
          },
          isLargeDataset ? 30 : 20,
        );
      });

      if (isLargeDataset) {
        overlayController.update(
          true,
          95,
          'Finalizing view...',
          `Visualizing ${dataSize.toLocaleString()} proteins`,
        );
      }

      await yieldToBrowser();

      if (structureViewer.style.display !== 'none') {
        structureViewer.style.display = 'none';
      }

      interactionController.updateSelectedProteinDisplay(null);

      if (isLargeDataset) {
        overlayController.update(
          true,
          100,
          'Ready to explore!',
          `Visualizing ${dataSize.toLocaleString()} proteins`,
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const endTime = performance.now();
      performanceMetrics.loadingTime = endTime - startTime;

      console.log('Data loading completed:', {
        proteins: newData.protein_ids.length.toLocaleString(),
        loadingTime: `${Math.round(performanceMetrics.loadingTime)}ms`,
      });
    } finally {
      if (isLargeDataset) {
        overlayController.update(false);
      }
    }
  };
}
