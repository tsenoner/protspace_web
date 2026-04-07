import type { ProtspaceControlBar, ProtspaceLegend, ProtspaceScatterplot } from '@protspace/core';
import type { BundleSettings, PublicationFigureLayoutId } from '@protspace/utils';
import {
  createScatterCaptureFromElement,
  exportParquetBundle,
  exportPublicationFigure,
  exportUtils,
  generateBundleFilename,
  generateProtspaceExportBasename,
} from '@protspace/utils';
import { notify } from '../lib/notify';
import { getExportFailureNotification, getExportSuccessNotification } from './notifications';
import { buildPublicationLegendModelFromDom } from './publication-export-bridge';

interface ExportEventDetail {
  includeExportOptions?: boolean;
  includeLegendSettings?: boolean;
  layoutId?: PublicationFigureLayoutId;
  mode?: 'publication';
  type: 'ids' | 'pdf' | 'png' | 'parquet';
}

interface ExportHandlerOptions {
  controlBar: ProtspaceControlBar;
  getSelectedProteins(): string[];
  legendElement: ProtspaceLegend;
  plotElement: ProtspaceScatterplot;
}

export function createExportHandler({
  controlBar,
  getSelectedProteins,
  legendElement,
  plotElement,
}: ExportHandlerOptions) {
  return async (event: Event) => {
    const customEvent = event as CustomEvent<ExportEventDetail>;
    const { type, includeLegendSettings, includeExportOptions, mode, layoutId } =
      customEvent.detail;

    try {
      if (type === 'parquet') {
        const currentData = plotElement.getCurrentData();
        if (!currentData) {
          throw new Error('No data available for export');
        }

        const includeSettings = includeLegendSettings || includeExportOptions;
        let settings: BundleSettings | undefined;
        if (includeSettings) {
          settings = {
            legendSettings: includeLegendSettings ? legendElement.getAllPersistedSettings() : {},
            exportOptions: includeExportOptions ? controlBar.getAllPersistedExportOptions() : {},
          };
        }

        const filename = generateBundleFilename(includeSettings);
        exportParquetBundle(currentData, filename, { includeSettings, settings });
        notify.success(getExportSuccessNotification(filename));
        return;
      }

      if (type === 'ids') {
        exportUtils.exportProteinIds(plotElement);
        return;
      }

      if (type === 'png' || type === 'pdf') {
        if (mode !== 'publication' || !layoutId) {
          throw new Error(
            'PNG/PDF export requires publication layout settings from the control bar.',
          );
        }
        try {
          await document.fonts.load('600 10px "Roboto Condensed"');
          await document.fonts.load('500 10px "Roboto Condensed"');
        } catch {
          // Canvas falls back to Arial stack
        }
        const selectionIds = plotElement.selectedProteinIds ?? getSelectedProteins();
        const legendModel = buildPublicationLegendModelFromDom(
          plotElement,
          legendElement,
          selectionIds,
        );
        const fileNameBase = generateProtspaceExportBasename(plotElement);
        await exportPublicationFigure({
          layoutId,
          format: type,
          backgroundColor: '#ffffff',
          scatterCapture: createScatterCaptureFromElement(plotElement),
          legendModel,
          fileNameBase,
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      notify.error(getExportFailureNotification(error));
    }
  };
}
