import '@protspace/core'; // Registers all web components
import type { VisualizationData } from '@protspace/utils';
import type {
  ProtspaceScatterplot,
  ProtspaceLegend,
  ProtspaceStructureViewer,
  DataLoader,
} from '@protspace/core';
import { ProtspaceControlBar, EXPORT_DEFAULTS } from '@protspace/core';
import { createExporter, showNotification } from '@protspace/utils';
import { maybeRunWebglPerfSuite } from './webgl-perf-suite';

// Export initialization function that can be called when the component mounts
export async function initializeDemo() {
  // Wait for all components to be defined for initial setup
  await Promise.all([
    customElements.whenDefined('protspace-scatterplot'),
    customElements.whenDefined('protspace-legend'),
    customElements.whenDefined('protspace-structure-viewer'),
    customElements.whenDefined('protspace-control-bar'),
    customElements.whenDefined('protspace-data-loader'),
  ]);

  console.log('🚀 All web components defined and ready!');
  const plotElement = document.getElementById('myPlot') as ProtspaceScatterplot | null;
  const legendElement = document.getElementById('myLegend') as ProtspaceLegend | null;
  const structureViewer = document.getElementById(
    'myStructureViewer',
  ) as ProtspaceStructureViewer | null;
  const controlBar = document.getElementById('myControlBar') as ProtspaceControlBar | null;
  const dataLoader = document.getElementById('myDataLoader') as DataLoader | null;

  // UI elements
  const selectedProteinElement = document.getElementById('selectedProtein') as HTMLElement | null;

  if (plotElement && legendElement && structureViewer && controlBar && dataLoader) {
    // Track state
    let hiddenValues: string[] = [];
    let selectedProteins: string[] = [];
    let selectionMode = false;
    let isolationMode = false;

    // Performance monitoring
    const performanceMetrics = {
      lastDataSize: 0,
      loadingTime: 0,
    };

    // Helper to show/update loading overlay
    const updateLoadingOverlay = (
      show: boolean,
      progress: number = 0,
      message: string = '',
      subMessage: string = '',
    ) => {
      let overlay = document.getElementById('progressive-loading');

      if (!show) {
        if (overlay) {
          overlay.style.transition = 'opacity 0.5s ease';
          overlay.style.opacity = '0';
          setTimeout(() => overlay?.remove(), 500);
        }
        return;
      }

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'progressive-loading';
        overlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,40,0.9));
          color: white; z-index: 9999;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        overlay.innerHTML = `
          <div style="text-align: center; max-width: 500px;">
            <div style="font-size: 24px; margin-bottom: 10px;">🚀 Loading ProtSpace</div>
            <div id="processing-text" style="font-size: 18px; margin-bottom: 20px;">
              ${subMessage}
            </div>
            <div style="width: 300px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin: 20px auto;">
              <div id="progress-bar" style="height: 100%; background: linear-gradient(90deg, #3b82f6, #06b6d4); border-radius: 2px; width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="progress-text" style="font-size: 14px; opacity: 0.8; margin-top: 10px;">
              ${message}
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      } else {
        overlay.style.opacity = '1';
        overlay.style.transition = 'none';
      }

      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const processingText = document.getElementById('processing-text');

      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressText) progressText.textContent = message;
      if (processingText) processingText.textContent = subMessage;
    };

    // Function to load new data and reset all state with progressive loading and performance optimization
    const loadNewData = async (newData: VisualizationData) => {
      console.log('🔄 Loading new data:', newData);
      const startTime = performance.now();
      const dataSize = newData.protein_ids.length;

      // Store performance metrics
      performanceMetrics.lastDataSize = dataSize;

      // Determine if we need loading indicator (for large datasets)
      const isLargeDataset = dataSize > 1000;

      console.log('📊 Dataset analysis:', {
        size: dataSize.toLocaleString(),
        willUseProgressiveLoading: isLargeDataset,
      });

      // Show enhanced loading indicator for large datasets
      if (isLargeDataset) {
        console.log(
          `⚡ Large dataset detected (${dataSize.toLocaleString()} proteins) - using optimized loading pipeline`,
        );
        updateLoadingOverlay(
          true,
          20,
          'Preparing visualization...',
          `Found ${dataSize.toLocaleString()} proteins`,
        );
      } else {
        // If not large dataset, hide the overlay that was shown during file reading
        updateLoadingOverlay(false);
      }

      try {
        // Reset all state
        hiddenValues = [];
        selectedProteins = [];
        selectionMode = false;
        isolationMode = false;

        // Update progress
        if (isLargeDataset) {
          updateLoadingOverlay(
            true,
            20,
            'Rendering scatterplot points...',
            `Visualizing ${dataSize.toLocaleString()} proteins`,
          );
        }

        // Yield to browser before heavy processing
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Update scatterplot with new data
        console.log('📊 Updating scatterplot with new data...');
        const oldData = plotElement.data;
        plotElement.data = newData;
        plotElement.requestUpdate('data', oldData);

        plotElement.selectedProjectionIndex = 0;
        const firstAnnotationKey = Object.keys(newData.annotations)[0] || '';
        plotElement.selectedAnnotation = firstAnnotationKey;
        plotElement.selectedProteinIds = [];
        plotElement.selectionMode = false;
        plotElement.hiddenAnnotationValues = [];

        console.log(
          `📊 Scatterplot updated: ${newData.protein_ids.length} proteins, ${newData.projections.length} projections`,
        );

        // Update progress
        if (isLargeDataset) {
          updateLoadingOverlay(
            true,
            40,
            'Configuring controls and filters...',
            `Visualizing ${dataSize.toLocaleString()} proteins`,
          );
        }

        // Yield to browser
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Update control bar with performance awareness
        await new Promise((resolve) => {
          setTimeout(
            () => {
              controlBar.autoSync = true;
              controlBar.selectedProjection = newData.projections[0]?.name || '';
              controlBar.selectedAnnotation = Object.keys(newData.annotations)[0] || '';
              controlBar.selectionMode = false;
              controlBar.selectedProteinsCount = 0;
              controlBar.requestUpdate();
              resolve(undefined);
            },
            isLargeDataset ? 50 : 10,
          ); // Longer delay for large datasets
        });

        // Update progress
        if (isLargeDataset) {
          updateLoadingOverlay(
            true,
            60,
            'Organizing color categories...',
            `Visualizing ${dataSize.toLocaleString()} proteins`,
          );
        }

        // Yield to browser
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Update legend with enhanced progressive annotation processing
        await new Promise((resolve) => {
          setTimeout(
            async () => {
              legendElement.autoSync = true;
              legendElement.autoHide = true;

              legendElement.data = { annotations: newData.annotations };
              legendElement.selectedAnnotation = Object.keys(newData.annotations)[0] || '';

              // Process legend annotation values
              const firstAnnotation = Object.keys(newData.annotations)[0];
              if (firstAnnotation) {
                if (isLargeDataset) {
                  // Large datasets: Chunked processing to keep UI responsive
                  const chunkSize = 1000;
                  const annotationValues: (string | null)[] = [];

                  for (let i = 0; i < newData.protein_ids.length; i += chunkSize) {
                    const endIndex = Math.min(i + chunkSize, newData.protein_ids.length);

                    for (let j = i; j < endIndex; j++) {
                      const annotationIdxArray = newData.annotation_data[firstAnnotation][j];

                      for (let k = 0; k < annotationIdxArray.length; k++) {
                        annotationValues.push(
                          newData.annotations[firstAnnotation].values[annotationIdxArray[k]],
                        );
                      }
                    }

                    // Yield to browser and update progress
                    if (i + chunkSize < newData.protein_ids.length) {
                      const progress = 60 + (i / newData.protein_ids.length) * 30;
                      updateLoadingOverlay(
                        true,
                        progress,
                        'Organizing color categories...',
                        `Visualizing ${dataSize.toLocaleString()} proteins`,
                      );
                      await new Promise((resolve) => requestAnimationFrame(resolve));
                    }
                  }

                  legendElement.annotationValues = annotationValues;
                } else {
                  // Small datasets: Process directly
                  const annotationValues = newData.protein_ids.flatMap((_, index) => {
                    const annotationIdx = newData.annotation_data[firstAnnotation][index];
                    return annotationIdx.map(
                      (idx) => newData.annotations[firstAnnotation].values[idx],
                    );
                  });
                  legendElement.annotationValues = annotationValues;
                }

                legendElement.proteinIds = newData.protein_ids;
              }

              legendElement.requestUpdate();

              console.log(
                `🏷️ Legend updated with ${Object.keys(newData.annotations).length} annotations`,
              );

              resolve(undefined);
            },
            isLargeDataset ? 30 : 20,
          );
        });

        // Update progress
        if (isLargeDataset) {
          updateLoadingOverlay(
            true,
            95,
            'Finalizing view...',
            `Visualizing ${dataSize.toLocaleString()} proteins`,
          );
        }

        // Yield to browser
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Hide structure viewer and finalize
        if (structureViewer.style.display !== 'none') {
          structureViewer.style.display = 'none';
        }

        updateSelectedProteinDisplay(null);

        // Update progress to 100%
        if (isLargeDataset) {
          updateLoadingOverlay(
            true,
            100,
            'Ready to explore!',
            `Visualizing ${dataSize.toLocaleString()} proteins`,
          );

          // Keep the success message visible briefly
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        const endTime = performance.now();
        performanceMetrics.loadingTime = endTime - startTime;

        console.log('✅ Data loading completed:', {
          proteins: newData.protein_ids.length.toLocaleString(),
          loadingTime: `${Math.round(performanceMetrics.loadingTime)}ms`,
        });
      } finally {
        // Remove loading overlay with fade effect
        if (isLargeDataset) {
          updateLoadingOverlay(false);
        }
      }
    };

    // Load data from the parquet bundle file
    const loadDataFromFile = async () => {
      try {
        console.log('🔄 Loading data from data.parquetbundle...');

        // First, try to fetch the file directly to check if it exists
        const response = await fetch('./data.parquetbundle');
        if (!response.ok) {
          throw new Error(`File not found: ${response.status} ${response.statusText}`);
        }

        // Get the file as ArrayBuffer and create a File object for the data loader
        const arrayBuffer = await response.arrayBuffer();
        const file = new File([arrayBuffer], 'data.parquetbundle', {
          type: 'application/octet-stream',
        });

        console.log(`📁 File loaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Use loadFromFile instead of loadFromUrl for better error handling
        await dataLoader.loadFromFile(file);
      } catch (error) {
        console.error('❌ Failed to load data from file:', error);
        console.log('💡 Make sure data.parquetbundle exists in the public directory');
        console.log(
          '🎯 Alternative: You can drag and drop the data.parquetbundle file onto the data loader component',
        );

        // Show user-friendly error message with instructions
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Auto-load failed: ${errorMessage}`);
        console.log(
          '📋 The data loader is ready for drag-and-drop. Simply drag the data.parquetbundle file onto the component.',
        );
      }
    };

    // Initialize control bar - auto-sync handles most initialization
    // The control bar will automatically sync with the scatterplot

    // Initialize legend - now with auto-sync enabled
    setTimeout(() => {
      legendElement.autoSync = true;
      legendElement.autoHide = true; // Automatically hide values in scatterplot
    }, 100);

    // Update legend function - force sync even with auto-sync enabled
    const updateLegend = () => {
      const currentAnnotation = plotElement.selectedAnnotation;
      const currentData = plotElement.getCurrentData();
      if (currentAnnotation && currentData && currentData.annotations[currentAnnotation]) {
        // Force legend sync using the public interface
        if (legendElement.autoSync && 'forceSync' in legendElement) {
          legendElement.forceSync();
        } else if (!legendElement.autoSync) {
          // Manual update for non-auto-sync mode
          legendElement.data = { annotations: currentData.annotations };
          legendElement.selectedAnnotation = currentAnnotation;

          // Extract annotation values for current data
          const annotationValues = currentData.protein_ids.flatMap((_, index) => {
            const annotationIdxArray = currentData.annotation_data[currentAnnotation][index];

            return annotationIdxArray.map((annotationIdx) => {
              return currentData.annotations[currentAnnotation].values[annotationIdx];
            });
          });

          legendElement.annotationValues = annotationValues;
          legendElement.proteinIds = currentData.protein_ids;
        }
      }
    };

    // Update selected protein display
    const updateSelectedProteinDisplay = (proteinId: string | null) => {
      if (!selectedProteinElement) {
        return;
      }
      if (proteinId) {
        selectedProteinElement.textContent = `Selected: ${proteinId}`;
        selectedProteinElement.style.color = '#3b82f6';
      } else {
        selectedProteinElement.textContent = 'No protein selected';
        selectedProteinElement.style.color = '#6b7280';
      }
    };

    // Link structure viewer to scatterplot and control bar selections
    const handleSelectionChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { proteinIds } = customEvent.detail;

      selectedProteins = Array.isArray(proteinIds) ? [...proteinIds] : [];

      if (selectedProteins.length > 0) {
        // Load the most recently selected protein into the viewer
        const lastSelected = selectedProteins[selectedProteins.length - 1];
        structureViewer.loadProtein(lastSelected);
        updateSelectedProteinDisplay(`${selectedProteins.length} proteins selected`);
      } else {
        updateSelectedProteinDisplay(null);
      }
    };

    // The control bar is now the single source of truth for selection events.
    controlBar.addEventListener('protein-selection-change', handleSelectionChange);

    // Initialize legend
    updateLegend();

    // Handle isolation events from scatterplot
    plotElement.addEventListener('data-isolation', () => {
      // Update legend with filtered data
      updateLegend();
    });

    plotElement.addEventListener('data-isolation-reset', () => {
      // Update legend with full data
      updateLegend();
    });

    // Handle legend item clicks to toggle visibility
    legendElement.addEventListener('legend-item-click', (event: Event) => {
      const customEvent = event as CustomEvent;
      const value = customEvent.detail.value;

      // Legend handles hiding automatically when autoHide=true
      // Just keep track locally for export functionality
      const valueKey = value === null ? 'null' : value;

      if (hiddenValues.includes(valueKey)) {
        hiddenValues = hiddenValues.filter((v) => v !== valueKey);
      } else {
        hiddenValues = [...hiddenValues, valueKey];
      }
    });

    // Handle structure viewer events
    structureViewer.addEventListener('structure-load', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { proteinId, status } = customEvent.detail;

      // Only log loaded events (loading/error states are less interesting for demo)
      if (status === 'loaded') {
        console.log(`✅ Structure loaded: ${proteinId}`);
      }
    });

    structureViewer.addEventListener('structure-close', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { proteinId } = customEvent.detail;
      console.log(`🔒 Structure viewer closed for protein: ${proteinId || 'none'}`);
      console.log('Structure viewer should now be hidden');
      updateSelectedProteinDisplay(null);
    });

    // Control Bar Event Handlers
    // Note: With auto-sync enabled, the control bar now directly manages the scatterplot
    // We keep some event listeners for additional logic that auto-sync doesn't handle

    // Handle annotation change for resetting hidden values
    controlBar.addEventListener('annotation-change', () => {
      hiddenValues = []; // Reset hidden values when switching annotations
      plotElement.hiddenAnnotationValues = hiddenValues;
      updateLegend();
    });

    // Handle selection mode toggle for local state
    controlBar.addEventListener('toggle-selection-mode', () => {
      selectionMode = plotElement.selectionMode; // Sync with scatterplot state
    });

    // Handle data-change from scatterplot to sync selections
    plotElement.addEventListener('data-change', () => {
      // When data changes (e.g. after a split), the selection is often cleared.
      // Sync local selection state with the component state.
      selectedProteins = plotElement.selectedProteinIds || [];
      updateLegend();
    });

    // Handle notification events from control bar
    // This separates business logic from presentation concerns
    controlBar.addEventListener('selection-disabled-notification', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { message, type } = customEvent.detail;

      // Use the notification utility to show the message
      // Applications can replace this with their own notification system
      showNotification(message, {
        type: type || 'warning',
        duration: 3000,
      });
    });

    // Data Loader Event Handlers

    // Handle loading start
    dataLoader.addEventListener('data-loading-start', () => {
      console.log('🚀 Data loading started');
      updateLoadingOverlay(true, 5, 'Analyzing file structure...', 'Starting upload...');
    });

    // Handle loading progress
    dataLoader.addEventListener('data-loading-progress', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { percentage } = customEvent.detail;
      // Map 0-100 from loader to 0-20 of overall process (since loadNewData does the rest)
      // Or maybe 0-50? loadNewData seems to do a lot.
      // Let's say data loading is the first 20%.
      const visualProgress = Math.min(20, Math.max(5, percentage * 0.2));
      updateLoadingOverlay(true, visualProgress, 'Reading protein data...', 'Uploading...');
    });

    // Handle successful data loading
    dataLoader.addEventListener('data-loaded', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { data } = customEvent.detail;

      // Load the new data into all components
      loadNewData(data);
    });

    // Handle data loading errors
    dataLoader.addEventListener('data-error', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { error } = customEvent.detail;
      console.error('❌ Data loading error:', error);

      // You could show a toast notification or error message here
      alert(`Failed to load data: ${error}`);
    });

    // Try to load data from file, but don't fail if it doesn't work
    // The user can still drag and drop the file manually

    const shouldRunPerfSuite = new URLSearchParams(window.location.search).get('webglPerf') === '1';
    if (shouldRunPerfSuite) {
      void maybeRunWebglPerfSuite({ plotElement, dataLoader });
    } else {
      loadDataFromFile();
    }

    // Handle export
    controlBar.addEventListener('export', async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { type, imageWidth, imageHeight, legendWidthPercent, legendFontSizePx } =
        customEvent.detail;

      try {
        const exporter = createExporter(plotElement);

        // Calculate scatterplot dimensions (excluding legend)
        const legendPercent = (legendWidthPercent ?? EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT) / 100;
        const targetWidth = Math.round(
          (imageWidth ?? EXPORT_DEFAULTS.IMAGE_WIDTH) * (1 - legendPercent),
        );
        const targetHeight = imageHeight ?? EXPORT_DEFAULTS.IMAGE_HEIGHT;

        // Export options
        const options = {
          targetWidth,
          targetHeight,
          legendWidthPercent: legendWidthPercent ?? EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT,
          legendScaleFactor:
            (legendFontSizePx ?? EXPORT_DEFAULTS.LEGEND_FONT_SIZE_PX) /
            EXPORT_DEFAULTS.BASE_FONT_SIZE,
          includeSelection: selectedProteins.length > 0,
          backgroundColor: 'white',
        };

        // Execute export
        switch (type) {
          case 'json':
            exporter.exportJSON(options);
            break;
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
        alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    console.log('ProtSpace components loaded and connected!');
    console.log('Data will be loaded from data.parquetbundle file');
    console.log('Use the control bar to change annotations and toggle selection modes!');
  } else {
    console.error('Could not find one or more required elements.');
    console.log('Plot element:', plotElement);
    console.log('Legend element:', legendElement);
    console.log('Structure viewer:', structureViewer);
    console.log('Control bar:', controlBar);
  }
}
