import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { dismissTourIfPresent, waitForExploreDataLoad } from './helpers/explore';

const SPEC_DIR = path.dirname(new URL(import.meta.url).pathname);
const SPROT_FIXTURE = path.resolve(SPEC_DIR, 'fixtures/sprot_50.parquetbundle');
const fixtureAvailable = fs.existsSync(SPROT_FIXTURE);

test.describe('large bundle load (sprot_50, 573k proteins)', () => {
  test.skip(
    !fixtureAvailable,
    'Fixture sprot_50.parquetbundle not present; copy from protspace/data/other/sprot/.',
  );
  test.setTimeout(120_000);

  test('loads sprot_50 without OOM and renders the legend', async ({ page }) => {
    let pageCrashed = false;
    const consoleErrors: string[] = [];

    page.on('crash', () => {
      pageCrashed = true;
    });

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // Ignore Lit dev-mode warnings and third-party analytics CORS errors.
      if (
        text.includes('Lit') ||
        text.includes('cloudflareinsights') ||
        text.includes('ERR_FAILED') ||
        text.includes('ERR_BLOCKED')
      )
        return;
      consoleErrors.push(text);
    });

    await page.goto('/explore');
    await page.evaluate(() => localStorage.setItem('driver.overviewTour', 'true'));
    await dismissTourIfPresent(page);

    // Open the import menu and set the file via the file input inside the data loader.
    await page.locator('protspace-control-bar [data-driver-id="import"] .dropdown-trigger').click();
    await expect(
      page.locator('protspace-control-bar [data-driver-id="import-own-dataset"]'),
    ).toBeVisible();

    await page
      .locator('protspace-data-loader')
      .locator('input[type="file"]')
      .setInputFiles(SPROT_FIXTURE);

    await waitForExploreDataLoad(page, 90_000);

    // Verify page did not OOM-crash (Aw, Snap = error code 5).
    expect(pageCrashed, 'Page crashed (OOM) during or after loading sprot_50').toBe(false);
    expect(consoleErrors).toEqual([]);

    // Verify all 573,649 proteins loaded (evaluate only the count, not the full array).
    const proteinCount = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as
        | (Element & { data?: { protein_ids?: { length?: number } } })
        | null;
      return plot?.data?.protein_ids?.length ?? 0;
    });
    expect(proteinCount).toBe(573_649);

    // The legend must be visible and rendering.
    const legend = page.locator('protspace-legend');
    await expect(legend).toBeVisible();

    // Switch the selected annotation across categorical (kingdom),
    // multi-valued (pfam), high-card (gene_name), and numeric (annotation_score)
    // and verify the legend stays visible after each switch.
    for (const annotation of ['kingdom', 'pfam', 'gene_name', 'annotation_score']) {
      await page.evaluate((name) => {
        const plot = document.querySelector('#myPlot') as
          | (Element & { selectedAnnotation?: string })
          | null;
        if (plot) plot.selectedAnnotation = name;
      }, annotation);

      await page.waitForFunction(
        (name) => {
          const plot = document.querySelector('#myPlot') as
            | (Element & { selectedAnnotation?: string })
            | null;
          return plot?.selectedAnnotation === name;
        },
        annotation,
        { timeout: 10_000, polling: 200 },
      );

      await expect(legend).toBeVisible();
    }
  });
});
