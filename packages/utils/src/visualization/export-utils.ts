import { LEGEND_VALUES } from './shapes';

export interface ExportableData {
  protein_ids: string[];
  annotations: Record<
    string,
    {
      values: (string | null)[];
      colors: string[];
      shapes: string[];
    }
  >;
  annotation_data: Record<string, number[][]>;
  projections?: Array<{ name: string }>;
}

export interface ExportableElement extends Element {
  getCurrentData(): ExportableData | null;
  selectedAnnotation: string;
  selectedProjectionIndex: number;
  selectedProteinIds?: string[];
  hiddenAnnotationValues?: string[];
}

export interface ExportOptions {
  exportName?: string;
}

export function generateProtspaceExportBasename(
  element: Pick<
    ExportableElement,
    'getCurrentData' | 'selectedAnnotation' | 'selectedProjectionIndex'
  >,
): string {
  const data = element.getCurrentData();
  const date = new Date().toISOString().split('T')[0];
  const projection = data?.projections?.[element.selectedProjectionIndex]?.name || 'unknown';
  const annotation = element.selectedAnnotation || 'unknown';
  let cleanProjection = projection.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const cleanAnnotation = annotation.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  cleanProjection = cleanProjection.replace(/_[23]$/, '');
  return `protspace_${cleanProjection}_${cleanAnnotation}_${date}`;
}

export function exportProteinIdsFromElement(element: ExportableElement): void {
  const data = element.getCurrentData();
  if (!data) {
    console.error('No data available for export');
    return;
  }

  const selectedAnnotation = element.selectedAnnotation;
  const annotationIndices = data.annotation_data?.[selectedAnnotation];
  const annotationInfo = data.annotations?.[selectedAnnotation];
  const hiddenValues: string[] = Array.isArray(element.hiddenAnnotationValues)
    ? element.hiddenAnnotationValues
    : [];

  let visibleIds: string[] = [];
  if (annotationIndices && annotationInfo && Array.isArray(annotationInfo.values)) {
    const hiddenSet = new Set(hiddenValues);
    visibleIds = data.protein_ids.filter((_id, i) => {
      const viArray = annotationIndices[i];
      if (!Array.isArray(viArray) || viArray.length === 0) {
        return !hiddenSet.has(LEGEND_VALUES.NA_VALUE);
      }
      return viArray.some((vi) => {
        const value: string | null =
          typeof vi === 'number' && vi >= 0 && vi < annotationInfo.values.length
            ? (annotationInfo.values[vi] ?? null)
            : null;
        const key = value === null ? LEGEND_VALUES.NA_VALUE : String(value);
        return !hiddenSet.has(key);
      });
    });
  } else {
    visibleIds = data.protein_ids || [];
  }

  const idsStr = visibleIds.join('\n');
  const idsUri = `data:text/plain;charset=utf-8,${encodeURIComponent(idsStr)}`;
  const fileName = 'protein_ids.txt';

  const link = document.createElement('a');
  link.href = idsUri;
  link.download = fileName;
  link.click();
}

export class ProtSpaceExporter {
  private element: ExportableElement;

  constructor(element: ExportableElement, _selectedProteins: string[] = []) {
    this.element = element;
  }

  exportProteinIds(_options: ExportOptions = {}): void {
    exportProteinIdsFromElement(this.element);
  }
}

export function createExporter(
  element: ExportableElement,
  selectedProteins: string[] = [],
): ProtSpaceExporter {
  return new ProtSpaceExporter(element, selectedProteins);
}

export const exportUtils = {
  exportProteinIds: (
    element: ExportableElement,
    _selectedProteins?: string[],
    _options?: ExportOptions,
  ) => {
    exportProteinIdsFromElement(element);
  },
};
