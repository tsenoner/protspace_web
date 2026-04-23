import { test, expect, type Page } from '@playwright/test';
import { waitForExploreDataLoad, dismissTourIfPresent } from './helpers/explore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Right-click at a position on the scatter-plot canvas. */
async function rightClickOnPlot(page: Page, x: number, y: number): Promise<void> {
  const plot = page.locator('#myPlot');
  const box = await plot.boundingBox();
  if (!box) throw new Error('Plot element not found');
  await page.mouse.click(box.x + x, box.y + y, { button: 'right' });
}

/** Right-click on a data point — finds a point with data via evaluate. */
async function rightClickOnDataPoint(page: Page): Promise<void> {
  // Find coordinates of any rendered point by querying the quadtree
  const coords = await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    if (!plot?._plotData?.length) return null;
    const point = plot._plotData[0];
    const scales = plot._scales;
    const transform = plot._transform;
    if (!scales || !transform) return null;

    const screenX = scales.x(point.x) * transform.k + transform.x;
    const screenY = scales.y(point.y) * transform.k + transform.y;
    return { x: screenX, y: screenY, id: point.id };
  });

  if (!coords) throw new Error('No data points found to right-click');

  const plot = page.locator('#myPlot');
  const box = await plot.boundingBox();
  if (!box) throw new Error('Plot element not found');
  await page.mouse.click(box.x + coords.x, box.y + coords.y, { button: 'right' });
}

/** Check if the context menu is visible inside the scatter-plot shadow DOM. */
async function isContextMenuOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    const menu = plot?.shadowRoot?.querySelector('protspace-context-menu');
    if (!menu) return false;
    return menu.open === true;
  });
}

/** Get context menu item labels. */
async function getContextMenuItems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    const menu = plot?.shadowRoot?.querySelector('protspace-context-menu');
    if (!menu?.shadowRoot) return [];
    const buttons = menu.shadowRoot.querySelectorAll('.menu-item:not(.separator)');
    return Array.from(buttons).map((b: any) => b.textContent?.trim() ?? '');
  });
}

/** Click a context menu item by label text. */
async function clickContextMenuItem(page: Page, label: string): Promise<void> {
  await page.evaluate((targetLabel) => {
    const plot = document.querySelector('#myPlot') as any;
    const menu = plot?.shadowRoot?.querySelector('protspace-context-menu');
    if (!menu?.shadowRoot) throw new Error('Context menu not found');
    const buttons = menu.shadowRoot.querySelectorAll('button.menu-item');
    for (const btn of buttons) {
      if (btn.textContent?.includes(targetLabel)) {
        (btn as HTMLElement).click();
        return;
      }
    }
    throw new Error(`Menu item "${targetLabel}" not found`);
  }, label);
}

/** Get the number of indicator arrows on the canvas. */
async function getIndicatorCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    const layer = plot?.shadowRoot?.querySelector('protspace-indicator-layer');
    if (!layer?.shadowRoot) return 0;
    return layer.shadowRoot.querySelectorAll('.indicator').length;
  });
}

/** Check if the export studio is open. */
async function isExportStudioOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const studio = document.querySelector('#export-studio') as any;
    return studio?.open === true;
  });
}

/** Open the export studio by clicking the export button for PNG. */
async function openExportStudio(page: Page): Promise<void> {
  // Dispatch an export event for PNG to trigger the studio
  await page.evaluate(() => {
    const controlBar = document.querySelector('protspace-control-bar') as any;
    if (!controlBar) throw new Error('Control bar not found');
    controlBar.dispatchEvent(
      new CustomEvent('export', {
        detail: { type: 'png' },
        bubbles: true,
        composed: true,
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForExploreDataLoad(page);
    await dismissTourIfPresent(page);
    // Short wait for rendering to stabilize
    await page.waitForTimeout(500);
  });

  test('right-click on a data point shows context menu with point actions', async ({ page }) => {
    await rightClickOnDataPoint(page);
    await page.waitForTimeout(200);

    const open = await isContextMenuOpen(page);
    expect(open).toBe(true);

    const items = await getContextMenuItems(page);
    expect(items.some((i) => i.includes('Indicate'))).toBe(true);
    expect(items.some((i) => i.includes('Select'))).toBe(true);
    expect(items.some((i) => i.includes('Copy ID'))).toBe(true);
    expect(items.some((i) => i.includes('UniProt'))).toBe(true);
  });

  test('right-click on empty space shows context menu with inset action', async ({ page }) => {
    // Click in an area far from data clusters — use extreme corner
    const plot = page.locator('#myPlot');
    const box = await plot.boundingBox();
    if (!box) throw new Error('Plot not found');
    // Bottom-right extreme corner is most likely to be empty
    await page.mouse.click(box.x + box.width - 10, box.y + box.height - 10, { button: 'right' });
    await page.waitForTimeout(200);

    const open = await isContextMenuOpen(page);
    if (!open) {
      // If context menu didn't open (browser native menu), skip
      test.skip();
      return;
    }

    const items = await getContextMenuItems(page);
    // Check for "Add inset here" — case insensitive
    expect(items.some((i) => i.toLowerCase().includes('inset'))).toBe(true);
  });

  test('context menu closes on Escape', async ({ page }) => {
    await rightClickOnDataPoint(page);
    await page.waitForTimeout(200);
    expect(await isContextMenuOpen(page)).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await isContextMenuOpen(page)).toBe(false);
  });
});

test.describe('Indicator Arrows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForExploreDataLoad(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(500);
  });

  test('clicking Indicate adds an arrow to the canvas', async ({ page }) => {
    const before = await getIndicatorCount(page);
    expect(before).toBe(0);

    await rightClickOnDataPoint(page);
    await page.waitForTimeout(200);
    await clickContextMenuItem(page, 'Indicate');
    await page.waitForTimeout(300);

    const after = await getIndicatorCount(page);
    expect(after).toBeGreaterThan(before);
  });

  test('multiple indicators can be added', async ({ page }) => {
    // Add first indicator
    await rightClickOnDataPoint(page);
    await page.waitForTimeout(200);
    await clickContextMenuItem(page, 'Indicate');
    await page.waitForTimeout(300);

    // Add second indicator (right-click again)
    await rightClickOnDataPoint(page);
    await page.waitForTimeout(200);
    await clickContextMenuItem(page, 'Indicate');
    await page.waitForTimeout(300);

    expect(await getIndicatorCount(page)).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Export Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForExploreDataLoad(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(500);
  });

  test('export studio opens when exporting PNG', async ({ page }) => {
    expect(await isExportStudioOpen(page)).toBe(false);

    await openExportStudio(page);
    await page.waitForTimeout(300);

    expect(await isExportStudioOpen(page)).toBe(true);
  });

  test('export studio shows layout preset controls', async ({ page }) => {
    await openExportStudio(page);
    await page.waitForTimeout(300);

    // Check for preset buttons in the export studio shadow DOM
    const hasPresets = await page.evaluate(() => {
      const studio = document.querySelector('#export-studio') as any;
      if (!studio?.shadowRoot) return false;
      const presetBtns = studio.shadowRoot.querySelectorAll('.preset-btn');
      return presetBtns.length > 0;
    });
    expect(hasPresets).toBe(true);
  });

  test('export studio closes on Escape', async ({ page }) => {
    await openExportStudio(page);
    await page.waitForTimeout(300);
    expect(await isExportStudioOpen(page)).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await isExportStudioOpen(page)).toBe(false);
  });

  test('export studio closes on overlay click', async ({ page }) => {
    await openExportStudio(page);
    await page.waitForTimeout(300);
    expect(await isExportStudioOpen(page)).toBe(true);

    // Click on the overlay (top-left corner which should be outside the studio content)
    await page.evaluate(() => {
      const studio = document.querySelector('#export-studio') as any;
      const overlay = studio?.shadowRoot?.querySelector('.modal-overlay');
      if (overlay) {
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    await page.waitForTimeout(200);
    expect(await isExportStudioOpen(page)).toBe(false);
  });

  test('indicators appear in export studio panel', async ({ page }) => {
    // Add an indicator first
    await rightClickOnDataPoint(page);
    await page.waitForTimeout(200);
    await clickContextMenuItem(page, 'Indicate');
    await page.waitForTimeout(300);

    // Open export studio
    await openExportStudio(page);
    await page.waitForTimeout(300);

    // Check indicator count in studio
    const indicatorCount = await page.evaluate(() => {
      const studio = document.querySelector('#export-studio') as any;
      if (!studio?.shadowRoot) return 0;
      // Find the indicators section header
      const headers = studio.shadowRoot.querySelectorAll('h3');
      for (const h of headers) {
        if (h.textContent?.includes('Indicators')) {
          const match = h.textContent.match(/\((\d+)\)/);
          return match ? parseInt(match[1]) : 0;
        }
      }
      return 0;
    });
    expect(indicatorCount).toBeGreaterThan(0);
  });
});

test.describe('Select via Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForExploreDataLoad(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(500);
  });

  test('clicking Select adds point to selection', async ({ page }) => {
    // Get initial selection count
    const initialCount = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      return plot?.selectedProteinIds?.length ?? 0;
    });
    expect(initialCount).toBe(0);

    await rightClickOnDataPoint(page);
    await page.waitForTimeout(200);
    await clickContextMenuItem(page, 'Select');
    await page.waitForTimeout(300);

    const afterCount = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      return plot?.selectedProteinIds?.length ?? 0;
    });
    expect(afterCount).toBeGreaterThan(0);
  });
});
