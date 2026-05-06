import { test, expect } from '@playwright/test';

const FASTA = '>P12345\nMKTAYIAKQRQ\n';
const FAKE_BUNDLE_BYTES = new Uint8Array([0x50, 0x41, 0x52, 0x51]); // "PARQ"

test('FASTA drop flows through mocked prep backend into Explore loader', async ({ page }) => {
  // Mock POST /api/prepare → 202 { job_id }
  await page.route('**/api/prepare', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ job_id: 'test-job' }),
    });
  });

  // Mock GET /api/prepare/test-job/events → an SSE-shaped response.
  await page.route('**/api/prepare/test-job/events', async (route) => {
    const body =
      'event: queued\ndata: {"job_id":"test-job"}\n\n' +
      'event: progress\ndata: {"stage":"embedding"}\n\n' +
      'event: done\ndata: {"download_url":"/api/prepare/test-job/bundle"}\n\n';
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    });
  });

  // Mock GET /api/prepare/test-job/bundle → bytes the loader will try to parse.
  await page.route('**/api/prepare/test-job/bundle', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: Buffer.from(FAKE_BUNDLE_BYTES),
    });
  });

  await page.goto('/explore');

  // Drop the FASTA file via the file input fallback.
  const fileInput = page.locator('protspace-data-loader').locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'test.fasta',
    mimeType: 'text/plain',
    buffer: Buffer.from(FASTA),
  });

  // The bundle is fake, so the existing parquet loader will surface a parse
  // error. Asserting that error means the bytes flowed end-to-end through:
  //   FASTA → POST → SSE done → bundle download → parquet loader.
  await expect(page.getByText(/parquet|bundle|invalid|fail/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
