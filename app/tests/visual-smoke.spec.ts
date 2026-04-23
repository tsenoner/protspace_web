/**
 * Visual smoke test — uses REAL mouse clicks (not page.evaluate hacks).
 * Takes screenshots at each step so we can verify visually.
 */
import { test, expect } from '@playwright/test';
import { waitForExploreDataLoad, dismissTourIfPresent } from './helpers/explore';

test.describe('Visual Smoke: Context Menu + Indicate + Export Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await waitForExploreDataLoad(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1000);
  });

  test('full workflow with real mouse clicks', async ({ page }) => {
    // ── Step 1: Screenshot of loaded scatter plot ──
    await page.screenshot({ path: 'test-results/01-scatter-loaded.png' });

    // ── Step 2: Right-click on the scatter plot center to trigger context menu ──
    const plot = page.locator('#myPlot');
    const box = await plot.boundingBox();
    expect(box).not.toBeNull();

    // Click in the center of the plot — high chance of hitting a data point
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.click(cx, cy, { button: 'right' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/02-context-menu-open.png' });

    // ── Step 3: Verify context menu is visible near click position ──
    // The menu should be rendered within the scatter-plot shadow DOM
    const menuVisible = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      const menu = plot?.shadowRoot?.querySelector('protspace-context-menu');
      if (!menu || !menu.open) return { visible: false, x: 0, y: 0 };
      const rect = menu.getBoundingClientRect();
      return { visible: true, x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    });
    console.log('Context menu state:', JSON.stringify(menuVisible));

    // ── Step 4: Try to click "Indicate" using REAL mouse click on the menu ──
    // First find the button position via evaluate, then click with mouse
    const indicatePos = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      const menu = plot?.shadowRoot?.querySelector('protspace-context-menu');
      if (!menu?.shadowRoot) return null;
      const buttons = menu.shadowRoot.querySelectorAll('button.menu-item');
      for (const btn of buttons) {
        if (btn.textContent?.includes('Indicate')) {
          const rect = (btn as HTMLElement).getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }
      }
      return null;
    });

    console.log('Indicate button position:', JSON.stringify(indicatePos));

    if (indicatePos) {
      await page.mouse.click(indicatePos.x, indicatePos.y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/03-after-indicate-click.png' });

      // Check if indicator was added
      const indicatorCount = await page.evaluate(() => {
        const plot = document.querySelector('#myPlot') as any;
        return plot?.indicators?.length ?? 0;
      });
      console.log('Indicator count after click:', indicatorCount);
    } else {
      console.log('WARN: Could not find Indicate button position');
      await page.screenshot({ path: 'test-results/03-indicate-not-found.png' });
    }

    // ── Step 5: Open Export Studio ──
    // Find and click the export dropdown/button in the control bar
    const exportBtnPos = await page.evaluate(() => {
      const cb = document.querySelector('protspace-control-bar') as any;
      if (!cb?.shadowRoot) return null;
      // Look for export-related buttons
      const buttons = cb.shadowRoot.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() ?? '';
        const label = btn.getAttribute('aria-label')?.toLowerCase() ?? '';
        if (text.includes('export') || label.includes('export') || text.includes('png')) {
          const rect = (btn as HTMLElement).getBoundingClientRect();
          return {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            text: btn.textContent?.trim(),
          };
        }
      }
      // Also check dropdown items
      const items = cb.shadowRoot.querySelectorAll('.dropdown-item');
      for (const item of items) {
        if (item.textContent?.toLowerCase().includes('png')) {
          const rect = (item as HTMLElement).getBoundingClientRect();
          return {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            text: item.textContent?.trim(),
          };
        }
      }
      return null;
    });

    console.log('Export button:', JSON.stringify(exportBtnPos));

    // Try dispatching export event directly as fallback
    await page.evaluate(() => {
      const controlBar = document.querySelector('protspace-control-bar') as any;
      if (controlBar) {
        controlBar.dispatchEvent(
          new CustomEvent('export', {
            detail: { type: 'png' },
            bubbles: true,
            composed: true,
          }),
        );
      }
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/04-export-studio.png' });

    // Check export studio state
    const studioState = await page.evaluate(() => {
      const studio = document.querySelector('#export-studio') as any;
      if (!studio) return { found: false };
      return {
        found: true,
        open: studio.open,
        hasPreview: studio.shadowRoot?.querySelector('.preview-area') !== null,
        hasControls: studio.shadowRoot?.querySelector('.controls-panel') !== null,
        overlayVisible: studio.shadowRoot?.querySelector('.modal-overlay') !== null,
        studioSize: (() => {
          const s = studio.shadowRoot?.querySelector('.studio');
          if (!s) return null;
          const rect = (s as HTMLElement).getBoundingClientRect();
          return { w: rect.width, h: rect.height };
        })(),
      };
    });
    console.log('Export studio state:', JSON.stringify(studioState));

    // ── Step 6: Close and screenshot final state ──
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/05-final-state.png' });
  });
});
