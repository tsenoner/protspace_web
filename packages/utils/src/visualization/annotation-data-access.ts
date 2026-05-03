import type { AnnotationData } from '../types.js';

/**
 * Returns the list of category indices for a given protein.
 * - For Int32Array storage: a fresh single-element array (or `[]` if missing).
 * - For (readonly number[])[] storage: the inner array (do not mutate).
 *
 * Hot paths needing just the first index should use `getFirstAnnotationIndex`
 * to avoid the wrapper allocation.
 */
export function getProteinAnnotationIndices(
  data: AnnotationData,
  proteinIdx: number,
): readonly number[] {
  if (data instanceof Int32Array) {
    if (proteinIdx < 0 || proteinIdx >= data.length) return [];
    const value = data[proteinIdx];
    return value < 0 ? [] : [value];
  }
  if (proteinIdx < 0 || proteinIdx >= data.length) return [];
  return data[proteinIdx];
}

export function getProteinAnnotationCount(data: AnnotationData, proteinIdx: number): number {
  if (data instanceof Int32Array) {
    if (proteinIdx < 0 || proteinIdx >= data.length) return 0;
    return data[proteinIdx] < 0 ? 0 : 1;
  }
  if (proteinIdx < 0 || proteinIdx >= data.length) return 0;
  return data[proteinIdx].length;
}

/**
 * Returns the first category index for a protein, or -1 if missing/none.
 * Allocation-free: prefer this on hot paths (per-point coloring, sorting).
 */
export function getFirstAnnotationIndex(data: AnnotationData, proteinIdx: number): number {
  if (data instanceof Int32Array) {
    if (proteinIdx < 0 || proteinIdx >= data.length) return -1;
    return data[proteinIdx];
  }
  if (proteinIdx < 0 || proteinIdx >= data.length) return -1;
  const list = data[proteinIdx];
  return list.length === 0 ? -1 : list[0];
}

/**
 * Slice an AnnotationData by the given array of original indices (e.g. keptIndices).
 * Returns the same storage shape as the input.
 */
export function sliceAnnotationData(data: AnnotationData, indices: number[]): AnnotationData {
  if (data instanceof Int32Array) {
    const out = new Int32Array(indices.length);
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      out[i] = idx >= 0 && idx < data.length ? data[idx] : -1;
    }
    return out;
  }
  return indices.map((idx) => (idx >= 0 && idx < data.length ? data[idx] : []));
}
