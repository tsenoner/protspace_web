import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
  IMAGES_DIR,
  waitForDataLoad,
  waitForLegend,
  waitForStructureViewer,
  clickProteinPoint,
} from './helpers';

// Ensure output directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
});

/**
 * Wait for the control bar to be fully rendered with all elements styled.
 * This fixes the gray control-bar issue by waiting for shadow DOM elements.
 */
async function waitForControlBar(
  page: import('@playwright/test').Page,
  timeout = 15000,
): Promise<void> {
  await page.waitForSelector('#myControlBar', { timeout });

  // Wait for the control bar shadow DOM to be fully rendered
  await page.waitForFunction(
    () => {
      const controlBar = document.querySelector('#myControlBar') as any;
      if (!controlBar || !controlBar.shadowRoot) return false;

      // Check that key elements exist and are styled
      const controlBarDiv = controlBar.shadowRoot.querySelector('.control-bar');
      const selects = controlBar.shadowRoot.querySelectorAll('select');
      const buttons = controlBar.shadowRoot.querySelectorAll('button');

      if (!controlBarDiv || selects.length < 2 || buttons.length < 3) return false;

      // Check that selects have options (data is loaded)
      const projectionSelect = selects[0] as HTMLSelectElement;
      const featureSelect = selects[1] as HTMLSelectElement;

      return projectionSelect.options.length > 0 && featureSelect.options.length > 0;
    },
    { timeout, polling: 500 },
  );

  // Additional wait for CSS transitions to complete
  await page.waitForTimeout(300);
}

test.describe('Interface Overview Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForDataLoad(page);
    await waitForLegend(page);
    await waitForControlBar(page);
  });

  test('interface-overview.png - Full page layout', async ({ page }) => {
    await page.screenshot({
      path: path.join(IMAGES_DIR, 'interface-overview.png'),
      fullPage: false,
    });
    console.log('📸 Captured: interface-overview.png');
  });

  test('scatterplot-example.png - Scatterplot with colored proteins', async ({ page }) => {
    const plot = page.locator('#myPlot');
    await plot.screenshot({
      path: path.join(IMAGES_DIR, 'scatterplot-example.png'),
    });
    console.log('📸 Captured: scatterplot-example.png');
  });

  test('legend-panel.png - Legend with categories', async ({ page }) => {
    const legend = page.locator('#myLegend');
    await legend.screenshot({
      path: path.join(IMAGES_DIR, 'legend-panel.png'),
    });
    console.log('📸 Captured: legend-panel.png');
  });

  test('structure-viewer.png - 3D structure viewer', async ({ page }) => {
    // Click on a protein to load it in the structure viewer
    await clickProteinPoint(page);

    // Wait for the structure viewer to load and WebGL to be ready
    await waitForStructureViewer(page, 30000);

    // Additional wait to ensure structure is fully rendered
    await page.waitForTimeout(2000);

    // Capture the structure viewer element
    // Since it's in a shadow DOM, we'll use captureShadowElement or get bounding box
    const viewer = page.locator('#myStructureViewer');
    const box = await viewer.boundingBox();

    if (box) {
      // Capture with some padding
      await page.screenshot({
        path: path.join(IMAGES_DIR, 'structure-viewer.png'),
        clip: {
          x: Math.max(0, box.x - 10),
          y: Math.max(0, box.y - 10),
          width: box.width + 20,
          height: box.height + 20,
        },
      });
    } else {
      // Fallback: try to screenshot the element directly
      await viewer.screenshot({
        path: path.join(IMAGES_DIR, 'structure-viewer.png'),
      });
    }

    console.log('📸 Captured: structure-viewer.png');
  });
});

test.describe('Control Bar Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForDataLoad(page);
    await waitForControlBar(page);
  });

  test('control-bar-annotated.png - Annotated control bar with numbered callouts', async ({
    page,
  }) => {
    // Inject numbered callout annotations
    await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar') as any;
      if (!controlBar?.shadowRoot) return;

      const shadowRoot = controlBar.shadowRoot;

      // Define annotations with their target selectors
      const annotations = [
        { selector: '#projection-select', label: '1', offset: { x: -15, y: -40 } },
        { selector: '#feature-select', label: '2', offset: { x: -15, y: -40 } },
        { selector: '.search-group', label: '3', offset: { x: -15, y: -40 } },
        { selector: 'button:has(.icon)', label: '4', offset: { x: -15, y: -40 }, nth: 0 }, // Select
        { selector: 'button:has(.icon)', label: '5', offset: { x: -15, y: -40 }, nth: 1 }, // Clear
        { selector: 'button:has(.icon)', label: '6', offset: { x: -15, y: -40 }, nth: 2 }, // Isolate
        { selector: '.filter-container', label: '7', offset: { x: -15, y: -40 } },
        {
          selector: '.export-container.right-controls-export',
          label: '8',
          offset: { x: -15, y: -40 },
        },
        { selector: '.right-controls-data', label: '9', offset: { x: -15, y: -40 } },
      ];

      annotations.forEach(({ selector, label, offset, nth }) => {
        let element: Element | null;
        if (nth !== undefined) {
          const elements = shadowRoot.querySelectorAll(selector);
          element = elements[nth] || null;
        } else {
          element = shadowRoot.querySelector(selector);
        }

        if (!element) return;

        const rect = element.getBoundingClientRect();

        // Create callout circle
        const callout = document.createElement('div');
        callout.style.cssText = `
          position: fixed;
          left: ${rect.left + rect.width / 2 + (offset?.x || -15)}px;
          top: ${rect.top + (offset?.y || -40)}px;
          width: 40px;
          height: 40px;
          background: #dc2626;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: bold;
          font-family: system-ui, sans-serif;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: 10000;
        `;
        callout.textContent = label;
        document.body.appendChild(callout);
      });
    });

    await page.waitForTimeout(200);

    // Get control bar bounds plus extra space for annotations above
    const controlBar = page.locator('#myControlBar');
    const box = await controlBar.boundingBox();

    if (box) {
      await page.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-annotated.png'),
        clip: {
          x: Math.max(0, box.x - 10),
          y: Math.max(0, box.y - 35), // Extra space for callouts above
          width: box.width + 20,
          height: box.height + 45,
        },
      });
    } else {
      await controlBar.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-annotated.png'),
      });
    }

    console.log('📸 Captured: control-bar-annotated.png');
  });

  test('control-bar-projection.png - Projection dropdown with options overlay', async ({
    page,
  }) => {
    // Create a custom dropdown overlay since native <select> dropdowns can't be captured
    const projectionOptions = await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar') as any;
      if (!controlBar?.shadowRoot) return { options: [], bounds: null };

      const select = controlBar.shadowRoot.querySelector('#projection-select') as HTMLSelectElement;
      if (!select) return { options: [], bounds: null };

      const options = Array.from(select.options).map((opt) => opt.textContent || opt.value);
      const selectedValue = select.value;
      const bounds = select.getBoundingClientRect();

      // Add visual highlight to the select
      select.style.outline = '2px solid #3b82f6';
      select.style.outlineOffset = '1px';

      // Create overlay dropdown
      const overlay = document.createElement('div');
      overlay.id = 'projection-overlay';
      overlay.style.cssText = `
        position: fixed;
        left: ${bounds.left}px;
        top: ${bounds.bottom + 2}px;
        min-width: ${bounds.width}px;
        background: white;
        border: 1px solid #d9e2ec;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: system-ui, sans-serif;
        font-size: 14px;
      `;

      options.forEach((opt) => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding: 8px 12px;
          cursor: pointer;
          background: ${opt === selectedValue ? '#e0f2fe' : 'white'};
          color: #333;
        `;
        item.textContent = opt;
        overlay.appendChild(item);
      });

      document.body.appendChild(overlay);

      return {
        options,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        overlayBottom: bounds.bottom + 2 + options.length * 32,
      };
    });

    await page.waitForTimeout(200);

    // Capture the area including the overlay
    if (projectionOptions.bounds) {
      const bounds = projectionOptions.bounds;
      await page.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-projection.png'),
        clip: {
          x: Math.max(0, bounds.x - 10),
          y: Math.max(0, bounds.y - 10),
          width: bounds.width + 20,
          height: (projectionOptions.overlayBottom || bounds.y + 200) - bounds.y + 20,
        },
      });
    } else {
      const controlBar = page.locator('#myControlBar');
      await controlBar.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-projection.png'),
      });
    }

    console.log('📸 Captured: control-bar-projection.png');
  });

  test('control-bar-colorby.png - Color By dropdown with options overlay', async ({ page }) => {
    // Create a custom dropdown overlay since native <select> dropdowns can't be captured
    const colorByOptions = await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar') as any;
      if (!controlBar?.shadowRoot) return { options: [], bounds: null };

      const select = controlBar.shadowRoot.querySelector('#feature-select') as HTMLSelectElement;
      if (!select) return { options: [], bounds: null };

      const options = Array.from(select.options).map((opt) => opt.textContent || opt.value);
      const selectedValue = select.value;
      const bounds = select.getBoundingClientRect();

      // Add visual highlight to the select
      select.style.outline = '2px solid #3b82f6';
      select.style.outlineOffset = '1px';

      // Create overlay dropdown
      const overlay = document.createElement('div');
      overlay.id = 'colorby-overlay';
      overlay.style.cssText = `
        position: fixed;
        left: ${bounds.left}px;
        top: ${bounds.bottom + 2}px;
        min-width: ${bounds.width}px;
        background: white;
        border: 1px solid #d9e2ec;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: system-ui, sans-serif;
        font-size: 14px;
      `;

      options.forEach((opt) => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding: 8px 12px;
          cursor: pointer;
          background: ${opt === selectedValue ? '#e0f2fe' : 'white'};
          color: #333;
        `;
        item.textContent = opt;
        overlay.appendChild(item);
      });

      document.body.appendChild(overlay);

      return {
        options,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        overlayBottom: bounds.bottom + 2 + options.length * 32,
      };
    });

    await page.waitForTimeout(200);

    // Capture the area including the overlay
    if (colorByOptions.bounds) {
      const bounds = colorByOptions.bounds;
      await page.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-colorby.png'),
        clip: {
          x: Math.max(0, bounds.x - 10),
          y: Math.max(0, bounds.y - 10),
          width: bounds.width + 20,
          height: (colorByOptions.overlayBottom || bounds.y + 200) - bounds.y + 20,
        },
      });
    } else {
      const controlBar = page.locator('#myControlBar');
      await controlBar.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-colorby.png'),
      });
    }

    console.log('📸 Captured: control-bar-colorby.png');
  });

  test('control-bar-export.png - Export menu', async ({ page }) => {
    // Open export dropdown
    await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar') as any;
      if (!controlBar?.shadowRoot) return;

      // Find and click the export button
      const exportContainer = controlBar.shadowRoot.querySelector(
        '.export-container.right-controls-export',
      );
      const exportButton = exportContainer?.querySelector('button');
      if (exportButton) {
        exportButton.click();
      }
    });

    await page.waitForTimeout(500);

    // Calculate clip region for export button and dropdown
    const clipRegion = await page.evaluate(() => {
      const controlBar = document.querySelector('#myControlBar') as any;
      if (!controlBar?.shadowRoot) return null;

      const exportContainer = controlBar.shadowRoot.querySelector(
        '.export-container.right-controls-export',
      );
      const exportMenu = controlBar.shadowRoot.querySelector('.export-menu');

      if (!exportContainer) return null;

      const containerBounds = exportContainer.getBoundingClientRect();
      const exportMenuBounds = exportMenu?.getBoundingClientRect();

      if (!exportMenuBounds) {
        return {
          x: Math.max(0, containerBounds.left - 10),
          y: Math.max(0, containerBounds.top - 10),
          width: containerBounds.width + 20,
          height: containerBounds.height + 20,
        };
      }

      // Calculate region that encompasses both the export button and dropdown
      const minX = Math.min(containerBounds.left, exportMenuBounds.left);
      const minY = Math.min(containerBounds.top, exportMenuBounds.top);
      const maxX = Math.max(containerBounds.right, exportMenuBounds.right);
      const maxY = Math.max(containerBounds.bottom, exportMenuBounds.bottom);

      return {
        x: Math.max(0, minX - 10),
        y: Math.max(0, minY - 10),
        width: maxX - minX + 20,
        height: maxY - minY + 20,
      };
    });

    if (clipRegion) {
      await page.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-export.png'),
        clip: clipRegion,
      });
    } else {
      const controlBar = page.locator('#myControlBar');
      await controlBar.screenshot({
        path: path.join(IMAGES_DIR, 'control-bar-export.png'),
      });
    }

    console.log('📸 Captured: control-bar-export.png');
  });
});
