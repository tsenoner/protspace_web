import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const EXPECTED_SCENARIOS = ['annotationChange', 'zoomInOut', 'dragCanvas', 'clickPoint'] as const;
const ITERATIONS = 10;
const SUITE_TIMEOUT_MS = 45 * 60_000;

test.describe('WebGL render perf benchmark (headed)', () => {
  test('downloads a single WebGL perf suite file and validates contents', async ({
    page,
  }, testInfo) => {
    test.setTimeout(SUITE_TIMEOUT_MS);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    const firstPageError = new Promise<Error>((resolve) => {
      page.once('pageerror', (err) => resolve(err as Error));
    });

    const downloadPromise = page.waitForEvent('download', {
      timeout: SUITE_TIMEOUT_MS - 60_000,
      predicate: (dl) => dl.suggestedFilename().includes('webgl-perf-suite'),
    });

    await page.goto(`/explore?webglPerf=1&webglPerfIterations=${ITERATIONS}`);
    await page.bringToFront();

    await Promise.race([
      page.waitForSelector('#myPlot', { timeout: 60_000 }),
      firstPageError.then((err) => {
        throw err;
      }),
    ]);
    await Promise.race([
      page.waitForSelector('#myDataLoader', { timeout: 60_000, state: 'attached' }),
      firstPageError.then((err) => {
        throw err;
      }),
    ]);

    const dl = await Promise.race([
      downloadPromise,
      firstPageError.then((err) => {
        throw err;
      }),
    ]);
    const savedTo = testInfo.outputPath(`webgl-perf-suite-${testInfo.project.name}.json`);
    await dl.saveAs(savedTo);

    const suite = JSON.parse(fs.readFileSync(savedTo, 'utf-8')) as any;
    expect(suite).toBeTruthy();
    expect(typeof suite.createdAt).toBe('string');
    expect(suite.iterations).toBe(ITERATIONS);
    expect(Array.isArray(suite.results)).toBeTruthy();
    expect((suite.results as unknown[]).length).toBeGreaterThan(0);

    const results = suite.results as any[];
    const datasetIds = results.map((r) => r?.dataset?.id);
    for (const id of datasetIds) {
      expect(typeof id).toBe('string');
      expect((id as string).length).toBeGreaterThan(0);
    }
    expect(new Set(datasetIds).size).toBe(datasetIds.length);

    for (const r of results) {
      expect(r).toBeTruthy();
      expect(Array.isArray(r.scenarios)).toBeTruthy();

      const scenarioNames = (r.scenarios as any[]).map((s) => s?.name).filter(Boolean);
      for (const expected of EXPECTED_SCENARIOS) {
        expect(scenarioNames).toContain(expected);
      }
    }

    if (consoleErrors.length || pageErrors.length) {
      console.log('console errors:', consoleErrors);
      console.log('page errors:', pageErrors);
    }

    expect(pageErrors).toEqual([]);
  });
});
