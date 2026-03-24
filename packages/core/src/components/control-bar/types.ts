/**
 * Control bar-related type definitions
 */

import type { NumericAnnotationDisplaySettingsMap } from '@protspace/utils';

export interface ProtspaceData {
  projections?: Array<{ name: string; metadata?: { dimension?: 2 | 3 } }>;
  annotations?: Record<
    string,
    {
      kind?: 'categorical' | 'numeric';
      sourceKind?: 'categorical' | 'numeric';
      values: (string | null)[];
      colors?: string[];
      shapes?: string[];
      numericMetadata?: {
        strategy: 'linear' | 'quantile' | 'logarithmic';
        binCount: number;
        signature: string;
        topologySignature: string;
        logSupported: boolean;
        bins: Array<{
          id: string;
          label: string;
          lowerBound: number;
          upperBound: number;
          count: number;
        }>;
      };
    }
  >;
  annotation_data?: Record<string, number[] | number[][]>;
  numeric_annotation_data?: Record<string, (number | null)[]>;
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
  filteredProteinIds?: string[];
  filtersActive?: boolean;
  numericAnnotationSettings?: NumericAnnotationDisplaySettingsMap;

  runWebGLRenderPerfMeasurements?: (
    iterations?: number,
    options?: { download?: boolean; dataset?: { id: string; url?: string; proteinCount?: number } },
  ) => Promise<unknown>;

  // Data access
  getCurrentData?: (options?: { includeFilteredProteinIds?: boolean }) => ProtspaceData | undefined;
  getMaterializedData?: () => ProtspaceData | undefined;

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
