export interface Annotation {
  values: (string | null)[];
  colors: string[];
  shapes: string[];
}

export interface Projection {
  name: string;
  metadata?: Record<string, unknown> & { dimension?: 2 | 3 };
  // Each point is either [x, y] or [x, y, z]
  data: Array<[number, number] | [number, number, number]>;
}

export interface VisualizationData {
  protein_ids: string[];
  projections: Projection[];
  annotations: Record<string, Annotation>;
  annotation_data: Record<string, number[][]>;
  annotation_scores?: Record<string, (number | null)[][]>;
}

export interface PlotDataPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  annotationValues: Record<string, string[]>;
  annotationScores?: Record<string, (number | null)[]>;
  originalIndex: number;
}

export interface StyleForAnnotation {
  color: string;
  shape: string;
}

export interface ScatterplotConfig {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  pointSize?: number;
  zoomExtent?: [number, number];
  baseOpacity?: number;
  selectedOpacity?: number;
  fadedOpacity?: number;
  /**
   * Enable duplicate-stack UI for points that share the exact same coordinates.
   * When enabled, the scatterplot will compute duplicate stacks and render an SVG overlay:
   * - numeric count badges
   * - spiderfy expansion on click
   *
   * Default: false (kept off to avoid O(n) duplicate stack computation on large datasets).
   */
  enableDuplicateStackUI?: boolean;
}

export type PointShape = 'circle' | 'square' | 'diamond' | 'triangle-up' | 'triangle-down' | 'plus';

// ─────────────────────────────────────────────────────────────────
// Legend Persistence Types
// ─────────────────────────────────────────────────────────────────

export type LegendSortMode =
  | 'size-asc'
  | 'size-desc'
  | 'alpha-asc'
  | 'alpha-desc'
  | 'manual'
  | 'manual-reverse';

export interface PersistedCategoryData {
  zOrder: number;
  color: string;
  shape: string;
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
}

/**
 * Bundle settings map: annotation name -> legend settings for that annotation.
 */
export type BundleSettings = Record<string, LegendPersistedSettings>;
