import type { ExportableData } from '../export-utils';
import { LEGEND_VALUES, toDisplayValue } from '../shapes';
import type {
  LegendExportSnapshot,
  PublicationLegendModel,
  PublicationLegendRow,
} from './legend-model';

function proteinIndicesFromIds(data: ExportableData, ids: readonly string[]): Set<number> {
  const set = new Set<number>();
  const m = new Map<string, number>();
  for (let i = 0; i < data.protein_ids.length; i += 1) {
    m.set(data.protein_ids[i], i);
  }
  for (const id of ids) {
    const idx = m.get(id);
    if (idx !== undefined) set.add(idx);
  }
  return set;
}

function countsByValueKey(
  data: ExportableData,
  annotation: string,
  allowedProteinIndices: Set<number> | null,
): Map<string, number> {
  const annotationInfo = data.annotations[annotation];
  const indices = data.annotation_data[annotation];
  const counts = new Map<string, number>();
  if (!annotationInfo || !indices || !Array.isArray(annotationInfo.values)) {
    return counts;
  }

  for (let i = 0; i < indices.length; i += 1) {
    if (allowedProteinIndices && !allowedProteinIndices.has(i)) continue;
    const viArray = indices[i];
    if (!Array.isArray(viArray)) continue;
    for (const vi of viArray) {
      if (typeof vi !== 'number' || vi < 0 || vi >= annotationInfo.values.length) continue;
      const raw = annotationInfo.values[vi];
      const key = raw === null ? LEGEND_VALUES.NA_VALUE : String(raw);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function buildPublicationLegendModel(input: {
  legendExport: LegendExportSnapshot;
  data: ExportableData | null;
  annotationKey: string;
  selectedProteinIds: readonly string[];
  hiddenAnnotationValues: readonly string[];
}): PublicationLegendModel {
  const hiddenSet = new Set(input.hiddenAnnotationValues);
  const ordered = [...input.legendExport.items]
    .filter((it) => it.isVisible && !hiddenSet.has(it.value))
    .sort((a, b) => a.zOrder - b.zOrder);

  const selectionActive = input.selectedProteinIds.length > 0;
  let countMap: Map<string, number> | null = null;
  if (selectionActive && input.data) {
    const allowed = proteinIndicesFromIds(input.data, input.selectedProteinIds);
    countMap = countsByValueKey(input.data, input.annotationKey, allowed);
  }

  const items: PublicationLegendRow[] = ordered.map((it) => ({
    value: it.value,
    displayLabel: toDisplayValue(
      it.value,
      it.value === LEGEND_VALUES.OTHER ? input.legendExport.otherItemsCount : undefined,
    ),
    color: it.color,
    shape: it.shape,
    count: countMap !== null ? (countMap.get(it.value) ?? 0) : it.count,
    isVisible: it.isVisible,
    zOrder: it.zOrder,
  }));

  return {
    annotationTitle: input.legendExport.annotation,
    includeShapes: input.legendExport.includeShapes,
    otherItemsCount: input.legendExport.otherItemsCount,
    items,
  };
}
