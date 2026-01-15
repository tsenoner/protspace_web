import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
  TEMP_VIDEOS_DIR,
  waitForDataLoad,
  waitForLegend,
  toggleLegendItem,
  doubleClickLegendItem,
  enableSelectionMode,
  initVisualIndicators,
  showClickIndicator,
  showKeyboardIndicator,
  hideKeyboardIndicator,
  clickClearButton,
  getClearButtonCoords,
  clickIsolateButton,
  clickResetButton,
  trackedMouseMove,
  trackedMouseClick,
  trackedMouseDown,
  trackedMouseUp,
  trackedMouseWheel,
  trackedKeyboardDown,
  trackedKeyboardUp,
  trackedKeyboardPress,
  logAction,
  printActionSummary,
} from './helpers';

// Shared constants for animation timing
// Initial pause after data loads to show the initial state before animation starts
// This time will be trimmed from the final GIF to remove loading screen
const INITIAL_PAUSE = 2000; // 2 seconds

// Ensure temp videos directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(TEMP_VIDEOS_DIR)) {
    fs.mkdirSync(TEMP_VIDEOS_DIR, { recursive: true });
  }
});

// After each test, copy the video to our temp directory with a proper name
test.afterEach(async ({ page }, testInfo) => {
  // Print action summary before closing
  printActionSummary();

  // Get the video from the test
  const video = page.video();
  if (video) {
    // Create a sanitized filename from the test title
    const sanitizedName = testInfo.title
      .replace(/\.gif.*$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase();

    const destPath = path.join(TEMP_VIDEOS_DIR, `${sanitizedName}.webm`);

    // Close the page first to finalize the video recording
    await page.close();

    // Now saveAs() will work because the video is finalized
    await video.saveAs(destPath);
    console.log(`🎬 Video saved: ${destPath}`);
  }
});

test.describe('Zoom Animation', () => {
  const ZOOM_STEPS = 20;
  const ZOOM_DELTA = 50;
  const STEP_DELAY = 50;
  const PAUSE_DURATION = 1000;

  /**
   * Perform a smooth zoom animation with multiple wheel steps.
   */
  async function performZoomAnimation(
    page: any,
    deltaY: number,
    steps: number,
    stepDelay: number,
  ): Promise<void> {
    const direction = deltaY < 0 ? 'Zoom In' : 'Zoom Out';
    await logAction(
      page,
      'mouse',
      'Zoom Animation',
      `${direction} (${steps} steps, ${deltaY} delta)`,
    );
    for (let i = 0; i < steps; i++) {
      await trackedMouseWheel(page, 0, deltaY);
      await page.waitForTimeout(stepDelay);
    }
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForDataLoad(page);
    await waitForLegend(page);
  });

  test('zoom.gif - Zooming and panning animation', async ({ page }) => {
    const plot = page.locator('#myPlot');
    const box = await plot.boundingBox();
    if (!box) throw new Error('Could not get plot bounding box');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Initialize visual indicators and action logging
    await initVisualIndicators(page);

    // Move to center and wait before starting zoom
    await trackedMouseMove(page, centerX, centerY, { steps: 15 });
    await page.waitForTimeout(INITIAL_PAUSE);

    // Show wheel indicator at center before zooming in
    await showClickIndicator(page, centerX, centerY);
    await page.waitForTimeout(200);
    // Zoom in smoothly
    await performZoomAnimation(page, -ZOOM_DELTA, ZOOM_STEPS, STEP_DELAY);
    await page.waitForTimeout(PAUSE_DURATION);

    // Show wheel indicator at center before zooming out
    await showClickIndicator(page, centerX, centerY);
    await page.waitForTimeout(200);
    // Zoom out smoothly
    await performZoomAnimation(page, ZOOM_DELTA, ZOOM_STEPS, STEP_DELAY);
    await page.waitForTimeout(PAUSE_DURATION);
  });
});

test.describe('Scatterplot Animation Captures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForDataLoad(page);
    await waitForLegend(page);
  });

  test('select-single.gif - Clicking to select a protein', async ({ page }) => {
    const plot = page.locator('#myPlot');
    const box = await plot.boundingBox();
    if (!box) throw new Error('Could not get plot bounding box');

    // Initialize visual indicators for clicks and key presses
    await initVisualIndicators(page);

    // Wait to show initial state (will be trimmed from GIF)
    await page.waitForTimeout(INITIAL_PAUSE);

    // Determine modifier key based on platform (Meta for Mac, Control for Windows/Linux)
    const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control';

    // Get screen coordinates of visible protein points
    const pointCoords = await page.evaluate((plotBox) => {
      const plot = document.querySelector('#myPlot') as any;
      if (!plot?._plotData?.length || !plot._scales) return null;

      const plotData = plot._plotData;
      const scales = plot._scales;
      const transform = plot._transform || { x: 0, y: 0, k: 1 };

      // Get the plot element's bounding box
      const plotElement = plot.getBoundingClientRect();

      // Get points that are likely visible (near center of data range)
      const visiblePoints: Array<{ screenX: number; screenY: number; id: string }> = [];

      // Sample 5 points from different parts of the plot
      const sampleIndices = [
        Math.floor(plotData.length * 0.15),
        Math.floor(plotData.length * 0.31),
        Math.floor(plotData.length * 0.5),
        Math.floor(plotData.length * 0.75),
        Math.floor(plotData.length * 0.85),
      ];

      for (const idx of sampleIndices) {
        if (idx < plotData.length) {
          const point = plotData[idx];
          if (point && scales) {
            // Calculate screen coordinates (scales return coordinates relative to plot)
            const plotX = scales.x(point.x);
            const plotY = scales.y(point.y);

            // Apply transform
            const transformedX = plotX * transform.k + transform.x;
            const transformedY = plotY * transform.k + transform.y;

            // Convert to absolute screen coordinates
            const screenX = plotElement.left + transformedX;
            const screenY = plotElement.top + transformedY;

            // Check if within plot bounds (with some margin)
            if (
              transformedX >= -50 &&
              transformedX <= plotElement.width + 50 &&
              transformedY >= -50 &&
              transformedY <= plotElement.height + 50
            ) {
              visiblePoints.push({
                screenX,
                screenY,
                id: point.id,
              });
            }
          }
        }
      }

      return visiblePoints.length > 0 ? visiblePoints : null;
    });

    if (!pointCoords || pointCoords.length < 5) {
      // Fallback: click on center area
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await logAction(
        page,
        'mouse',
        'Click (Fallback)',
        `Click center at (${Math.round(centerX)}, ${Math.round(centerY)})`,
      );
      await trackedMouseClick(page, centerX, centerY);
      await page.waitForTimeout(1500);
      return;
    }

    // Click sequence: 5 points with specific pattern
    // 1. Click first point
    const point1 = pointCoords[0];
    await trackedMouseMove(page, point1.screenX, point1.screenY, { steps: 15 });
    await page.waitForTimeout(400);
    await showClickIndicator(page, point1.screenX, point1.screenY);
    await trackedMouseClick(page, point1.screenX, point1.screenY);
    await page.waitForTimeout(1500);

    // 2. Click second point
    const point2 = pointCoords[1];
    await trackedMouseMove(page, point2.screenX, point2.screenY, { steps: 15 });
    await page.waitForTimeout(400);
    await showClickIndicator(page, point2.screenX, point2.screenY);
    await trackedMouseClick(page, point2.screenX, point2.screenY);
    await page.waitForTimeout(1500);

    // 3. Click second point again (to deselect it)
    await showClickIndicator(page, point2.screenX, point2.screenY);
    await trackedMouseClick(page, point2.screenX, point2.screenY);
    await page.waitForTimeout(1500);

    // 4. Click third point
    const point3 = pointCoords[2];
    await trackedMouseMove(page, point3.screenX, point3.screenY, { steps: 15 });
    await page.waitForTimeout(400);
    await showClickIndicator(page, point3.screenX, point3.screenY);
    await trackedMouseClick(page, point3.screenX, point3.screenY);
    await page.waitForTimeout(1500);

    // 5. Hold Command/Ctrl and click fourth point
    const point4 = pointCoords[3];
    await trackedKeyboardDown(page, modifierKey);
    await showKeyboardIndicator(page, modifierKey);
    await page.waitForTimeout(300); // Show indicator before moving
    await trackedMouseMove(page, point4.screenX, point4.screenY, { steps: 15 });
    await page.waitForTimeout(400);
    await showClickIndicator(page, point4.screenX, point4.screenY, { modifier: modifierKey });
    await trackedMouseClick(page, point4.screenX, point4.screenY);
    await page.waitForTimeout(800); // Keep indicator visible after click
    await trackedKeyboardUp(page, modifierKey);

    // 6. Hold Command/Ctrl and click fifth point
    const point5 = pointCoords[4];
    await trackedKeyboardDown(page, modifierKey);
    await showKeyboardIndicator(page, modifierKey);
    await page.waitForTimeout(300); // Show indicator before moving
    await trackedMouseMove(page, point5.screenX, point5.screenY, { steps: 15 });
    await page.waitForTimeout(400);
    await showClickIndicator(page, point5.screenX, point5.screenY, { modifier: modifierKey });
    await trackedMouseClick(page, point5.screenX, point5.screenY);
    await page.waitForTimeout(800); // Keep indicator visible after click
    await trackedKeyboardUp(page, modifierKey);
    await hideKeyboardIndicator(page);
    await page.waitForTimeout(1000);

    // 7. Click the clear button to clear all selections
    const clearButtonCoords = await getClearButtonCoords(page);
    if (clearButtonCoords) {
      await trackedMouseMove(page, clearButtonCoords.x, clearButtonCoords.y, { steps: 15 });
      await page.waitForTimeout(400);
      await showClickIndicator(page, clearButtonCoords.x, clearButtonCoords.y);
      await trackedMouseClick(page, clearButtonCoords.x, clearButtonCoords.y);
      await page.waitForTimeout(1500);
    } else {
      // Fallback: use the helper function
      await logAction(page, 'mouse', 'Click Clear Button', 'Clear all selections');
      await clickClearButton(page);
      await page.waitForTimeout(1500);
    }

    // Final pause to show the result
    await page.waitForTimeout(500);
  });

  test('select-box.gif - Box selection animation', async ({ page }) => {
    // Initialize visual indicators and action logging
    await initVisualIndicators(page);

    // Wait to show initial state (will be trimmed from GIF)
    await page.waitForTimeout(INITIAL_PAUSE);

    // Enable selection mode first - get button coordinates for visual indicator
    const selectButtonCoords = await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar');
      if (!controlBar || !controlBar.shadowRoot) return null;
      const selectButton = controlBar.shadowRoot.querySelector(
        '[data-select-button], .select-button, button[title*="Select"]',
      ) as HTMLElement;
      if (!selectButton) return null;
      const rect = selectButton.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (selectButtonCoords) {
      await trackedMouseMove(page, selectButtonCoords.x, selectButtonCoords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, selectButtonCoords.x, selectButtonCoords.y);
    }
    await enableSelectionMode(page);
    await page.waitForTimeout(500);

    const plot = page.locator('#myPlot');
    const box = await plot.boundingBox();
    if (!box) throw new Error('Could not get plot bounding box');

    // Perform box selection
    const startX = box.x + box.width * 0.3;
    const startY = box.y + box.height * 0.3;
    const endX = box.x + box.width * 0.7;
    const endY = box.y + box.height * 0.7;

    await logAction(
      page,
      'mouse',
      'Box Selection',
      `Drag from (${Math.round(startX)}, ${Math.round(startY)}) to (${Math.round(endX)}, ${Math.round(endY)})`,
    );
    await trackedMouseMove(page, startX, startY, { steps: 15 });
    await page.waitForTimeout(300);
    await showClickIndicator(page, startX, startY);
    await trackedMouseDown(page);
    await trackedMouseMove(page, endX, endY, { steps: 30 });
    await page.waitForTimeout(200);
    await trackedMouseUp(page);

    // Show the selection result
    await page.waitForTimeout(1000);

    // Click the isolate button - get coordinates for visual indicator
    const isolateButtonCoords = await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar');
      if (!controlBar || !controlBar.shadowRoot) return null;
      const isolateButton = controlBar.shadowRoot.querySelector(
        '.right-controls-split, button[title*="Isolate selected proteins"]',
      ) as HTMLElement;
      if (!isolateButton) return null;
      const rect = isolateButton.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (isolateButtonCoords) {
      await trackedMouseMove(page, isolateButtonCoords.x, isolateButtonCoords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, isolateButtonCoords.x, isolateButtonCoords.y);
    }
    await clickIsolateButton(page);
    await page.waitForTimeout(1000);

    // Click the reset button - get coordinates for visual indicator
    const resetButtonCoords = await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar');
      if (!controlBar || !controlBar.shadowRoot) return null;
      const resetButton = controlBar.shadowRoot.querySelector(
        'button[title*="Reset to original dataset"]',
      ) as HTMLElement;
      if (!resetButton) return null;
      const rect = resetButton.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (resetButtonCoords) {
      await trackedMouseMove(page, resetButtonCoords.x, resetButtonCoords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, resetButtonCoords.x, resetButtonCoords.y);
    }
    await clickResetButton(page);
    await page.waitForTimeout(1000);
  });
});

test.describe('Legend Animation Captures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForDataLoad(page);
    await waitForLegend(page);
  });

  test('legend-toggle.gif - Toggling category visibility', async ({ page }) => {
    // Initialize visual indicators and action logging
    await initVisualIndicators(page);

    // Wait to show initial state (will be trimmed from GIF)
    await page.waitForTimeout(INITIAL_PAUSE);

    // Helper function to get coordinates of a legend item by index
    const getLegendItemCoords = async (index: number) => {
      return await page.evaluate((idx) => {
        const legend = document.querySelector('#myLegend');
        if (!legend || !legend.shadowRoot) return null;
        const items = legend.shadowRoot.querySelectorAll('.legend-item');
        if (items[idx]) {
          const rect = (items[idx] as HTMLElement).getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return null;
      }, index);
    };

    // 1. Click first legend item (hides it)
    const item0Coords = await getLegendItemCoords(0);
    if (item0Coords) {
      await trackedMouseMove(page, item0Coords.x, item0Coords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, item0Coords.x, item0Coords.y);
    }
    await toggleLegendItem(page, 0);
    await page.waitForTimeout(800);

    // 2. Click second legend item (hides it)
    const item1Coords = await getLegendItemCoords(1);
    if (item1Coords) {
      await trackedMouseMove(page, item1Coords.x, item1Coords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, item1Coords.x, item1Coords.y);
    }
    await toggleLegendItem(page, 1);
    await page.waitForTimeout(800);

    // 3. Click third legend item (hides it)
    const item2Coords = await getLegendItemCoords(2);
    if (item2Coords) {
      await trackedMouseMove(page, item2Coords.x, item2Coords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, item2Coords.x, item2Coords.y);
    }
    await toggleLegendItem(page, 2);
    await page.waitForTimeout(800);

    // 4. Click second legend item again (shows it again)
    const item1CoordsAfter = await getLegendItemCoords(1);
    if (item1CoordsAfter) {
      await trackedMouseMove(page, item1CoordsAfter.x, item1CoordsAfter.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, item1CoordsAfter.x, item1CoordsAfter.y);
    }
    await toggleLegendItem(page, 1);
    await page.waitForTimeout(800);

    // 5. Double-click third legend item (shows only that category)
    const item2CoordsAfter = await getLegendItemCoords(2);
    if (item2CoordsAfter) {
      await trackedMouseMove(page, item2CoordsAfter.x, item2CoordsAfter.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, item2CoordsAfter.x, item2CoordsAfter.y);
      await page.waitForTimeout(100);
      await showClickIndicator(page, item2CoordsAfter.x, item2CoordsAfter.y);
    }
    await doubleClickLegendItem(page, 2);
    await page.waitForTimeout(1000);

    // 6. Click third legend item again (shows all labels again - when only one remains)
    // After double-click isolation, the third item should be the only visible one
    const finalItemCoords = await getLegendItemCoords(2);
    if (finalItemCoords) {
      await trackedMouseMove(page, finalItemCoords.x, finalItemCoords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, finalItemCoords.x, finalItemCoords.y);
    }
    await toggleLegendItem(page, 2);
    await page.waitForTimeout(1000);
  });

  test('legend-reorder.gif - Dragging to reorder labels', async ({ page }) => {
    // Initialize visual indicators and action logging
    await initVisualIndicators(page);

    // Wait to show initial state (will be trimmed from GIF)
    await page.waitForTimeout(INITIAL_PAUSE);

    // Get coordinates of legend items dynamically
    const getLegendItemCoords = async (index: number) => {
      return await page.evaluate((idx) => {
        const legend = document.querySelector('#myLegend');
        if (!legend || !legend.shadowRoot) return null;
        const items = legend.shadowRoot.querySelectorAll('.legend-item');
        if (items[idx]) {
          const rect = (items[idx] as HTMLElement).getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return null;
      }, index);
    };

    // Get initial coordinates
    const firstItemCoords = await getLegendItemCoords(0);
    const secondItemCoords = await getLegendItemCoords(1);
    const thirdItemCoords = await getLegendItemCoords(2);

    if (!firstItemCoords || !secondItemCoords || !thirdItemCoords) {
      throw new Error('Could not get legend item coordinates');
    }

    // Calculate target position: between second and third item
    const targetX = secondItemCoords.x;
    const targetY = secondItemCoords.y + (thirdItemCoords.y - secondItemCoords.y) / 2;

    // Move to first item
    await trackedMouseMove(page, firstItemCoords.x, firstItemCoords.y, { steps: 15 });
    await page.waitForTimeout(300);

    // Show click indicator to indicate we're starting the drag
    await showClickIndicator(page, firstItemCoords.x, firstItemCoords.y);
    await page.waitForTimeout(200);

    // Perform drag: trigger dragstart, then drag to target, then drop
    await logAction(page, 'mouse', 'Drag Legend Item', 'Drag first item to third position');

    // Trigger dragstart event manually
    await page.evaluate(() => {
      const legend = document.querySelector('#myLegend');
      if (!legend || !legend.shadowRoot) return;
      const items = legend.shadowRoot.querySelectorAll('.legend-item');
      if (items[0]) {
        const dragStartEvent = new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        });
        items[0].dispatchEvent(dragStartEvent);
      }
    });

    // Mouse down and move to start the drag
    await page.mouse.move(firstItemCoords.x, firstItemCoords.y);
    await trackedMouseDown(page);
    await page.waitForTimeout(300);

    // Move to target position with smooth animation
    // During the move, trigger dragover events on the target item
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const currentX = firstItemCoords.x + (targetX - firstItemCoords.x) * (i / steps);
      const currentY = firstItemCoords.y + (targetY - firstItemCoords.y) * (i / steps);
      await page.mouse.move(currentX, currentY);

      // Trigger dragover on the item we're hovering over
      if (i > steps / 2) {
        // We're closer to the target, trigger dragover on second item
        await page.evaluate(() => {
          const legend = document.querySelector('#myLegend');
          if (!legend || !legend.shadowRoot) return;
          const items = legend.shadowRoot.querySelectorAll('.legend-item');
          if (items[1]) {
            const dragOverEvent = new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              dataTransfer: new DataTransfer(),
            });
            dragOverEvent.preventDefault();
            items[1].dispatchEvent(dragOverEvent);
          }
        });
      }
      await page.waitForTimeout(10);
    }

    await page.waitForTimeout(1000);

    // Trigger drop event on the target item
    await page.evaluate(() => {
      const legend = document.querySelector('#myLegend');
      if (!legend || !legend.shadowRoot) return;
      const items = legend.shadowRoot.querySelectorAll('.legend-item');
      if (items[1]) {
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        });
        dropEvent.preventDefault();
        items[1].dispatchEvent(dropEvent);
      }
    });

    // Mouse up to complete
    await trackedMouseUp(page);

    // Trigger dragend
    await page.evaluate(() => {
      const legend = document.querySelector('#myLegend');
      if (!legend || !legend.shadowRoot) return;
      const items = legend.shadowRoot.querySelectorAll('.legend-item');
      if (items[0]) {
        const dragEndEvent = new DragEvent('dragend', {
          bubbles: true,
          cancelable: true,
        });
        items[0].dispatchEvent(dragEndEvent);
      }
    });

    // Show final result
    await page.waitForTimeout(2000);
  });

  test('legend-others.gif - Expanding and collapsing Others group', async ({ page }) => {
    // Initialize visual indicators and action logging
    await initVisualIndicators(page);

    // Step 1: Switch to "genus" annotation to show the Others category
    // This happens before INITIAL_PAUSE so it gets trimmed from the GIF
    const colorBySelectCoords = await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar');
      if (!controlBar || !controlBar.shadowRoot) return null;
      const select = controlBar.shadowRoot.querySelector('#annotation-select') as HTMLElement;
      if (!select) return null;
      const rect = select.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (colorBySelectCoords) {
      await trackedMouseMove(page, colorBySelectCoords.x, colorBySelectCoords.y, { steps: 15 });
      await page.waitForTimeout(300);
    }

    await logAction(page, 'mouse', 'Change Color By', 'Switch to genus annotation');
    await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar');
      if (!controlBar || !controlBar.shadowRoot) return;
      const select = controlBar.shadowRoot.querySelector('#annotation-select') as HTMLSelectElement;
      if (select) {
        // Find and select "genus" option
        const options = Array.from(select.options);
        const genusOption = options.find((opt) => opt.value.toLowerCase().includes('genus'));
        if (genusOption) {
          select.value = genusOption.value;
          // Trigger change event
          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
          select.dispatchEvent(changeEvent);
        }
      }
    });

    // Wait for legend to update with new annotation
    await waitForLegend(page);
    await page.waitForTimeout(500);

    // Wait to show initial state (will be trimmed from GIF) - now after switching to genus
    await page.waitForTimeout(INITIAL_PAUSE);

    // Step 2: Click "(view)" button in the "Other" category
    const viewButtonCoords = await page.evaluate(() => {
      const legend = document.querySelector('#myLegend');
      if (!legend || !legend.shadowRoot) return null;
      const items = legend.shadowRoot.querySelectorAll('.legend-item');
      // Find the "Other" item
      for (const item of items) {
        const textElement = item.querySelector('.legend-text');
        if (textElement && textElement.textContent?.trim() === 'Other') {
          const viewButton = item.querySelector('.view-button') as HTMLElement;
          if (viewButton) {
            const rect = viewButton.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
        }
      }
      return null;
    });

    if (viewButtonCoords) {
      await trackedMouseMove(page, viewButtonCoords.x, viewButtonCoords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, viewButtonCoords.x, viewButtonCoords.y);
    }
    await logAction(page, 'mouse', 'Click View Button', 'Open Others dialog');
    await page.evaluate(() => {
      const legend = document.querySelector('#myLegend');
      if (!legend || !legend.shadowRoot) return;
      const items = legend.shadowRoot.querySelectorAll('.legend-item');
      // Find the "Other" item and click its view button
      for (const item of items) {
        const textElement = item.querySelector('.legend-text');
        if (textElement && textElement.textContent?.trim() === 'Other') {
          const viewButton = item.querySelector('.view-button') as HTMLElement;
          if (viewButton) {
            viewButton.click();
            return;
          }
        }
      }
    });

    // Wait for modal to appear
    await page.waitForTimeout(800);

    // Step 3: Find and click "Extract" button next to "Olivierus"
    const extractButtonCoords = await page.evaluate(() => {
      const legend = document.querySelector('#myLegend');
      if (!legend || !legend.shadowRoot) return null;
      const modal = legend.shadowRoot.querySelector('.modal-content');
      if (!modal) return null;
      const otherItems = modal.querySelectorAll('.other-item');
      // Find the item with "Olivierus"
      for (const item of otherItems) {
        const nameElement = item.querySelector('.other-item-name');
        if (nameElement && nameElement.textContent?.includes('Olivierus')) {
          const extractButton = item.querySelector('.extract-button') as HTMLElement;
          if (extractButton) {
            const rect = extractButton.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
        }
      }
      return null;
    });

    if (extractButtonCoords) {
      await trackedMouseMove(page, extractButtonCoords.x, extractButtonCoords.y, { steps: 15 });
      await page.waitForTimeout(300);
      await showClickIndicator(page, extractButtonCoords.x, extractButtonCoords.y);
    }
    await logAction(page, 'mouse', 'Click Extract Button', 'Extract Olivierus');
    await page.evaluate(() => {
      const legend = document.querySelector('#myLegend');
      if (!legend || !legend.shadowRoot) return;
      const modal = legend.shadowRoot.querySelector('.modal-content');
      if (!modal) return;
      const otherItems = modal.querySelectorAll('.other-item');
      // Find and click extract button for "Olivierus"
      for (const item of otherItems) {
        const nameElement = item.querySelector('.other-item-name');
        if (nameElement && nameElement.textContent?.includes('Olivierus')) {
          const extractButton = item.querySelector('.extract-button') as HTMLElement;
          if (extractButton) {
            extractButton.click();
            return;
          }
        }
      }
    });

    // Wait for extraction to complete and modal to close
    await page.waitForTimeout(1500);

    // Show final result
    await page.waitForTimeout(1000);
  });
});
