# Load Reliability — Design

**Date:** 2026-05-02
**Author:** Tobias Senoner (with Claude Opus 4.7)
**Status:**

- **Phase 1** — ✅ SHIPPED in PR [#240](https://github.com/tsenoner/protspace_web/pull/240), merged at `2297acf`. Crash-loop guard works.
- **Phase 2** — implementation ⚠️ INCOMPLETE on branch `fix/load-reliability-phase-2`: §6.1, §6.2, §6.3, §6.4 committed (5 commits — see plan); §6.6 (sprot_50 Playwright spec) deferred (stashed locally) until Phase 2.5 lands.
- **Phase 2.5** — ✅ Implemented. Stripped per-point annotation Records from `PlotDataPoint`; consumers read on-demand via new `plot-data-accessors` module. Playwright spec loading sprot_50 (573,649 proteins) passes without renderer crash. See [`2026-05-02-render-lazy-materialization-design.md`](./2026-05-02-render-lazy-materialization-design.md). Commits `9ac2c64`…`02813fc` on `fix/load-reliability-phase-2`.
- **Phase 3** — tracked at [#239](https://github.com/tsenoner/protspace_web/issues/239); unchanged scope (worker-based decode + lazy column materialization + search/filter UI).

**Scope of this doc:** Phase 1 + Phase 2 only. The render-layer OOM discovery (Phase 2.5) is recorded in §11 as a follow-up; full Phase 2.5 design will be a separate spec.

## 1. Problem

Loading `sprot_50.parquetbundle` (573,649 proteins, 24 annotation columns, 45 MB on disk) crashes the renderer with Chrome's "Aw, Snap! Error code: 5" — a tab OOM. Worse, on every page reload the persisted dataset in OPFS is auto-loaded again, putting the user in an infinite crash loop. The page becomes unusable until OPFS is manually cleared.

The user reported this as related to issue [#217](https://github.com/tsenoner/protspace_web/issues/217) ("[BUG] Trying to create bins on non-numeric values"). Investigation shows #217 is partially related — the reported "binning of non-numeric categories" cannot occur with the current strict `Number()` parser at `packages/core/src/components/data-loader/utils/conversion.ts:73` — but the underlying memory-pressure picture #217 hints at is real and the cause of the crash.

## 2. Goals

1. Reloading the page after a crashed load must NOT auto-retry the same file. Show a recovery banner instead.
2. `sprot_50.parquetbundle` must load reliably in Chrome on a typical developer laptop without crashing.
3. Future big-dataset crashes are recoverable; the OPFS-cached file no longer becomes a poison pill.

## 3. Non-goals (deferred to Phase 3)

- Web Worker–based parquet decode and materialization.
- Streaming row-group decode.
- Lazy-by-column decoding (only decode an annotation column when its annotation is selected).
- Search/filter UI for finding specific values inside high-cardinality columns (e.g., a specific Pfam ID).
- Reliable support for datasets > 1 M proteins.
- True progress reporting during load (today the overlay just spins).

## 4. Root cause analysis

### 4.1 Symptom decoded

Chrome's "Aw, Snap! Error code: 5" is a renderer-process crash, in this context an OOM. The screenshot showed it after `sprot_50` was dragged in.

### 4.2 Bundle scale

Decoded directly with PyArrow:

| Part                 | Rows      | Columns                     |
| -------------------- | --------- | --------------------------- |
| selected_annotations | 573,649   | 24 (all string-typed)       |
| projections_metadata | 2         | 3                           |
| projections_data     | 1,147,298 | 5 (2 projections × 573,649) |

Cardinality of categorical columns after the frontend's parse semantics (split on `;`, then `parseAnnotationValue` strips a trailing `|score` or `|EVIDENCE`):

| Column                        | Unique labels | Multi-valued rows | Max entries / row |
| ----------------------------- | ------------- | ----------------- | ----------------- |
| pfam                          | 18,633        | 174,583           | 28                |
| cath                          | 5,501         | 173,203           | 20                |
| gene_name                     | 104,288       | 54                | 2                 |
| protein_families              | 9,926         | 7                 | 2                 |
| cc_subcellular_location       | 463           | 60,352            | 28                |
| superfamily                   | 1,932         | 117,867           | 12                |
| species                       | 11,676        | 0                 | 1                 |
| genus                         | 5,533         | 0                 | 1                 |
| All other categorical columns | ≤ 2,000       | ≤ 60k             | ≤ 2               |

Of the 23 annotation columns, 1 is numeric (`annotation_score`) and 22 are categorical. Of the categoricals, **6 contain any multi-valued rows** (pfam, cath, cc*subcellular_location, superfamily, gene_name, protein_families). The remaining **16 are strictly single-valued** — `maxValuesPerProtein === 1` for every protein. Two of the multi-valued columns (gene_name, protein_families) have only 54 / 7 rows with multiple entries respectively, but the spec treats them as multi-valued because the `Int32Array` storage in §6.1 requires \_strict* single-valuedness.

### 4.3 Where the memory goes

`extractAnnotationsOptimized` (`packages/core/src/components/data-loader/utils/conversion.ts:850`) builds, per categorical column:

- `valueCountMap: Map<string, number>` of unique labels → frequencies. Bounded by column cardinality.
- `colors: string[]` of length `uniqueValues.length` (`generateColors`, `conversion.ts:803`).
- `shapes: string[]` of length `uniqueValues.length` (`generateShapes`, `conversion.ts:825`).
- `annotationDataArray: number[][]` of length `numProteins`, each entry a fresh JS array of indices.

The dominant cost is `annotationDataArray`: ~573,649 small `number[]` arrays per column × 22 categorical columns = **~12.6 M tiny array allocations**, each carrying ~50–80 bytes of V8 overhead. Heap demand for `annotation_data` alone approaches 0.7–1 GB.

`mergeProjectionsWithAnnotations` (`packages/core/src/components/data-loader/utils/bundle.ts:165–172`) compounds the pressure: it spreads each of 1,147,298 projection rows into a fresh `{...projection, ...annotation}` object before downstream extraction.

A secondary bug: `materializeVisualizationData` (`packages/utils/src/visualization/numeric-binning.ts:779`) materializes **every numeric annotation** when `selectedNumericAnnotation` is null on first render, instead of materializing only the selected one. With strict numeric parsing only `annotation_score` is numeric in this dataset, so the bug isn't dominant here — but it is wrong, and it amplifies pressure on datasets with many numeric columns.

### 4.4 The infinite-reload loop

`persisted-dataset.ts:75–95` always re-attempts the OPFS-stored file on every page open. The OPFS metadata schema (`opfs-dataset-store.ts:6–13`) records `name / type / size / lastModified / storedAt` but no success/failure flag. A tab crash mid-load on N produces another auto-retry on N+1, ad infinitum. The dataset is poisonous to the page.

### 4.5 Likely "used to work" trigger

PR #228 (just merged on `main`) added per-cell `normalizeMissingValue` and a synthetic `__NA__` category, plus shifted numeric defaults to `quantile` strategy with sorted-values pre-allocation. None of these alone caused the cliff, but combined they trimmed enough headroom to push `sprot_50` over the edge on this machine.

## 5. Phase 1 — Crash-loop guard

### 5.1 Storage schema change

In `app/src/explore/opfs-dataset-store.ts`:

- Bump `SCHEMA_VERSION` to `2`.
- Extend `StoredDatasetMetadata`:
  ```ts
  interface StoredDatasetMetadata {
    schemaVersion: number;
    name: string;
    type: string;
    size: number;
    lastModified: number;
    storedAt: string;
    lastLoadStatus: 'pending' | 'success' | 'error';
    lastError?: string;
    failedAttempts?: number;
  }
  ```
- Migration: any `schemaVersion === 1` metadata is silently treated as `'success'` and rewritten with the new field on next save. Schema bumps that fail validation continue to surface `StoredDatasetCorruptError`.

Add two narrow APIs on the store:

```ts
export async function markLastLoadStatus(
  status: 'pending' | 'success' | 'error',
  options?: { error?: string },
): Promise<void>;

export async function readLastLoadStatus(): Promise<{
  status: 'pending' | 'success' | 'error';
  lastError?: string;
  failedAttempts: number;
} | null>;
```

`markLastLoadStatus('pending')` increments `failedAttempts` only if the previous status was already `'pending'` (i.e., we're starting again after a prior incomplete load). On `'success'`, the counter resets to 0.

### 5.2 Persisted-dataset controller change

Refactor `persisted-dataset.ts:loadPersistedOrDefaultDataset`:

```ts
const persistedFile = await loadLastImportedFile();
if (!persistedFile) {
  return loadDefaultDataset();
}

const status = await readLastLoadStatus();
if (status?.status === 'pending' || status?.status === 'error') {
  // Do NOT auto-load. Surface recovery banner with file metadata + lastError.
  showRecoveryBanner({
    file: persistedFile,
    failedAttempts: status.failedAttempts,
    lastError: status.lastError,
  });
  return;
}

await markLastLoadStatus('pending');
registerFileLoad(persistedFile, 'opfs');
setCurrentDatasetName(persistedFile.name);
setCurrentDatasetIsDemo(false);
await dataLoader.loadFromFile(persistedFile, { source: 'auto' });
```

The actual `'success'` write happens from the `data-loaded` event handler in `dataset-controller.ts`, _after_ the scatterplot has rendered the first frame — not at the end of `loadFromFile`. This guarantees a tab crash during render still leaves status as `'pending'`. On caught errors, write `'error'` with the error message.

### 5.3 Recovery banner

Implemented as a new file `app/src/explore/recovery-banner.ts` rendered in the existing notifications slot — separate from `notifications.ts` because the banner is sticky (not auto-dismissed) and has interactive actions, which the toast system does not currently model. Three actions:

1. **Try again** — calls `markLastLoadStatus('pending')` and re-runs `dataLoader.loadFromFile(persistedFile)`.
2. **Load default** — calls `loadDefaultDatasetAndClearPersistedFile`.
3. **Clear stored data** — `clearLastImportedFile()` + reload to the default state.

After three failed attempts (`failedAttempts >= 3`) the banner upgrades to a stronger message ("This dataset has failed to load multiple times — consider clearing it") and disables Try again until the user clicks Load default or Clear.

### 5.4 Files touched

- `app/src/explore/opfs-dataset-store.ts` — schema bump + new APIs + migration.
- `app/src/explore/persisted-dataset.ts` — gate auto-load behind status check, expose recovery hooks.
- `app/src/explore/dataset-controller.ts` — write `'success'` on `data-loaded`, `'error'` on load errors.
- New file `app/src/explore/recovery-banner.ts` (component + state machine for Try again / Load default / Clear).
- `app/src/explore/notifications.ts` — copy strings only; banner mount happens from `recovery-banner.ts`.
- `app/src/explore/opfs-dataset-store.test.ts` — extend coverage for migration + status APIs.

### 5.5 Acceptance — must be verified in the browser

1. `pnpm dev`, drop `sprot_50.parquetbundle`, kill the tab via DevTools "Crash" while loading. Reload — recovery banner appears with three actions. No auto-retry.
2. Load a small bundle that succeeds. Reload — auto-loads silently, no banner.
3. Pre-existing OPFS metadata (schemaVersion=1) — silently migrated to `'success'`, auto-loads on first run after upgrade.
4. After 3 failed Try-again clicks, banner upgrades and disables Try again.

## 6. Phase 2 — Targeted memory wins

### 6.1 Single-valued categorical columns use `Int32Array`

In `extractAnnotationsOptimized` (`conversion.ts:850`):

- During Pass 1, in addition to `valueCountMap`, track `maxValuesPerProtein` (the maximum number of indices any one protein contributed to this column).
- After Pass 1: if `maxValuesPerProtein === 1`, allocate `annotation_data[col]` as `Int32Array(numProteins)` initialized to `-1`. Pass 2 writes a single `Int32Array[idx] = valueIndex` per protein.
- Otherwise, fall back to today's `number[][]`.

Type model in `packages/utils/src/types.ts`:

```ts
export type AnnotationData =
  | Int32Array // single-valued column (sentinel -1 = missing)
  | (readonly number[])[]; // multi-valued column (per-protein index list)
```

A new accessor module at `packages/utils/src/visualization/annotation-data-access.ts` (kept separate from `data-processor.ts` so the dual-shape branching is testable in isolation):

```ts
export function getProteinAnnotationIndices(
  data: AnnotationData,
  proteinIdx: number,
): readonly number[];

export function getProteinAnnotationCount(data: AnnotationData, proteinIdx: number): number;
```

For `Int32Array` storage, `getProteinAnnotationIndices` returns `[index]` (or `[]` if the slot is `-1`) — a small allocation, but only on demand at the call site, not for every protein up front. The dominant scatterplot color path will use a specialized `getFirstIndex(data, proteinIdx): number` accessor that avoids any allocation.

### 6.2 Drop the spread-merge in `mergeProjectionsWithAnnotations`

Replace the per-row `{...projection, ...annotation}` allocation in `bundle.ts:165–172` with a `RowSource` interface that returns projection fields and annotation fields without materializing a merged row. `extractRowsFromParquetBundle` returns:

```ts
export interface BundleExtractionResult {
  projections: Rows;
  annotationsById: Map<string, GenericRow>;
  projectionIdColumn: string;
  annotationIdColumn: string;
  projectionsMetadata: Rows;
  settings: BundleSettings | null;
}
```

`extractAnnotationsOptimized` and projection extraction read directly from these without spreading. Saves ~1.1 M object allocations.

### 6.3 Pair-aware color/shape generation

Replace `generateColors(count)` and `generateShapes(count)` with a single `generateColorsAndShapes(paletteId, count)`:

```ts
export function generateColorsAndShapes(
  paletteId: ColorSchemeId,
  count: number,
): { colors: string[]; shapes: string[] } {
  const palette = COLOR_SCHEMES[paletteId] ?? COLOR_SCHEMES.kellys;
  const shapeCount = SUPPORTED_SHAPES.length;
  const cap = Math.min(count, palette.length * shapeCount);
  const colors: string[] = new Array(cap);
  const shapes: string[] = new Array(cap);
  for (let i = 0; i < cap; i++) {
    colors[i] = palette[i % palette.length];
    shapes[i] = SUPPORTED_SHAPES[Math.floor(i / palette.length) % shapeCount];
  }
  return { colors, shapes };
}
```

This yields `palette.length * shapeCount` distinct (color, shape) pairs (e.g., 21 × 6 = 126 for Kelly's, 3× the 42 reachable today).

Consumers of `colors[i]` / `shapes[i]` change to `colors[i % colors.length]` / `shapes[i % shapes.length]`. Audit list (must be updated in the same PR):

- `packages/core/src/components/legend/legend-data-processor.ts`
- `packages/core/src/components/legend/legend.ts`
- `packages/core/src/components/scatter-plot/*` (color pipeline)
- `packages/utils/src/visualization/export-utils.ts`
- `packages/core/src/components/legend/legend-settings-dialog.ts`

User-pinned color/shape overrides remain stored per-category-value (not per-index) via the persistence controller, so capping the array doesn't drop any user customization.

### 6.4 Fix `materializeVisualizationData` null-selection gate

`packages/utils/src/visualization/numeric-binning.ts:779` — change:

```ts
const shouldMaterialize = requestedAnnotations
  ? requestedAnnotations.has(annotationName)
  : !selectedNumericAnnotation || annotationName === selectedNumericAnnotation;
```

to:

```ts
const shouldMaterialize = requestedAnnotations
  ? requestedAnnotations.has(annotationName)
  : annotationName === selectedNumericAnnotation; // null → none
```

When no annotation is selected at first render, materialize none. Update unit tests accordingly.

### 6.5 Files touched

- `packages/core/src/components/data-loader/utils/conversion.ts` — `Int32Array` branch in `extractAnnotationsOptimized`; `generateColors`/`generateShapes` → `generateColorsAndShapes`.
- `packages/core/src/components/data-loader/utils/bundle.ts` — `RowSource` shape, no per-row spread.
- `packages/utils/src/types.ts` — `AnnotationData` union type (already the home of shared annotation types).
- `packages/utils/src/visualization/annotation-data-access.ts` — new accessor module (`getProteinAnnotationIndices`, `getProteinAnnotationCount`, `getFirstIndex`).
- `packages/utils/src/index.ts` — re-export the new accessor module.
- `packages/core/src/components/legend/legend-data-processor.ts`, `legend.ts` — accessor consumption + `colors[i % len]` / `shapes[i % len]`.
- `packages/core/src/components/scatter-plot/*` — color pipeline accessor.
- `packages/utils/src/visualization/export-utils.ts` — accessor consumption for export.
- `packages/utils/src/visualization/numeric-binning.ts` — null-selection gate fix.
- Updated tests in `conversion-numeric.test.ts`, `bundle-roundtrip.test.ts`, `numeric-binning.test.ts`, plus a new `annotation-data-access.test.ts`.
- New Playwright spec `app/tests/load-large-bundle.spec.ts` that loads `sprot_50` and asserts non-empty legend + selected scatter render.

### 6.6 Acceptance — must be verified in the browser

1. `pnpm dev` → drop `sprot_50.parquetbundle` → load completes without "Aw, Snap!".
2. DevTools heap snapshot retained size after load **under 500 MB** (current state crashes at >2–4 GB).
3. Switch the selected annotation across `kingdom`, `gene_name`, `pfam`, `cath`, `annotation_score` (numeric) — all render correctly with no console errors.
4. Reload — auto-load completes silently (Phase 1's `'success'` state).
5. `pnpm precommit` passes.
6. New tests pass:
   - Single-valued column produces `Int32Array`.
   - Multi-valued column produces `(readonly number[])[]`.
   - Pair-aware color generator yields 126 distinct (color, shape) pairs for Kelly's, with `colors[126]` colliding with `colors[0]`.
   - `materializeVisualizationData(data, {}, 10, null)` returns `data` unchanged.

## 7. Risks & mitigations

| Risk                                                                                                                           | Likelihood | Mitigation                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Int32Array` shape change leaks past the accessor and breaks a downstream consumer (sort, filter, export)                      | Medium     | Single accessor `getProteinAnnotationIndices`; grep for direct `annotation_data[col][i]` reads and route through it; `AnnotationData` union enforces shape via type-check.                           |
| `mergeProjectionsWithAnnotations` removal breaks projection switching                                                          | Low–Medium | The only consumers are `extractAnnotationsOptimized` and projection extraction — both will read via the `RowSource` interface. Test: switching between 2D/3D projections still re-renders correctly. |
| `colors[idx % len]` contract change misses a consumer (e.g., persisted legend export)                                          | Low        | Audit all `colors[`/`shapes[` usages before merge; persisted user overrides keyed by `categoryValue` not index, so unaffected.                                                                       |
| Phase 1 metadata schemaVersion bump strands users with existing OPFS data                                                      | Low        | Old metadata silently treated as `'success'`; only new loads get `'pending'` until verified.                                                                                                         |
| OPFS write-after-`data-loaded` race — tab killed between load success and status write → next reload thinks it's still pending | Low        | Acceptable. User sees recovery banner once and clicks Try again; load succeeds and clears it. Better than the inverse (false-success after a real crash).                                            |
| Phase 2 introduces a regression in legend rendering at 100k+ scale that small-bundle tests miss                                | Medium     | Browser verification on `sprot_50` is mandatory pre-merge. Playwright test loads `sprot_50` and asserts legend + scatter render.                                                                     |

## 8. Rollout

Two PRs, sequenced:

1. **PR-1: Phase 1 (crash-loop guard)** — independent, ships first. Smallest blast radius.
2. **PR-2: Phase 2 (memory wins)** — ships when `sprot_50` loads cleanly in Playwright + a manual heap snapshot is under target.

Phase 3 (worker-based decode + lazy column materialization + search/filter UI) is filed as a separate GitHub issue with a link to this spec.

## 9. Effort estimate (LLM-assisted)

| Task                                                                     | Estimate           |
| ------------------------------------------------------------------------ | ------------------ |
| Phase 1 (crash-loop guard, including migration + tests + browser verify) | ~1–2 hours         |
| Phase 2 (memory wins, including consumer audit + tests + browser verify) | ~half day          |
| Playwright spec for large-bundle load                                    | ~30 min            |
| **Total**                                                                | **~half to 1 day** |

## 10. References

- Issue [#217](https://github.com/tsenoner/protspace_web/issues/217) — partial trigger; binning of non-numeric not directly causal under strict `Number()` parser, but motivated the investigation.
- PR [#228](https://github.com/tsenoner/protspace_web/pull/228) — NA redesign + numeric type inference; added per-cell normalization that narrowed memory headroom.
- PR [#240](https://github.com/tsenoner/protspace_web/pull/240) — Phase 1 (crash-loop guard) shipped.
- Issue [#239](https://github.com/tsenoner/protspace_web/issues/239) — Phase 3 (worker-based decode).
- `packages/core/src/components/data-loader/utils/conversion.ts:850` — `extractAnnotationsOptimized`.
- `packages/utils/src/visualization/numeric-binning.ts:779` — null-selection materialization bug.
- `app/src/explore/persisted-dataset.ts:75-95` — auto-reload site.
- `app/src/explore/opfs-dataset-store.ts:6-13` — metadata schema.

## 11. Post-implementation discovery — render-layer OOM (Phase 2.5)

**Discovered:** 2026-05-02 during Task 14 verification.

After Phase 2's wins (§6.1–§6.4) shipped on `fix/load-reliability-phase-2`, manual sprot_50 load still OOMs Chrome with "Aw, Snap!". The root cause has shifted from the conversion layer to the render layer:

**Conversion layer (Phase 2 fixed)**: `Int32Array` storage for 16/22 categorical columns, dropped projection×annotation spread merge, pair-aware color/shape generator, null-selection materialization gate. Conversion now completes successfully — `Loading new data: {protein_ids: Array(573649), …}` is logged.

**Render layer (Phase 2.5 to fix)**: After conversion, `applyPlotState(plot, data, initialView)` triggers `<protspace-scatterplot>`'s data-setter pipeline. That pipeline calls `DataProcessor.processVisualizationData` (`packages/utils/src/visualization/data-processor.ts:17-91`) which **eagerly builds 573,649 `PlotDataPoint` objects** via `data.protein_ids.map(...)`. Each point carries 6 fully-populated `Record<string, ...>` annotation maps (`annotationValues`, `annotationDisplayValues`, `numericAnnotationValues`, `numericAnnotationTypes`, `annotationScores`, `annotationEvidence`) covering all 22 columns. Cost per point ≈ 6 KB; total ≈ **3.4 GB** in one synchronous allocation. Chrome's ~4 GB cap is exceeded mid-`map`.

The TODO comment at `scatter-plot.ts:792` already names this ("the ~700 MB memory spike from rebuilding the full PlotDataPoint array") but its estimate predates the four extra Records that were added later, so today's actual cost is far higher.

**Phase 2.5 candidate fix (to be designed in a separate spec):** stop materializing per-point annotation Records up front. Replace with bare `PlotDataPoint`s (`{id, x, y, z, originalIndex}`) + on-demand accessors against `data.annotations` / `data.annotation_data` (which is already cheap thanks to Int32Array). Tooltip / hover / selection / export consumers become lookup-driven instead of receiving pre-baked Records. Estimated post-fix render-side heap: ~50 MB (down from 3.4 GB).

**Secondary opportunity (lower priority):** 6 categorical columns (gene_name, protein_families, plus the 4 truly multi-valued: pfam, cath, cc_subcellular_location, superfamily) stay on `number[][]` because `maxValuesPerProtein > 1`. For gene_name and protein_families, only 54 / 7 rows respectively are multi-valued out of 573k — a "Int32Array primary + overflow side-channel" optimization recovers ~150 MB.

**PR-2 will not ship until Phase 2.5 lands.** Task 14's Playwright spec is stashed locally.
