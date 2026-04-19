# Annotation Type Inference — Design Spec

**Issue:** [#226 — Floats aren't recognized as numeric and are still shown as categoric values](https://github.com/tsenoner/protspace_web/issues/226)
**Date:** 2026-04-17

## Problem

ProtSpace currently infers whether an annotation is numeric using a density/cardinality heuristic over string-backed values. This causes two problems:

- true float-valued annotations stored as strings are not consistently recognized as numeric
- the inference behavior is hard to explain because it depends on dataset shape rather than only on the values themselves

The application requirement is stricter than the current implementation:

- users must be able to load arbitrary parquet files without annotation inference crashing the import path
- annotation type should be inferred from the annotation values themselves
- numeric annotations should enable the numeric legend path, including gradient and binning controls
- integer and float annotations should have different display formatting

## Solution

Replace the current heuristic classifier with deterministic value-based annotation inference.

Each annotation is classified into one of three semantic types:

- `int`
- `float`
- `string`

Inference rule:

1. Iterate across all values of a single annotation.
2. Ignore `null`, `undefined`, and empty-string values for inference.
3. If all remaining values parse as finite integers, infer `int`.
4. Else if all remaining values parse as finite numbers and at least one value is non-integer, infer `float`.
5. Otherwise infer `string`.

This removes density, sparsity, and distinct-count thresholds entirely.

## Core Invariants

- Annotation inference must never make dataset import fail.
- Inference is deterministic for a given annotation value set.
- Mixed integer and float values infer `float`.
- Any non-finite or non-numeric token forces `string`.
- Numeric UI is enabled for `int` and `float`, disabled for `string`.
- User override wins over inferred type.

## Inference Semantics

### Input Model

Inference operates on the raw imported annotation values before any legend materialization.

The importer must preserve enough raw information to:

- infer semantic type
- build `numeric_annotation_data` for numeric annotations
- re-run parsing later if the user applies an override

### Parsing Rules

For each annotation value:

- `null`, `undefined`, and trimmed `''` are ignored for inference
- parse candidate numeric values using the existing numeric parsing path, but with deterministic classification rules
- require finite numeric results only

The following values must force `string` because they are not finite numbers:

- `nan`
- `inf`
- `-inf`
- `+inf`
- unit-suffixed values such as `25 kDa`
- percentages such as `34%`
- thousands-separated values such as `689,005`
- range values such as `200-400`
- semicolon-delimited values such as `90;10`
- pipe-delimited values such as `95|high`
- any other token that fails numeric parsing

### Classification Rules

Given the parsed annotation values:

- if there are no remaining non-empty values, infer `string`
- if every parsed value is an integer, infer `int`
- else if every parsed value is numeric and finite, infer `float`
- else infer `string`

Examples:

- `["1", "2", "3"]` -> `int`
- `["1.5", "2.0", "3.25"]` -> `float`
- `["1", "2.5", "3"]` -> `float`
- `["1", "A", "3"]` -> `string`
- `["nan", "1.2"]` -> `string`

## Runtime Behavior

### Numeric Annotations

Both `int` and `float` use the numeric path:

- store parsed values in `numeric_annotation_data`
- mark the raw annotation kind as numeric
- allow materialization into bins for legend rendering
- enable gradient palette preview and numeric settings
- enable numeric filtering behavior

### String Annotations

`string` annotations continue to use the categorical path:

- store values in `annotation_data`
- show categorical legend UI
- do not expose gradient controls

### Failure Containment

Malformed values affect only that annotation’s inferred type. They must not:

- abort the dataset load
- break unrelated annotations
- leave the control bar or legend in a partially initialized state

Worst case behavior is fallback to `string`.

## Formatting Rules

Formatting is driven by the inferred numeric subtype, not by Parquet schema storage.

- `int`: no comma, no decimals
- `float`: comma and decimals

Examples:

- integer display: `1200` stays `1200`
- float display: `1200.5` becomes `1,200.5`

Formatting must be applied consistently in:

- legend labels
- numeric tooltip labels
- numeric filter menus
- numeric preview chrome where values are shown

The float formatter should preserve decimals using a bounded formatter so values do not expand into noisy full-precision strings.

## Manual Override

Add a per-annotation manual override in the UI.

Supported override targets:

- `string`
- numeric

Behavior:

- override state is applied after inference and wins over it
- switching to numeric mode must re-parse the original raw annotation values
- if re-parse fails because some values are non-numeric, reject the override with a clear message
- switching to string mode must disable numeric UI and rebuild the annotation as categorical

Persistence:

- override must be persisted per dataset and per annotation
- override persistence should follow the same dataset-scoped behavior already used for legend settings

## Architecture

### New Internal Type

Replace the current boolean-only numeric classifier with an explicit result type:

```typescript
type InferredAnnotationType = 'int' | 'float' | 'string';

interface AnnotationInferenceResult {
  inferredType: InferredAnnotationType;
  numericValues?: (number | null)[];
}
```

This helper should become the single inference entry point for:

- bundle-format imports
- legacy-format imports
- optimized large-dataset imports

### Import Pipeline Changes

In `packages/core/src/components/data-loader/utils/conversion.ts`:

- replace `isScalarNumericAnnotationColumn(...)` with a deterministic classifier returning `AnnotationInferenceResult`
- remove density, distinct-count, and decimal-density thresholds from the import decision
- keep shared parsing logic in one place so all import paths classify annotations identically

### Numeric Metadata

Carry numeric subtype metadata forward so rendering can distinguish `int` from `float`.

Store subtype inside numeric metadata as a dedicated field:

```typescript
numericMetadata?: {
  numericType?: 'int' | 'float';
  // existing numeric metadata fields remain unchanged
}
```

This keeps subtype attached to the numeric rendering path and makes it available for:

- formatting decisions
- override persistence
- tests asserting the inferred subtype

### Override Layer

Override state should be modeled above raw import results rather than mutating raw source values.

Recommended behavior:

- preserve original imported values
- re-derive annotation presentation from raw values + persisted override
- reuse the existing numeric materialization stack once an annotation is in numeric mode

## UI Changes

### Numeric Legend Enablement

Numeric legend controls should appear for both inferred `int` and inferred `float`.

This includes:

- gradient palette preview
- bin count control
- numeric distribution strategy control
- numeric sorting behavior

### Label Formatting

All numeric label renderers must branch on subtype:

- `int`: whole-number formatting only
- `float`: grouped formatting with decimals

This applies even when numeric values were imported from strings.

### Override UX

Expose a per-annotation type switch in the legend settings dialog for the selected annotation.

Use a three-option segmented control or select with these exact values:

- `Auto`
- `String`
- `Numeric`

Behavior:

- `Auto` uses inference
- `String` forces categorical mode
- `Numeric` forces numeric mode using the existing parser and then infers `int` vs `float` from the parsed values
- the control is visible for the selected annotation
- changing it updates the preview immediately
- invalid `Numeric` override shows a clear rejection message and keeps the previous effective type

## Testing

### Unit Tests

Add or update inference tests to cover:

- all-int strings -> `int`
- all-float strings -> `float`
- mixed int/float strings -> `float`
- non-numeric token mixed with numerics -> `string`
- null/empty plus valid numerics -> numeric
- `nan` / `inf` / `-inf` -> `string`
- delimiter-based values (`;`, `|`) -> `string`

### Regression Bundle Coverage

Use the external fixture `data_custom.parquetbundle` as the main regression bundle for string-backed inference behavior.

Expected groups:

- `num_*` columns should infer numeric, split into `int` or `float`
- `cat_*` columns with non-numeric formatting should infer `string`
- `edge_*` columns should validate boundary behavior for:
  - all zeros
  - all NaNs
  - mostly numeric values with a few invalid tokens
  - mixed int/float

### Browser Tests

Add end-to-end coverage for:

- `int` annotations show numeric controls and integer formatting
- `float` annotations show numeric controls and float formatting
- `string` annotations stay categorical
- override updates the UI immediately
- override persists across reload for the same dataset
- invalid numeric override is rejected without breaking the page

## Consequences and Tradeoff

This design intentionally accepts a new tradeoff:

- numeric-looking identifier columns will be treated as numeric if every value is parseable as a finite integer or float

This is acceptable because:

- it is consistent with the selected product rule
- it removes opaque heuristics
- manual override provides a recovery path when numeric inference is too aggressive for a specific dataset

The design favors deterministic behavior over semantic guessing.
