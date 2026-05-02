# Render-Side Lazy Materialization (Phase 2.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop render-layer heap allocation from ~3.4 GB to ~50 MB by stripping annotation Records from `PlotDataPoint` and routing per-point reads through a new on-demand accessor module, fixing the OOM that prevents `sprot_50.parquetbundle` (573,649 proteins) from loading.

**Architecture:** Add `packages/utils/src/visualization/plot-data-accessors.ts` exposing per-field accessors (used by the hot render path) and a `buildTooltipView` helper (used once per hover). Migrate consumers (style-getters, tooltip element, tooltip helpers, scatter-plot hover handler) to the accessors first. Last, strip the Records from `PlotDataPoint` and simplify `DataProcessor.processVisualizationData`. Each task ends with a green build.

**Tech Stack:** TypeScript, Lit web components, Vitest for unit tests, Playwright for browser verification, pnpm + Turbo monorepo.

**Spec:** [`docs/superpowers/specs/2026-05-02-render-lazy-materialization-design.md`](../specs/2026-05-02-render-lazy-materialization-design.md)

**Branch:** `fix/load-reliability-phase-2` (already has Phase 1 + Phase 2 commits + Phase 2.5 spec).

---

## File map

**Created**

- `packages/utils/src/visualization/plot-data-accessors.ts` — per-field accessors + `buildTooltipView`.
- `packages/utils/src/visualization/plot-data-accessors.test.ts` — accessor unit tests.

**Modified**

- `packages/utils/src/index.ts` — re-export the new module.
- `packages/utils/src/types.ts` — strip Records from `PlotDataPoint`.
- `packages/utils/src/visualization/data-processor.ts` — bare-point materialization.
- `packages/utils/src/visualization/data-processor.test.ts` — drop Record assertions.
- `packages/core/src/components/scatter-plot/style-getters.ts` — read via accessor.
- `packages/core/src/components/scatter-plot/style-getters.test.ts` — fixtures use bare points.
- `packages/core/src/components/scatter-plot/protein-tooltip-helpers.ts` — helpers take `string[]`.
- `packages/core/src/components/scatter-plot/protein-tooltip-helpers.test.ts` — helper test signatures.
- `packages/core/src/components/scatter-plot/protein-tooltip.ts` — `view` prop.
- `packages/core/src/components/scatter-plot/scatter-plot.ts` — build `TooltipView` in hover handler; `_tooltipData` shape; prop wiring.
- `packages/core/src/components/scatter-plot/quadtree-index.test.ts` — bare-point fixtures.

**Restored**

- `app/tests/load-large-bundle.spec.ts` — sprot_50 Playwright spec (was stashed at end of Phase 2).
- `app/tests/fixtures/sprot_50.parquetbundle` — copied from `protspace/data/other/sprot/`.

---

## Task 1: New `plot-data-accessors.ts` module

Pure additive change. Creates the accessor module and its unit tests. No type breakage; nothing else changes yet.

**Files:**

- Create: `packages/utils/src/visualization/plot-data-accessors.ts`
- Create: `packages/utils/src/visualization/plot-data-accessors.test.ts`
- Modify: `packages/utils/src/index.ts`

- [ ] **Step 1: Write the failing test file**

Create `packages/utils/src/visualization/plot-data-accessors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getProteinAnnotationValues,
  getProteinDisplayValues,
  getProteinNumericValue,
  getProteinNumericType,
  getProteinScores,
  getProteinEvidence,
  buildTooltipView,
} from './plot-data-accessors';
import type { VisualizationData } from '../types';

const baseData = (): VisualizationData => ({
  protein_ids: ['p0', 'p1', 'p2'],
  projections: [
    {
      name: 't',
      data: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    },
  ],
  annotations: {
    species: {
      kind: 'categorical',
      values: ['human', 'mouse', '__NA__'],
      colors: ['#f00', '#0f0', '#ccc'],
      shapes: ['circle', 'square', 'circle'],
    },
    gene_name: {
      kind: 'categorical',
      values: ['BRCA1', '__NA__'],
      colors: ['#00f', '#ccc'],
      shapes: ['circle', 'circle'],
    },
  },
  annotation_data: {
    species: Int32Array.of(0, 1, 2),
    gene_name: Int32Array.of(0, -1, -1),
  },
});

describe('plot-data-accessors', () => {
  describe('getProteinAnnotationValues', () => {
    it('returns mapped value for Int32Array storage with populated slot', () => {
      expect(getProteinAnnotationValues(baseData(), 0, 'species')).toEqual(['human']);
      expect(getProteinAnnotationValues(baseData(), 1, 'species')).toEqual(['mouse']);
    });

    it('returns __NA__ for missing slot (-1) in Int32Array column', () => {
      expect(getProteinAnnotationValues(baseData(), 1, 'gene_name')).toEqual([]);
    });

    it('returns mapped values for multi-valued (number[][]) storage', () => {
      const data = baseData();
      data.annotation_data.species = [[0, 1], [2], []];
      expect(getProteinAnnotationValues(data, 0, 'species')).toEqual(['human', 'mouse']);
      expect(getProteinAnnotationValues(data, 2, 'species')).toEqual([]);
    });

    it('returns empty array when annotation key is missing from annotation_data', () => {
      expect(getProteinAnnotationValues(baseData(), 0, 'nonexistent')).toEqual([]);
    });
  });

  describe('getProteinDisplayValues', () => {
    it('returns raw values when annotation has no numeric bin label map', () => {
      expect(getProteinDisplayValues(baseData(), 0, 'species')).toEqual(['human']);
    });

    it('substitutes numeric bin labels when annotation has binning metadata', () => {
      const data = baseData();
      data.annotations.score = {
        kind: 'numeric',
        values: ['0', '1'],
        colors: ['#000', '#fff'],
        shapes: ['circle', 'circle'],
        numericMetadata: {
          strategy: 'linear',
          binCount: 2,
          numericType: 'float',
          signature: 'sig',
          topologySignature: 'topo',
          logSupported: false,
          bins: [
            { id: '0', label: 'low', lowerBound: 0, upperBound: 5, count: 1 },
            { id: '1', label: 'high', lowerBound: 5, upperBound: 10, count: 1 },
          ],
        },
      };
      data.annotation_data.score = Int32Array.of(0, 1, -1);
      expect(getProteinDisplayValues(data, 0, 'score')).toEqual(['low']);
      expect(getProteinDisplayValues(data, 1, 'score')).toEqual(['high']);
    });
  });

  describe('getProteinNumericValue', () => {
    it('returns the numeric value at the protein index', () => {
      const data = baseData();
      data.numeric_annotation_data = { score: [3.14, 2.71, null] };
      expect(getProteinNumericValue(data, 0, 'score')).toBe(3.14);
      expect(getProteinNumericValue(data, 2, 'score')).toBeNull();
    });

    it('returns null when the column is absent', () => {
      expect(getProteinNumericValue(baseData(), 0, 'score')).toBeNull();
    });
  });

  describe('getProteinNumericType', () => {
    it('returns the annotation numericType when present', () => {
      const data = baseData();
      data.annotations.score = {
        kind: 'numeric',
        values: ['x'],
        colors: ['#000'],
        shapes: ['circle'],
        numericType: 'int',
      };
      expect(getProteinNumericType(data, 'score')).toBe('int');
    });

    it("defaults to 'float' when annotation is missing", () => {
      expect(getProteinNumericType(baseData(), 'absent')).toBe('float');
    });
  });

  describe('getProteinScores', () => {
    it('returns the score array for the protein index', () => {
      const data = baseData();
      data.annotation_scores = { species: [[[1.5]], [null], [null]] };
      expect(getProteinScores(data, 0, 'species')).toEqual([[1.5]]);
    });

    it('returns empty array when scores are absent', () => {
      expect(getProteinScores(baseData(), 0, 'species')).toEqual([]);
    });
  });

  describe('getProteinEvidence', () => {
    it('returns the evidence array for the protein index', () => {
      const data = baseData();
      data.annotation_evidence = { species: [['ECO:1'], [null], [null]] };
      expect(getProteinEvidence(data, 0, 'species')).toEqual(['ECO:1']);
    });

    it('returns empty array when evidence is absent', () => {
      expect(getProteinEvidence(baseData(), 0, 'species')).toEqual([]);
    });
  });

  describe('buildTooltipView', () => {
    it('returns header values from gene_name / protein_name / uniprot_kb_id keys', () => {
      const data = baseData();
      data.annotations.protein_name = {
        kind: 'categorical',
        values: ['BRCA1 protein'],
        colors: ['#000'],
        shapes: ['circle'],
      };
      data.annotation_data.protein_name = Int32Array.of(0, -1, -1);
      data.annotations.uniprot_kb_id = {
        kind: 'categorical',
        values: ['P00001'],
        colors: ['#000'],
        shapes: ['circle'],
      };
      data.annotation_data.uniprot_kb_id = Int32Array.of(0, -1, -1);
      const view = buildTooltipView(data, 0, 'species');
      expect(view.geneName).toEqual(['BRCA1']);
      expect(view.proteinName).toEqual(['BRCA1 protein']);
      expect(view.uniprotKbId).toEqual(['P00001']);
      expect(view.displayValues).toEqual(['human']);
    });

    it('falls back to "Gene name" / "Protein name" keys when snake_case keys are absent', () => {
      const data: VisualizationData = {
        protein_ids: ['p0'],
        projections: [{ name: 't', data: [[0, 0]] }],
        annotations: {
          'Gene name': {
            kind: 'categorical',
            values: ['BRCA1'],
            colors: ['#000'],
            shapes: ['circle'],
          },
          'Protein name': {
            kind: 'categorical',
            values: ['BRCA1 protein'],
            colors: ['#000'],
            shapes: ['circle'],
          },
        },
        annotation_data: {
          'Gene name': Int32Array.of(0),
          'Protein name': Int32Array.of(0),
        },
      };
      const view = buildTooltipView(data, 0, null);
      expect(view.geneName).toEqual(['BRCA1']);
      expect(view.proteinName).toEqual(['BRCA1 protein']);
    });

    it('returns empty selected-annotation fields when selectedAnnotation is null', () => {
      const view = buildTooltipView(baseData(), 0, null);
      expect(view.displayValues).toEqual([]);
      expect(view.numericValue).toBeNull();
      expect(view.numericType).toBe('float');
      expect(view.scores).toEqual([]);
      expect(view.evidence).toEqual([]);
    });

    it('returns empty header arrays when the named annotations are absent', () => {
      const view = buildTooltipView(baseData(), 0, 'species');
      expect(view.geneName).toEqual(['BRCA1']); // baseData has gene_name
      // No protein_name / uniprot_kb_id in baseData
      expect(view.proteinName).toEqual([]);
      expect(view.uniprotKbId).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/utils test:ci -- plot-data-accessors`

Expected: FAIL — module does not exist (`Cannot find module './plot-data-accessors'`).

- [ ] **Step 3: Implement the accessor module**

Create `packages/utils/src/visualization/plot-data-accessors.ts`:

```ts
import type { VisualizationData, NumericAnnotationType } from '../types.js';
import { getProteinAnnotationIndices } from './annotation-data-access.js';
import { getNumericBinLabelMap } from './numeric-binning.js';
import { toInternalValue } from './missing-values.js';

/**
 * Hot path — used per-protein per render frame.
 * Returns the raw annotation value strings for a protein on a given key.
 * Empty array when the protein has no value for this key.
 */
export function getProteinAnnotationValues(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): string[] {
  const annotation = data.annotations[annotationKey];
  const annotationRows = data.annotation_data?.[annotationKey];
  if (!annotation || !annotationRows || !Array.isArray(annotation.values)) return [];
  const indices = getProteinAnnotationIndices(annotationRows, proteinIdx);
  if (indices.length === 0) return [];
  const out: string[] = [];
  for (const i of indices) {
    if (Number.isFinite(i)) {
      out.push(toInternalValue(annotation.values[i]));
    }
  }
  return out;
}

/**
 * Tooltip — display values run through the numeric-bin label map.
 */
export function getProteinDisplayValues(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): string[] {
  const annotation = data.annotations[annotationKey];
  const values = getProteinAnnotationValues(data, proteinIdx, annotationKey);
  if (!annotation || values.length === 0) return values;
  const labelMap = getNumericBinLabelMap(annotation);
  if (labelMap.size === 0) return values;
  return values.map((v) => labelMap.get(v) ?? v);
}

export function getProteinNumericValue(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): number | null {
  return data.numeric_annotation_data?.[annotationKey]?.[proteinIdx] ?? null;
}

export function getProteinNumericType(
  data: VisualizationData,
  annotationKey: string,
): NumericAnnotationType {
  const annotation = data.annotations[annotationKey];
  return annotation?.numericType ?? annotation?.numericMetadata?.numericType ?? 'float';
}

export function getProteinScores(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): (number[] | null)[] {
  const scores = data.annotation_scores?.[annotationKey]?.[proteinIdx];
  return Array.isArray(scores) ? scores : [];
}

export function getProteinEvidence(
  data: VisualizationData,
  proteinIdx: number,
  annotationKey: string,
): (string | null)[] {
  const evidence = data.annotation_evidence?.[annotationKey]?.[proteinIdx];
  return Array.isArray(evidence) ? evidence : [];
}

/**
 * Tooltip view — assembled once per hover, never per-protein.
 */
export interface TooltipView {
  proteinId: string;
  geneName: string[];
  proteinName: string[];
  uniprotKbId: string[];
  displayValues: string[];
  numericValue: number | null;
  numericType: NumericAnnotationType;
  scores: (number[] | null)[];
  evidence: (string | null)[];
}

function getHeaderValues(
  data: VisualizationData,
  proteinIdx: number,
  primaryKey: string,
  fallbackKey: string,
): string[] {
  if (data.annotations[primaryKey]) {
    return getProteinAnnotationValues(data, proteinIdx, primaryKey);
  }
  if (data.annotations[fallbackKey]) {
    return getProteinAnnotationValues(data, proteinIdx, fallbackKey);
  }
  return [];
}

export function buildTooltipView(
  data: VisualizationData,
  proteinIdx: number,
  selectedAnnotation: string | null,
): TooltipView {
  const proteinId = data.protein_ids[proteinIdx] ?? '';
  const geneName = getHeaderValues(data, proteinIdx, 'gene_name', 'Gene name');
  const proteinName = getHeaderValues(data, proteinIdx, 'protein_name', 'Protein name');
  const uniprotKbId = data.annotations.uniprot_kb_id
    ? getProteinAnnotationValues(data, proteinIdx, 'uniprot_kb_id')
    : [];

  if (!selectedAnnotation) {
    return {
      proteinId,
      geneName,
      proteinName,
      uniprotKbId,
      displayValues: [],
      numericValue: null,
      numericType: 'float',
      scores: [],
      evidence: [],
    };
  }

  return {
    proteinId,
    geneName,
    proteinName,
    uniprotKbId,
    displayValues: getProteinDisplayValues(data, proteinIdx, selectedAnnotation),
    numericValue: getProteinNumericValue(data, proteinIdx, selectedAnnotation),
    numericType: getProteinNumericType(data, selectedAnnotation),
    scores: getProteinScores(data, proteinIdx, selectedAnnotation),
    evidence: getProteinEvidence(data, proteinIdx, selectedAnnotation),
  };
}
```

- [ ] **Step 4: Re-export from package index**

Modify `packages/utils/src/index.ts` to re-export the new module. Find the existing `export * from './visualization/annotation-data-access.js';` line (or similar visualization exports) and add adjacent to it:

```ts
export * from './visualization/plot-data-accessors.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @protspace/utils test:ci -- plot-data-accessors`

Expected: PASS — all `plot-data-accessors` tests pass.

- [ ] **Step 6: Run full quality gate**

Run: `pnpm precommit`

Expected: format + lint + typecheck + tests + docs:build all pass. No regression in any package.

- [ ] **Step 7: Commit**

```bash
git add packages/utils/src/visualization/plot-data-accessors.ts \
        packages/utils/src/visualization/plot-data-accessors.test.ts \
        packages/utils/src/index.ts
git commit -m "feat(utils): plot-data-accessors module for lazy point reads"
```

---

## Task 2: Migrate `style-getters.ts` to read via accessor

The hot render path (called per-protein per frame) stops reading `point.annotationValues[selectedAnnotation]` and starts using `getProteinAnnotationValues(data, point.originalIndex, selectedAnnotation)`. `data` is already in closure.

This task does NOT remove the `annotationValues` field from `PlotDataPoint` yet — it just stops reading from it. Tests still construct points with `annotationValues` Records (which become unused). Build stays green.

**Files:**

- Modify: `packages/core/src/components/scatter-plot/style-getters.ts:121,143,184,217`
- Modify: `packages/core/src/components/scatter-plot/style-getters.test.ts`

- [ ] **Step 1: Update style-getters.ts to import the accessor**

Modify `packages/core/src/components/scatter-plot/style-getters.ts:1-3`. Find:

```ts
import { NEUTRAL_VALUE_COLOR } from './config';
import type { PlotDataPoint, VisualizationData } from '@protspace/utils';
import { isNumericAnnotation, normalizeShapeName, toInternalValue } from '@protspace/utils';
```

Replace with:

```ts
import { NEUTRAL_VALUE_COLOR } from './config';
import type { PlotDataPoint, VisualizationData } from '@protspace/utils';
import {
  getProteinAnnotationValues,
  isNumericAnnotation,
  normalizeShapeName,
  toInternalValue,
} from '@protspace/utils';
```

- [ ] **Step 2: Replace four `point.annotationValues[...]` reads with accessor calls**

In `packages/core/src/components/scatter-plot/style-getters.ts`, replace the line at `:121` (inside `getPointShape`):

```ts
const annotationValueArray = point.annotationValues[styleConfig.selectedAnnotation];
```

with:

```ts
const annotationValueArray = getProteinAnnotationValues(
  data,
  point.originalIndex,
  styleConfig.selectedAnnotation,
);
```

Apply the identical replacement to lines `:143` (inside `getColors`), `:184` (inside `getOpacity`), and `:217` (inside `getDepth`).

Note for line `:184` — today's code is:

```ts
const annotationValue = point.annotationValues[styleConfig.selectedAnnotation];
```

(variable name `annotationValue`, not `annotationValueArray`). Replace it with:

```ts
const annotationValue = getProteinAnnotationValues(
  data,
  point.originalIndex,
  styleConfig.selectedAnnotation,
);
```

(same RHS, keep the original local variable name).

After this change, `point.annotationValues` is no longer read anywhere in `style-getters.ts`.

- [ ] **Step 3: Update test fixtures to omit reliance on Records**

In `packages/core/src/components/scatter-plot/style-getters.test.ts`, the four `describe` blocks each define their own `createMockPoint`. They build points with `originalIndex: 0` and a corresponding `annotationValues` Record. Post-migration, `originalIndex` must point to the matching row in `data.annotation_data[selectedAnnotation]`.

Replace each `createMockPoint` factory and update test call sites.

For `describe('N/A value handling')` (top of file, around line 14):

Replace the existing `createMockPoint` and the way it's called. The mock data is built from `createMockData([null, 'value1', 'value2'])` which produces:

- `protein_ids: ['protein_0', 'protein_1', 'protein_2']`
- `annotation_data.test_annotation: [[0], [1], [2]]` (multi-valued storage; after migration the accessor handles this fine)

Update the factory to require an explicit `originalIndex`:

```ts
const createMockPoint = (id: string, originalIndex: number): PlotDataPoint => ({
  id,
  x: 0,
  y: 0,
  z: 0,
  originalIndex,
  annotationValues: {
    test_annotation: [], // unused after migration; kept for type compat until Task 4
  },
});
```

Then update each call site in this `describe` block:

| Old call                    | New call                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `createMockPoint(null)`     | `createMockPoint('protein_0', 0)`                                                                                             |
| `createMockPoint('value1')` | `createMockPoint('protein_1', 1)`                                                                                             |
| `createMockPoint('__NA__')` | `createMockPoint('protein_0', 0)` (the test in this case uses `createMockData(['__NA__', 'value1'])` so **NA** is at index 0) |

For `describe('depth stability across visibility toggles')` (around line 169):

The mock data is `createMockData(['categoryA', 'categoryB', 'categoryC'])`. Replace the factory with:

```ts
const createMockPoint = (id: string, originalIndex: number): PlotDataPoint => ({
  id,
  x: 0,
  y: 0,
  z: 0,
  originalIndex,
  annotationValues: {
    test_annotation: [],
  },
});
```

Update each call site:

| Old call                             | New call                   |
| ------------------------------------ | -------------------------- |
| `createMockPoint('p0', 'categoryA')` | `createMockPoint('p0', 0)` |
| `createMockPoint('p1', 'categoryB')` | `createMockPoint('p1', 1)` |

For `describe('z-order change consistency')` (around line 273):

The mock data is `createMockData(['categoryA', 'categoryB', 'categoryC'])`. Replace the factory with:

```ts
const createMockPoint = (originalIndex: number): PlotDataPoint => ({
  id: 'test_protein',
  x: 0,
  y: 0,
  z: 0,
  originalIndex,
  annotationValues: {
    test_annotation: [],
  },
});
```

Update call sites:

| Old call                       | New call             |
| ------------------------------ | -------------------- |
| `createMockPoint('categoryA')` | `createMockPoint(0)` |
| `createMockPoint('categoryB')` | `createMockPoint(1)` |
| `createMockPoint('categoryC')` | `createMockPoint(2)` |

- [ ] **Step 4: Run tests to verify they still pass**

Run: `pnpm --filter @protspace/core test:ci -- style-getters`

Expected: PASS — all 14 style-getters tests pass with the accessor-driven reads.

- [ ] **Step 5: Run full quality gate**

Run: `pnpm precommit`

Expected: full pre-commit gate passes.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/scatter-plot/style-getters.ts \
        packages/core/src/components/scatter-plot/style-getters.test.ts
git commit -m "perf(scatter-plot): style-getters reads annotation values via accessor"
```

---

## Task 3: Migrate tooltip + hover handler to use `TooltipView`

The hover handler in `scatter-plot.ts` builds a `TooltipView` once per hover. The tooltip element receives `view: TooltipView | null` instead of reaching into `protein.*` Records. Tooltip helpers (`getGeneName / getProteinName / getUniprotKbId`) change signature from `Record<string, string[]>` to `string[]`.

After this task, no one reads from `point.annotationDisplayValues / numericAnnotationValues / numericAnnotationTypes / annotationScores / annotationEvidence` anywhere in the codebase. Records remain on the type but are dead. Build stays green.

**Files:**

- Modify: `packages/core/src/components/scatter-plot/protein-tooltip-helpers.ts`
- Modify: `packages/core/src/components/scatter-plot/protein-tooltip-helpers.test.ts`
- Modify: `packages/core/src/components/scatter-plot/protein-tooltip.ts`
- Modify: `packages/core/src/components/scatter-plot/scatter-plot.ts:84,1819,1853-1860,2102`

- [ ] **Step 1: Update tooltip helpers to take `string[]`**

Replace `packages/core/src/components/scatter-plot/protein-tooltip-helpers.ts` lines 17–40 (the three header helpers) with:

```ts
/**
 * Resolve gene name from already-extracted gene-name values.
 */
export function getGeneName(geneNameValues: string[]): string | null {
  return filterAnnotationValues(geneNameValues);
}

/**
 * Resolve protein name from already-extracted protein-name values.
 */
export function getProteinName(proteinNameValues: string[]): string | null {
  return filterAnnotationValues(proteinNameValues);
}

/**
 * Resolve UniProtKB ID from already-extracted uniprot-kb-id values.
 */
export function getUniprotKbId(uniprotKbIdValues: string[]): string | null {
  return filterAnnotationValues(uniprotKbIdValues);
}
```

The `gene_name | 'Gene name'` and `protein_name | 'Protein name'` fallback logic now lives in `buildTooltipView` (Task 1), which feeds these helpers.

`getAnnotationHeaderType` (lines 47–54) is unchanged — it already takes scores and evidence arrays.

- [ ] **Step 2: Update tooltip-helpers test file**

`packages/core/src/components/scatter-plot/protein-tooltip-helpers.test.ts` currently passes `Record<string, string[]>` objects to the three helpers. Update each test to pass the relevant value array directly.

The test file has 36 tests. The mechanical rewrite is: every call to `getGeneName({ gene_name: ['BRCA1'] })` becomes `getGeneName(['BRCA1'])`, every `getGeneName({ 'Gene name': ['BRCA1'] })` becomes `getGeneName(['BRCA1'])`, every `getGeneName({ gene_name: ['BRCA1'], 'Gene name': ['DUP'] })` (which today exercises the fallback priority) is removed or replaced with a single test that confirms `getGeneName(['BRCA1'])` returns `'BRCA1'` — the fallback priority logic moved to `buildTooltipView` and is covered by `plot-data-accessors.test.ts`.

Concretely, replace any test that targets the key-resolution behavior (e.g., "prefers `gene_name` over `Gene name`") with a `it.skip` annotation or remove it; the equivalent coverage exists in `plot-data-accessors.test.ts`'s `buildTooltipView` block. Tests that exercise empty arrays / NA filtering / whitespace stripping stay, just with the new signature:

```ts
// Before
expect(getGeneName({ gene_name: ['BRCA1'] })).toBe('BRCA1');
expect(getGeneName({ gene_name: ['__NA__'] })).toBeNull();
expect(getGeneName({})).toBeNull();
expect(getGeneName(undefined as never)).toBeNull(); // (defensive test, may exist)

// After
expect(getGeneName(['BRCA1'])).toBe('BRCA1');
expect(getGeneName(['__NA__'])).toBeNull();
expect(getGeneName([])).toBeNull();
```

Open the test file, apply the same mechanical rewrite to every `getGeneName / getProteinName / getUniprotKbId` call. Remove or `it.skip` tests whose entire purpose is verifying the snake_case-vs-spaced-key fallback priority — that contract now belongs to `buildTooltipView`.

- [ ] **Step 3: Update tooltip element to use `view` prop**

Replace `packages/core/src/components/scatter-plot/protein-tooltip.ts` lines 1–11 with:

```ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { toDisplayValue, toInternalValue } from '@protspace/utils';
import type { NumericAnnotationType, TooltipView } from '@protspace/utils';
import { proteinTooltipStyles } from './protein-tooltip.styles';
import {
  getAnnotationHeaderType,
  getGeneName,
  getProteinName,
  getUniprotKbId,
} from './protein-tooltip-helpers';
```

Replace lines 70–94 (the class declaration, prop, and render-prelude up to `headerType`) with:

```ts
@customElement('protspace-protein-tooltip')
class ProtspaceProteinTooltip extends LitElement {
  @property({ type: Object }) view: TooltipView | null = null;
  @property({ type: String }) selectedAnnotation = '';

  static styles = proteinTooltipStyles;

  render() {
    if (!this.view) {
      return html``;
    }

    const view = this.view;
    const geneName = getGeneName(view.geneName);
    const proteinName = getProteinName(view.proteinName);
    const uniprotKbId = getUniprotKbId(view.uniprotKbId);
    const tooltipAnnotationValues = view.displayValues;
    const rawNumericValue = view.numericValue;
    const rawNumericType: NumericAnnotationType = view.numericType;
    const tooltipAnnotationScores = view.scores;
    const tooltipAnnotationEvidence = view.evidence;
    const headerType = getAnnotationHeaderType(tooltipAnnotationScores, tooltipAnnotationEvidence);
```

Replace the `${this.protein.id}` reference at line 99 with `${view.proteinId}`.

The rest of the `render()` body (lines 95–154) is unchanged — it already references local variables like `tooltipAnnotationValues`, `rawNumericValue`, etc., which still resolve correctly.

`PlotDataPoint` is no longer imported by this file. `NumericAnnotationType` stays imported because of the `rawNumericType` type annotation.

- [ ] **Step 4: Update scatter-plot.ts hover handler and tooltip wiring**

In `packages/core/src/components/scatter-plot/scatter-plot.ts`:

**4a.** Update the imports near line 6 to add `buildTooltipView` and `TooltipView`:

Find the existing import block that includes `PlotDataPoint`:

```ts
import {
  PlotDataPoint,
  ...
} from '@protspace/utils';
```

Add `buildTooltipView` and `TooltipView` to the same import. If they're imported by another statement, add them there. Result should look like:

```ts
import {
  PlotDataPoint,
  buildTooltipView,
  TooltipView,
  ...
} from '@protspace/utils';
```

(Use `import type { TooltipView }` if the surrounding imports already separate types from values.)

**4b.** Update the `_tooltipData` state shape at line 84:

```ts
@state() private _tooltipData: {
  x: number;
  y: number;
  view: TooltipView;
} | null = null;
```

(Replace `protein: PlotDataPoint` with `view: TooltipView`.)

**4c.** Update the hover-handler write at line 1819. The current line is:

```ts
this._tooltipData = { x, y, protein: point };
```

Replace the entire `_handleMouseOver` method (lines 1817-1832) with the version below, which (a) early-returns when data is null so `buildTooltipView` is type-safe, and (b) drops the `_createDisplayPoint` indirection (no longer needed — see step 4e):

```ts
private _handleMouseOver(event: MouseEvent, point: PlotDataPoint) {
  if (!this.data) return;
  const { x, y } = this._getLocalPointerPosition(event);
  const view = buildTooltipView(this.data, point.originalIndex, this.selectedAnnotation);
  this._tooltipData = { x, y, view };

  if (this._hoveredProteinId !== point.id) {
    this._hoveredProteinId = point.id;
    this.dispatchEvent(
      new CustomEvent('protein-hover', {
        detail: { proteinId: point.id, point },
        bubbles: true,
      }),
    );
  }
}
```

(The component's `data` and `selectedAnnotation` are confirmed at `scatter-plot.ts:62` and `:65` as `@property` fields.)

**4d.** Apply the same `_createDisplayPoint` removal to the click handler. Find the second call site at line 1834 and replace `pointForEvent` with `point` in the corresponding `protein-click` event detail. Concretely, change:

```ts
const pointForEvent = this._createDisplayPoint(point);
// ...
new CustomEvent('protein-click', {
  detail: { proteinId: point.id, point: pointForEvent, modifierKeys },
  ...
})
```

to:

```ts
new CustomEvent('protein-click', {
  detail: { proteinId: point.id, point, modifierKeys },
  ...
})
```

(The local `pointForEvent` declaration goes away.)

**4e.** Delete the `_createDisplayPoint` method entirely (lines 1853-1860):

```ts
// DELETE this entire method
private _createDisplayPoint(point: PlotDataPoint): PlotDataPoint {
  return point.annotationDisplayValues
    ? {
        ...point,
        annotationValues: point.annotationDisplayValues,
      }
    : point;
}
```

It read `point.annotationDisplayValues` (a Record we're removing) and is used only by the two event-dispatch sites we just updated. Verified consumers of `protein-hover` / `protein-click` only read `proteinId` from `event.detail` — none read `event.detail.point.annotationValues`.

**4f.** Update the tooltip prop wiring at line 2102. Replace:

```ts
.protein=${this._tooltipData.protein}
.selectedAnnotation=${this.selectedAnnotation}
```

with:

```ts
.view=${this._tooltipData.view}
.selectedAnnotation=${this.selectedAnnotation}
```

- [ ] **Step 5: Run tooltip + scatter-plot tests**

Run: `pnpm --filter @protspace/core test:ci -- "(protein-tooltip|scatter-plot)"`

Expected: all tooltip and scatter-plot unit tests pass. If a tooltip-helpers test that was skipped causes a pass-count regression, that's expected — the skip is intentional.

- [ ] **Step 6: Run full quality gate**

Run: `pnpm precommit`

Expected: full pre-commit gate passes (typecheck must pass — verifies the new tooltip prop wiring is consistent).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/components/scatter-plot/protein-tooltip.ts \
        packages/core/src/components/scatter-plot/protein-tooltip-helpers.ts \
        packages/core/src/components/scatter-plot/protein-tooltip-helpers.test.ts \
        packages/core/src/components/scatter-plot/scatter-plot.ts
git commit -m "refactor(tooltip): build TooltipView per hover; tooltip reads from view"
```

---

## Task 4: Strip Records from `PlotDataPoint`; simplify `data-processor.ts`

This is the breaking type change. After Tasks 2 and 3 there are no remaining reads from `annotationValues / annotationDisplayValues / numericAnnotationValues / numericAnnotationTypes / annotationScores / annotationEvidence` on `PlotDataPoint`, so removing them is safe. `DataProcessor.processVisualizationData` is rewritten to allocate only bare points.

**Files:**

- Modify: `packages/utils/src/types.ts:62-74`
- Modify: `packages/utils/src/visualization/data-processor.ts:17-91`
- Modify: `packages/utils/src/visualization/data-processor.test.ts`
- Modify: `packages/core/src/components/scatter-plot/quadtree-index.test.ts`
- Modify: `packages/core/src/components/scatter-plot/style-getters.test.ts` (drop the unused `annotationValues: { ... }` from the three `createMockPoint` factories — required for typecheck after the field is removed)

- [ ] **Step 1: Strip Records from `PlotDataPoint`**

In `packages/utils/src/types.ts`, replace lines 62–74 with:

```ts
export interface PlotDataPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  originalIndex: number;
}
```

- [ ] **Step 2: Simplify `DataProcessor.processVisualizationData`**

Replace the entire body of the static method in `packages/utils/src/visualization/data-processor.ts:8-106` with:

```ts
static processVisualizationData(
  data: VisualizationData,
  projectionIndex: number,
  isolationMode: boolean = false,
  isolationHistory?: string[][],
  projectionPlane: 'xy' | 'xz' | 'yz' = 'xy',
): PlotDataPoint[] {
  if (!data.projections[projectionIndex]) return [];

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

  if (isolationMode && isolationHistory && isolationHistory.length > 0) {
    let filteredData = processedData.filter((p) => isolationHistory[0].includes(p.id));
    for (let i = 1; i < isolationHistory.length; i++) {
      const splitIds = isolationHistory[i];
      filteredData = filteredData.filter((p) => splitIds.includes(p.id));
    }
    return filteredData;
  }

  return processedData;
}
```

Remove the now-unused imports at the top of the file. The remaining imports should be:

```ts
import type { VisualizationData, PlotDataPoint } from '../types.js';
import * as d3 from 'd3';
```

(Drop `NumericAnnotationType`, `toInternalValue`, `getNumericBinLabelMap`, `getProteinAnnotationIndices`. The `createScales` static method below is unaffected and still uses `d3`.)

- [ ] **Step 3: Update `data-processor.test.ts` assertions**

Open `packages/utils/src/visualization/data-processor.test.ts`. Drop every assertion that reads `result[0].annotationValues.<key>`, `result[0].annotationDisplayValues.<key>`, etc. Replace with assertions on the surviving fields (`id`, `x`, `y`, `z`, `originalIndex`) and on isolation-filter behavior.

Concrete pattern: each `it(...)` that today asserts `expect(result[0].annotationValues.species).toEqual(['human'])` either:

- (a) becomes a sanity check on the bare point: `expect(result[0]).toEqual({ id: 'p0', x: 0, y: 0, z: 0, originalIndex: 0 });` (adapt to fixture);
- (b) is removed if the only thing it asserted was the now-deleted Record content.

Add one new test asserting that `processVisualizationData` no longer materializes Records:

```ts
it('does not materialize annotation Records on points', () => {
  const data: VisualizationData = {
    protein_ids: ['p0'],
    projections: [{ name: 't', data: [[0, 0]] }],
    annotations: {
      species: {
        kind: 'categorical',
        values: ['human'],
        colors: ['#f00'],
        shapes: ['circle'],
      },
    },
    annotation_data: { species: Int32Array.of(0) },
  };
  const result = DataProcessor.processVisualizationData(data, 0);
  expect(result).toHaveLength(1);
  expect(Object.keys(result[0]).sort()).toEqual(['id', 'originalIndex', 'x', 'y']);
});
```

- [ ] **Step 4: Update `quadtree-index.test.ts` fixtures**

In `packages/core/src/components/scatter-plot/quadtree-index.test.ts`, every fixture that builds a `PlotDataPoint` literal includes Records (`annotationValues: {...}`). Strip those fields. The fixture should look like:

```ts
const points: PlotDataPoint[] = [
  { id: 'p0', x: 0, y: 0, originalIndex: 0 },
  { id: 'p1', x: 10, y: 10, originalIndex: 1 },
  // ...
];
```

(Apply mechanically to every fixture in the file. The quadtree only reads `x`, `y`, `id`, so dropping Records is safe and required for typecheck.)

- [ ] **Step 5: Strip residual Record literals from `style-getters.test.ts`**

In `packages/core/src/components/scatter-plot/style-getters.test.ts`, the three `createMockPoint` factories you updated in Task 2 still contain a now-illegal `annotationValues: { test_annotation: [] }` field. Remove that field from each factory:

```ts
const createMockPoint = (id: string, originalIndex: number): PlotDataPoint => ({
  id,
  x: 0,
  y: 0,
  z: 0,
  originalIndex,
});
```

(And the `(originalIndex: number)` variant in the third `describe` block — same removal.)

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test:ci`

Expected: all packages green. No `Property 'annotationValues' does not exist on type 'PlotDataPoint'` errors. No runtime test regressions.

- [ ] **Step 7: Run full quality gate**

Run: `pnpm precommit`

Expected: format + lint + typecheck + tests + docs:build all pass. Type-check is the critical gate — it confirms no untouched consumer reads from a removed Record.

- [ ] **Step 8: Commit**

```bash
git add packages/utils/src/types.ts \
        packages/utils/src/visualization/data-processor.ts \
        packages/utils/src/visualization/data-processor.test.ts \
        packages/core/src/components/scatter-plot/quadtree-index.test.ts \
        packages/core/src/components/scatter-plot/style-getters.test.ts
git commit -m "perf(data-processor): bare PlotDataPoint, strip annotation Records"
```

---

## Task 5: Restore Playwright spec for `sprot_50` + browser verification

Restore the stashed Playwright spec from end of Phase 2 (`stash@{0}`), copy the fixture, run the spec, then perform manual browser verification with a heap snapshot.

**Files:**

- Restore: `app/tests/load-large-bundle.spec.ts` (from `git stash`)
- Restore: `app/tests/fixtures/sprot_50.parquetbundle` (copy from `protspace/data/other/sprot/`)
- Possibly modify: `app/tests/playwright.config.ts` (register the new spec as a project entry)

- [ ] **Step 1: Pop the stashed Task 14 work**

```bash
git stash pop stash@{0}
```

Expected: stash applies cleanly. If conflicts, inspect — they should be in `.gitignore` only (the stash also includes a `.gitignore` exclusion for the fixture).

- [ ] **Step 2: Copy the fixture**

```bash
cp /Users/tsenoner/Documents/projects/protspace-suite/protspace/data/other/sprot/sprot_50.parquetbundle \
   app/tests/fixtures/sprot_50.parquetbundle
```

Expected: file copied, ~45 MB. Verify with `ls -lh app/tests/fixtures/sprot_50.parquetbundle`.

- [ ] **Step 3: Verify Playwright config registers the spec**

Open `app/tests/playwright.config.ts`. Each spec needs an entry in the `projects` array. Verify there's a project entry pointing at `load-large-bundle.spec.ts`. If absent, add one matching the existing `dataset-recovery.spec.ts` entry style.

- [ ] **Step 4: Run the Playwright spec**

```bash
pnpm --filter @protspace/app exec playwright test load-large-bundle
```

Expected: spec passes — drops `sprot_50.parquetbundle`, asserts legend populates, hovers a point and asserts tooltip renders, switches the selected annotation, reloads and confirms auto-load. The `page.on('crash')` listener should never fire.

If the spec fails on a browser crash, this means the heap target is not yet met. Capture a DevTools heap snapshot manually (Step 5 below) and inspect the dominant retainer — it may indicate a missed consumer of the removed Records.

- [ ] **Step 5: Manual browser verification**

```bash
pnpm dev
```

Open `http://localhost:8080`. In a fresh tab (or after clearing OPFS via the recovery banner if Phase 1's success state is sticky):

1. Drop `app/tests/fixtures/sprot_50.parquetbundle` onto the page.
2. Wait for the load to complete — should take ~10–30 s, no "Aw, Snap!".
3. Open DevTools → Memory → Take heap snapshot. **Retained size must be under 500 MB.** Note the actual value.
4. Switch the selected annotation across `kingdom`, `gene_name`, `pfam`, `cath`, `annotation_score` (numeric). Each switch should re-render in < 5 s with no console errors.
5. Hover several points under each selected annotation — tooltip header shows gene/protein name; selected annotation row shows correct value; numeric tooltip shows numeric value.
6. Reload the page. Recovery banner should NOT appear; auto-load should complete silently.

Record the heap snapshot value in the commit message.

- [ ] **Step 6: Run full quality gate**

```bash
pnpm precommit
```

Expected: full pre-commit gate passes.

- [ ] **Step 7: Commit**

```bash
git add app/tests/load-large-bundle.spec.ts app/tests/fixtures/sprot_50.parquetbundle .gitignore app/tests/playwright.config.ts
git commit -m "test(load): playwright spec + fixture for sprot_50 large-bundle load

Heap snapshot retained size after sprot_50 load: <FILL IN actual MB value from Step 5.3>"
```

(Update the commit message body with the actual heap value before committing.)

---

## After all tasks: open PR-2

PR-2 contains all of Phase 2 (already on the branch from prior work) plus Phase 2.5. Title and body should cover both phases. Use the existing Phase 2 commits + the new Phase 2.5 commits. PR description points to both spec docs (`2026-05-02-load-reliability-design.md` and `2026-05-02-render-lazy-materialization-design.md`).

```bash
gh pr create --base main --head fix/load-reliability-phase-2 --title "fix(load): reliable large-bundle load (Phase 2 + 2.5)" --body "$(cat <<'EOF'
## Summary
- Phase 2: conversion-layer memory wins (Int32Array storage, dropped spread merge, pair-aware colors, null-selection gate)
- Phase 2.5: render-side lazy materialization — strip annotation Records from PlotDataPoint, route per-point reads through new accessor module
- Loads sprot_50.parquetbundle (573k proteins) without OOM; heap retained size <500 MB

Specs:
- docs/superpowers/specs/2026-05-02-load-reliability-design.md
- docs/superpowers/specs/2026-05-02-render-lazy-materialization-design.md
EOF
)"
```
