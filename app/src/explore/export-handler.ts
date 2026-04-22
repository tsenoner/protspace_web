import type { ProtspaceControlBar, ProtspaceLegend, ProtspaceScatterplot } from '@protspace/core';
import { EXPORT_DEFAULTS } from '@protspace/core';
import type { BundleSettings } from '@protspace/utils';
import {
  createExporter,
  exportCanvasAsPdf,
  exportParquetBundle,
  generateBundleFilename,
} from '@protspace/utils';
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

interface PublishEditorEventDetail {
  imageWidth?: number;
  imageHeight?: number;
  legendWidthPercent?: number;
  legendFontSizePx?: number;
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
  // ── Publish editor handler ─────────────────────────

  function setupPublishEditorHandler() {
    controlBar.addEventListener('open-publish-editor', async (event: Event) => {
      const detail = (event as CustomEvent<PublishEditorEventDetail>).detail;

      try {
        // Lazy-import the publish modal component
        const { ProtspacePublishModal } = await import('@protspace/core/publish');

        // Remove any existing modal
        document.querySelector('protspace-publish-modal')?.remove();

        const modal = new ProtspacePublishModal();
        modal.plotElement = plotElement as unknown as HTMLElement;
        modal.initialState = {
          imageWidth: detail.imageWidth,
          imageHeight: detail.imageHeight,
          legendWidthPercent: detail.legendWidthPercent,
          legendFontSizePx: detail.legendFontSizePx,
        };

        // Restore saved publish state from current bundle settings
        const bundleSettings = (
          plotElement as unknown as { bundleSettings?: { publishState?: Record<string, unknown> } }
        ).bundleSettings;
        if (bundleSettings?.publishState) {
          modal.savedPublishState = bundleSettings.publishState;
        }

        // Handle export from the figure editor
        modal.addEventListener('publish-export', (async (e: CustomEvent) => {
          const { canvas, state } = e.detail as {
            canvas: HTMLCanvasElement;
            state: { format: string; widthPx: number; heightPx: number };
          };

          try {
            const fname = generateFilename(state.format);
            if (state.format === 'pdf') {
              await exportCanvasAsPdf(canvas, fname);
            } else {
              const dataUrl = canvas.toDataURL('image/png');
              downloadFile(dataUrl, fname);
            }
            notify.success(getExportSuccessNotification(fname));
          } catch (err) {
            console.error('Publish export failed:', err);
            notify.error(getExportFailureNotification(err));
          }
          modal.remove();
        }) as EventListener);

        // Handle close
        modal.addEventListener('close', () => {
          modal.remove();
        });

        document.body.appendChild(modal);
      } catch (err) {
        console.error('Failed to open figure editor:', err);
        notify.error(getExportFailureNotification(err));
      }
    });
  }

  function generateFilename(ext: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `protspace_figure_${date}.${ext}`;
  }

  function downloadFile(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }

  // Wire up the publish editor listener
  setupPublishEditorHandler();

  // ── Original export handler ────────────────────────

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
