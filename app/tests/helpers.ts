import type { Page } from '@playwright/test';

/** Wait for the scatterplot data to be loaded. */
export async function waitForDataLoad(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForSelector('#myPlot', { timeout });

  await page.waitForFunction(
    () => {
      const plot = document.querySelector('#myPlot') as any;
      return plot?.data?.protein_ids?.length > 0;
    },
    { timeout, polling: 1000 },
  );

  // Let rendering and WebGL settle
  await page.waitForTimeout(500);
}

/** Dismiss the product tour if it appears. */
export async function dismissTourIfPresent(page: Page): Promise<void> {
  const skipBtn = page.locator('.driver-tour-skip-btn');
  if ((await skipBtn.count()) > 0) {
    await skipBtn.click();
    await page.waitForSelector('.driver-popover', { state: 'detached', timeout: 5_000 });
  }
}
