# Query Builder Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the checkbox-based filter with a UniProt-style row-based query builder that evaluates AND/OR/NOT queries, selects matching proteins, and isolates them.

**Architecture:** Pure evaluation logic in a helpers file (TDD), three new Lit components (query-builder, query-condition-row, query-value-picker), integrated into the existing control-bar popover system. The old filter code (synthetic "Custom" annotation, checkbox UI, filter helpers) is removed.

**Tech Stack:** TypeScript, Lit (web components), Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-query-builder-filter-design.md`

---

## File Structure

### New files

| File                                                                | Responsibility                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/components/control-bar/annotation-categories.ts` | Shared `ANNOTATION_CATEGORIES`, `TAXONOMY_ORDER`, `CategoryName`, `GroupedAnnotation` types — extracted from `annotation-select.ts`           |
| `packages/core/src/components/control-bar/query-types.ts`           | `FilterCondition`, `FilterGroup`, `FilterQuery` types + `createCondition()`, `createGroup()` factory functions + `isFilterGroup()` type guard |
| `packages/core/src/components/control-bar/query-evaluate.ts`        | `evaluateQuery()` pure function + `resolveAnnotationValue()` helper                                                                           |
| `packages/core/src/components/control-bar/query-evaluate.test.ts`   | Tests for `evaluateQuery()` — AND/OR/NOT, groups, all operators, edge cases                                                                   |
| `packages/core/src/components/control-bar/query-value-picker.ts`    | `<protspace-query-value-picker>` — searchable dropdown for annotation values                                                                  |
| `packages/core/src/components/control-bar/query-condition-row.ts`   | `<protspace-query-condition-row>` — single condition row with all controls                                                                    |
| `packages/core/src/components/control-bar/query-builder.ts`         | `<protspace-query-builder>` — main builder managing conditions/groups                                                                         |
| `packages/core/src/components/control-bar/query-builder.styles.ts`  | Styles for all three query builder components                                                                                                 |

### Modified files

| File                                                             | Changes                                                                                                                                                                          |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/components/control-bar/annotation-select.ts`  | Import `ANNOTATION_CATEGORIES`, `TAXONOMY_ORDER`, `CategoryName`, `GroupedAnnotation` from `annotation-categories.ts` instead of defining inline                                 |
| `packages/core/src/components/control-bar/control-bar.ts`        | Replace filter menu template with `<protspace-query-builder>`, replace `applyFilters()` with query-based select+isolate, update filter button for badge, remove old filter state |
| `packages/core/src/components/control-bar/control-bar.styles.ts` | Remove `filterStyles` import, add `queryBuilderStyles` import                                                                                                                    |

### Removed files

| File                                                        | Reason                                |
| ----------------------------------------------------------- | ------------------------------------- |
| `packages/core/src/components/control-bar/styles/filter.ts` | Replaced by `query-builder.styles.ts` |

### Files with old filter helpers to clean up

| File                                                              | What to remove                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/components/control-bar/control-bar-helpers.ts` | Remove `getActiveFilters`, `doesProteinMatchFilters`, `applyFiltersToData`, `createCustomAnnotation`, `areFilterConfigsEqual`, `initializeFilterConfig`, `validateAnnotationValues`, `FilterConfig`, `ActiveFilter` |

---

## Task 1: Extract Annotation Categories to Shared Module

**Files:**

- Create: `packages/core/src/components/control-bar/annotation-categories.ts`
- Modify: `packages/core/src/components/control-bar/annotation-select.ts`
- Modify: `packages/core/src/components/control-bar/annotation-select.test.ts`

- [ ] **Step 1: Create the shared module**

Create `annotation-categories.ts` with the constants and types extracted from `annotation-select.ts`:

```typescript
export const ANNOTATION_CATEGORIES = {
  UniProt: [
    'annotation_score',
    'cc_subcellular_location',
    'ec',
    'fragment',
    'gene_name',
    'go_bp',
    'go_cc',
    'go_mf',
    'keyword',
    'length_fixed',
    'length_quantile',
    'protein_existence',
    'protein_families',
    'reviewed',
    'xref_pdb',
  ],
  InterPro: [
    'cath',
    'cdd',
    'panther',
    'pfam',
    'prints',
    'prosite',
    'signal_peptide',
    'smart',
    'superfamily',
  ],
  Taxonomy: ['root', 'domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'],
} as const;

export const TAXONOMY_ORDER = [
  'root',
  'domain',
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
] as const;

export type CategoryName = 'UniProt' | 'InterPro' | 'Taxonomy' | 'Other';

export interface GroupedAnnotation {
  category: CategoryName;
  annotations: string[];
}
```

- [ ] **Step 2: Update annotation-select.ts imports**

In `annotation-select.ts`, remove the inline `ANNOTATION_CATEGORIES`, `TAXONOMY_ORDER`, `CategoryName`, and `GroupedAnnotation` definitions (lines 9–61). Replace with:

```typescript
import {
  ANNOTATION_CATEGORIES,
  TAXONOMY_ORDER,
  type CategoryName,
  type GroupedAnnotation,
} from './annotation-categories';
```

- [ ] **Step 3: Update annotation-select.test.ts imports**

In `annotation-select.test.ts`, remove the duplicated `ANNOTATION_CATEGORIES`, `TAXONOMY_ORDER`, `CategoryName`, and `GroupedAnnotation` definitions. Replace with:

```typescript
import {
  ANNOTATION_CATEGORIES,
  TAXONOMY_ORDER,
  type CategoryName,
  type GroupedAnnotation,
} from './annotation-categories';
```

- [ ] **Step 4: Verify tests pass**

Run: `cd packages/core && pnpm test -- --run annotation-select`
Expected: All existing tests pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/control-bar/annotation-categories.ts \
       packages/core/src/components/control-bar/annotation-select.ts \
       packages/core/src/components/control-bar/annotation-select.test.ts
git commit -m "refactor(core): extract annotation categories to shared module"
```

---

## Task 2: Create Query Data Model Types

**Files:**

- Create: `packages/core/src/components/control-bar/query-types.ts`

- [ ] **Step 1: Create query-types.ts**

```typescript
export type LogicalOp = 'AND' | 'OR' | 'NOT';
export type ConditionOperator = 'is' | 'is_not' | 'contains' | 'starts_with';

export interface FilterCondition {
  id: string;
  logicalOp?: LogicalOp;
  annotation: string;
  operator: ConditionOperator;
  values: string[];
}

export interface FilterGroup {
  id: string;
  logicalOp?: LogicalOp;
  conditions: FilterQueryItem[];
}

export type FilterQueryItem = FilterCondition | FilterGroup;
export type FilterQuery = FilterQueryItem[];

let nextId = 0;

export function generateId(): string {
  return `q-${Date.now()}-${nextId++}`;
}

export function createCondition(overrides?: Partial<FilterCondition>): FilterCondition {
  return {
    id: generateId(),
    annotation: '',
    operator: 'is',
    values: [],
    ...overrides,
  };
}

export function createGroup(overrides?: Partial<FilterGroup>): FilterGroup {
  return {
    id: generateId(),
    logicalOp: 'AND',
    conditions: [createCondition()],
    ...overrides,
  };
}

export function isFilterGroup(item: FilterQueryItem): item is FilterGroup {
  return 'conditions' in item;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/components/control-bar/query-types.ts
git commit -m "feat(core): add query builder data model types"
```

---

## Task 3: Implement evaluateQuery with Tests (TDD)

**Files:**

- Create: `packages/core/src/components/control-bar/query-evaluate.test.ts`
- Create: `packages/core/src/components/control-bar/query-evaluate.ts`

This task follows strict TDD — write failing tests first, then implement.

- [ ] **Step 1: Write test file with helpers and single-condition tests**

Create `query-evaluate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { ProtspaceData } from './types';
import type { FilterQuery } from './query-types';
import { evaluateQuery, resolveAnnotationValue } from './query-evaluate';

/** Minimal test data: 5 proteins with organism and reviewed annotations */
function createTestData(): ProtspaceData {
  return {
    protein_ids: ['P1', 'P2', 'P3', 'P4', 'P5'],
    annotations: {
      organism: { values: ['Human', 'Mouse', 'Zebrafish'] },
      reviewed: { values: ['true', 'false'] },
      pfam: { values: ['PF00069', 'PF00076', null] },
    },
    annotation_data: {
      // P1=Human, P2=Mouse, P3=Human, P4=Zebrafish, P5=Mouse
      organism: [[0], [1], [0], [2], [1]],
      // P1=true, P2=false, P3=true, P4=true, P5=false
      reviewed: [[0], [1], [0], [0], [1]],
      // P1=PF00069, P2=PF00076, P3=null, P4=PF00069, P5=PF00076
      pfam: [[0], [1], [2], [0], [1]],
    },
  };
}

describe('resolveAnnotationValue', () => {
  it('resolves value from number[][] format', () => {
    const data = createTestData();
    expect(resolveAnnotationValue(0, 'organism', data)).toBe('Human');
    expect(resolveAnnotationValue(1, 'organism', data)).toBe('Mouse');
  });

  it('returns null for missing annotation', () => {
    const data = createTestData();
    expect(resolveAnnotationValue(0, 'nonexistent', data)).toBeNull();
  });

  it('returns null for out-of-range index', () => {
    const data = createTestData();
    expect(resolveAnnotationValue(99, 'organism', data)).toBeNull();
  });

  it('handles number[] format (flat array)', () => {
    const data: ProtspaceData = {
      protein_ids: ['P1', 'P2'],
      annotations: { organism: { values: ['Human', 'Mouse'] } },
      annotation_data: { organism: [0, 1] as unknown as number[][] },
    };
    expect(resolveAnnotationValue(0, 'organism', data)).toBe('Human');
    expect(resolveAnnotationValue(1, 'organism', data)).toBe('Mouse');
  });
});

describe('evaluateQuery', () => {
  describe('empty/trivial queries', () => {
    it('returns all indices for empty query', () => {
      const data = createTestData();
      const result = evaluateQuery([], data);
      expect(result).toEqual(new Set([0, 1, 2, 3, 4]));
    });

    it('returns empty set for missing protein_ids', () => {
      const result = evaluateQuery([], {});
      expect(result).toEqual(new Set());
    });
  });

  describe('single condition - is operator', () => {
    it('matches proteins with selected value', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // P1=Human, P3=Human
      expect(result).toEqual(new Set([0, 2]));
    });

    it('matches multiple values (implicit OR)', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human', 'Mouse'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // P1=Human, P2=Mouse, P3=Human, P5=Mouse
      expect(result).toEqual(new Set([0, 1, 2, 4]));
    });

    it('skips condition with empty values', () => {
      const query: FilterQuery = [{ id: '1', annotation: 'organism', operator: 'is', values: [] }];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 1, 2, 3, 4]));
    });
  });

  describe('single condition - is_not operator', () => {
    it('excludes proteins with selected value', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is_not', values: ['Human'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // P2=Mouse, P4=Zebrafish, P5=Mouse
      expect(result).toEqual(new Set([1, 3, 4]));
    });
  });

  describe('single condition - contains operator', () => {
    it('matches substring case-insensitive', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'contains', values: ['uman'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });

    it('does not match null values', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'pfam', operator: 'contains', values: ['PF'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // P1=PF00069, P2=PF00076, P4=PF00069, P5=PF00076 (P3=null excluded)
      expect(result).toEqual(new Set([0, 1, 3, 4]));
    });
  });

  describe('single condition - starts_with operator', () => {
    it('matches prefix case-insensitive', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'starts_with', values: ['hu'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });
  });

  describe('AND logic', () => {
    it('intersects two conditions', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
        { id: '2', logicalOp: 'AND', annotation: 'reviewed', operator: 'is', values: ['true'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // P1=Human+true, P3=Human+true
      expect(result).toEqual(new Set([0, 2]));
    });
  });

  describe('OR logic', () => {
    it('unions two conditions', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
        { id: '2', logicalOp: 'OR', annotation: 'reviewed', operator: 'is', values: ['false'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // Human: P1,P3 | reviewed=false: P2,P5 → union: P1,P2,P3,P5
      expect(result).toEqual(new Set([0, 1, 2, 4]));
    });
  });

  describe('NOT logic', () => {
    it('negates a single condition', () => {
      const query: FilterQuery = [
        { id: '1', logicalOp: 'NOT', annotation: 'organism', operator: 'is', values: ['Human'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // NOT Human: P2=Mouse, P4=Zebrafish, P5=Mouse
      expect(result).toEqual(new Set([1, 3, 4]));
    });

    it('NOT combined with AND', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human', 'Mouse'] },
        { id: '2', logicalOp: 'NOT', annotation: 'reviewed', operator: 'is', values: ['false'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // (Human|Mouse): {0,1,2,4} AND NOT(reviewed=false): NOT({1,4}) = {0,2,3}
      // intersection: {0,2}
      expect(result).toEqual(new Set([0, 2]));
    });
  });

  describe('groups', () => {
    it('evaluates a group as a unit', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'reviewed', operator: 'is', values: ['true'] },
        {
          id: 'g1',
          logicalOp: 'AND',
          conditions: [
            { id: '2', annotation: 'organism', operator: 'is', values: ['Human'] },
            { id: '3', logicalOp: 'OR', annotation: 'organism', operator: 'is', values: ['Mouse'] },
          ],
        },
      ];
      const result = evaluateQuery(query, createTestData());
      // reviewed=true: {0,2,3} AND (Human OR Mouse): {0,1,2,4} → {0,2}
      expect(result).toEqual(new Set([0, 2]));
    });

    it('negates an entire group with NOT', () => {
      const query: FilterQuery = [
        {
          id: 'g1',
          logicalOp: 'NOT',
          conditions: [
            { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
            { id: '2', logicalOp: 'AND', annotation: 'reviewed', operator: 'is', values: ['true'] },
          ],
        },
      ];
      const result = evaluateQuery(query, createTestData());
      // NOT(Human AND reviewed=true) = NOT({0,2}) = {1,3,4}
      expect(result).toEqual(new Set([1, 3, 4]));
    });
  });

  describe('missing annotation', () => {
    it('treats missing annotation as non-matching', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'nonexistent', operator: 'is', values: ['foo'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set());
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- --run query-evaluate`
Expected: FAIL — `query-evaluate.ts` module not found.

- [ ] **Step 3: Implement evaluateQuery**

Create `query-evaluate.ts`:

```typescript
import type { ProtspaceData } from './types';
import type { FilterQuery, FilterQueryItem, FilterCondition, FilterGroup } from './query-types';
import { isFilterGroup } from './query-types';
import { toInternalValue } from '../legend/config';

/**
 * Resolve the string annotation value for a protein at the given index.
 * Handles both number[] and number[][] formats in annotation_data.
 */
export function resolveAnnotationValue(
  proteinIndex: number,
  annotation: string,
  data: ProtspaceData,
): string | null {
  const idxData = data.annotation_data?.[annotation];
  const valuesArr = data.annotations?.[annotation]?.values;

  if (!idxData || !valuesArr || proteinIndex >= idxData.length) return null;

  const entry = idxData[proteinIndex];
  const idx = Array.isArray(entry) ? (entry as number[])[0] : (entry as unknown as number);

  if (idx == null || idx < 0 || idx >= valuesArr.length) return null;

  return valuesArr[idx] ?? null;
}

/**
 * Normalize a resolved annotation value for consistent comparison.
 * Applies toInternalValue() to convert null/empty to '__NA__'.
 */
function normalizeValue(value: string | null): string {
  return toInternalValue(value);
}

/**
 * Evaluate a single condition against all proteins, returning a Set of matching indices.
 */
function evaluateCondition(
  condition: FilterCondition,
  data: ProtspaceData,
  numProteins: number,
): Set<number> {
  // Empty values → not configured → match all
  if (condition.values.length === 0) {
    return allIndices(numProteins);
  }

  // Missing annotation → match none
  if (!data.annotation_data?.[condition.annotation] || !data.annotations?.[condition.annotation]) {
    return new Set();
  }

  const matches = new Set<number>();

  for (let i = 0; i < numProteins; i++) {
    const resolved = resolveAnnotationValue(i, condition.annotation, data);

    const normalized = normalizeValue(resolved);

    if (matchesOperator(condition.operator, condition.values, resolved, normalized)) {
      matches.add(i);
    }
  }

  return matches;
}

function matchesOperator(
  operator: FilterCondition['operator'],
  values: string[],
  resolved: string | null,
  normalized: string,
): boolean {
  switch (operator) {
    case 'is':
      return values.some((v) => v === normalized);
    case 'is_not':
      return !values.some((v) => v === normalized);
    case 'contains': {
      if (resolved == null) return false;
      const search = (values[0] ?? '').toLowerCase();
      return resolved.toLowerCase().includes(search);
    }
    case 'starts_with': {
      if (resolved == null) return false;
      const prefix = (values[0] ?? '').toLowerCase();
      return resolved.toLowerCase().startsWith(prefix);
    }
  }
}

/**
 * Evaluate a FilterQuery (array of conditions/groups) and return the Set of matching protein indices.
 */
export function evaluateQuery(query: FilterQuery, data: ProtspaceData): Set<number> {
  const numProteins = data.protein_ids?.length ?? 0;
  if (numProteins === 0) return new Set();
  if (query.length === 0) return allIndices(numProteins);

  return evaluateItems(query, data, numProteins);
}

function evaluateItems(
  items: FilterQueryItem[],
  data: ProtspaceData,
  numProteins: number,
): Set<number> {
  let accumulated: Set<number> | null = null;

  for (const item of items) {
    let itemResult: Set<number>;

    if (isFilterGroup(item)) {
      itemResult = evaluateItems((item as FilterGroup).conditions, data, numProteins);
    } else {
      itemResult = evaluateCondition(item as FilterCondition, data, numProteins);
    }

    const op = item.logicalOp;

    // NOT is unary: negate the result, then AND with accumulated
    if (op === 'NOT') {
      itemResult = complement(itemResult, numProteins);
    }

    if (accumulated === null) {
      accumulated = itemResult;
    } else if (op === 'OR') {
      accumulated = union(accumulated, itemResult);
    } else {
      // AND, NOT (after complement), or first item
      accumulated = intersection(accumulated, itemResult);
    }
  }

  return accumulated ?? new Set();
}

function allIndices(n: number): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < n; i++) s.add(i);
  return s;
}

function union(a: Set<number>, b: Set<number>): Set<number> {
  const result = new Set(a);
  for (const v of b) result.add(v);
  return result;
}

function intersection(a: Set<number>, b: Set<number>): Set<number> {
  const result = new Set<number>();
  for (const v of a) {
    if (b.has(v)) result.add(v);
  }
  return result;
}

function complement(s: Set<number>, n: number): Set<number> {
  const result = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (!s.has(i)) result.add(i);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- --run query-evaluate`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `cd packages/core && pnpm test -- --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/control-bar/query-evaluate.ts \
       packages/core/src/components/control-bar/query-evaluate.test.ts
git commit -m "feat(core): add evaluateQuery with full test coverage"
```

---

## Task 4: Create Query Builder Styles

**Files:**

- Create: `packages/core/src/components/control-bar/query-builder.styles.ts`

- [ ] **Step 1: Create the styles file**

Create `query-builder.styles.ts` with styles for the query builder popover, condition rows, value picker, and groups. Reference the existing design tokens (`var(--spacing-*)`, `var(--text-*)`, `var(--primary)`, etc.) from `packages/core/src/styles/tokens.ts` and mixin patterns from `packages/core/src/styles/mixins.ts`.

Key CSS classes to define:

- `.query-builder` — popover container (min-width: 480px, max-width: 620px)
- `.query-header` — flex row with title and match count
- `.query-conditions` — scrollable list of condition rows
- `.condition-row` — flex row with gap, rounded background
- `.condition-row .logical-op` — styled select for AND/OR/NOT (green for AND/OR, red for NOT)
- `.condition-row .annotation-select`, `.operator-select` — styled dropdowns
- `.value-chips` — flex-wrap container for value chips
- `.value-chip` — small pill with text and "x" button
- `.value-chip-add` — dashed border "+" button
- `.text-input` — input field for contains/starts_with
- `.condition-remove` — "x" button to remove row
- `.group-container` — indented block with 3px left border
- `.group-header` — group label with operator select and remove
- `.query-actions` — flex row for "+ Add condition" / "+ Add group"
- `.query-footer` — flex row with Reset All and Apply & Isolate
- `.match-count` — right-aligned text showing "N of M matched"
- `.filter-badge` — small circular badge on the filter button
- `.value-picker` — absolute positioned searchable dropdown
- `.value-picker-input` — search input
- `.value-picker-list` — scrollable results list
- `.value-picker-item` — single value row with protein count
- `.value-picker-highlight` — highlighted match portion

Style the logical operator select to have green background (`var(--primary)` tints) for AND/OR and red background for NOT, consistent with the design mockups.

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/components/control-bar/query-builder.styles.ts
git commit -m "feat(core): add query builder styles"
```

---

## Task 5: Create Query Value Picker Component

**Files:**

- Create: `packages/core/src/components/control-bar/query-value-picker.ts`

- [ ] **Step 1: Create the component**

Create `<protspace-query-value-picker>` — a Lit component that renders a searchable dropdown for selecting annotation values.

**Properties (inputs):**

- `annotation: string` — which annotation's values to show
- `data: ProtspaceData` — full dataset (to count proteins per value)
- `selectedValues: string[]` — already-selected values (to hide from list)
- `open: boolean` — whether the picker is visible

**Events (outputs):**

- `value-selected` — dispatched when user clicks a value, detail: `{ value: string }`
- `picker-close` — dispatched when user presses Escape or clicks outside

**Behavior:**

1. On open, auto-focus the search input
2. List all values from `data.annotations[annotation].values` after applying `toInternalValue()` normalization (this converts `null` to `'__NA__'` which displays as "N/A"). Exclude `selectedValues` from the list.
3. Filter by substring match on the search query (case-insensitive)
4. Highlight the matched portion in each result using `<mark>` or `<strong>`
5. For each value, count how many proteins have it: iterate `data.annotation_data[annotation]` and count occurrences of each index, then map index→value
6. Render each result as: `[value text with highlight] [protein count]`
7. On click, dispatch `value-selected` event (do NOT close — dropdown stays open for multi-add)
8. Handle Escape key → dispatch `picker-close`
9. Handle click outside → dispatch `picker-close`
10. Show footer: "N of M values shown"

Use `query-builder.styles.ts` for styling (`.value-picker`, `.value-picker-input`, etc.).

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/components/control-bar/query-value-picker.ts
git commit -m "feat(core): add query-value-picker component"
```

---

## Task 6: Create Query Condition Row Component

**Files:**

- Create: `packages/core/src/components/control-bar/query-condition-row.ts`

- [ ] **Step 1: Create the component**

Create `<protspace-query-condition-row>` — a Lit component rendering a single condition row.

**Properties (inputs):**

- `condition: FilterCondition` — the condition data
- `annotations: string[]` — available annotation names
- `data: ProtspaceData` — for the value picker
- `showLogicalOp: boolean` — false for first row in a query or group

**Events (outputs):**

- `condition-changed` — dispatched on any change, detail: `{ condition: FilterCondition }`
- `condition-removed` — dispatched when "x" is clicked, detail: `{ id: string }`

**Template structure:**

```
[logical-op select (if showLogicalOp)] [annotation dropdown] [operator select] [values area] [remove x]
```

**Annotation dropdown:**

- Uses `ANNOTATION_CATEGORIES` from `annotation-categories.ts` to group annotations
- Searchable with input at top
- Renders grouped sections (UniProt, InterPro, Taxonomy, Other)
- On select, updates `condition.annotation` and clears `condition.values`
- Dispatches `condition-changed`

**Operator select:**

- `<select>` with options: "is", "is not", "contains", "starts with"
- On change, updates `condition.operator` and clears `condition.values` (since value format changes)
- Dispatches `condition-changed`

**Values area (depends on operator):**

- For `is` / `is_not`: render value chips + "+" button. Clicking "+" opens `<protspace-query-value-picker>`. On `value-selected`, add chip. On chip "x", remove value.
- For `contains` / `starts_with`: render `<input>` text field. On input, update `condition.values[0]`.

**Logical operator select:**

- `<select>` with AND / OR / NOT
- Styled: green background for AND/OR, red for NOT
- On change, update `condition.logicalOp` and dispatch `condition-changed`

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/components/control-bar/query-condition-row.ts
git commit -m "feat(core): add query-condition-row component"
```

---

## Task 7: Create Query Builder Component

**Files:**

- Create: `packages/core/src/components/control-bar/query-builder.ts`

- [ ] **Step 1: Create the component**

Create `<protspace-query-builder>` — the main Lit component managing the full query.

**Properties (inputs):**

- `annotations: string[]` — available annotations for conditions
- `data: ProtspaceData` — passed through to condition rows and value pickers
- `query: FilterQuery` — the current query state (managed externally by control-bar)

**Events (outputs):**

- `query-changed` — dispatched whenever the query changes, detail: `{ query: FilterQuery }`
- `query-apply` — dispatched when "Apply & Isolate" is clicked, detail: `{ matchedIndices: Set<number> }`
- `query-reset` — dispatched when "Reset All" is clicked

**Internal state:**

- `_matchCount: number` — debounced match count
- `_totalCount: number` — total protein count
- `_evaluating: boolean` — loading indicator flag

**Template structure:**

```html
<div class="query-builder">
  <!-- Header -->
  <div class="query-header">
    <span>Filter Query</span>
    <span class="match-count">{_matchCount} of {_totalCount} proteins matched</span>
  </div>

  <!-- Conditions list -->
  <div class="query-conditions">
    ${repeat(query, item => item.id, (item, index) => {
      if (isFilterGroup(item)) return renderGroup(item, index);
      return html`<protspace-query-condition-row
        .condition=${item}
        .annotations=${annotations}
        .data=${data}
        .showLogicalOp=${index > 0}
        @condition-changed=${handleConditionChanged}
        @condition-removed=${handleConditionRemoved}
      />`;
    })}
  </div>

  <!-- Add buttons -->
  <div class="query-actions">
    <button @click=${addCondition}>+ Add condition</button>
    <button @click=${addGroup}>+ Add group</button>
  </div>

  <!-- Footer -->
  <div class="query-footer">
    <button class="reset-btn" @click=${handleReset}>Reset All</button>
    <button class="apply-btn" ?disabled=${disableApply} @click=${handleApply}>
      Apply & Isolate
    </button>
  </div>
</div>
```

**Group rendering:**
Each group renders as an indented block with:

- Group header: logical-op select + "Group" label + "x" remove button
- Nested `<protspace-query-condition-row>` elements for each condition in the group
- "+ Add condition" button inside the group

**Match count (debounced):**

- On any query change, debounce 300ms, then call `evaluateQuery(query, data)`
- Update `_matchCount` with result size
- If evaluation takes >50ms, set `_evaluating = true` to show loading state

**Disable logic:**

- "Apply & Isolate" disabled when `_matchCount === 0` or `_matchCount === _totalCount` (empty query)
- Actually per spec: disabled when matchCount is 0 or query is empty. When all match, it's allowed (no-op).

**Query mutation helpers:**

- `addCondition()`: push new `createCondition()` to query, dispatch `query-changed`
- `addGroup()`: push new `createGroup()` with default AND and one empty condition
- `handleConditionChanged(e)`: find item by ID, replace, dispatch `query-changed`
- `handleConditionRemoved(e)`: filter out by ID, dispatch `query-changed`
- `handleReset()`: dispatch `query-reset`
- `handleApply()`: run `evaluateQuery`, dispatch `query-apply` with result

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/components/control-bar/query-builder.ts
git commit -m "feat(core): add query-builder component"
```

---

## Task 8: Integrate into Control Bar

**Files:**

- Modify: `packages/core/src/components/control-bar/control-bar.ts`
- Modify: `packages/core/src/components/control-bar/control-bar.styles.ts`

- [ ] **Step 1: Add new imports and state to control-bar.ts**

Add imports:

```typescript
import './query-builder';
import type { FilterQuery } from './query-types';
```

Add new state properties:

```typescript
@state() private filterQuery: FilterQuery = [];
@state() private filterActive = false;
@state() private _currentData: ProtspaceData | undefined;
```

Update the existing `_handleDataChange` listener (or wherever data is received) to also set `this._currentData`:

```typescript
this._currentData = sp.getCurrentData?.();
```

Remove old filter state properties:

- `filterConfig`
- `lastAppliedFilterConfig`
- `openValueMenus`
- `filterHighlightIndex`
- `annotationValuesMap` (if only used by filter — check usage first)

- [ ] **Step 2: Replace filter menu template**

Find the filter button + menu template section (around lines 830–1011 in `control-bar.ts`). Replace with:

Filter button: add badge when `filterActive` is true and `filterQuery.length > 0`:

```html
<button
  class="dropdown-trigger ${this.showFilterMenu ? 'open' : ''} ${this.filterActive ? 'filter-active' : ''}"
  @click="${this.toggleFilterMenu}"
  title="Filter Options"
>
  <svg class="icon" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 5h18M6 12h12M10 19h4" />
  </svg>
  Filter ${this.filterActive ? html`<span class="filter-badge">${this.filterQuery.length}</span>` :
  html`<svg class="chevron-down" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
  >`}
</button>
```

Filter menu: replace checkbox UI with query builder:

```html
${this.showFilterMenu ? html`
<protspace-query-builder
  class="filter-menu"
  .annotations="${this.annotations}"
  .data="${this._currentData}"
  .query="${this.filterQuery}"
  @query-changed="${this.handleQueryChanged}"
  @query-apply="${this.handleQueryApply}"
  @query-reset="${this.handleQueryReset}"
></protspace-query-builder>
` : ''}
```

- [ ] **Step 3: Add event handlers**

```typescript
private handleQueryChanged(e: CustomEvent<{ query: FilterQuery }>) {
  this.filterQuery = e.detail.query;
}

private handleQueryApply(e: CustomEvent<{ matchedIndices: Set<number> }>) {
  if (!this._scatterplotElement) return;
  const sp = this._scatterplotElement as ScatterplotElementLike;
  const data = sp.getCurrentData?.();
  if (!data?.protein_ids) return;

  // Convert indices to protein IDs
  const matchedIds = Array.from(e.detail.matchedIndices).map((i) => data.protein_ids![i]);

  // Set selection and isolate (dispatch event for downstream listeners)
  sp.selectedProteinIds = matchedIds;
  this.dispatchEvent(new CustomEvent('isolate-data', { detail: {}, bubbles: true, composed: true }));
  sp.isolateSelection?.();

  this.filterActive = true;
  this.showFilterMenu = false;
}

private handleQueryReset() {
  if (!this._scatterplotElement) return;
  const sp = this._scatterplotElement as ScatterplotElementLike;
  this.dispatchEvent(new CustomEvent('reset-isolation', { detail: {}, bubbles: true, composed: true }));
  sp.resetIsolation?.();

  this.filterQuery = [];
  this.filterActive = false;
  this.isolationMode = false;
  this.isolationHistory = [];
  // Do NOT close popover — user may want to start a new query
}
```

- [ ] **Step 4: Remove old filter methods**

Remove these methods from `control-bar.ts`:

- `handleFilterToggle()`
- `handleValueToggle()`
- `selectAllValues()`
- `clearAllValues()`
- `toggleValueMenu()`
- `applyFilters()`

Keep `toggleFilterMenu()` — it still opens/closes the popover.

- [ ] **Step 5: Update control-bar.styles.ts**

In `control-bar.styles.ts`, replace the `filterStyles` import with `queryBuilderStyles`:

```typescript
// Remove:
import { filterStyles } from './styles/filter';
// Add:
import { queryBuilderStyles } from './query-builder.styles';
```

Update the composed styles array to use `queryBuilderStyles` instead of `filterStyles`.

Add `.filter-active` and `.filter-badge` styles to the layout styles or the query builder styles:

```css
.dropdown-trigger.filter-active {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-light);
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--primary);
  color: white;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-left: var(--spacing-xs);
}
```

- [ ] **Step 6: Run type-check and tests**

Run: `pnpm type-check && pnpm test:ci`
Expected: All pass. Fix any type errors from removed state/methods.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/components/control-bar/control-bar.ts \
       packages/core/src/components/control-bar/control-bar.styles.ts
git commit -m "feat(core): integrate query builder into control bar"
```

---

## Task 9: Remove Old Filter Code

**Files:**

- Delete: `packages/core/src/components/control-bar/styles/filter.ts`
- Modify: `packages/core/src/components/control-bar/control-bar-helpers.ts`

- [ ] **Step 1: Remove styles/filter.ts**

Delete the file `packages/core/src/components/control-bar/styles/filter.ts`.

- [ ] **Step 2: Clean up control-bar-helpers.ts**

Remove the following exports that are no longer used (the old filter logic):

- `FilterConfig` interface
- `ActiveFilter` interface
- `getActiveFilters()`
- `doesProteinMatchFilters()`
- `applyFiltersToData()`
- `createCustomAnnotation()`
- `areFilterConfigsEqual()`
- `initializeFilterConfig()`
- `validateAnnotationValues()`

Keep all non-filter helpers: `createDefaultExportOptions`, `calculateHeightFromWidth`, `calculateWidthFromHeight`, `isProjection3D`, `getProjectionPlane`, `shouldDisableSelection`, `getSelectionDisabledMessage`, `toggleProteinSelection`, `mergeProteinSelections`.

- [ ] **Step 3: Remove stale imports in control-bar.ts**

Remove any imports of the deleted helpers (`getActiveFilters`, `doesProteinMatchFilters`, etc.) from `control-bar.ts` if they were still referenced.

- [ ] **Step 4: Run full quality checks**

Run: `pnpm precommit`
Expected: format, lint, type-check, and tests all pass.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor(core): remove old checkbox filter code"
```

---

## Task 10: Manual Smoke Test

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev:app`

- [ ] **Step 2: Verify basic flow**

1. Load a dataset with annotations (use one of the example datasets)
2. Click the Filter button → query builder popover should appear
3. Click "+ Add condition" → a new empty row should appear
4. Select an annotation from the grouped dropdown → values area should update
5. Select "is" operator, click "+" to add values → searchable value picker should appear
6. Search for a value, click to add → chip should appear, picker stays open
7. Add a second condition with AND → match count should update
8. Click "Apply & Isolate" → non-matching proteins should disappear
9. Filter button should show active badge with count
10. Reopen filter → existing query should be editable
11. Click "Reset All" → full dataset should be restored

- [ ] **Step 3: Test edge cases**

1. Try "contains" and "starts with" operators with text input
2. Try NOT operator
3. Try adding a group with OR conditions
4. Try removing conditions and groups
5. Verify empty query shows all proteins in match count
6. Verify no-match query disables "Apply & Isolate"
