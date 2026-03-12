import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the scatterplot data to be loaded. */
async function waitForDataLoad(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForSelector('#myPlot', { timeout });

  await page.waitForFunction(
    () => {
      const plot = document.querySelector('#myPlot') as any;
      return plot?.data?.protein_ids?.length > 0;
    },
    { timeout, polling: 1000 },
  );

  // Let rendering settle
  await page.waitForTimeout(500);
}

/** Dismiss the product tour if it appears. */
async function dismissTourIfPresent(page: Page): Promise<void> {
  const skipBtn = page.locator('.driver-tour-skip-btn');
  if ((await skipBtn.count()) > 0) {
    await skipBtn.click();
    await page.waitForSelector('.driver-popover', { state: 'detached', timeout: 5_000 });
  }
}

/** Get the first non-Other legend item's data-value from shadow DOM. */
async function getFirstLegendItemValue(page: Page): Promise<string> {
  const value = await page.evaluate(() => {
    const legend = document.querySelector('protspace-legend') as any;
    if (!legend?.shadowRoot) return null;
    const item = legend.shadowRoot.querySelector(
      '.legend-item:not([data-value="Other"]):not([data-value="__NA__"])',
    );
    return item?.getAttribute('data-value') ?? null;
  });
  if (!value) throw new Error('No legend item found');
  return value;
}

/** Check if a legend item is hidden (has the 'hidden' CSS class). */
async function isLegendItemHidden(page: Page, value: string): Promise<boolean> {
  return page.evaluate((v) => {
    const legend = document.querySelector('protspace-legend') as any;
    if (!legend?.shadowRoot) return false;
    const item = legend.shadowRoot.querySelector(`[data-value="${v}"]`);
    return item?.classList.contains('hidden') ?? false;
  }, value);
}

/** Click a legend item by its data-value. */
async function clickLegendItem(page: Page, value: string): Promise<void> {
  await page.evaluate((v) => {
    const legend = document.querySelector('protspace-legend') as any;
    const item = legend?.shadowRoot?.querySelector(`[data-value="${v}"]`) as HTMLElement;
    item?.click();
  }, value);
  // Wait for state update and re-render
  await page.waitForTimeout(300);
}

/** Find a protspace legend localStorage key. */
async function findLegendStorageKey(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('protspace:legend:')) return key;
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Dataset reload resets state (#178)', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress the product tour so it doesn't interfere
    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await page.goto('/explore');
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);
  });

  test('page reload restores default legend state', async ({ page }) => {
    const itemValue = await getFirstLegendItemValue(page);

    // Item should start visible
    expect(await isLegendItemHidden(page, itemValue)).toBe(false);

    // Click to hide the item
    await clickLegendItem(page, itemValue);
    expect(await isLegendItemHidden(page, itemValue)).toBe(true);

    // Verify localStorage was written
    const storageKey = await findLegendStorageKey(page);
    expect(storageKey).not.toBeNull();

    // Reload the page
    await page.reload();
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    // After reload, the item should be visible again (default state restored)
    expect(await isLegendItemHidden(page, itemValue)).toBe(false);
  });

  test('legend localStorage is cleared on reload', async ({ page }) => {
    const itemValue = await getFirstLegendItemValue(page);

    // Modify legend state
    await clickLegendItem(page, itemValue);

    // Verify localStorage has legend entries
    const storageKey = await findLegendStorageKey(page);
    expect(storageKey).not.toBeNull();

    const savedSettings = await page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key!) || '{}');
    }, storageKey);
    expect(savedSettings.hiddenValues).toContain(itemValue);

    // Reload the page
    await page.reload();
    await waitForDataLoad(page);

    // After reload + file settings applied, hiddenValues should not contain our item
    const reloadedKey = await findLegendStorageKey(page);
    if (reloadedKey) {
      const reloadedSettings = await page.evaluate((key) => {
        return JSON.parse(localStorage.getItem(key!) || '{}');
      }, reloadedKey);
      expect(reloadedSettings.hiddenValues ?? []).not.toContain(itemValue);
    }
  });
});
