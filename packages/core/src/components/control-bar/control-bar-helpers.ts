import type { PersistedExportOptions, PublicationFigureLayoutId } from '@protspace/utils';

export const EXPORT_DEFAULTS = {
  FORMAT: 'png' as const,
  LAYOUT_ID: 'two_column_below' as PublicationFigureLayoutId,
  LEGACY_IMAGE_WIDTH: 2048,
  LEGACY_IMAGE_HEIGHT: 1024,
  LEGACY_LEGEND_WIDTH_PERCENT: 20,
  LEGACY_LEGEND_FONT_SIZE_PX: 15,
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

export function shouldDisableSelection(dataSize: number): boolean {
  return dataSize <= 1;
}

export function getSelectionDisabledMessage(reason: string, dataSize: number): string {
  if (reason === 'insufficient-data') {
    return `Selection mode disabled: Only ${dataSize} point${dataSize !== 1 ? 's' : ''} remaining`;
  }
  return 'Selection mode disabled';
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

export function mergeProteinSelections(
  currentSelection: string[],
  newSelections: string[],
): string[] {
  const merged = new Set(currentSelection);
  newSelections.forEach((id) => merged.add(id));
  return Array.from(merged);
}
