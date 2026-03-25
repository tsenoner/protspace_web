# Query Builder Filter — Design Spec

**Issue:** [#161 — Rework on the filter logic](https://github.com/tsenoner/protspace_web/issues/161)
**Date:** 2026-03-25

## Problem

The current filter creates a synthetic "Custom" annotation that splits proteins into "Filtered Proteins" vs "Other Proteins". This doesn't truly subset the data for subsequent exploration. There is also no way to reset filters.

## Solution

Replace the current checkbox-based filter with a **row-based query builder** (UniProt-style) that evaluates a query, selects matching proteins, and **isolates** them — hiding non-matching proteins from the plot entirely.

**Key invariant:** The new filter does NOT mutate `sp.data`. It only programmatically sets the scatterplot's selection and triggers isolation. This is a clean separation from the old approach which injected a synthetic annotation into the data.

## Query Builder UI

### Layout

The filter button in the control bar opens a **wider popover** containing the query builder. The popover replaces the current filter dropdown.

### Condition Rows

Each condition is a row with four parts:

```
[Logical Connector] [Annotation] [Operator] [Value(s)]
```

- **Logical connector:** AND / OR / NOT dropdown. The first row (or first item in a group) has no connector.
- **Annotation:** Searchable dropdown grouped by category (UniProt, InterPro, Taxonomy, Other). Reuses the existing annotation category structure from `annotation-select.ts`.
- **Operator:** One of `is`, `is not`, `contains`, `starts with`.
- **Value(s):** Depends on operator:
  - `is` / `is not` — Multi-value chip selector. Each chip shows a selected value with an "x" to remove. A "+" button opens a searchable value picker.
  - `contains` / `starts with` — Free-text input field (single value).

Each row also has an "x" button to remove the condition.

### Groups (Parentheses)

Groups provide logical precedence. They are rendered as **indented blocks with a left border**:

- A group has its own logical connector (AND / OR / NOT) relative to the rest of the query.
- Inside a group, conditions follow the same row pattern (first condition in the group has no connector).
- Groups can be removed with an "x" button on the group header.

Users add groups via a "+ Add group" button alongside "+ Add condition".

### Value Picker

When clicking "+" to add a value for `is` / `is not` operators:

- Opens a **searchable dropdown** positioned below the row.
- **Substring matching** with the matched portion highlighted in results.
- Each value shows a **protein count** (how many proteins have that value).
- Already-selected values are **hidden** from the dropdown.
- Clicking a value adds it as a chip; the dropdown **stays open** for adding more.
- Close with Escape or clicking outside.

### Annotation Picker

When clicking the annotation dropdown in a condition row:

- Opens a **grouped searchable dropdown**.
- Annotations grouped by category: UniProt, InterPro, Taxonomy, Other.
- Search input at the top filters across all categories.
- Extracts the shared `ANNOTATION_CATEGORIES` constant from `annotation-select.ts` into a shared module (e.g., `annotation-categories.ts`) so both the annotation-select component and the query builder can import it.

## Filter Button States

### Inactive

Standard button appearance with filter icon and "Filter" label.

### Active

- Button highlighted with primary color border and text.
- **Badge** showing the number of active conditions (e.g., "3").
- Clicking opens the popover with the **existing query** for editing.

## Popover Layout

```
┌─────────────────────────────────────────────┐
│ Filter Query              142 of 500 matched│
├─────────────────────────────────────────────┤
│                                             │
│  [        ] [organism ▾] [is ▾] [Human ×]   │
│             [Mouse ×] [+]                   │
│                                             │
│  [AND ▾   ] [reviewed ▾] [is ▾] [true ×][+]│
│                                             │
│  [NOT ▾   ] [go_bp    ▾] [contains] [kinase]│
│                                             │
│  ┃ OR Group                              x  │
│  ┃  [        ] [pfam ▾] [is ▾] [PF00069]   │
│  ┃  [OR ▾   ] [pfam ▾] [is ▾] [PF00076]   │
│                                             │
│  + Add condition    + Add group             │
├─────────────────────────────────────────────┤
│ [Reset All]                [Apply & Isolate]│
└─────────────────────────────────────────────┘
```

## Behavior

### Apply & Isolate

1. Evaluate the query against all proteins in the dataset.
2. Convert matching protein indices to protein IDs via `data.protein_ids`.
3. Programmatically set the scatterplot's selection via `sp.selectedProteinIds = matchingIds` (existing property on `ScatterplotElementLike`).
4. Call `sp.isolateSelection()` to isolate the matched proteins.
5. Close the popover.

### Reset All

1. Clear all conditions from the query.
2. Call `sp.resetIsolation()` to restore the full dataset view.
3. Remove the active badge from the filter button.

No data mutation cleanup is needed because the new filter never modifies `sp.data`.

### Match Count

- Displayed at the top right of the popover: "N of M proteins matched".
- Updates as conditions are added/modified/removed (before applying).
- **Debounced** (300ms) to avoid blocking the main thread on large datasets (500k+ proteins). If evaluation takes >50ms, show a brief loading indicator in place of the count.

### Query Evaluation Logic

- **AND:** Protein must satisfy both the preceding and current condition.
- **OR:** Protein must satisfy either the preceding or current condition.
- **NOT:** Unary prefix — negates only the immediately following condition or group. `NOT` on row N means "negate the result of row N", unlike `AND`/`OR` which combine row N-1 with row N. In evaluation, `NOT` first evaluates the condition/group normally, then takes the complement.
- **Groups:** All conditions inside a group are evaluated as a unit (respecting their internal connectors). The group's result is then combined with the preceding items using the group's own logical connector.
- **`is` with multiple values:** Implicitly OR — protein matches if it has any of the selected values.
- **`is not` with multiple values:** Protein matches if it has none of the selected values.
- **`contains`:** Substring match (case-insensitive) against the resolved annotation string value.
- **`starts with`:** Prefix match (case-insensitive) against the resolved annotation string value.

### Edge Cases

- **Empty query (no conditions):** `evaluateQuery` returns all protein indices. Match count shows "N of N". "Apply & Isolate" button is disabled.
- **Condition with empty `values: []`:** Treated as "not yet configured" — skipped during evaluation (matches all proteins). The condition row should show a visual hint that values need to be selected.
- **Annotation not present in dataset:** Condition evaluates as non-matching (no protein matches). A warning icon could indicate the annotation has no data.
- **Null annotation values:** When the resolved string value for a protein is `null`, text operators (`contains`, `starts with`) treat it as non-matching. `is` matches only if `null` is explicitly in the selected values. `is not` matches (the protein does not have any of the excluded values).
- **All proteins match:** "Apply & Isolate" works normally (isolates all — effectively a no-op since nothing is hidden).
- **No proteins match:** "Apply & Isolate" is disabled. Match count shows "0 of N".

## Architecture

### Query Data Model

```typescript
interface FilterCondition {
  id: string; // stable key for Lit repeat() directive
  logicalOp?: 'AND' | 'OR' | 'NOT'; // undefined for first condition in query or group
  annotation: string;
  operator: 'is' | 'is_not' | 'contains' | 'starts_with';
  values: string[]; // multiple for is/is_not, single-element for contains/starts_with
}

interface FilterGroup {
  id: string; // stable key for Lit repeat() directive
  logicalOp?: 'AND' | 'OR' | 'NOT'; // undefined if first item in query or parent group
  conditions: (FilterCondition | FilterGroup)[];
}

type FilterQuery = (FilterCondition | FilterGroup)[];
```

### Components to Create/Modify

**New components (packages/core/src/components/control-bar/):**

- `query-builder.ts` — Main query builder component rendered inside the popover. Manages the list of conditions/groups and renders condition rows.
- `query-condition-row.ts` — Single condition row with operator, annotation picker, operator selector, and value chips.
- `query-value-picker.ts` — Searchable dropdown for selecting annotation values with protein counts.
- `query-builder.styles.ts` — Styles for the query builder.
- `annotation-categories.ts` — Shared constant extracted from `annotation-select.ts` so both components can import it.

**Modified components:**

- `control-bar.ts` — Replace current filter menu rendering with the query builder popover. Update filter button to show active badge. Replace `applyFilters()` with query evaluation + select + isolate.
- `styles/filter.ts` — Remove this file. All filter styles move to `query-builder.styles.ts`.
- `annotation-select.ts` — Import `ANNOTATION_CATEGORIES` from the new shared module instead of defining inline.
- Scatterplot component — No changes needed; `selectedProteinIds` property already exists on `ScatterplotElementLike`.

### Data Flow

```
User builds query in popover
  → FilterQuery object constructed
  → evaluateQuery(query, data) resolves annotation values and returns matching protein indices
  → Match count displayed (debounced) in popover header
  → On "Apply & Isolate":
    → Convert indices to protein IDs
    → sp.selectedProteinIds = matchingIds
    → sp.isolateSelection()
  → On "Reset All":
    → Clear FilterQuery
    → sp.resetIsolation()
```

### Query Evaluation

A pure function that takes a `FilterQuery` and the dataset, returning matching protein indices:

```typescript
function evaluateQuery(query: FilterQuery, data: ProtspaceData): Set<number>;
```

The caller must guard that `data.protein_ids`, `data.annotations`, and `data.annotation_data` are all present before calling `evaluateQuery`. If any are missing, the filter should be a no-op (return all indices).

**Value resolution:** Annotations are stored as integer indices. For each protein `i` and annotation `a`:

1. Look up the index: `annotationIdxData[a][i]` (handle both `number[]` and `number[][]` formats, as the existing code does).
2. Resolve the string value: `annotations[a].values[index]`.
3. Apply `toInternalValue()` normalization before comparison (consistent with existing convention).

This function recursively evaluates conditions and groups, combining results with the appropriate logical operators. It is stateless and testable in isolation.

## Testing

- **Unit tests** for `evaluateQuery` — cover AND/OR/NOT logic, groups, all operators, edge cases (empty values, missing annotations, null values, empty query).
- **Component tests** for `query-condition-row` — verify annotation picker, value picker, operator switching.
- **Integration test** for the full flow — build query → apply → verify `setSelectedProteins` and `isolateSelection` are called with correct protein IDs.

## Out of Scope

- Saving/loading named filter queries.
- Drag-and-drop reordering of conditions.
- Undo/redo within the query builder.
- Numeric comparison operators (greater than, less than) — all annotations are categorical.
