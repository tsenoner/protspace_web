import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  dismissTourIfPresent,
  waitForExploreDataLoad,
  getFirstLegendItemValue,
} from './helpers/explore';

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
      // Ignore Lit dev-mode banner and third-party analytics CORS errors.
      if (
        text.includes('Lit is in dev mode') ||
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

    // The legend must be populated (not just upgraded) — :host { display: flex }
    // would let toBeVisible() pass on an empty legend, so check for a real item.
    const initialLegendItem = await getFirstLegendItemValue(page);
    expect(initialLegendItem.length, 'legend item value should be non-empty').toBeGreaterThan(0);

    // Switch the selected annotation across categorical (kingdom),
    // multi-valued (pfam), high-card (gene_name), and numeric (annotation_score)
    // and verify the legend stays populated after each switch.
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

      const legendItem = await getFirstLegendItemValue(page);
      expect(
        legendItem.length,
        `legend item value should be non-empty after switching to ${annotation}`,
      ).toBeGreaterThan(0);

      // After switching to gene_name (the annotation that exercises the
      // tooltip header), synthesize a hover and verify the buildTooltipView
      // path renders non-empty content into the tooltip element.
      if (annotation === 'gene_name') {
        const tooltipText = await page.evaluate(() => {
          const plot = document.querySelector('protspace-scatterplot') as
            | (HTMLElement & {
                _plotData?: Array<{ originalIndex: number; id: string }>;
                _handleMouseOver?: (evt: MouseEvent, point: unknown) => void;
                shadowRoot: ShadowRoot | null;
              })
            | null;
          if (!plot?._plotData?.length) return null;
          const point = plot._plotData[0];
          const rect = plot.getBoundingClientRect();
          const evt = new MouseEvent('mouseover', {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
          });
          plot._handleMouseOver?.(evt, point);
          const tooltip = plot.shadowRoot?.querySelector('protspace-protein-tooltip') as
            | (HTMLElement & { shadowRoot: ShadowRoot | null })
            | null;
          return tooltip?.shadowRoot?.textContent ?? null;
        });

        // The tooltip element is mounted lazily on first hover via the
        // _tooltipData state; if Lit hasn't flushed yet, give it a tick.
        if (!tooltipText) {
          await page.waitForFunction(
            () => {
              const plot = document.querySelector('protspace-scatterplot') as
                | (HTMLElement & { shadowRoot: ShadowRoot | null })
                | null;
              const tooltip = plot?.shadowRoot?.querySelector('protspace-protein-tooltip') as
                | (HTMLElement & { shadowRoot: ShadowRoot | null })
                | null;
              const text = tooltip?.shadowRoot?.textContent ?? '';
              return text.trim().length > 0;
            },
            undefined,
            { timeout: 5_000, polling: 100 },
          );
        }

        const finalTooltipText = await page.evaluate(() => {
          const plot = document.querySelector('protspace-scatterplot') as
            | (HTMLElement & { shadowRoot: ShadowRoot | null })
            | null;
          const tooltip = plot?.shadowRoot?.querySelector('protspace-protein-tooltip') as
            | (HTMLElement & { shadowRoot: ShadowRoot | null })
            | null;
          return tooltip?.shadowRoot?.textContent ?? null;
        });

        expect(finalTooltipText, 'tooltip should render after hover').toBeTruthy();
        expect(
          finalTooltipText!.trim().length,
          'tooltip should have non-empty text',
        ).toBeGreaterThan(0);
      }
    }
  });
});
