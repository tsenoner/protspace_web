import { test, expect } from '@playwright/test';
import { waitForExploreDataLoad, dismissTourIfPresent } from './helpers/explore';

test('check indicator doubling in export', async ({ page }) => {
  await page.goto('/explore');
  await waitForExploreDataLoad(page);
  await dismissTourIfPresent(page);
  await page.waitForTimeout(1000);

  // Add ONE indicator
  await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    const menu = plot?.shadowRoot?.querySelector('protspace-context-menu');
    // Simulate adding indicator directly via the annotation controller event
    plot.dispatchEvent(
      new CustomEvent('context-menu-action', {
        detail: { type: 'indicate', proteinId: 'TEST_P1', dataCoords: [0, 0] },
        bubbles: true,
        composed: true,
      }),
    );
  });
  await page.waitForTimeout(500);

  // Check how many indicators exist
  const indicatorState = await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    return {
      plotIndicators: plot?.indicators?.length ?? 0,
      indicatorIds: plot?.indicators?.map((i: any) => i.id) ?? [],
    };
  });
  console.log('Indicators:', JSON.stringify(indicatorState));
  expect(indicatorState.plotIndicators).toBe(1);

  // Open export studio
  await page.evaluate(() => {
    document
      .querySelector('protspace-control-bar')
      ?.dispatchEvent(
        new CustomEvent('export', { detail: { type: 'png' }, bubbles: true, composed: true }),
      );
  });
  await page.waitForTimeout(1500);

  // Check studio state
  const studioIndicators = await page.evaluate(() => {
    const studio = document.querySelector('#export-studio') as any;
    return {
      count: studio?.indicators?.length ?? 0,
      ids: studio?.indicators?.map((i: any) => i.id) ?? [],
    };
  });
  console.log('Studio indicators:', JSON.stringify(studioIndicators));

  // Check the plot state again (did opening studio add duplicates?)
  const plotAfterStudio = await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    return {
      count: plot?.indicators?.length ?? 0,
      ids: plot?.indicators?.map((i: any) => i.id) ?? [],
    };
  });
  console.log('Plot after studio open:', JSON.stringify(plotAfterStudio));

  await page.screenshot({ path: 'test-results/double-check-studio.png' });
});
