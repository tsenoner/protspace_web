/**
 * Helper functions for control bar component
 * These functions contain the core logic extracted from the component for better testability
 */

import type { ProtspaceData } from './types';

/**
 * Export default settings
 */
export const EXPORT_DEFAULTS = {
  FORMAT: 'png' as const,
  IMAGE_WIDTH: 2048,
  IMAGE_HEIGHT: 1024,
  LEGEND_WIDTH_PERCENT: 25,
  LEGEND_FONT_SIZE_PX: 24,
  BASE_FONT_SIZE: 24,
  MIN_LEGEND_FONT_SIZE_PX: 8,
  MAX_LEGEND_FONT_SIZE_PX: 120,
  LOCK_ASPECT_RATIO: true,
};

/**
 * Calculate new height when width changes with locked aspect ratio
 */
export function calculateHeightFromWidth(
  newWidth: number,
  oldWidth: number,
  currentHeight: number,
): number {
  if (oldWidth <= 0) return currentHeight;
  const ratio = newWidth / oldWidth;
  return Math.round(currentHeight * ratio);
}

/**
 * Calculate new width when height changes with locked aspect ratio
 */
export function calculateWidthFromHeight(
  newHeight: number,
  oldHeight: number,
  currentWidth: number,
): number {
  if (oldHeight <= 0) return currentWidth;
  const ratio = newHeight / oldHeight;
  return Math.round(currentWidth * ratio);
}

/**
 * Check if projection is 3D based on metadata
 */
export function isProjection3D(
  projectionName: string,
  projectionsMeta: Array<{ name: string; metadata?: { dimension?: 2 | 3 } }>,
): boolean {
  const meta = projectionsMeta.find((p) => p.name === projectionName);
  return meta?.metadata?.dimension === 3;
}

/**
 * Get appropriate plane for projection
 */
export function getProjectionPlane(
  is3D: boolean,
  currentPlane: 'xy' | 'xz' | 'yz',
): 'xy' | 'xz' | 'yz' {
  return is3D ? currentPlane : 'xy';
}

/**
 * Filter configuration type
 */
export interface FilterConfig {
  enabled: boolean;
  values: (string | null)[];
}

/**
 * Active filter type
 */
export interface ActiveFilter {
  annotation: string;
  values: (string | null)[];
}

/**
 * Extract active filters from filter configuration
 */
export function getActiveFilters(filterConfig: Record<string, FilterConfig>): ActiveFilter[] {
  return Object.entries(filterConfig)
    .filter(([, cfg]) => cfg.enabled && Array.isArray(cfg.values) && cfg.values.length > 0)
    .map(([annotation, cfg]) => ({
      annotation,
      values: cfg.values,
    }));
}

/**
 * Check if a protein matches all active filters
 */
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

    // Handle both number[] and number[][] formats
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

/**
 * Apply filters to data and return membership array
 * Returns array where 0 = Filtered Proteins, 1 = Other Proteins
 */
export function applyFiltersToData(data: ProtspaceData, activeFilters: ActiveFilter[]): number[] {
  const numProteins = Array.isArray(data.protein_ids) ? data.protein_ids.length : 0;
  const indices: number[] = new Array(numProteins);

  for (let i = 0; i < numProteins; i++) {
    const isMatch = doesProteinMatchFilters(i, activeFilters, data);
    indices[i] = isMatch ? 0 : 1;
  }

  return indices;
}

/**
 * Create custom annotation from filter results
 */
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

/**
 * Validate selection mode based on data size
 */
export function shouldDisableSelection(dataSize: number): boolean {
  return dataSize <= 1;
}

/**
 * Create selection disabled message
 */
export function getSelectionDisabledMessage(reason: string, dataSize: number): string {
  if (reason === 'insufficient-data') {
    return `Selection mode disabled: Only ${dataSize} point${dataSize !== 1 ? 's' : ''} remaining`;
  }
  return 'Selection mode disabled';
}

/**
 * Check if two filter configurations are equal
 */
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

/**
 * Initialize filter config for annotations
 */
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

/**
 * Toggle protein selection (add or remove)
 */
export function toggleProteinSelection(proteinId: string, currentSelection: string[]): string[] {
  const currentSet = new Set(currentSelection);
  if (currentSet.has(proteinId)) {
    currentSet.delete(proteinId);
  } else {
    currentSet.add(proteinId);
  }
  return Array.from(currentSet);
}

/**
 * Merge multiple protein selections (for brush selection)
 */
export function mergeProteinSelections(
  currentSelection: string[],
  newSelections: string[],
): string[] {
  const merged = new Set(currentSelection);
  newSelections.forEach((id) => merged.add(id));
  return Array.from(merged);
}

/**
 * Validate annotation values
 */
export function validateAnnotationValues(
  values: (string | null)[],
  availableValues: (string | null)[],
): (string | null)[] {
  const availableSet = new Set(availableValues);
  return values.filter((v) => availableSet.has(v));
}
