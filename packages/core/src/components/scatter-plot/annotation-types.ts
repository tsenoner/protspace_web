// packages/core/src/components/scatter-plot/annotation-types.ts

export interface Indicator {
  id: string;
  proteinId: string;
  label: string;
  dataCoords: [number, number];
  offsetPx: [number, number];
}

export interface Inset {
  id: string;
  sourceTransform: { x: number; y: number; scale: number };
  capturedCanvas: HTMLCanvasElement | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  shape: 'rectangle' | 'circle';
  label: string;
  zoomFactor: number;
}

export type InsetStep = 'idle' | 'framing' | 'snapped' | 'positioning';

export interface AnnotationSnapshot {
  indicators: Indicator[];
  insets: Omit<Inset, 'capturedCanvas'>[];
}

export interface ContextMenuAction {
  type: 'indicate' | 'select' | 'copy-id' | 'view-uniprot' | 'add-inset';
  proteinId?: string;
  dataCoords?: [number, number];
}
