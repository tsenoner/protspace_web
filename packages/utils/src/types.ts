export interface Feature {
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
  features: Record<string, Feature>;
  feature_data: Record<string, number[][]>;
}

export interface PlotDataPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  featureValues: Record<string, string[]>;
  originalIndex: number;
}

export interface StyleForFeature {
  color: string;
  shape: string;
}

export interface ScatterplotConfig {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  pointSize?: number;
  highlightedPointSize?: number;
  selectedPointSize?: number;
  zoomExtent?: [number, number];
  baseOpacity?: number;
  selectedOpacity?: number;
  fadedOpacity?: number;

  // Performance options
  transitionDuration?: number;
  largeDatasetThreshold?: number;
  fastRenderingThreshold?: number;
  enableTransitions?: boolean;
  useSimpleShapes?: boolean;
  maxPointsForComplexShapes?: number;
  zoomSizeScaleExponent?: number;
}

export type PointShape =
  | 'asterisk'
  | 'circle'
  | 'cross'
  | 'diamond'
  | 'plus'
  | 'square'
  | 'star'
  | 'triangle'
  | 'wye'
  | 'times';
