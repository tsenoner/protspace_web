/**
 * Inset tool lifecycle test — lens UX.
 */
import { test, expect } from '@playwright/test';
import { waitForExploreDataLoad, dismissTourIfPresent } from './helpers/explore';

test.describe('Inset Tool', () => {
  test('full lens lifecycle: button → lens appears → confirm → inset created', async ({ page }) => {
    await page.goto('/explore');
    await waitForExploreDataLoad(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/inset-00-initial.png' });

    // ── Click inset button ──
    const btnPos = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      const btn = plot?.shadowRoot?.querySelector('.inset-tool-btn');
      if (!btn) return null;
      const rect = (btn as HTMLElement).getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    expect(btnPos).not.toBeNull();
    await page.mouse.click(btnPos!.x, btnPos!.y);
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => (document.querySelector('#myPlot') as any)?.insetStep)).toBe(
      'framing',
    );
    await page.screenshot({ path: 'test-results/inset-01-lens.png' });

    // ── Verify lens is visible ──
    const lensVisible = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      const tool = plot?.shadowRoot?.querySelector('protspace-inset-tool') as any;
      return !!tool?.shadowRoot?.querySelector('.lens');
    });
    expect(lensVisible).toBe(true);

    // ── Click the lens confirm button (✓) ──
    const confirmPos = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      const tool = plot?.shadowRoot?.querySelector('protspace-inset-tool') as any;
      const btn = tool?.shadowRoot?.querySelector('.lens-confirm');
      if (!btn) return null;
      const rect = (btn as HTMLElement).getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    expect(confirmPos).not.toBeNull();
    await page.mouse.click(confirmPos!.x, confirmPos!.y);
    await page.waitForTimeout(500);

    const finalState = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as any;
      return {
        insetStep: plot?.insetStep,
        insetCount: plot?.insets?.length ?? 0,
      };
    });
    console.log('Final:', JSON.stringify(finalState));
    expect(finalState.insetStep).toBe('idle');
    expect(finalState.insetCount).toBe(1);
    await page.screenshot({ path: 'test-results/inset-02-confirmed.png' });

    // ── Escape cancels lens ──
    await page.mouse.click(btnPos!.x, btnPos!.y);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (document.querySelector('#myPlot') as any)?.insetStep)).toBe(
      'framing',
    );

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (document.querySelector('#myPlot') as any)?.insetStep)).toBe(
      'idle',
    );

    // ── Inset shows in export studio ──
    await page.evaluate(() => {
      document
        .querySelector('protspace-control-bar')
        ?.dispatchEvent(
          new CustomEvent('export', { detail: { type: 'png' }, bubbles: true, composed: true }),
        );
    });
    await page.waitForTimeout(1000);

    const studioInsets = await page.evaluate(() => {
      const studio = document.querySelector('#export-studio') as any;
      if (!studio?.shadowRoot) return 0;
      for (const h of studio.shadowRoot.querySelectorAll('h3')) {
        if (h.textContent?.includes('Insets')) {
          return parseInt(h.textContent.match(/\((\d+)\)/)?.[1] ?? '0');
        }
      }
      return 0;
    });
    expect(studioInsets).toBe(1);
    await page.screenshot({ path: 'test-results/inset-03-in-studio.png' });
  });
});
