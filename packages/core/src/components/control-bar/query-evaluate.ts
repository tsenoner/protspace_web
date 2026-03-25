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
  if (condition.values.length === 0) {
    return allIndices(numProteins);
  }

  if (
    !data.annotation_data?.[condition.annotation] ||
    !data.annotations?.[condition.annotation]
  ) {
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

/**
 * `is`/`is_not` compare against the normalized value (toInternalValue), so the
 * value picker can expose __NA__ for null annotations.
 * `contains`/`starts_with` compare against the raw resolved string for
 * human-readable substring matching; null values are non-matching.
 */
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
 * Evaluate a FilterQuery and return the Set of matching protein indices.
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

    if (op === 'NOT') {
      itemResult = complement(itemResult, numProteins);
    }

    if (accumulated === null) {
      accumulated = itemResult;
    } else if (op === 'OR') {
      accumulated = union(accumulated, itemResult);
    } else {
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
