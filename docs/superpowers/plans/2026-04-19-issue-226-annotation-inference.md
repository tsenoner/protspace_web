# Issue 226 Annotation Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make parquet-backed annotations load safely with deterministic value-based `int`/`float`/`string` inference, numeric UI for numeric annotations, and subtype-aware numeric labels.

**Architecture:** Move annotation inference away from the current density/cardinality heuristic and into one deterministic parser used by every loader path. Carry numeric subtype through raw annotations and materialized numeric metadata so legend, tooltip, filtering, export, and tests can distinguish integer and float display. Keep malformed values contained to the current annotation by falling back to categorical string behavior.

**Tech Stack:** TypeScript, Lit web components, Vitest, Playwright, pnpm/turbo, hyparquet parquetbundle fixtures.

---

## File Structure

- Modify `packages/utils/src/types.ts`: add `NumericAnnotationType`, attach it to raw `Annotation` and materialized `NumericAnnotationMetadata`, and add persisted `annotationTypeOverride`.
- Modify `packages/utils/src/visualization/numeric-binning.ts`: accept numeric subtype during materialization and format bin labels according to `int` or `float`.
- Modify `packages/utils/src/visualization/numeric-binning.test.ts`: assert subtype propagation and label formatting.
- Create `packages/utils/src/visualization/annotation-type-overrides.ts`: apply persisted `Auto`/`String`/`Numeric` overrides to already-loaded visualization data without requiring a second file import.
- Create `packages/utils/src/visualization/annotation-type-overrides.test.ts`: cover override success and rejection paths.
- Modify `packages/utils/src/parquet/settings-validation.ts`: validate and sanitize persisted annotation type overrides.
- Modify `packages/utils/src/parquet/settings-validation.test.ts`: cover override persistence validation.
- Modify `packages/core/src/components/data-loader/utils/conversion.ts`: replace `isScalarNumericAnnotationColumn()` and all density constants with deterministic `inferAnnotationType()`.
- Modify `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts`: replace heuristic expectations with all-values inference expectations.
- Copy `/Users/florin/Downloads/data_custom.parquetbundle` to `app/tests/fixtures/data_custom.parquetbundle`: make the annotated edge-case fixture part of the repo test set.
- Modify `packages/core/src/components/legend/types.ts`: mirror numeric subtype and override fields used by the legend.
- Modify `packages/core/src/components/legend/legend-settings-dialog.ts`: add the `Auto`/`String`/`Numeric` annotation type control.
- Modify `packages/core/src/components/legend/legend.ts`: include annotation type override in dialog state and persisted settings.
- Modify `packages/core/src/components/legend/controllers/persistence-controller.ts`: persist the override with the rest of the per-annotation settings.
- Modify `packages/core/src/components/legend/controllers/persistence-controller.test.ts`: assert override round-trip behavior.
- Modify `packages/core/src/components/legend/scatterplot-interface.ts`: expose an `annotationTypeOverrides` map to the scatterplot.
- Modify `packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`: sync override state into the scatterplot.
- Modify `packages/core/src/components/scatter-plot/scatter-plot.ts`: apply override state before numeric materialization, include subtype and overrides in materialization cache invalidation, and expose materialized data.
- Modify `packages/core/src/components/scatter-plot/protein-tooltip.ts`: use numeric subtype for raw numeric tooltip formatting when shown.

## Known Invariants

- `null`, `undefined`, trimmed empty strings, and missing per-protein values do not count against numeric inference.
- If every remaining value is a finite integer, the annotation type is `int`.
- If every remaining value is finite numeric and at least one parsed value is non-integer, the annotation type is `float`.
- If any remaining value is nonnumeric, nonfinite, semicolon-delimited, or pipe-delimited, the annotation type is `string`.
- If no remaining values exist, the annotation type is `string`.
- A raw annotation with inferred type `int` or `float` is represented as `kind: 'numeric'` and stores parsed values in `numeric_annotation_data`.
- A raw annotation with inferred type `string` is represented as `kind: 'categorical'` and stores indices in `annotation_data`.
- `int` display has no comma and no decimals.
- `float` display has grouping commas and at least one decimal digit.

---

### Task 1: Add Numeric Subtype Types

**Files:**

- Modify: `packages/utils/src/types.ts`
- Modify: `packages/core/src/components/legend/types.ts`

- [ ] **Step 1: Add shared subtype and override types**

In `packages/utils/src/types.ts`, add the new exported types immediately after `AnnotationKind`:

```typescript
export type AnnotationKind = 'categorical' | 'numeric';

export type NumericAnnotationType = 'int' | 'float';

export type AnnotationTypeOverride = 'auto' | 'string' | 'numeric';
```

Update `NumericAnnotationMetadata`, `Annotation`, and `LegendPersistedSettings`:

```typescript
export interface NumericAnnotationMetadata {
  strategy: NumericBinningStrategy;
  binCount: number;
  signature: string;
  topologySignature: string;
  logSupported: boolean;
  numericType?: NumericAnnotationType;
  bins: NumericBinDefinition[];
}

export interface Annotation {
  kind: AnnotationKind;
  values: (string | null)[];
  colors: string[];
  shapes: string[];
  sourceKind?: AnnotationKind;
  numericType?: NumericAnnotationType;
  numericMetadata?: NumericAnnotationMetadata;
}

export interface LegendPersistedSettings {
  maxVisibleValues: number;
  includeShapes: boolean;
  shapeSize: number;
  sortMode: LegendSortMode;
  hiddenValues: string[];
  categories: Record<string, PersistedCategoryData>;
  enableDuplicateStackUI: boolean;
  selectedPaletteId: string;
  annotationTypeOverride?: AnnotationTypeOverride;
  numericSettings?: {
    strategy: NumericBinningStrategy;
    signature: string;
    topologySignature?: string;
    manualOrderIds?: string[];
    reverseGradient?: boolean;
  };
}
```

- [ ] **Step 2: Mirror the fields in legend-local types**

In `packages/core/src/components/legend/types.ts`, add `numericType` to both annotation shapes:

```typescript
export interface ScatterplotData {
  protein_ids: string[];
  annotations: Record<
    string,
    {
      kind?: 'categorical' | 'numeric';
      sourceKind?: 'categorical' | 'numeric';
      numericType?: 'int' | 'float';
      values: (string | null)[];
      colors?: string[];
      shapes?: string[];
      numericMetadata?: LegendAnnotationData['numericMetadata'];
    }
  >;
  annotation_data: Record<string, (number | number[])[]>;
  numeric_annotation_data?: Record<string, (number | null)[]>;
  projections?: Array<{ name: string }>;
}

export interface LegendAnnotationData {
  name: string;
  values: (string | null)[];
  colors?: string[];
  shapes?: string[];
  kind?: 'categorical' | 'numeric';
  sourceKind?: 'categorical' | 'numeric';
  numericType?: 'int' | 'float';
  numericMetadata?: {
    strategy: 'linear' | 'quantile' | 'logarithmic';
    binCount: number;
    signature: string;
    topologySignature: string;
    logSupported: boolean;
    numericType?: 'int' | 'float';
    bins: Array<{
      id: string;
      label: string;
      lowerBound: number;
      upperBound: number;
      count: number;
      colorPosition?: number;
    }>;
  };
}
```

- [ ] **Step 3: Run type check for expected compile gaps**

Run:

```bash
pnpm --filter @protspace/utils type-check
pnpm --filter @protspace/core type-check
```

Expected: `@protspace/utils` may pass immediately; `@protspace/core` may fail until later tasks populate `numericType` at assignment sites. Record the first relevant error before proceeding.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/utils/src/types.ts packages/core/src/components/legend/types.ts
git commit -m "feat(annotation): add numeric subtype fields"
```

Expected: commit succeeds.

---

### Task 2: Replace Loader Heuristic With Deterministic Inference

**Files:**

- Modify: `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts`
- Modify: `packages/core/src/components/data-loader/utils/conversion.ts`

- [ ] **Step 1: Update tests to encode deterministic inference**

In `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts`, replace the old heuristic tests named below:

- `keeps numeric-looking string labels categorical`
- `keeps sparse integer-like string columns categorical`
- `keeps small dense integer-like string columns categorical`
- `keeps sparse fractional string labels categorical`
- `detects dense integer-like string columns as numeric`
- `detects sufficiently varied fractional string columns as numeric`

Use these tests in their place:

```typescript
it('detects integer strings as int numeric annotations regardless of cardinality', () => {
  const result = convertParquetToVisualizationData([
    { identifier: 'P1', x: 0, y: 0, cluster_id: '101', family: 'A' },
    { identifier: 'P2', x: 1, y: 1, cluster_id: '203', family: 'B' },
    { identifier: 'P3', x: 2, y: 2, cluster_id: '101', family: 'A' },
  ]);

  expect(result.annotations.cluster_id.kind).toBe('numeric');
  expect(result.annotations.cluster_id.numericType).toBe('int');
  expect(result.numeric_annotation_data?.cluster_id).toEqual([101, 203, 101]);
  expect(result.annotation_data.cluster_id).toBeUndefined();
});

it('detects fractional strings as float numeric annotations regardless of density', () => {
  const result = convertParquetToVisualizationData([
    { identifier: 'P1', x: 0, y: 0, length: '1.1', family: 'A' },
    { identifier: 'P2', x: 1, y: 1, length: '2.2', family: 'B' },
    { identifier: 'P3', x: 2, y: 2, length: '5.5', family: 'A' },
  ]);

  expect(result.annotations.length.kind).toBe('numeric');
  expect(result.annotations.length.numericType).toBe('float');
  expect(result.numeric_annotation_data?.length).toEqual([1.1, 2.2, 5.5]);
  expect(result.annotation_data.length).toBeUndefined();
});

it('infers mixed integer and float strings as float numeric annotations', () => {
  const result = convertParquetToVisualizationData([
    { identifier: 'P1', x: 0, y: 0, length: '1', family: 'A' },
    { identifier: 'P2', x: 1, y: 1, length: '2.5', family: 'B' },
    { identifier: 'P3', x: 2, y: 2, length: '3', family: 'A' },
  ]);

  expect(result.annotations.length.kind).toBe('numeric');
  expect(result.annotations.length.numericType).toBe('float');
  expect(result.numeric_annotation_data?.length).toEqual([1, 2.5, 3]);
});

it('ignores null undefined and empty strings during inference', () => {
  const result = convertParquetToVisualizationData([
    { identifier: 'P1', x: 0, y: 0, length: '1', family: 'A' },
    { identifier: 'P2', x: 1, y: 1, length: null, family: 'B' },
    { identifier: 'P3', x: 2, y: 2, length: undefined, family: 'A' },
    { identifier: 'P4', x: 3, y: 3, length: '   ', family: 'B' },
  ]);

  expect(result.annotations.length.kind).toBe('numeric');
  expect(result.annotations.length.numericType).toBe('int');
  expect(result.numeric_annotation_data?.length).toEqual([1, null, null, null]);
});

it('falls back to categorical when no non-empty values remain', () => {
  const result = convertParquetToVisualizationData([
    { identifier: 'P1', x: 0, y: 0, empty_metric: null, family: 'A' },
    { identifier: 'P2', x: 1, y: 1, empty_metric: undefined, family: 'B' },
    { identifier: 'P3', x: 2, y: 2, empty_metric: '', family: 'A' },
  ]);

  expect(result.annotations.empty_metric.kind).toBe('categorical');
  expect(result.numeric_annotation_data?.empty_metric).toBeUndefined();
  expect(result.annotation_data.empty_metric).toEqual([[], [], []]);
});

it.each([
  ['nan'],
  ['inf'],
  ['-inf'],
  ['+inf'],
  ['25 kDa'],
  ['34%'],
  ['689,005'],
  ['200-400'],
  ['90;10'],
  ['95|high'],
])('falls back to categorical when a value is %s', (badValue) => {
  const result = convertParquetToVisualizationData([
    { identifier: 'P1', x: 0, y: 0, metric: '1.2', family: 'A' },
    { identifier: 'P2', x: 1, y: 1, metric: badValue, family: 'B' },
  ]);

  expect(result.annotations.metric.kind).toBe('categorical');
  expect(result.numeric_annotation_data?.metric).toBeUndefined();
  expect(result.annotation_data.metric).toBeDefined();
});
```

Also update existing assertions in `detects scalar numeric annotations and preserves raw values`, `detects raw numeric annotations in bundle-format rows`, and `preserves numeric annotations in the optimized large-dataset path`:

```typescript
expect(result.annotations.length.numericType).toBe('int');
```

- [ ] **Step 2: Run the updated tests and verify failure**

Run:

```bash
pnpm --filter @protspace/core test:ci -- src/components/data-loader/utils/conversion-numeric.test.ts
```

Expected: tests fail because the old heuristic still classifies low-cardinality numeric-looking strings as categorical and does not set `numericType`.

- [ ] **Step 3: Replace the heuristic helper**

In `packages/core/src/components/data-loader/utils/conversion.ts`, remove these constants and helper:

```typescript
const STRING_NUMERIC_DENSITY_THRESHOLD = 0.1;
const STRING_NUMERIC_MIN_DISTINCT_VALUES = 8;
const MAX_STRING_NUMERIC_DENSITY_DECIMALS = 6;

function countNumericStringDecimalPlaces(rawValue: string): number {
  // remove this function
}

function isScalarNumericAnnotationColumn(values: unknown[]): boolean {
  // remove this function
}
```

Replace them with this deterministic classifier:

```typescript
type InferredAnnotationType = 'int' | 'float' | 'string';

interface AnnotationInferenceResult {
  inferredType: InferredAnnotationType;
  numericValues: (number | null)[];
}

function parseNumericAnnotationValue(rawValue: unknown): number | null {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null;
  }

  if (typeof rawValue === 'bigint') {
    const parsed = Number(rawValue);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed.includes(';') || trimmed.includes('|')) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function inferAnnotationType(values: unknown[]): AnnotationInferenceResult {
  const numericValues: (number | null)[] = [];
  let sawNonEmptyValue = false;
  let sawFloatValue = false;

  for (const rawValue of values) {
    if (rawValue == null) {
      numericValues.push(null);
      continue;
    }

    if (typeof rawValue === 'string' && rawValue.trim() === '') {
      numericValues.push(null);
      continue;
    }

    sawNonEmptyValue = true;
    const parsed = parseNumericAnnotationValue(rawValue);
    if (parsed == null) {
      return {
        inferredType: 'string',
        numericValues: [],
      };
    }

    if (!Number.isInteger(parsed)) {
      sawFloatValue = true;
    }
    numericValues.push(parsed);
  }

  if (!sawNonEmptyValue) {
    return {
      inferredType: 'string',
      numericValues: [],
    };
  }

  return {
    inferredType: sawFloatValue ? 'float' : 'int',
    numericValues,
  };
}
```

- [ ] **Step 4: Carry subtype when creating numeric annotations**

Replace `createNumericAnnotation()` with:

```typescript
function createNumericAnnotation(numericType: 'int' | 'float'): Annotation {
  return {
    kind: 'numeric',
    numericType,
    values: [],
    colors: [],
    shapes: [],
  };
}
```

- [ ] **Step 5: Update the bundle-format import path**

Replace the `if (isScalarNumericAnnotationColumn(...))` block in `convertBundleFormatData` with:

```typescript
const inference = inferAnnotationType(baseProjectionData.map((row) => row[annotationCol]));
if (inference.inferredType !== 'string') {
  numeric_annotation_data[annotationCol] = uniqueProteinIds.map((proteinId) => {
    const row = baseRowsByProteinId.get(proteinId);
    const rawValue = row?.[annotationCol];
    if (rawValue == null || (typeof rawValue === 'string' && rawValue.trim() === '')) {
      return null;
    }
    return parseNumericAnnotationValue(rawValue);
  });
  annotations[annotationCol] = createNumericAnnotation(inference.inferredType);
  continue;
}
```

- [ ] **Step 6: Update the legacy import path**

Replace the `if (isScalarNumericAnnotationColumn(...))` block in the legacy-row path with:

```typescript
const inference = inferAnnotationType(rows.map((row) => row[annotationCol]));
if (inference.inferredType !== 'string') {
  annotations[annotationCol] = createNumericAnnotation(inference.inferredType);
  numeric_annotation_data[annotationCol] = inference.numericValues;
  continue;
}
```

- [ ] **Step 7: Update the optimized large-dataset path**

Replace the optimized-path `if (isScalarNumericAnnotationColumn(...))` condition with:

```typescript
const inference = inferAnnotationType(rows.map((row) => row[annotationCol]));
if (inference.inferredType !== 'string') {
  const numericValues: (number | null)[] = new Array(numProteins).fill(null);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, rows.length);
    for (let r = i; r < end; r++) {
      const row = rows[r];
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
      const idx = idToIndex.get(proteinId);
      if (idx === undefined) continue;

      const rawValue = row[annotationCol];
      if (rawValue == null || (typeof rawValue === 'string' && rawValue.trim() === '')) {
        numericValues[idx] = null;
        continue;
      }

      numericValues[idx] = parseNumericAnnotationValue(rawValue);
    }
    await fastYield();
  }

  annotations[annotationCol] = createNumericAnnotation(inference.inferredType);
  numeric_annotation_data[annotationCol] = numericValues;
  continue;
}
```

- [ ] **Step 8: Run the targeted tests**

Run:

```bash
pnpm --filter @protspace/core test:ci -- src/components/data-loader/utils/conversion-numeric.test.ts
```

Expected: all tests in `conversion-numeric.test.ts` pass.

- [ ] **Step 9: Commit**

Run:

```bash
git add packages/core/src/components/data-loader/utils/conversion.ts packages/core/src/components/data-loader/utils/conversion-numeric.test.ts
git commit -m "fix(loader): infer numeric annotations from all values"
```

Expected: commit succeeds.

---

### Task 3: Add Data Custom Fixture Regression

**Files:**

- Create: `app/tests/fixtures/data_custom.parquetbundle`
- Modify: `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts`

- [ ] **Step 1: Copy the annotated fixture into the repo**

Run:

```bash
cp /Users/florin/Downloads/data_custom.parquetbundle app/tests/fixtures/data_custom.parquetbundle
ls -lh app/tests/fixtures/data_custom.parquetbundle
```

Expected: `app/tests/fixtures/data_custom.parquetbundle` exists and is readable.

- [ ] **Step 2: Add fixture test helpers**

In `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts`, add this helper near the top of the file after imports:

```typescript
async function loadFixtureVisualizationData(fixtureName: string) {
  const filePath = resolve(__dirname, '../../../../../../app/tests/fixtures', fixtureName);
  const fileBuffer = readFileSync(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  );

  const { rows, projectionsMetadata } = await extractRowsFromParquetBundle(arrayBuffer);
  return convertParquetToVisualizationData(rows, projectionsMetadata ?? undefined);
}
```

- [ ] **Step 3: Add edge-case fixture expectations**

Add this test at the end of the `describe` block:

```typescript
it('classifies all annotated data_custom edge cases deterministically', async () => {
  const result = await loadFixtureVisualizationData('data_custom.parquetbundle');

  const expectedIntAnnotations = [
    'num_sequential',
    'num_negative_mixed',
    'num_8_distinct_dense',
    'num_zero_padded',
    'num_all_negative',
    'cat_5_distinct_int',
    'cat_7_distinct_int',
    'cat_binary_01',
    'cat_sparse_int',
    'cat_all_same_number',
    'cat_large_ints',
    'edge_all_zeros',
    'edge_density_boundary',
    'edge_density_below',
  ];

  const expectedFloatAnnotations = [
    'num_random_float',
    'num_mixed_int_float',
    'num_narrow_float',
    'cat_high_precision_float',
    'cat_wide_range_float',
    'edge_single_float',
  ];

  const expectedStringAnnotations = [
    'cat_mixed_str_num',
    'cat_numbers_with_units',
    'cat_percentages',
    'cat_comma_thousands',
    'cat_pipe_delimited',
    'cat_semicolon_delimited',
    'cat_nan_inf_strings',
    'cat_with_nan_strings',
    'edge_all_nan',
    'edge_few_nan_many_numbers',
  ];

  for (const annotationName of expectedIntAnnotations) {
    expect(result.annotations[annotationName]?.kind, annotationName).toBe('numeric');
    expect(result.annotations[annotationName]?.numericType, annotationName).toBe('int');
    expect(result.numeric_annotation_data?.[annotationName], annotationName).toBeDefined();
    expect(result.annotation_data[annotationName], annotationName).toBeUndefined();
  }

  for (const annotationName of expectedFloatAnnotations) {
    expect(result.annotations[annotationName]?.kind, annotationName).toBe('numeric');
    expect(result.annotations[annotationName]?.numericType, annotationName).toBe('float');
    expect(result.numeric_annotation_data?.[annotationName], annotationName).toBeDefined();
    expect(result.annotation_data[annotationName], annotationName).toBeUndefined();
  }

  for (const annotationName of expectedStringAnnotations) {
    expect(result.annotations[annotationName]?.kind, annotationName).toBe('categorical');
    expect(result.numeric_annotation_data?.[annotationName], annotationName).toBeUndefined();
    expect(result.annotation_data[annotationName], annotationName).toBeDefined();
  }
});
```

- [ ] **Step 4: Run fixture regression test**

Run:

```bash
pnpm --filter @protspace/core test:ci -- src/components/data-loader/utils/conversion-numeric.test.ts
```

Expected: all tests pass. If a fixture column expectation fails, inspect that column’s raw values before changing the expected list.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/tests/fixtures/data_custom.parquetbundle packages/core/src/components/data-loader/utils/conversion-numeric.test.ts
git commit -m "test(loader): cover custom annotation inference fixture"
```

Expected: commit succeeds.

---

### Task 4: Format Numeric Labels By Subtype

**Files:**

- Modify: `packages/utils/src/visualization/numeric-binning.test.ts`
- Modify: `packages/utils/src/visualization/numeric-binning.ts`
- Modify: `packages/core/src/components/scatter-plot/scatter-plot.ts`
- Modify: `packages/core/src/components/scatter-plot/protein-tooltip.ts`

- [ ] **Step 1: Add failing formatting tests**

In `packages/utils/src/visualization/numeric-binning.test.ts`, add these tests after `creates linear bins with distribution-aware gradient colors`:

```typescript
it('formats int numeric labels without grouping or decimals', () => {
  const result = materializeNumericAnnotation(
    [1000, 2000, 3000],
    {
      binCount: 3,
      strategy: 'linear',
      paletteId: 'viridis',
    },
    'int',
  );

  expect(result.annotation.numericType).toBe('int');
  expect(result.annotation.numericMetadata?.numericType).toBe('int');
  expect(result.annotation.numericMetadata?.bins.map((bin) => bin.label)).toEqual([
    '1000',
    '2000',
    '3000',
  ]);
});

it('formats float numeric labels with grouping and decimals', () => {
  const result = materializeNumericAnnotation(
    [1200.5, 2500.25, 3900.75],
    {
      binCount: 3,
      strategy: 'linear',
      paletteId: 'viridis',
    },
    'float',
  );

  expect(result.annotation.numericType).toBe('float');
  expect(result.annotation.numericMetadata?.numericType).toBe('float');
  expect(result.annotation.numericMetadata?.bins.map((bin) => bin.label)).toEqual([
    '1,200.5',
    '2,500.25',
    '3,900.75',
  ]);
});

it('carries numeric subtype through visualization materialization', () => {
  const data: VisualizationData = {
    protein_ids: ['P1', 'P2', 'P3'],
    projections: [
      {
        name: 'UMAP',
        data: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      },
    ],
    annotations: {
      mass: { kind: 'numeric', numericType: 'float', values: [], colors: [], shapes: [] },
    },
    annotation_data: {},
    numeric_annotation_data: {
      mass: [1200.5, 2500.25, 3900.75],
    },
  };

  const materialized = materializeVisualizationData(
    data,
    { mass: { binCount: 3, strategy: 'linear', paletteId: 'viridis' } },
    10,
    'mass',
  );

  expect(materialized.annotations.mass.numericType).toBe('float');
  expect(materialized.annotations.mass.numericMetadata?.numericType).toBe('float');
});
```

- [ ] **Step 2: Run formatting tests and verify failure**

Run:

```bash
pnpm --filter @protspace/utils test:ci -- src/visualization/numeric-binning.test.ts
```

Expected: tests fail because `materializeNumericAnnotation` does not accept a subtype and float labels do not use comma grouping.

- [ ] **Step 3: Update numeric formatting helpers**

In `packages/utils/src/visualization/numeric-binning.ts`, import the subtype type:

```typescript
import type {
  Annotation,
  NumericAnnotationType,
  NumericBinningStrategy,
  NumericBinDefinition,
  NumericAnnotationMetadata,
  LegendPersistedSettings,
  VisualizationData,
} from '../types';
```

Replace `formatNumericValue` with this subtype-aware formatter:

```typescript
function formatNumericValue(value: number, numericType: NumericAnnotationType): string {
  if (!Number.isFinite(value)) return String(value);

  if (numericType === 'int') {
    return String(Math.trunc(value));
  }

  return new Intl.NumberFormat('en-US', {
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 6,
  }).format(value);
}
```

Update `formatNumericValueWithPrecision` to preserve grouped float labels when fallback precision is needed:

```typescript
function formatNumericValueWithPrecision(
  value: number,
  precision: number,
  numericType: NumericAnnotationType,
): string {
  if (!Number.isFinite(value)) return String(value);
  if (numericType === 'int') return String(Math.trunc(value));

  const rounded = Number(value.toPrecision(precision));
  return new Intl.NumberFormat('en-US', {
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: Math.min(Math.max(precision, 1), 16),
  }).format(rounded);
}
```

- [ ] **Step 4: Thread subtype through materialization**

Change the signatures and call sites in `numeric-binning.ts`:

```typescript
function createObservedBinLabels(
  observedRanges: ObservedBinRange[],
  summary: NumericSummary,
  exactBounds: Array<{ lowerBound: number; upperBound: number }>,
  numericType: NumericAnnotationType,
): string[] {
  if (numericType === 'int') {
    return observedRanges.map(({ min, max }) =>
      formatRangeLabel(min, max, (value) => formatNumericValue(value, 'int')),
    );
  }

  const formatWith = (formatter: (value: number) => string) =>
    observedRanges.map(({ min, max }) => formatRangeLabel(min, max, formatter));

  const defaultLabels = formatWith((value) => formatNumericValue(value, 'float'));
  if (new Set(defaultLabels).size === defaultLabels.length) {
    return defaultLabels;
  }

  for (const precision of [6, 8, 10, 12, 14, 16]) {
    const labels = formatWith((value) =>
      formatNumericValueWithPrecision(value, precision, 'float'),
    );
    if (new Set(labels).size === labels.length) {
      return labels;
    }
  }

  const fallback = exactBounds.map(({ lowerBound, upperBound }) =>
    formatRangeLabel(lowerBound, upperBound, serializeNumericValue),
  );
  if (new Set(fallback).size === fallback.length) {
    return fallback;
  }

  return exactBounds.map(({ lowerBound, upperBound }, index) => {
    const base = formatRangeLabel(lowerBound, upperBound, serializeNumericValue);
    return `${base} (${index + 1})`;
  });
}
```

Update `materializeNumericAnnotation`:

```typescript
export function materializeNumericAnnotation(
  values: Array<number | null | undefined>,
  settings: NumericAnnotationDisplaySettings,
  numericType: NumericAnnotationType = 'float',
): {
  annotation: Annotation;
  annotationData: number[][];
} {
```

In the empty result metadata, include:

```typescript
numericType,
```

In the normal metadata, include:

```typescript
const numericMetadata: NumericAnnotationMetadata = {
  strategy: effectiveSettings.strategy,
  binCount: bins.length,
  signature: createSignature(effectiveSettings, binsWithColorPositions),
  topologySignature,
  logSupported: summary.logSupported,
  numericType,
  bins: binsWithColorPositions,
};
```

In the returned annotation, include:

```typescript
numericType,
```

Update the bin-label fallback line:

```typescript
label:
  labels[index] ??
  formatRangeLabel(bin.lowerBound, bin.upperBound, (value) =>
    formatNumericValue(value, numericType),
  ),
```

- [ ] **Step 5: Pass subtype from raw annotations**

In `materializeVisualizationData`, change the materialization call to:

```typescript
const materialized = materializeNumericAnnotation(
  numericValues,
  getNumericAnnotationSettings(settingsMap, annotationName, defaultBinCount),
  annotation.numericType ?? annotation.numericMetadata?.numericType ?? 'float',
);
```

- [ ] **Step 6: Include subtype in scatterplot materialization cache**

In `packages/core/src/components/scatter-plot/scatter-plot.ts`, include the selected annotation subtype in `_getMaterializedData()`’s `cacheKey`:

```typescript
const selectedNumericType = this.selectedAnnotation
  ? (this.data.annotations[this.selectedAnnotation]?.numericType ??
    this.data.annotations[this.selectedAnnotation]?.numericMetadata?.numericType ??
    null)
  : null;

const cacheKey = JSON.stringify({
  dataRef: this.data.protein_ids.length,
  selectedAnnotation: this.selectedAnnotation,
  selectedNumericValuesLength: selectedNumericValues?.length ?? 0,
  selectedNumericType,
  numericAnnotationSettings: selectedNumericSettings ?? null,
  annotationKeys: Object.keys(this.data.annotations),
});
```

- [ ] **Step 7: Format raw numeric tooltip values by subtype**

In `packages/core/src/components/scatter-plot/protein-tooltip.ts`, add:

```typescript
function formatRawNumericValue(value: number, numericType: 'int' | 'float' | undefined): string {
  if (!Number.isFinite(value)) return String(value);
  if (numericType === 'int') return String(Math.trunc(value));
  return new Intl.NumberFormat('en-US', {
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 6,
  }).format(value);
}
```

Where the tooltip renders the raw numeric value, replace direct string conversion with:

```typescript
formatRawNumericValue(
  rawNumericValue,
  this.protein.numericAnnotationTypes?.[this.selectedAnnotation],
);
```

If `PlotDataPoint` does not yet expose `numericAnnotationTypes`, add `numericAnnotationTypes?: Record<string, 'int' | 'float'>` to `packages/utils/src/types.ts` and populate it in `packages/utils/src/visualization/data-processor.ts`:

```typescript
numericAnnotationTypes[annotationKey] =
  annotation.numericType ?? annotation.numericMetadata?.numericType ?? undefined;
```

- [ ] **Step 8: Run tests**

Run:

```bash
pnpm --filter @protspace/utils test:ci -- src/visualization/numeric-binning.test.ts
pnpm --filter @protspace/core type-check
```

Expected: numeric-binning tests pass and core type-check passes.

- [ ] **Step 9: Commit**

Run:

```bash
git add packages/utils/src/types.ts packages/utils/src/visualization/numeric-binning.ts packages/utils/src/visualization/numeric-binning.test.ts packages/utils/src/visualization/data-processor.ts packages/core/src/components/scatter-plot/scatter-plot.ts packages/core/src/components/scatter-plot/protein-tooltip.ts
git commit -m "fix(numeric): format labels by inferred subtype"
```

Expected: commit succeeds.

---

### Task 5: Persist Annotation Type Override

**Files:**

- Modify: `packages/utils/src/parquet/settings-validation.ts`
- Modify: `packages/utils/src/parquet/settings-validation.test.ts`
- Modify: `packages/core/src/components/legend/controllers/persistence-controller.ts`
- Modify: `packages/core/src/components/legend/controllers/persistence-controller.test.ts`
- Modify: `packages/core/src/components/legend/legend-helpers.ts`
- Modify: `packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts`

- [ ] **Step 1: Add settings validation tests**

In `packages/utils/src/parquet/settings-validation.test.ts`, add tests that preserve valid override values and drop invalid values during sanitization:

```typescript
it('preserves valid annotation type overrides', () => {
  const normalized = normalizeBundleSettings({
    legendSettings: {
      score: {
        ...createValidLegendSettings(),
        annotationTypeOverride: 'numeric',
      },
    },
    exportOptions: {},
  });

  expect(normalized?.legendSettings.score.annotationTypeOverride).toBe('numeric');
});

it('drops invalid annotation type overrides while preserving settings', () => {
  const normalized = normalizeBundleSettings({
    legendSettings: {
      score: {
        ...createValidLegendSettings(),
        annotationTypeOverride: 'number',
      },
    },
    exportOptions: {},
  });

  expect(normalized?.legendSettings.score.annotationTypeOverride).toBeUndefined();
  expect(normalized?.legendSettings.score.maxVisibleValues).toBe(
    createValidLegendSettings().maxVisibleValues,
  );
});
```

- [ ] **Step 2: Update settings validation**

In `packages/utils/src/parquet/settings-validation.ts`, import `AnnotationTypeOverride` and add:

```typescript
const VALID_ANNOTATION_TYPE_OVERRIDES: AnnotationTypeOverride[] = ['auto', 'string', 'numeric'];

function isValidAnnotationTypeOverride(value: unknown): value is AnnotationTypeOverride {
  return (
    typeof value === 'string' &&
    VALID_ANNOTATION_TYPE_OVERRIDES.includes(value as AnnotationTypeOverride)
  );
}
```

In `isValidLegendSettings`, add:

```typescript
if (
  s.annotationTypeOverride !== undefined &&
  !isValidAnnotationTypeOverride(s.annotationTypeOverride)
) {
  return false;
}
```

In `sanitizeLegendSettingsEntry`, add:

```typescript
const annotationTypeOverride = isValidAnnotationTypeOverride(s.annotationTypeOverride)
  ? s.annotationTypeOverride
  : undefined;
```

Return it:

```typescript
    annotationTypeOverride,
```

- [ ] **Step 3: Persist override from legend**

In `packages/core/src/components/legend/controllers/persistence-controller.ts`, extend `getCurrentSettings()`:

```typescript
    annotationTypeOverride?: LegendPersistedSettings['annotationTypeOverride'];
```

When constructing `settings`, include:

```typescript
      annotationTypeOverride: currentSettings.annotationTypeOverride,
```

When returning from `getCurrentSettingsForExport()`, include:

```typescript
      annotationTypeOverride: currentSettings.annotationTypeOverride,
```

In `packages/core/src/components/legend/legend-helpers.ts`, update `createDefaultSettings` to set:

```typescript
    annotationTypeOverride: 'auto',
```

- [ ] **Step 4: Add persistence controller test coverage**

In `packages/core/src/components/legend/controllers/persistence-controller.test.ts`, add `annotationTypeOverride: 'numeric'` to an existing persisted numeric settings fixture and assert it is returned by `getCurrentSettingsForExport()`:

```typescript
expect(exported.annotationTypeOverride).toBe('numeric');
```

- [ ] **Step 5: Add bundle settings round-trip coverage**

In `packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts`, update the `round-trips numeric legend settings through bundle settings` fixture to include:

```typescript
          annotationTypeOverride: 'numeric' as const,
```

Update the assertion to keep the full settings equality:

```typescript
expect(extracted.settings).toEqual(settings);
```

- [ ] **Step 6: Run persistence tests**

Run:

```bash
pnpm --filter @protspace/utils test:ci -- src/parquet/settings-validation.test.ts
pnpm --filter @protspace/core test:ci -- src/components/legend/controllers/persistence-controller.test.ts
pnpm --filter @protspace/core test:ci -- src/components/data-loader/utils/bundle-roundtrip.test.ts
```

Expected: tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/utils/src/parquet/settings-validation.ts packages/utils/src/parquet/settings-validation.test.ts packages/core/src/components/legend/controllers/persistence-controller.ts packages/core/src/components/legend/controllers/persistence-controller.test.ts packages/core/src/components/legend/legend-helpers.ts packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts
git commit -m "feat(legend): persist annotation type override"
```

Expected: commit succeeds.

---

### Task 6: Apply Annotation Type Overrides To Loaded Data

**Files:**

- Create: `packages/utils/src/visualization/annotation-type-overrides.ts`
- Create: `packages/utils/src/visualization/annotation-type-overrides.test.ts`
- Modify: `packages/utils/src/index.ts`
- Modify: `packages/core/src/components/scatter-plot/scatter-plot.ts`
- Modify: `packages/core/src/components/legend/scatterplot-interface.ts`
- Modify: `packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`

- [ ] **Step 1: Add override utility tests**

Create `packages/utils/src/visualization/annotation-type-overrides.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { applyAnnotationTypeOverrides } from './annotation-type-overrides';
import type { VisualizationData } from '../types';

function createData(): VisualizationData {
  return {
    protein_ids: ['P1', 'P2', 'P3'],
    projections: [
      {
        name: 'UMAP',
        data: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      },
    ],
    annotations: {
      score: {
        kind: 'categorical',
        values: ['1.5', '2.5'],
        colors: ['#111', '#222'],
        shapes: ['circle', 'circle'],
      },
      family: {
        kind: 'categorical',
        values: ['A', 'B'],
        colors: ['#333', '#444'],
        shapes: ['circle', 'circle'],
      },
      length: { kind: 'numeric', numericType: 'int', values: [], colors: [], shapes: [] },
    },
    annotation_data: {
      score: [[0], [1], []],
      family: [[0], [1], [0]],
    },
    numeric_annotation_data: {
      length: [1000, 2000, null],
    },
  };
}

describe('applyAnnotationTypeOverrides', () => {
  it('converts a single-value numeric-looking categorical annotation to numeric', () => {
    const result = applyAnnotationTypeOverrides(createData(), { score: 'numeric' });

    expect(result.errors).toEqual([]);
    expect(result.data.annotations.score.kind).toBe('numeric');
    expect(result.data.annotations.score.numericType).toBe('float');
    expect(result.data.numeric_annotation_data?.score).toEqual([1.5, 2.5, null]);
    expect(result.data.annotation_data.score).toBeUndefined();
  });

  it('rejects numeric override when categorical values are nonnumeric', () => {
    const result = applyAnnotationTypeOverrides(createData(), { family: 'numeric' });

    expect(result.errors).toEqual([
      {
        annotation: 'family',
        message:
          'Cannot treat family as numeric because at least one non-empty value is nonnumeric.',
      },
    ]);
    expect(result.data.annotations.family.kind).toBe('categorical');
    expect(result.data.annotation_data.family).toEqual([[0], [1], [0]]);
  });

  it('converts a numeric annotation to categorical strings', () => {
    const result = applyAnnotationTypeOverrides(createData(), { length: 'string' });

    expect(result.errors).toEqual([]);
    expect(result.data.annotations.length.kind).toBe('categorical');
    expect(result.data.annotations.length.numericType).toBeUndefined();
    expect(result.data.numeric_annotation_data?.length).toBeUndefined();
    expect(result.data.annotations.length.values).toEqual(['1000', '2000']);
    expect(result.data.annotation_data.length).toEqual([[0], [1], []]);
  });
});
```

- [ ] **Step 2: Create the override utility**

Create `packages/utils/src/visualization/annotation-type-overrides.ts`:

```typescript
import type {
  Annotation,
  AnnotationTypeOverride,
  NumericAnnotationType,
  VisualizationData,
} from '../types';
import { COLOR_SCHEMES } from './color-scheme';

export interface AnnotationTypeOverrideError {
  annotation: string;
  message: string;
}

export interface AnnotationTypeOverrideResult {
  data: VisualizationData;
  errors: AnnotationTypeOverrideError[];
}

function parseOverrideNumericValue(rawValue: unknown): number | null {
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null;
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.includes(';') || trimmed.includes('|')) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function generateColors(count: number): string[] {
  const palette = COLOR_SCHEMES.kellys as readonly string[];
  return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
}

function generateShapes(count: number): string[] {
  return Array.from({ length: count }, () => 'circle');
}

function createNumericAnnotation(numericType: NumericAnnotationType): Annotation {
  return { kind: 'numeric', numericType, values: [], colors: [], shapes: [] };
}

function createCategoricalFromRawValues(rawValues: Array<string | null>): {
  annotation: Annotation;
  annotationData: number[][];
} {
  const valueToIndex = new Map<string, number>();
  const values: string[] = [];
  const annotationData = rawValues.map((rawValue) => {
    if (rawValue == null || rawValue.trim() === '') return [];
    const value = rawValue.trim();
    let index = valueToIndex.get(value);
    if (index === undefined) {
      index = values.length;
      valueToIndex.set(value, index);
      values.push(value);
    }
    return [index];
  });

  return {
    annotation: {
      kind: 'categorical',
      values,
      colors: generateColors(values.length),
      shapes: generateShapes(values.length),
    },
    annotationData,
  };
}

function inferNumericValues(rawValues: Array<string | null>): {
  numericType: NumericAnnotationType;
  values: (number | null)[];
} | null {
  const values: (number | null)[] = [];
  let sawNonEmpty = false;
  let sawFloat = false;

  for (const rawValue of rawValues) {
    if (rawValue == null || rawValue.trim() === '') {
      values.push(null);
      continue;
    }

    sawNonEmpty = true;
    const parsed = parseOverrideNumericValue(rawValue);
    if (parsed == null) return null;
    if (!Number.isInteger(parsed)) sawFloat = true;
    values.push(parsed);
  }

  if (!sawNonEmpty) return null;
  return { numericType: sawFloat ? 'float' : 'int', values };
}

function categoricalRowsToRawValues(
  data: VisualizationData,
  annotationName: string,
): string[] | null {
  const annotation = data.annotations[annotationName];
  const rows = data.annotation_data[annotationName];
  if (!annotation || !rows) return null;

  const rawValues: string[] = [];
  for (const row of rows) {
    if (row.length === 0) {
      rawValues.push('');
      continue;
    }
    if (row.length !== 1) return null;
    const valueIndex = row[0];
    rawValues.push(annotation.values[valueIndex] ?? '');
  }
  return rawValues;
}

export function applyAnnotationTypeOverrides(
  data: VisualizationData,
  overrides: Record<string, AnnotationTypeOverride | undefined>,
): AnnotationTypeOverrideResult {
  const next: VisualizationData = {
    ...data,
    annotations: { ...data.annotations },
    annotation_data: { ...data.annotation_data },
    numeric_annotation_data: data.numeric_annotation_data
      ? { ...data.numeric_annotation_data }
      : {},
  };
  const errors: AnnotationTypeOverrideError[] = [];

  for (const [annotationName, override] of Object.entries(overrides)) {
    if (!override || override === 'auto') continue;
    const annotation = data.annotations[annotationName];
    if (!annotation) continue;

    if (override === 'string' && annotation.kind === 'numeric') {
      const numericValues = data.numeric_annotation_data?.[annotationName] ?? [];
      const rawValues = numericValues.map((value) => (value == null ? null : String(value)));
      const categorical = createCategoricalFromRawValues(rawValues);
      next.annotations[annotationName] = categorical.annotation;
      next.annotation_data[annotationName] = categorical.annotationData;
      delete next.numeric_annotation_data?.[annotationName];
      continue;
    }

    if (override === 'numeric' && annotation.kind !== 'numeric') {
      const rawValues = categoricalRowsToRawValues(data, annotationName);
      const inferred = rawValues ? inferNumericValues(rawValues) : null;
      if (!inferred) {
        errors.push({
          annotation: annotationName,
          message: `Cannot treat ${annotationName} as numeric because at least one non-empty value is nonnumeric.`,
        });
        continue;
      }
      next.annotations[annotationName] = createNumericAnnotation(inferred.numericType);
      next.numeric_annotation_data![annotationName] = inferred.values;
      delete next.annotation_data[annotationName];
    }
  }

  if (next.numeric_annotation_data && Object.keys(next.numeric_annotation_data).length === 0) {
    delete next.numeric_annotation_data;
  }

  return { data: next, errors };
}
```

- [ ] **Step 3: Export the helper**

In `packages/utils/src/index.ts`, add:

```typescript
export * from './visualization/annotation-type-overrides';
```

- [ ] **Step 4: Run utility tests and verify they pass**

Run:

```bash
pnpm --filter @protspace/utils test:ci -- src/visualization/annotation-type-overrides.test.ts
```

Expected: tests pass.

- [ ] **Step 5: Expose override map to scatterplot sync**

In `packages/core/src/components/legend/scatterplot-interface.ts`, import the type:

```typescript
import type { AnnotationTypeOverride, NumericAnnotationDisplaySettingsMap } from '@protspace/utils';
```

Add to `IScatterplotElement`:

```typescript
  annotationTypeOverrides?: Record<string, AnnotationTypeOverride>;
```

In `packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`, import `AnnotationTypeOverride` and extend callbacks:

```typescript
  getAnnotationTypeOverrides?: () => Record<string, AnnotationTypeOverride>;
```

In `syncNumericAnnotationSettings()`, assign:

```typescript
this._scatterplotElement.annotationTypeOverrides =
  this.callbacks.getAnnotationTypeOverrides?.() ?? {};
```

- [ ] **Step 6: Apply override map before materialization**

In `packages/core/src/components/scatter-plot/scatter-plot.ts`, import the helper and type:

```typescript
import type {
  AnnotationTypeOverride,
  VisualizationData,
  PlotDataPoint,
  ScatterplotConfig,
  NumericAnnotationDisplaySettingsMap,
} from '@protspace/utils';
import {
  applyAnnotationTypeOverrides,
  DataProcessor,
  getNumericBinLabelMap,
  materializeVisualizationData,
  toInternalValue,
} from '@protspace/utils';
```

Add the property:

```typescript
  @property({ type: Object }) annotationTypeOverrides: Record<string, AnnotationTypeOverride> = {};
```

In `_getMaterializedData()`, apply overrides before calling `materializeVisualizationData`:

```typescript
const overrideResult = applyAnnotationTypeOverrides(this.data, this.annotationTypeOverrides);
for (const error of overrideResult.errors) {
  console.warn(`[protspace-scatterplot] ${error.message}`);
  this.dispatchEvent(
    new CustomEvent('annotation-type-override-error', {
      detail: error,
      bubbles: true,
      composed: true,
    }),
  );
}
const sourceData = overrideResult.data;
```

Then use `sourceData` instead of `this.data` for `selectedNumericValues`, `selectedNumericType`, `annotationKeys`, and the call to `materializeVisualizationData`:

```typescript
const selectedNumericValues = this.selectedAnnotation
  ? sourceData.numeric_annotation_data?.[this.selectedAnnotation]
  : undefined;
```

Add the overrides to the cache key:

```typescript
      annotationTypeOverrides: this.annotationTypeOverrides,
```

Call:

```typescript
this._materializedDataCache = materializeVisualizationData(
  sourceData,
  this.numericAnnotationSettings,
  10,
  this.selectedAnnotation,
);
```

- [ ] **Step 7: Run scatterplot and utility checks**

Run:

```bash
pnpm --filter @protspace/utils test:ci -- src/visualization/annotation-type-overrides.test.ts
pnpm --filter @protspace/core type-check
```

Expected: tests pass and type-check passes.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/utils/src/visualization/annotation-type-overrides.ts packages/utils/src/visualization/annotation-type-overrides.test.ts packages/utils/src/index.ts packages/core/src/components/scatter-plot/scatter-plot.ts packages/core/src/components/legend/scatterplot-interface.ts packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts
git commit -m "feat(annotation): apply type overrides to loaded data"
```

Expected: commit succeeds.

---

### Task 7: Add Override Control To Legend Settings

**Files:**

- Modify: `packages/core/src/components/legend/legend-settings-dialog.ts`
- Modify: `packages/core/src/components/legend/legend.ts`
- Modify: `packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`

- [ ] **Step 1: Extend dialog state and callbacks**

In `packages/core/src/components/legend/legend-settings-dialog.ts`, import the override type:

```typescript
import type { AnnotationTypeOverride } from '@protspace/utils';
```

Add to `SettingsDialogState`:

```typescript
annotationTypeOverride: AnnotationTypeOverride;
```

Add to `SettingsDialogCallbacks`:

```typescript
  onAnnotationTypeOverrideChange: (value: AnnotationTypeOverride) => void;
```

- [ ] **Step 2: Add the type control renderer**

Add this function after `renderCheckboxOptions`:

```typescript
function renderAnnotationTypeSection(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  return renderSection(
    'Annotation type',
    html`
      <div class="other-items-list-item other-items-list-item--grouped">
        <label for="annotation-type-override" class="other-items-list-item-label">Type mode</label>
        <select
          id="annotation-type-override"
          class="color-palette-select legend-form-control"
          .value=${state.annotationTypeOverride}
          @change=${(e: Event) =>
            callbacks.onAnnotationTypeOverrideChange(
              (e.target as HTMLSelectElement).value as AnnotationTypeOverride,
            )}
        >
          <option value="auto">Auto</option>
          <option value="string">String</option>
          <option value="numeric">Numeric</option>
        </select>
        <div class="settings-note settings-note--compact">
          Auto uses imported values. String disables gradient controls. Numeric enables gradient
          controls only when all non-empty values parse as finite numbers.
        </div>
      </div>
    `,
    undefined,
    'legend-annotation-type-section-title',
  );
}
```

In `renderSettingsDialog`, render it before the display section:

```typescript
          ${renderAnnotationTypeSection(state, callbacks)}
```

- [ ] **Step 3: Store override state in legend and sync it to the scatterplot**

In `packages/core/src/components/legend/legend.ts`, import `AnnotationTypeOverride`:

```typescript
import type { AnnotationTypeOverride } from '@protspace/utils';
```

Add component state near `_numericSettingsByAnnotation`:

```typescript
  @state() private _annotationTypeOverridesByAnnotation: Record<string, AnnotationTypeOverride> =
    {};
```

Extend `_dialogSettings` with:

```typescript
annotationTypeOverride: LegendPersistedSettings['annotationTypeOverride'];
```

Add the override map to the `ScatterplotSyncController` callbacks:

```typescript
    getAnnotationTypeOverrides: () => this._annotationTypeOverridesByAnnotation,
```

In `_handleCustomize`, set:

```typescript
      annotationTypeOverride:
        this._annotationTypeOverridesByAnnotation[this.selectedAnnotation] ?? 'auto',
```

In `_renderSettingsDialog`, pass:

```typescript
      annotationTypeOverride: this._dialogSettings.annotationTypeOverride ?? 'auto',
```

Add callback:

```typescript
      onAnnotationTypeOverrideChange: (value) => {
        this._dialogSettings = { ...this._dialogSettings, annotationTypeOverride: value };
      },
```

In the persistence controller callback `getCurrentSettings`, include:

```typescript
      annotationTypeOverride:
        this._annotationTypeOverridesByAnnotation[this.selectedAnnotation] ?? 'auto',
```

In `_applyPersistedSettings`, after `_selectedPaletteId = resolvedPaletteId;`, set the loaded override:

```typescript
this._annotationTypeOverridesByAnnotation = {
  ...this._annotationTypeOverridesByAnnotation,
  [this.selectedAnnotation]: settings.annotationTypeOverride ?? 'auto',
};
```

In `_handleSettingsSave`, after `_annotationSortModes` assignment, save the selected override in live state:

```typescript
this._annotationTypeOverridesByAnnotation = {
  ...this._annotationTypeOverridesByAnnotation,
  [this.selectedAnnotation]: this._dialogSettings.annotationTypeOverride ?? 'auto',
};
```

In the reset path that clears numeric settings for a new dataset, also reset:

```typescript
this._annotationTypeOverridesByAnnotation = {};
```

After updating settings in `_handleSettingsSave`, keep the existing call to `this._scatterplotController.syncNumericAnnotationSettings();` so the override map reaches the scatterplot before the next data-change event.

- [ ] **Step 4: Run type check**

Run:

```bash
pnpm --filter @protspace/core type-check
```

Expected: type-check passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/components/legend/legend-settings-dialog.ts packages/core/src/components/legend/legend.ts packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts
git commit -m "feat(legend): expose annotation type override"
```

Expected: commit succeeds.

---

### Task 8: Browser Reproduction And Validation

**Files:**

- No source changes expected

- [ ] **Step 1: Start the app**

Run:

```bash
pnpm dev:app
```

Expected: Vite starts the app, usually at `http://localhost:5173/`.

- [ ] **Step 2: Load the browser with Playwright**

Open the local app with Playwright and load `app/tests/fixtures/data_custom.parquetbundle` through the existing upload UI.

Expected:

- The file imports without console errors.
- Float annotations such as `num_random_float` show numeric gradient options in legend settings.
- Integer annotations such as `num_sequential` show numeric gradient options and integer labels without comma or decimals.
- String annotations such as `cat_numbers_with_units`, `cat_percentages`, `cat_pipe_delimited`, and `cat_nan_inf_strings` show categorical palette options.

- [ ] **Step 3: Validate formatting in the browser**

Select `cat_wide_range_float` or another float annotation with values above 1000.

Expected:

- Legend labels show comma grouping and decimals, for example `1,200.5`.
- Tooltip raw numeric values use comma grouping and decimals for float annotations.

Select an integer annotation with values above 1000.

Expected:

- Legend labels show no comma and no decimals, for example `1200`.
- Tooltip raw numeric values show no comma and no decimals.

- [ ] **Step 4: Validate override persistence**

Open legend settings for a numeric annotation, change `Type mode` to `String`, save, reload the dataset, and reopen the same annotation settings.

Expected:

- The settings dialog still shows `String`.
- Numeric gradient controls are not shown while string override is active.

Open legend settings for a categorical numeric-looking annotation, change `Type mode` to `Numeric`, save, reload the dataset, and reopen the same annotation settings.

Expected:

- If all non-empty values parse as finite numbers, `Numeric` remains selected and gradient controls are shown.
- If a nonnumeric value exists, the override is rejected with a visible error and the annotation stays categorical.

- [ ] **Step 5: Stop the dev server**

Stop the `pnpm dev:app` process with `Ctrl-C`.

Expected: dev server exits.

---

### Task 9: Full Verification

**Files:**

- No source changes expected

- [ ] **Step 1: Run package tests touched by this issue**

Run:

```bash
pnpm --filter @protspace/core test:ci -- src/components/data-loader/utils/conversion-numeric.test.ts
pnpm --filter @protspace/utils test:ci -- src/visualization/numeric-binning.test.ts
pnpm --filter @protspace/utils test:ci -- src/visualization/annotation-type-overrides.test.ts
pnpm --filter @protspace/utils test:ci -- src/parquet/settings-validation.test.ts
pnpm --filter @protspace/core test:ci -- src/components/legend/controllers/persistence-controller.test.ts
pnpm --filter @protspace/core test:ci -- src/components/data-loader/utils/bundle-roundtrip.test.ts
```

Expected: all targeted suites pass.

- [ ] **Step 2: Run repo quality gates**

Run:

```bash
pnpm type-check
pnpm test:ci
```

Expected: both commands pass.

- [ ] **Step 3: Run formatting only if needed**

Run this only if tests or type-check show formatting-generated snapshots or lint failures:

```bash
pnpm format
```

Expected: formatting completes without errors. Review changed files before committing.

- [ ] **Step 4: Final commit**

Run:

```bash
git status --short
git add packages app docs
git commit -m "fix(annotation): infer string-backed numeric types"
```

Expected: commit succeeds if there are uncommitted implementation changes. If `git status --short` is clean, skip the commit.

---

## Self-Review Checklist

- Spec coverage: deterministic inference is implemented in Task 2; the custom annotated fixture is covered in Task 3; numeric subtype metadata and formatting are covered in Task 4; override persistence, data application, and UI are covered in Tasks 5 through 7; browser validation is covered in Task 8.
- Placeholder scan: the plan contains no `TBD`, no `TODO`, no `implement later`, and no unspecified edge-case steps.
- Type consistency: `NumericAnnotationType` is consistently `int | float`; `AnnotationTypeOverride` is consistently `auto | string | numeric`; `numericType` is present on raw `Annotation` and materialized `numericMetadata`.
