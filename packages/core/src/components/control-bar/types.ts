/**
 * Control bar-related type definitions
 */

export interface ControlBarState {
  projections: string[];
  features: string[];
  selectedProjection: string;
  selectedFeature: string;
  selectionMode: boolean;
  selectedProteinsCount: number;
}

export interface ProtspaceData {
  projections?: Array<{ name: string; metadata?: { dimension?: 2 | 3 } }>;
  features?: Record<string, unknown>;
  protein_ids?: string[];
}

export interface DataChangeDetail {
  data: ProtspaceData;
}

export interface ScatterplotElementLike extends Element {
  // State properties
  selectedProjectionIndex?: number;
  selectedFeature?: string;
  selectionMode?: boolean;
  selectedProteinIds?: unknown[];

  // Data access
  getCurrentData?: () => ProtspaceData | undefined;

  // Split functionality
  isSplitMode?: () => boolean;
  getSplitHistory?: () => string[][];
  splitDataBySelection?: () => void;
  resetSplit?: () => void;

  // Event emitting is through DOM, so we rely on add/removeEventListener from Element
}
