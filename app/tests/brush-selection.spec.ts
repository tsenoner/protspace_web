import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForDataLoad(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForSelector('#myPlot', { timeout });

  await page.waitForFunction(
    () => {
      const plot = document.querySelector('#myPlot') as any;
      return plot?.data?.protein_ids?.length > 0;
    },
    { timeout, polling: 1000 },
  );

  // Let rendering and WebGL settle
  await page.waitForTimeout(1500);
}

async function dismissTourIfPresent(page: Page): Promise<void> {
  const skipBtn = page.locator('.driver-tour-skip-btn');
  if ((await skipBtn.count()) > 0) {
    await skipBtn.click();
    await page.waitForSelector('.driver-popover', { state: 'detached', timeout: 5_000 });
  }
}

async function getProteinCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    return plot?.data?.protein_ids?.length ?? 0;
  });
}

/** Read the list of currently selected protein IDs from the scatter-plot. */
async function getSelectedProteinIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    return Array.from(plot?.selectedProteinIds ?? []) as string[];
  });
}

/**
 * Programmatically invoke brush selection on the scatter-plot.
 * Coordinates are in CSS pixels relative to the plot element.
 * This bypasses mouse event delivery issues with shadow DOM.
 */
async function brushSelect(
  page: Page,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Promise<{ selectedCount: number; brushCreated: boolean; selectionMode: boolean }> {
  return page.evaluate(
    ({ x0, y0, x1, y1 }) => {
      const plot = document.querySelector('#myPlot') as any;
      if (!plot) return { selectedCount: 0, brushCreated: false, selectionMode: false };

      const selectionMode = !!plot.selectionMode;
      const scales = plot._scales;
      const brushGroup = plot._brushGroup;
      const brush = plot._brush;
      const brushCreated = !!brush;

      if (!scales || !brush || !brushGroup) {
        return { selectedCount: 0, brushCreated, selectionMode };
      }

      // Mirror the coordinate chain that D3 brush + zoom transform performs:
      // CSS pixels → SVG viewBox coords → local (untransformed) coords.
      // This is the same space that _handleBrushEnd and the D3 scales operate in.
      const svg = plot.shadowRoot?.querySelector('svg');
      if (!svg) return { selectedCount: 0, brushCreated, selectionMode };

      const svgRect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;

      // CSS pixel → SVG coordinate scaling (accounts for viewBox)
      const scaleX = viewBox.width / svgRect.width;
      const scaleY = viewBox.height / svgRect.height;

      const t = plot._transform;
      const svgX0 = x0 * scaleX;
      const svgY0 = y0 * scaleY;
      const svgX1 = x1 * scaleX;
      const svgY1 = y1 * scaleY;

      // SVG coords → local (untransformed) coords via inverse zoom transform.
      // The brush group carries `transform`, so local = (svg - t.x) / t.k.
      const localX0 = (svgX0 - t.x) / t.k;
      const localY0 = (svgY0 - t.y) / t.k;
      const localX1 = (svgX1 - t.x) / t.k;
      const localY1 = (svgY1 - t.y) / t.k;

      // Programmatically set the brush selection and trigger the end event
      brushGroup.call(brush.move, [
        [Math.min(localX0, localX1), Math.min(localY0, localY1)],
        [Math.max(localX0, localX1), Math.max(localY0, localY1)],
      ]);

      // The brush end handler runs synchronously via requestAnimationFrame.
      // We need to wait for it, but since we're in evaluate(), let's manually
      // invoke the selection check.
      const plotData = plot._plotData || [];
      let count = 0;
      const lx0 = Math.min(localX0, localX1);
      const ly0 = Math.min(localY0, localY1);
      const lx1 = Math.max(localX0, localX1);
      const ly1 = Math.max(localY0, localY1);

      for (const d of plotData) {
        const px = scales.x(d.x);
        const py = scales.y(d.y);
        if (px >= lx0 && px <= lx1 && py >= ly0 && py <= ly1) {
          count++;
        }
      }

      return { selectedCount: count, brushCreated, selectionMode };
    },
    { x0, y0, x1, y1 },
  );
}

/**
 * Apply a d3-zoom transform to the scatter-plot.
 */
async function setZoomTransform(page: Page, k: number, tx: number, ty: number): Promise<void> {
  await page.evaluate(
    ({ k, tx, ty }) => {
      const plot = document.querySelector('#myPlot') as any;
      if (!plot?._svgSelection || !plot._zoom) return;

      const ZoomTransform = plot._transform.constructor;
      const transform = new ZoomTransform(k, tx, ty);
      plot._svgSelection.call(plot._zoom.transform, transform);
    },
    { k, tx, ty },
  );
  await page.waitForTimeout(300);
}

/**
 * Enable selection mode and verify it's active.
 */
async function enableSelectionMode(page: Page): Promise<boolean> {
  await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    if (plot) plot.selectionMode = true;
  });
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    return !!plot?.selectionMode && !!plot?._brush;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Brush selection works at all zoom levels (#189)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await page.goto('/explore');
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);
  });

  test('full-canvas brush at default zoom selects all visible points', async ({ page }) => {
    const totalProteins = await getProteinCount(page);
    expect(totalProteins).toBeGreaterThan(0);

    const active = await enableSelectionMode(page);
    expect(active).toBe(true);

    const dims = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as HTMLElement;
      return { width: plot.clientWidth, height: plot.clientHeight };
    });

    // Brush from corner to corner
    const result = await brushSelect(page, 0, 0, dims.width, dims.height);
    expect(result.brushCreated).toBe(true);
    expect(result.selectionMode).toBe(true);
    expect(result.selectedCount).toBe(totalProteins);

    // Verify the component's actual selectedProteinIds state (not just our
    // reimplemented count). brush.move triggers _handleBrushEnd which uses
    // requestAnimationFrame, so we wait for it to settle.
    await page.waitForTimeout(300);
    const actual = await getSelectedProteinIds(page);
    expect(actual.length).toBe(totalProteins);
  });

  test('full-canvas brush after zooming out selects all points', async ({ page }) => {
    const totalProteins = await getProteinCount(page);

    const dims = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as HTMLElement;
      return { width: plot.clientWidth, height: plot.clientHeight };
    });

    // Zoom out: k=0.3 centered
    const k = 0.3;
    await setZoomTransform(page, k, ((1 - k) * dims.width) / 2, ((1 - k) * dims.height) / 2);

    const active = await enableSelectionMode(page);
    expect(active).toBe(true);

    // Brush from corner to corner — should capture all points since they're
    // all within the center of the canvas when zoomed out
    const result = await brushSelect(page, 0, 0, dims.width, dims.height);
    expect(result.selectedCount).toBe(totalProteins);

    // Verify actual component state
    await page.waitForTimeout(300);
    const actual = await getSelectedProteinIds(page);
    expect(actual.length).toBe(totalProteins);
  });

  test('full-canvas brush after zooming in selects visible points', async ({ page }) => {
    const dims = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as HTMLElement;
      return { width: plot.clientWidth, height: plot.clientHeight };
    });

    // Zoom in 3x centered
    const k = 3;
    await setZoomTransform(page, k, ((1 - k) * dims.width) / 2, ((1 - k) * dims.height) / 2);

    const active = await enableSelectionMode(page);
    expect(active).toBe(true);

    const result = await brushSelect(page, 0, 0, dims.width, dims.height);
    // When zoomed in to center, some (not all) points should be in view
    expect(result.selectedCount).toBeGreaterThan(0);

    // Verify actual component state
    await page.waitForTimeout(300);
    const actual = await getSelectedProteinIds(page);
    expect(actual.length).toBeGreaterThan(0);
  });

  test('brush reaches full viewport when panned and zoomed in', async ({ page }) => {
    const dims = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as HTMLElement;
      return { width: plot.clientWidth, height: plot.clientHeight };
    });

    // Zoom in 2x, panned so the data center is at screen top-left.
    // tx = -margin.left * k, ty = -margin.top * k pushes the data origin
    // to the screen origin, making points visible from the very first pixel.
    const k = 2;
    const margin = 40;
    await setZoomTransform(page, k, -margin * k, -margin * k);

    const active = await enableSelectionMode(page);
    expect(active).toBe(true);

    // Brush the entire visible viewport.  With the old margin-constrained
    // extent, starting from CSS pixel (0,0) would be clamped to margin.left
    // in local coords (dead-zone of margin*k = 80 screen pixels on each side).
    const result = await brushSelect(page, 0, 0, dims.width, dims.height);

    // Must actually select points — the brush extent must cover the full
    // viewport in local coords, not just the margin-bounded area.
    expect(result.brushCreated).toBe(true);
    expect(result.selectedCount).toBeGreaterThan(0);

    // Verify actual component state
    await page.waitForTimeout(300);
    const actual = await getSelectedProteinIds(page);
    expect(actual.length).toBeGreaterThan(0);
  });

  test('brush extent covers viewport not just margins', async ({ page }) => {
    // Enable selection mode and wait for Lit lifecycle to create the brush
    const active = await enableSelectionMode(page);
    expect(active).toBe(true);

    // Now read the brush extent
    const extentInfo = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      if (!plot?._brush) return null;

      const config = plot._mergedConfig;
      const t = plot._transform;
      const extent = plot._brush.extent()();

      return {
        extentX0: extent[0][0],
        extentY0: extent[0][1],
        extentX1: extent[1][0],
        extentY1: extent[1][1],
        marginLeft: config.margin.left,
        marginTop: config.margin.top,
        width: config.width,
        height: config.height,
        transformK: t.k,
        transformX: t.x,
        transformY: t.y,
      };
    });

    expect(extentInfo).not.toBeNull();
    if (!extentInfo) return;

    // At default zoom (identity transform), the extent should cover
    // [0,0] to [width,height] — NOT [margin.left,margin.top] to
    // [width-margin.right, height-margin.bottom]
    if (extentInfo.transformK === 1 && extentInfo.transformX === 0) {
      expect(extentInfo.extentX0).toBeLessThanOrEqual(0);
      expect(extentInfo.extentY0).toBeLessThanOrEqual(0);
      expect(extentInfo.extentX1).toBeGreaterThanOrEqual(extentInfo.width);
      expect(extentInfo.extentY1).toBeGreaterThanOrEqual(extentInfo.height);
    }
  });
});
