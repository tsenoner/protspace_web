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

async function getProteinCount(page: Page): Promise<number> {
  const count = await page.evaluate(() => {
    const plot = document.querySelector('#myPlot') as any;
    return plot?.data?.protein_ids?.length ?? 0;
  });

  return Number(count);
}

async function waitForProteinCount(page: Page, expected: number, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    (target) => {
      const plot = document.querySelector('#myPlot') as any;
      return plot?.data?.protein_ids?.length === target;
    },
    expected,
    { timeout, polling: 500 },
  );

  await page.waitForTimeout(300);
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

async function clearPersistedDataset(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const storageWithDirectory = navigator.storage as StorageManager & {
      getDirectory?: () => Promise<FileSystemDirectoryHandle>;
    };

    if (typeof storageWithDirectory.getDirectory !== 'function') {
      return;
    }

    const root = await storageWithDirectory.getDirectory();
    try {
      await root.removeEntry('protspace-last-import', { recursive: true });
    } catch {
      // Ignore missing directory.
    }
  });
}

async function waitForPersistedDataset(page: Page, timeout = 30_000): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const hasPersistedDataset = await page.evaluate(async () => {
      const storageWithDirectory = navigator.storage as StorageManager & {
        getDirectory?: () => Promise<FileSystemDirectoryHandle>;
      };

      if (typeof storageWithDirectory.getDirectory !== 'function') {
        return false;
      }

      const root = await storageWithDirectory.getDirectory();
      try {
        const dir = await root.getDirectoryHandle('protspace-last-import');
        await dir.getFileHandle('metadata.json');
        await dir.getFileHandle('dataset.bin');
        return true;
      } catch {
        return false;
      }
    });

    if (hasPersistedDataset) {
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error('Timed out waiting for the persisted OPFS dataset to be written.');
}

async function openImportMenu(page: Page): Promise<void> {
  await page.locator('protspace-control-bar [data-driver-id="import"] .dropdown-trigger').click();
  await expect(
    page.locator('protspace-control-bar [data-driver-id="import-own-dataset"]'),
  ).toBeVisible();
}

async function loadCustomDataset(
  page: Page,
  datasetPublicPath: string,
  fileName: string,
): Promise<void> {
  await page.evaluate(
    async ({ publicPath, name }) => {
      const response = await fetch(publicPath);
      const buffer = await response.arrayBuffer();
      const file = new File([buffer], name, { type: 'application/octet-stream' });
      const loader = document.getElementById('myDataLoader') as any;
      await loader.loadFromFile(file);
    },
    { publicPath: datasetPublicPath, name: fileName },
  );
}

async function loadDemoDatasetFromImportMenu(page: Page): Promise<void> {
  await openImportMenu(page);
  await page.locator('protspace-control-bar [data-driver-id="import-demo-dataset"]').click();
}

async function isImportChevronVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const controlBar = document.querySelector('protspace-control-bar');
    const chevron = controlBar?.shadowRoot?.querySelector(
      '[data-driver-id="import"] .chevron-down',
    );

    if (!(chevron instanceof HTMLElement)) {
      return false;
    }

    return getComputedStyle(chevron).display !== 'none';
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
    await clearPersistedDataset(page);
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

test.describe('Persisted custom datasets in OPFS (#176)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await clearPersistedDataset(page);
    await page.goto('/explore');
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);
  });

  test('reload restores the last imported custom dataset and its local settings', async ({
    page,
  }) => {
    const defaultCount = await getProteinCount(page);

    await loadCustomDataset(page, '/data/5K.parquetbundle', '5K.parquetbundle');
    await page.waitForFunction(
      (originalCount) => {
        const plot = document.querySelector('#myPlot') as any;
        return (
          plot?.data?.protein_ids?.length > 0 && plot.data.protein_ids.length !== originalCount
        );
      },
      defaultCount,
      { polling: 500, timeout: 30_000 },
    );
    await waitForPersistedDataset(page);

    const customCount = await getProteinCount(page);
    expect(customCount).not.toBe(defaultCount);

    const itemValue = await getFirstLegendItemValue(page);
    await clickLegendItem(page, itemValue);
    expect(await isLegendItemHidden(page, itemValue)).toBe(true);

    await page.reload();
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    expect(await getProteinCount(page)).toBe(customCount);
    expect(await isLegendItemHidden(page, itemValue)).toBe(true);
  });

  test('reset to demo clears the persisted custom dataset', async ({ page }) => {
    const defaultCount = await getProteinCount(page);

    await loadCustomDataset(page, '/data/5K.parquetbundle', '5K.parquetbundle');
    await page.waitForFunction(
      (originalCount) => {
        const plot = document.querySelector('#myPlot') as any;
        return (
          plot?.data?.protein_ids?.length > 0 && plot.data.protein_ids.length !== originalCount
        );
      },
      defaultCount,
      { polling: 500, timeout: 30_000 },
    );
    await waitForPersistedDataset(page);

    await loadDemoDatasetFromImportMenu(page);
    await waitForProteinCount(page, defaultCount);

    await page.reload();
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    expect(await getProteinCount(page)).toBe(defaultCount);
  });

  test('compact layout still shows the import dropdown affordance', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 527 });
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    expect(await isImportChevronVisible(page)).toBe(true);
  });
});

test.describe('Persisted dataset failure handling', () => {
  test('OPFS save failures alert without blocking the current session load', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('driver.overviewTour', 'true');
      Object.defineProperty(navigator.storage, 'getDirectory', {
        configurable: true,
        value: async () => {
          throw new Error('OPFS disabled for this test');
        },
      });
    });

    const dialogPromise = page.waitForEvent('dialog');

    await page.goto('/explore');
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    const defaultCount = await getProteinCount(page);

    await loadCustomDataset(page, '/data/5K.parquetbundle', '5K.parquetbundle');
    await page.waitForFunction(
      (originalCount) => {
        const plot = document.querySelector('#myPlot') as any;
        return (
          plot?.data?.protein_ids?.length > 0 && plot.data.protein_ids.length !== originalCount
        );
      },
      defaultCount,
      { polling: 500, timeout: 30_000 },
    );

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('could not save it in browser storage');
    await dialog.accept();

    expect(await getProteinCount(page)).not.toBe(defaultCount);
  });
});
