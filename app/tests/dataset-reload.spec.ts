import { test, expect, type Page } from '@playwright/test';
import { waitForDataLoad, dismissTourIfPresent } from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function writeCorruptedPersistedDataset(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const storageWithDirectory = navigator.storage as StorageManager & {
      getDirectory?: () => Promise<FileSystemDirectoryHandle>;
    };

    if (typeof storageWithDirectory.getDirectory !== 'function') {
      throw new Error('OPFS is unavailable in this browser context.');
    }

    const root = await storageWithDirectory.getDirectory();
    const store = await root.getDirectoryHandle('protspace-last-import', { create: true });
    const metadataHandle = await store.getFileHandle('metadata.json', { create: true });
    const writable = await metadataHandle.createWritable();
    await writable.write('{not-json');
    await writable.close();
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

    if (!(chevron instanceof Element)) {
      return false;
    }

    return getComputedStyle(chevron).display !== 'none';
  });
}

async function dispatchCustomEvent(
  page: Page,
  selector: string,
  eventName: string,
  detail: unknown,
): Promise<void> {
  await page.evaluate(
    ({ targetSelector, eventType, eventDetail }) => {
      const target = document.querySelector(targetSelector);
      if (!(target instanceof EventTarget)) {
        throw new Error(`No event target found for ${targetSelector}`);
      }

      target.dispatchEvent(
        new CustomEvent(eventType, {
          detail: eventDetail,
          bubbles: true,
          composed: true,
        }),
      );
    },
    { targetSelector: selector, eventType: eventName, eventDetail: detail },
  );
}

async function hasLegacyNotificationHelperArtifacts(page: Page): Promise<boolean> {
  return page.evaluate(() => document.getElementById('protspace-notification-styles') !== null);
}

async function dispatchParquetExport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const controlBar = document.getElementById('myControlBar');
    controlBar?.dispatchEvent(
      new CustomEvent('export', {
        detail: {
          type: 'parquet',
        },
      }),
    );
  });
}

async function dispatchBrokenParquetExport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const plot = document.getElementById('myPlot') as {
      getCurrentData?: () => unknown;
    } | null;
    if (plot?.getCurrentData) {
      plot.getCurrentData = () => null;
    }

    const controlBar = document.getElementById('myControlBar');
    controlBar?.dispatchEvent(
      new CustomEvent('export', {
        detail: {
          type: 'parquet',
        },
      }),
    );
  });
}

async function dispatchSelectionDisabledNotification(page: Page): Promise<void> {
  await page.evaluate(() => {
    const controlBar = document.getElementById('myControlBar');
    controlBar?.dispatchEvent(
      new CustomEvent('selection-disabled-notification', {
        detail: {
          message: 'Selection mode disabled: Only 1 point remaining',
          severity: 'warning',
          source: 'control-bar',
          context: {
            reason: 'insufficient-data',
            dataSize: 1,
          },
        },
      }),
    );
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
  test('corrupted persisted datasets are cleared and replaced with the demo dataset', async ({
    page,
  }) => {
    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await clearPersistedDataset(page);
    await writeCorruptedPersistedDataset(page);

    await page.goto('/explore');
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    await expect(page.getByText('Saved dataset was cleared.')).toBeVisible();
    await expect(page.getByText(/loaded the default demo dataset instead/i)).toBeVisible();
    expect(await getProteinCount(page)).toBeGreaterThan(0);
  });

  test('OPFS access restrictions show a toast without blocking the current session load', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('driver.overviewTour', 'true');
      Object.defineProperty(navigator.storage, 'getDirectory', {
        configurable: true,
        value: async () => {
          throw new DOMException('Security error when calling GetDirectory', 'SecurityError');
        },
      });
    });

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

    await expect(
      page.getByText('Dataset loaded, but automatic reload is unavailable.'),
    ).toBeVisible();
    await expect(page.getByText(/private\/incognito mode/i)).toBeVisible();
    await expect(page.getByText(/browser storage is restricted/i)).toBeVisible();

    expect(await getProteinCount(page)).not.toBe(defaultCount);
  });

  test('unsupported browsers show an OPFS support toast without blocking the current session load', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('driver.overviewTour', 'true');
      Object.defineProperty(navigator.storage, 'getDirectory', {
        configurable: true,
        value: undefined,
      });
    });

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

    await expect(
      page.getByText('Dataset loaded, but automatic reload is unavailable.'),
    ).toBeVisible();
    await expect(page.getByText(/does not support the Origin Private File System/i)).toBeVisible();

    expect(await getProteinCount(page)).not.toBe(defaultCount);
  });

  test('corrupted persisted datasets fall back to the demo and show a toast instead of a browser dialog', async ({
    page,
  }) => {
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    const defaultCount = await getProteinCount(page);
    await writeCorruptedPersistedDataset(page);

    await page.reload();
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    await expect(page.getByText('Saved dataset was cleared.')).toBeVisible();
    await expect(page.getByText(/loaded the default demo dataset instead/i)).toBeVisible();
    expect(await getProteinCount(page)).toBe(defaultCount);
    expect(dialogSeen).toBe(false);
  });

  test('dataset load failures show a toast instead of a browser dialog', async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    await page.evaluate(async () => {
      const loader = document.getElementById('myDataLoader') as {
        loadFromFile: (file: File) => Promise<void>;
      } | null;
      if (!loader) {
        throw new Error('Missing data loader');
      }

      const file = new File(['not-a-valid-bundle'], 'broken.parquetbundle', {
        type: 'application/octet-stream',
      });
      await loader.loadFromFile(file);
    });

    await expect(page.getByText('Dataset import failed.')).toBeVisible();
    expect(dialogSeen).toBe(false);
  });

  test('successful parquet exports show a Sonner toast', async ({ page }) => {
    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    await dispatchParquetExport(page);

    await expect(page.getByText('Export ready.')).toBeVisible();
    await expect(page.getByText(/\.parquetbundle/i)).toBeVisible();
  });

  test('failed parquet exports show a toast instead of a browser dialog', async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    await dispatchBrokenParquetExport(page);

    await expect(page.getByText('Export failed.')).toBeVisible();
    await expect(page.getByText('No data available for export')).toBeVisible();
    expect(dialogSeen).toBe(false);
  });

  test('selection-disabled notifications use the shared Sonner path', async ({ page }) => {
    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    await dispatchSelectionDisabledNotification(page);

    await expect(page.getByText('Selection mode disabled.')).toBeVisible();
    await expect(page.getByText('Selection mode disabled: Only 1 point remaining')).toBeVisible();
  });
});

test.describe('Unified app notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await clearPersistedDataset(page);
    await page.goto('/explore');
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);
  });

  test('corrupted persisted datasets fall back to the demo with an in-app warning', async ({
    page,
  }) => {
    const dialogMessages: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    const defaultCount = await getProteinCount(page);
    await writeCorruptedPersistedDataset(page);

    await page.reload();
    await waitForDataLoad(page);
    await dismissTourIfPresent(page);

    await expect(page.getByText('Saved dataset was cleared.')).toBeVisible();
    await expect(page.getByText(/loaded the default demo dataset/i)).toBeVisible();
    expect(await getProteinCount(page)).toBe(defaultCount);
    expect(dialogMessages).toEqual([]);
    expect(await hasLegacyNotificationHelperArtifacts(page)).toBe(false);
  });

  test('normalized data-error events surface a toast instead of a browser dialog', async ({
    page,
  }) => {
    const dialogMessages: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    await dispatchCustomEvent(page, '#myDataLoader', 'data-error', {
      message: 'Invalid parquet bundle',
      severity: 'error',
      source: 'data-loader',
      context: {
        operation: 'load',
      },
    });

    await expect(page.getByText('Dataset import failed.')).toBeVisible();
    await expect(page.getByText('Invalid parquet bundle')).toBeVisible();
    expect(dialogMessages).toEqual([]);
    expect(await hasLegacyNotificationHelperArtifacts(page)).toBe(false);
  });

  test('selection-disabled-notification uses the unified warning toast path', async ({ page }) => {
    await dispatchCustomEvent(page, '#myControlBar', 'selection-disabled-notification', {
      message: 'Selection mode disabled: Only 1 point remaining',
      severity: 'warning',
      source: 'control-bar',
      context: {
        reason: 'insufficient-data',
        dataSize: 1,
      },
    });

    await expect(page.getByText('Selection mode disabled.')).toBeVisible();
    await expect(page.getByText('Selection mode disabled: Only 1 point remaining')).toBeVisible();
    expect(await hasLegacyNotificationHelperArtifacts(page)).toBe(false);
  });

  test('successful parquet exports show the unified success toast', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    await dispatchCustomEvent(page, '#myControlBar', 'export', {
      type: 'parquet',
      includeLegendSettings: false,
      includeExportOptions: false,
    });

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.parquetbundle');
    await expect(page.getByText('Export ready.')).toBeVisible();
    expect(await hasLegacyNotificationHelperArtifacts(page)).toBe(false);
  });

  test('failed exports show the unified error toast', async ({ page }) => {
    await page.evaluate(() => {
      const plot = document.getElementById('myPlot') as { getCurrentData?: () => unknown } | null;
      if (!plot) {
        throw new Error('Scatterplot element not found');
      }

      plot.getCurrentData = () => null;
    });

    await dispatchCustomEvent(page, '#myControlBar', 'export', {
      type: 'parquet',
      includeLegendSettings: false,
      includeExportOptions: false,
    });

    await expect(page.getByText('Export failed.')).toBeVisible();
    await expect(page.getByText('No data available for export')).toBeVisible();
    expect(await hasLegacyNotificationHelperArtifacts(page)).toBe(false);
  });
});
