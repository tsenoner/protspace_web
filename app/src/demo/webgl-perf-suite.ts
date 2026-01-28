import type { DataLoader, ProtspaceScatterplot } from '@protspace/core';

type Args = {
  plotElement: ProtspaceScatterplot;
  dataLoader: DataLoader;
};

type PerfSuiteResult = {
  createdAt: string;
  iterations: number;
  results: unknown[];
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 250,
): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error('perf: timeout');
}

async function readDatasetList(): Promise<string[]> {
  const fallback = [
    '5K',
    '40K',
    '7K_toxprot',
    '35K_ec_brenda',
    '105K_homoSapiens_drosophilaMelanogaster',
    '127K_beta_lactamase',
    '573K_swissprot',
    'beta_lactamase_ec',
    'beta_lactamase_pn',
    'phosphatase',
  ];

  try {
    const res = await fetch('/data/datasets.json', { cache: 'no-store' });
    if (!res.ok) return fallback;
    const payload = (await res.json()) as unknown;
    if (!Array.isArray(payload)) return fallback;
    const ids = payload.filter((v) => typeof v === 'string' && v.length > 0) as string[];
    return ids.length ? ids : fallback;
  } catch {
    return fallback;
  }
}

function downloadJson(filename: string, payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function loadDataset(args: Args, datasetId: string, timeoutMs: number): Promise<void> {
  const url = `/data/${datasetId}.parquetbundle`;
  const plotAny = args.plotElement as any;
  const loaderAny = args.dataLoader as any;

  const dataChange = new Promise<void>((resolve) => {
    args.plotElement.addEventListener('data-change', () => resolve(), { once: true });
  });

  const loaderDone = new Promise<void>((resolve, reject) => {
    args.dataLoader.addEventListener('data-loaded', () => resolve(), { once: true });
    args.dataLoader.addEventListener(
      'data-error',
      (event: any) => reject(new Error(String(event?.detail?.error ?? 'unknown error'))),
      { once: true },
    );
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`perf: failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const file = new File([arrayBuffer], `${datasetId}.parquetbundle`, {
    type: 'application/octet-stream',
  });

  await loaderAny.loadFromFile(file);
  await loaderDone;
  await dataChange;

  await waitUntil(() => !!plotAny?.data?.protein_ids?.length, timeoutMs);
  await waitUntil(() => !document.getElementById('progressive-loading'), timeoutMs);
}

export async function maybeRunWebglPerfSuite(args: Args): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  if (params.get('webglPerf') !== '1') return;

  const g = globalThis as any;
  if (g.__protspaceWebglPerfSuiteInFlight || g.__protspaceWebglPerfSuiteConsumed) return;
  g.__protspaceWebglPerfSuiteInFlight = true;

  const iterations = (() => {
    const raw = params.get('webglPerfIterations');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
  })();

  let success = false;
  try {
    const datasets = await readDatasetList();
    const timeoutMs = 12 * 60_000;
    const createdAt = new Date().toISOString();
    const results: unknown[] = [];

    for (const datasetId of datasets) {
      await loadDataset(args, datasetId, timeoutMs);

      const plotAny = args.plotElement as any;
      const result = await plotAny.runWebGLRenderPerfMeasurements(iterations, {
        download: false,
        dataset: { id: datasetId, url: `/data/${datasetId}.parquetbundle` },
      });
      if (!result) {
        throw new Error(`perf: no result for dataset ${datasetId}`);
      }
      results.push(result);
    }

    const suite: PerfSuiteResult = {
      createdAt,
      iterations,
      results,
    };

    const safeCreatedAt = createdAt.split(':').join('-');
    downloadJson(`protspace-webgl-perf-suite-${safeCreatedAt}.json`, suite);
    success = true;
  } finally {
    g.__protspaceWebglPerfSuiteInFlight = false;
    if (success) g.__protspaceWebglPerfSuiteConsumed = true;
  }
}
