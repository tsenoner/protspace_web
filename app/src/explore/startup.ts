import type { ProtspaceDataLoader, ProtspaceScatterplot } from '@protspace/core';
import { maybeRunWebglPerfSuite } from '../perf/webgl-perf-suite';
import type { DatasetController } from './dataset-controller';

interface StartupOptions {
  dataLoader: ProtspaceDataLoader;
  datasetController: DatasetController;
  plotElement: ProtspaceScatterplot;
}

export async function startInitialExploreLoad({
  dataLoader,
  datasetController,
  plotElement,
}: StartupOptions): Promise<void> {
  const perfSuiteHandled = await maybeRunWebglPerfSuite({ plotElement, dataLoader });
  if (!perfSuiteHandled) {
    await datasetController.loadPersistedOrDefaultDataset();
  }
}
