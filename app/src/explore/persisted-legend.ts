import type { ProtspaceScatterplot } from '@protspace/core';
import {
  buildStorageKey,
  generateDatasetHash,
  getStorageItem,
  setStorageItem,
  type VisualizationData,
} from '@protspace/utils';

interface PersistedLegendOptions {
  plotElement: ProtspaceScatterplot;
}

export interface PersistedLegendController {
  clearPersistedLegendHiddenValues(annotation: string, dataOverride?: VisualizationData): void;
}

export function createPersistedLegendController({
  plotElement,
}: PersistedLegendOptions): PersistedLegendController {
  const getCurrentDatasetForPersistence = (
    dataOverride?: VisualizationData,
  ): VisualizationData | null => {
    if (dataOverride) {
      return dataOverride;
    }

    const plotWithUnfilteredGetter = plotElement as ProtspaceScatterplot & {
      getCurrentData?: (options?: {
        includeFilteredProteinIds?: boolean;
      }) => VisualizationData | undefined;
    };

    return (
      plotWithUnfilteredGetter.getCurrentData?.({ includeFilteredProteinIds: false }) ??
      plotElement.getCurrentData?.() ??
      plotElement.data ??
      null
    );
  };

  return {
    clearPersistedLegendHiddenValues(annotation, dataOverride) {
      if (!annotation) {
        return;
      }

      const dataset = getCurrentDatasetForPersistence(dataOverride);
      if (!dataset) {
        return;
      }

      const storageKey = buildStorageKey('legend', generateDatasetHash(dataset), annotation);
      const persistedSettings = getStorageItem<Record<string, unknown> | null>(storageKey, null);

      if (!persistedSettings || !Array.isArray(persistedSettings.hiddenValues)) {
        return;
      }

      setStorageItem(storageKey, {
        ...persistedSettings,
        hiddenValues: [],
      });
    },
  };
}
