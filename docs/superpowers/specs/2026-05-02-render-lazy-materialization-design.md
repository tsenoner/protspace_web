# Render-Side Lazy Materialization (Phase 2.5) — Design

**Date:** 2026-05-02
**Author:** Tobias Senoner (with Claude Opus 4.7)
**Status:** 🔜 Designed; implementation pending. Branch target: `fix/load-reliability-phase-2`. Ships as part of PR-2 alongside Phase 2.

**Parent spec:** [2026-05-02-load-reliability-design.md](./2026-05-02-load-reliability-design.md) §11.

## 1. Problem

After Phase 2's conversion-layer wins shipped on `fix/load-reliability-phase-2`, manual load of `sprot_50.parquetbundle` (573,649 proteins, 22 categorical + 1 numeric annotation columns) still OOMs Chrome with "Aw, Snap! Error code: 5". Conversion now succeeds — `Loading new data: { protein_ids: Array(573649), … }` is logged — but the renderer crashes during the data-setter pipeline.

Root cause: `DataProcessor.processVisualizationData` (`packages/utils/src/visualization/data-processor.ts:17-91`) eagerly materializes one `PlotDataPoint` per protein, each carrying **six** fully-populated annotation Records (`annotationValues`, `annotationDisplayValues`, `numericAnnotationValues`, `numericAnnotationTypes`, `annotationScores`, `annotationEvidence`) covering all 22 columns. Per-point cost ≈ 6 KB; total ≈ **3.4 GB** in one synchronous allocation, exceeding Chrome's ~4 GB renderer cap.

Every actual read at runtime is per-point × small set of keys, never the full 22-key Record. The 3.4 GB is pure waste.

## 2. Goals

1. `sprot_50.parquetbundle` loads reliably in Chrome on a typical developer laptop without crashing.
2. Render-side heap allocation drops from ~3.4 GB to ~50 MB.
3. No regression in tooltip, hover, selection, isolation, or annotation switching behavior.

## 3. Non-goals (deferred)

- "Int32Array primary + overflow side-channel" optimization for mostly-single-valued multi columns (~150 MB additional savings — separate ticket if motivated).
- Lazy column-level decoding (Phase 3, [#239](https://github.com/tsenoner/protspace_web/issues/239)).
- Worker-based decode (Phase 3).
- Streaming row-group decode.

## 4. Approach

Strip all six annotation Records from `PlotDataPoint`. Consumers (style-getters, tooltip, tooltip-helpers) look up annotation data on demand against `VisualizationData` via a new accessor module. The lookup is cheap because Phase 2's `Int32Array` storage already made per-protein index access O(1).

Reads at runtime fall into three patterns, each addressed:

- **Hot render path (`style-getters.ts`)** — needs only `point.annotationValues[selectedAnnotation]` per protein per frame. Replaced by a single accessor call `getProteinAnnotationValues(data, originalIndex, selectedAnnotation)`.
- **Hover (`<protein-tooltip>`)** — needs five fields for the selected annotation plus three header keys (`gene_name`, `protein_name`, `uniprot_kb_id`). Hover handler builds a small `TooltipView` once per hover and passes it to the tooltip element.
- **Tooltip element** — receives a pure `TooltipView` instead of reaching into `protein.*` Records.

`PlotDataPoint` becomes pure layout data:

```ts
export interface PlotDataPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  originalIndex: number;
}
```

## 5. New module — `plot-data-accessors.ts`

Location: `packages/utils/src/visualization/plot-data-accessors.ts`. Sibling of `annotation-data-access.ts` (which holds index-only helpers introduced in Phase 2). Re-exported from `packages/utils/src/index.ts`.

Public surface:

```ts
import type { VisualizationData, NumericAnnotationType } from '../types.js';

// Hot path — used per-protein per render frame.
// Returns the raw annotation value strings for a protein on a given key.
// Empty array when the protein has no value for this key.
export function getProteinAnnotationValues(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): string[];

// Tooltip — display values run through the numeric-bin label map.
export function getProteinDisplayValues(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): string[];

export function getProteinNumericValue(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): number | null;

export function getProteinNumericType(
  data: VisualizationData,
  annotationKey: string,
): NumericAnnotationType;

export function getProteinScores(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): (number[] | null)[];

export function getProteinEvidence(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): (string | null)[];

// Tooltip view — assembled once per hover, never per-protein.
export interface TooltipView {
  geneName: string[]; // from annotationValues.gene_name / 'Gene name'
  proteinName: string[]; // from annotationValues.protein_name / 'Protein name'
  uniprotKbId: string[]; // from annotationValues.uniprot_kb_id
  displayValues: string[]; // for selectedAnnotation
  numericValue: number | null;
  numericType: NumericAnnotationType;
  scores: (number[] | null)[];
  evidence: (string | null)[];
}

export function buildTooltipView(
  data: VisualizationData,
  proteinIdx: number,
  selectedAnnotation: string | null,
): TooltipView;
```

Implementation notes:

- `getProteinAnnotationValues` reads `data.annotation_data[key]`, calls `getProteinAnnotationIndices` from `annotation-data-access.ts`, maps indices to `data.annotations[key].values[i]`, normalizes via `toInternalValue`. Phase 2's `Int32Array` storage makes the index lookup near-free; the `[index]` array allocation in `getProteinAnnotationIndices` happens once per call.
- `getProteinDisplayValues` builds the numeric bin label map via `getNumericBinLabelMap(annotation)` per call. Tooltip-only; called at hover frequency, so unmemoized for now. Memoization can be added later if profiling shows it matters.
- `buildTooltipView` accepts `selectedAnnotation: string | null`. When `null`, returns `displayValues: [], numericValue: null, numericType: 'float', scores: [], evidence: []`. Header fields are always populated when the named keys exist on `data.annotations`.
- All accessors are pure functions; no caching state in the module.

## 6. Type changes

`packages/utils/src/types.ts`:

```ts
// Before
export interface PlotDataPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  annotationValues: Record<string, string[]>;
  annotationDisplayValues?: Record<string, string[]>;
  numericAnnotationValues?: Record<string, number | null>;
  numericAnnotationTypes?: Record<string, NumericAnnotationType>;
  annotationScores?: Record<string, (number[] | null)[]>;
  annotationEvidence?: Record<string, (string | null)[]>;
  originalIndex: number;
}

// After
export interface PlotDataPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  originalIndex: number;
}
```

This is a breaking change to a public type exported from `@protspace/utils`. Acceptable because the consumers are all internal to this monorepo.

## 7. Consumer changes

### 7.1 `packages/utils/src/visualization/data-processor.ts`

Replace lines 17–91 with:

```ts
const processedData: PlotDataPoint[] = data.protein_ids.map((id, index) => {
  const coordinates = (data.projections[projectionIndex].data[index] ?? [0, 0]) as
    | [number, number]
    | [number, number, number];

  let xVal = coordinates[0];
  let yVal = coordinates[1];
  if (coordinates.length === 3) {
    if (projectionPlane === 'xz') {
      yVal = coordinates[2];
    } else if (projectionPlane === 'yz') {
      xVal = coordinates[1];
      yVal = coordinates[2];
    }
    return { id, x: xVal, y: yVal, z: coordinates[2], originalIndex: index };
  }
  return { id, x: xVal, y: yVal, originalIndex: index };
});
```

Removes 6 Record allocations × 22 keys × 573k points. Isolation filter at the bottom (lines 93–103) is unchanged.

### 7.2 `packages/core/src/components/scatter-plot/style-getters.ts`

Four reads of `point.annotationValues[styleConfig.selectedAnnotation]` (lines 121, 143, 184, 217) all become:

```ts
const annotationValueArray = getProteinAnnotationValues(
  data,
  point.originalIndex,
  styleConfig.selectedAnnotation,
);
```

`data` is already in closure scope. New import from `@protspace/utils`.

### 7.3 `packages/core/src/components/scatter-plot/protein-tooltip-helpers.ts`

Helpers change to take a `TooltipView`:

```ts
export function getGeneName(view: TooltipView): string | null {
  return filterAnnotationValues(view.geneName);
}
export function getProteinName(view: TooltipView): string | null {
  return filterAnnotationValues(view.proteinName);
}
export function getUniprotKbId(view: TooltipView): string | null {
  return filterAnnotationValues(view.uniprotKbId);
}
```

Field-mapping detail: `buildTooltipView` populates `geneName` from whichever of `data.annotations.gene_name` or `data.annotations['Gene name']` is present (today's helper checks both). Same fallback pattern for `proteinName` (`protein_name` / `'Protein name'`) and `uniprotKbId` (`uniprot_kb_id`).

### 7.4 `packages/core/src/components/scatter-plot/protein-tooltip.ts`

`@property` `protein: PlotDataPoint | null` is replaced with `view: TooltipView | null`. Reads at lines 82–92 become:

```ts
const displayValues = this.view.displayValues;
const rawNumericValue = this.view.numericValue;
const annotationNumericType = this.view.numericType;
const tooltipAnnotationScores = this.view.scores;
const tooltipAnnotationEvidence = this.view.evidence;
```

Header reads use the updated tooltip-helpers, passed `this.view`.

### 7.5 `packages/core/src/components/scatter-plot/scatter-plot.ts`

In `_handleProteinHovered` (or wherever the tooltip is opened), build the view once:

```ts
const view = buildTooltipView(this._data, point.originalIndex, this._selectedAnnotation);
this._tooltipView = view;
```

Replace any `protein={...}` prop wiring on `<protein-tooltip>` with `view={...}`. The `_hoveredPoint: { protein: PlotDataPoint; ... }` shape can stay — `protein` here is just for retaining the WebGL hit-test result; the tooltip itself reads from `_tooltipView`.

## 8. Files touched

- `packages/utils/src/types.ts` — `PlotDataPoint` interface stripped.
- `packages/utils/src/visualization/plot-data-accessors.ts` — NEW module.
- `packages/utils/src/index.ts` — re-export the new module.
- `packages/utils/src/visualization/data-processor.ts` — bare-point materialization.
- `packages/utils/src/visualization/data-processor.test.ts` — drop Record assertions; cover bare-point + isolation.
- `packages/core/src/components/scatter-plot/style-getters.ts` — accessor consumption.
- `packages/core/src/components/scatter-plot/style-getters.test.ts` — pass `data` into the closure under test.
- `packages/core/src/components/scatter-plot/protein-tooltip.ts` — `view` prop.
- `packages/core/src/components/scatter-plot/protein-tooltip-helpers.ts` — helpers take `TooltipView`.
- `packages/core/src/components/scatter-plot/scatter-plot.ts` — hover handler builds `TooltipView`; tooltip prop wiring.
- `packages/core/src/components/scatter-plot/quadtree-index.test.ts` — bare-point fixtures.
- NEW `packages/utils/src/visualization/plot-data-accessors.test.ts` — accessor unit tests.
- `app/tests/load-large-bundle.spec.ts` — restored Playwright spec for `sprot_50` (replaces stashed Task 14 from Phase 2).
- `app/tests/fixtures/sprot_50.parquetbundle` — copy from `protspace/data/other/sprot/`.

## 9. Acceptance — must be verified in the browser

1. `pnpm dev` → drop `sprot_50.parquetbundle` → load completes without "Aw, Snap!".
2. DevTools heap snapshot retained size after load **under 500 MB** (current state: crashes at >2–4 GB).
3. Switch the selected annotation across `kingdom`, `gene_name`, `pfam`, `cath`, `annotation_score` (numeric) — all render correctly with no console errors.
4. Hover several points under each selected annotation — tooltip header shows gene/protein name; selected annotation row shows correct value; numeric tooltip shows numeric value and type.
5. Reload — auto-load completes silently (Phase 1's `'success'` state).
6. `pnpm precommit` passes.
7. Playwright `app/tests/load-large-bundle.spec.ts` passes — drops sprot_50, verifies legend, tooltip, annotation switch, reload; `page.on('crash')` listener fails the test if the renderer dies.

## 10. Risks & mitigations

| Risk                                                                                                                                                   | Likelihood | Mitigation                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A consumer not in the audit reads a removed Record field, causing a runtime error or type error.                                                       | Low        | TypeScript catches direct reads since the fields are removed from the interface; `pnpm typecheck` is gating. Audit list in §8 covers all known reads.                                                                                                               |
| `getProteinDisplayValues` recomputes the numeric bin label map per call and shows up in profiling.                                                     | Low        | Style-getters use `getProteinAnnotationValues` (raw, no label map). Display values are tooltip-only (≤ ~10 Hz). Memoization can be added if profiling motivates it.                                                                                                 |
| Test fixtures construct `PlotDataPoint` literals with Records baked in.                                                                                | Medium     | All fixture sites updated in the same PR; type change is breaking by design. `pnpm typecheck` flushes them out.                                                                                                                                                     |
| Hover view is built before the user selects an annotation; tooltip blanks out a row.                                                                   | Low        | `buildTooltipView` accepts `selectedAnnotation: string \| null`; null-case returns empty/null fields. Tooltip already handles missing rows gracefully today.                                                                                                        |
| `getProteinAnnotationValues` allocates one tiny array per call from `getProteinAnnotationIndices`. With 573k points × N renders/sec this could be hot. | Low        | Today's hot path already allocates `point.annotationValues[key]` (a fresh array per access pattern via `Array.isArray` check). The new path's allocation is no worse, and the per-protein index lookup is cheaper because it bypasses Record string-key resolution. |

## 11. Effort estimate (LLM-assisted)

| Task                                                                      | Estimate       |
| ------------------------------------------------------------------------- | -------------- |
| New `plot-data-accessors.ts` module + unit tests                          | ~1 hour        |
| Strip `PlotDataPoint` Records + `data-processor.ts` rewrite + test fixups | ~30 min        |
| `style-getters.ts` update + test pass                                     | ~30 min        |
| Tooltip + tooltip-helpers + `scatter-plot.ts` hover wiring                | ~1 hour        |
| Restore Playwright spec + fixture, manual heap snapshot, browser verify   | ~1 hour        |
| **Total**                                                                 | **~3–4 hours** |

## 12. Rollout

Phase 2.5 ships on `fix/load-reliability-phase-2` as additional commits, then Phase 2 + Phase 2.5 ship together as PR-2.

After PR-2 merges, update [#239](https://github.com/tsenoner/protspace_web/issues/239) to note the render-layer fix is in place; the secondary "Int32Array primary + overflow side-channel" optimization stays on Phase 3 (lower priority).

## 13. References

- Parent spec: [2026-05-02-load-reliability-design.md](./2026-05-02-load-reliability-design.md) §11.
- `packages/utils/src/visualization/data-processor.ts:17-91` — current eager materialization.
- `packages/core/src/components/scatter-plot/style-getters.ts:121,143,184,217` — hot-path `point.annotationValues` reads.
- `packages/core/src/components/scatter-plot/protein-tooltip.ts:82-92` — tooltip Record reads.
- `packages/core/src/components/scatter-plot/protein-tooltip-helpers.ts:21-39` — header helpers.
- `packages/core/src/components/scatter-plot/scatter-plot.ts:790` — pre-existing TODO comment naming this memory cliff (out of date estimate, real cost is ~5× higher).
- Phase 2 module: `packages/utils/src/visualization/annotation-data-access.ts` — index-only accessors.
