import { test, expect } from '@playwright/test';
import { waitForExploreDataLoad, dismissTourIfPresent } from './helpers/explore';

test('inset visible in export preview', async ({ page }) => {
  await page.goto('/explore');
  await waitForExploreDataLoad(page);
  await dismissTourIfPresent(page);
  await page.waitForTimeout(1000);

  // Create an inset via lens
  const btnPos = await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    const btn = plot?.shadowRoot?.querySelector('.inset-tool-btn');
    if (!btn) return null;
    const r = (btn as HTMLElement).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(btnPos!.x, btnPos!.y);
  await page.waitForTimeout(500);

  // Confirm via evaluate (reliable)
  await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    const tool = plot?.shadowRoot?.querySelector('protspace-inset-tool') as any;
    const btn = tool?.shadowRoot?.querySelector('.lens-confirm');
    (btn as HTMLElement)?.click();
  });
  await page.waitForTimeout(500);

  // Verify inset exists
  const insetCount = await page.evaluate(
    () => (document.querySelector('#myPlot') as any)?.insets?.length ?? 0,
  );
  console.log('Insets on plot:', insetCount);
  expect(insetCount).toBe(1);
  await page.screenshot({ path: 'test-results/export-inset-01-canvas.png' });

  // Open export studio
  await page.evaluate(() => {
    document
      .querySelector('protspace-control-bar')
      ?.dispatchEvent(
        new CustomEvent('export', { detail: { type: 'png' }, bubbles: true, composed: true }),
      );
  });
  await page.waitForTimeout(1500);

  // Check what the export studio has
  const studioState = await page.evaluate(() => {
    const studio = document.querySelector('#export-studio') as any;
    if (!studio) return { found: false };
    return {
      found: true,
      open: studio.open,
      indicatorCount: studio.indicators?.length ?? 0,
      insetCount: studio.insets?.length ?? 0,
      hasCapture: !!studio.scatterCapture,
      hasLegend: !!studio.legendModel,
      previewCanvas: !!studio.shadowRoot?.querySelector('canvas'),
    };
  });
  console.log('Export studio state:', JSON.stringify(studioState));
  await page.screenshot({ path: 'test-results/export-inset-02-studio.png' });

  // Check if the scatter plot still has insets when capture is called
  const plotState = await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    return {
      indicators: plot?.indicators?.length ?? 0,
      insets: plot?.insets?.length ?? 0,
      hasCapture: typeof plot?.captureAtResolution === 'function',
    };
  });
  console.log('Plot state during export:', JSON.stringify(plotState));
});
