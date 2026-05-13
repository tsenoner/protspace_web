/**
 * Per-projection coord key — two points belong to the same duplicate-badge
 * stack iff this key matches. Identical embeddings that produce identical
 * coords in PCA but distinct coords in UMAP/t-SNE will share a stack only
 * in the projection where they actually collapse, which is the intended
 * behavior: a duplicate badge represents physical co-location in the
 * current view, not embedding identity.
 */
export function getDuplicateStackKey(p: { x: number; y: number }): string {
  return `${p.x}|${p.y}`;
}
