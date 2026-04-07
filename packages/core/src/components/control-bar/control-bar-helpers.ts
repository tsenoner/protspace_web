import type { PersistedExportOptions, PublicationFigureLayoutId } from '@protspace/utils';
import type { ProtspaceData } from './types';

export const EXPORT_DEFAULTS = {
  FORMAT: 'png' as const,
  LAYOUT_ID: 'two_column_below' as PublicationFigureLayoutId,
  LEGACY_IMAGE_WIDTH: 2048,
  LEGACY_IMAGE_HEIGHT: 1024,
  LEGACY_LEGEND_WIDTH_PERCENT: 25,
  LEGACY_LEGEND_FONT_SIZE_PX: 24,
};

export function createDefaultExportOptions(): PersistedExportOptions {
  return {
    imageWidth: EXPORT_DEFAULTS.LEGACY_IMAGE_WIDTH,
    imageHeight: EXPORT_DEFAULTS.LEGACY_IMAGE_HEIGHT,
    lockAspectRatio: true,
    legendWidthPercent: EXPORT_DEFAULTS.LEGACY_LEGEND_WIDTH_PERCENT,
    legendFontSizePx: EXPORT_DEFAULTS.LEGACY_LEGEND_FONT_SIZE_PX,
    includeLegendSettings: true,
    includeExportOptions: true,
    layoutId: EXPORT_DEFAULTS.LAYOUT_ID,
  };
}

export function calculateHeightFromWidth(
  newWidth: number,
  oldWidth: number,
  currentHeight: number,
): number {
  if (oldWidth <= 0) return currentHeight;
  const ratio = newWidth / oldWidth;
  return Math.round(currentHeight * ratio);
}

export function calculateWidthFromHeight(
  newHeight: number,
  oldHeight: number,
  currentWidth: number,
): number {
  if (oldHeight <= 0) return currentWidth;
  const ratio = newHeight / oldHeight;
  return Math.round(currentWidth * ratio);
}

export function isProjection3D(
  projectionName: string,
  projectionsMeta: Array<{ name: string; metadata?: { dimension?: 2 | 3 } }>,
): boolean {
  const meta = projectionsMeta.find((p) => p.name === projectionName);
  return meta?.metadata?.dimension === 3;
}

export function getProjectionPlane(
  is3D: boolean,
  currentPlane: 'xy' | 'xz' | 'yz',
): 'xy' | 'xz' | 'yz' {
  return is3D ? currentPlane : 'xy';
}

export interface FilterConfig {
  enabled: boolean;
  values: (string | null)[];
}

export interface ActiveFilter {
  annotation: string;
  values: (string | null)[];
}

export function getActiveFilters(filterConfig: Record<string, FilterConfig>): ActiveFilter[] {
  return Object.entries(filterConfig)
    .filter(([, cfg]) => cfg.enabled && Array.isArray(cfg.values) && cfg.values.length > 0)
    .map(([annotation, cfg]) => ({
      annotation,
      values: cfg.values,
    }));
}

export function doesProteinMatchFilters(
  proteinIndex: number,
  activeFilters: ActiveFilter[],
  data: ProtspaceData,
): boolean {
  for (const { annotation, values } of activeFilters) {
    const annotationIdxData = data.annotation_data?.[annotation];
    const valuesArr = data.annotations?.[annotation]?.values;

    if (!annotationIdxData || !valuesArr) {
      return false;
    }

    const annotationValue = Array.isArray(annotationIdxData[proteinIndex])
      ? (annotationIdxData[proteinIndex] as number[])[0]
      : (annotationIdxData as number[])[proteinIndex];

    const v =
      annotationValue != null && annotationValue >= 0 && annotationValue < valuesArr.length
        ? valuesArr[annotationValue]
        : null;

    if (!values.some((allowed) => allowed === v)) {
      return false;
    }
  }

  return true;
}

export function applyFiltersToData(data: ProtspaceData, activeFilters: ActiveFilter[]): number[] {
  const numProteins = Array.isArray(data.protein_ids) ? data.protein_ids.length : 0;
  const indices: number[] = new Array(numProteins);

  for (let i = 0; i < numProteins; i++) {
    const isMatch = doesProteinMatchFilters(i, activeFilters, data);
    indices[i] = isMatch ? 0 : 1;
  }

  return indices;
}

export function createCustomAnnotation(): {
  values: string[];
  colors: string[];
  shapes: string[];
} {
  return {
    values: ['Filtered Proteins', 'Other Proteins'],
    colors: ['#00A35A', '#9AA0A6'],
    shapes: ['circle', 'circle'],
  };
}

export function shouldDisableSelection(dataSize: number): boolean {
  return dataSize <= 1;
}

export function getSelectionDisabledMessage(reason: string, dataSize: number): string {
  if (reason === 'insufficient-data') {
    return `Selection mode disabled: Only ${dataSize} point${dataSize !== 1 ? 's' : ''} remaining`;
  }
  return 'Selection mode disabled';
}

export function areFilterConfigsEqual(
  config1: Record<string, FilterConfig>,
  config2: Record<string, FilterConfig>,
): boolean {
  const keys1 = Object.keys(config1).sort();
  const keys2 = Object.keys(config2).sort();

  if (keys1.length !== keys2.length) return false;
  if (keys1.join(',') !== keys2.join(',')) return false;

  for (const key of keys1) {
    const cfg1 = config1[key];
    const cfg2 = config2[key];

    if (cfg1.enabled !== cfg2.enabled) return false;
    if (JSON.stringify(cfg1.values.sort()) !== JSON.stringify(cfg2.values.sort())) return false;
  }

  return true;
}

export function initializeFilterConfig(
  annotations: string[],
  existingConfig: Record<string, FilterConfig>,
): Record<string, FilterConfig> {
  const nextConfig: Record<string, FilterConfig> = { ...existingConfig };
  annotations.forEach((annotation) => {
    if (!nextConfig[annotation]) {
      nextConfig[annotation] = { enabled: false, values: [] };
    }
  });
  return nextConfig;
}

export function toggleProteinSelection(proteinId: string, currentSelection: string[]): string[] {
  const currentSet = new Set(currentSelection);
  if (currentSet.has(proteinId)) {
    currentSet.delete(proteinId);
  } else {
    currentSet.add(proteinId);
  }
  return Array.from(currentSet);
}

export function mergeProteinSelections(
  currentSelection: string[],
  newSelections: string[],
): string[] {
  const merged = new Set(currentSelection);
  newSelections.forEach((id) => merged.add(id));
  return Array.from(merged);
}

export function validateAnnotationValues(
  values: (string | null)[],
  availableValues: (string | null)[],
): (string | null)[] {
  const availableSet = new Set(availableValues);
  return values.filter((v) => availableSet.has(v));
}
