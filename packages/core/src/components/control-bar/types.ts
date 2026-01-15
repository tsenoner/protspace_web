/**
 * Control bar-related type definitions
 */

export interface ControlBarState {
  projections: string[];
  annotations: string[];
  selectedProjection: string;
  selectedAnnotation: string;
  selectionMode: boolean;
  selectedProteinsCount: number;
}

export interface ProtspaceData {
  projections?: Array<{ name: string; metadata?: { dimension?: 2 | 3 } }>;
  annotations?: Record<string, { values: (string | null)[]; colors?: string[]; shapes?: string[] }>;
  annotation_data?: Record<string, number[] | number[][]>;
  protein_ids?: string[];
}

export interface DataChangeDetail {
  data: ProtspaceData;
}

export interface ScatterplotElementLike extends Element {
  // State properties
  selectedProjectionIndex?: number;
  selectedAnnotation?: string;
  selectionMode?: boolean;
  selectedProteinIds?: string[];
  projectionPlane?: 'xy' | 'xz' | 'yz';
  data?: ProtspaceData;

  // Data access
  getCurrentData?: () => ProtspaceData | undefined;

  // Isolation functionality
  isIsolationMode?: () => boolean;
  getIsolationHistory?: () => string[][];
  isolateSelection?: () => void;
  resetIsolation?: () => void;

  // Event emitting is through DOM, so we rely on add/removeEventListener from Element
  click?: () => void;
}

export interface DataLoaderElement extends Element {
  requestLoad?: () => void;
}

export interface StructureViewerElement extends Element {
  loadStructure?: (proteinId: string, structureUrl: string | null) => void;
  loadProtein?: (proteinId: string) => void;
}
