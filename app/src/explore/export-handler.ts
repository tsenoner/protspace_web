import type { ProtspaceControlBar, ProtspaceLegend, ProtspaceScatterplot } from '@protspace/core';
import { EXPORT_DEFAULTS } from '@protspace/core';
import type { BundleSettings } from '@protspace/utils';
import { createExporter, exportParquetBundle, generateBundleFilename } from '@protspace/utils';
import { notify } from '../lib/notify';
import { getExportFailureNotification, getExportSuccessNotification } from './notifications';

interface ExportEventDetail {
  imageHeight?: number;
  imageWidth?: number;
  includeExportOptions?: boolean;
  includeLegend?: boolean;
  includeLegendSettings?: boolean;
  legendFontSizePx?: number;
  legendWidthPercent?: number;
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
    const {
      type,
      imageWidth,
      imageHeight,
      legendWidthPercent,
      legendFontSizePx,
      includeLegend,
      includeLegendSettings,
      includeExportOptions,
    } = customEvent.detail;

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
        exportParquetBundle(currentData, filename, {
          includeSettings,
          settings,
        });
        notify.success(getExportSuccessNotification(filename));
        return;
      }

      const exporter = createExporter(plotElement);
      const shouldIncludeLegend = includeLegend ?? true;
      const totalWidth = imageWidth ?? EXPORT_DEFAULTS.IMAGE_WIDTH;
      const legendPercent = (legendWidthPercent ?? EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT) / 100;
      const targetWidth = shouldIncludeLegend
        ? Math.round(totalWidth * (1 - legendPercent))
        : totalWidth;
      const targetHeight = imageHeight ?? EXPORT_DEFAULTS.IMAGE_HEIGHT;

      const options = {
        targetWidth,
        targetHeight,
        legendWidthPercent: legendWidthPercent ?? EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT,
        legendScaleFactor:
          (legendFontSizePx ?? EXPORT_DEFAULTS.LEGEND_FONT_SIZE_PX) /
          EXPORT_DEFAULTS.BASE_FONT_SIZE,
        includeLegend: shouldIncludeLegend,
        includeSelection: getSelectedProteins().length > 0,
        backgroundColor: 'white' as const,
      };

      switch (type) {
        case 'ids':
          exporter.exportProteinIds(options);
          break;
        case 'png':
          await exporter.exportPNG(options);
          break;
        case 'pdf':
          await exporter.exportPDF(options);
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      notify.error(getExportFailureNotification(error));
    }
  };
}
