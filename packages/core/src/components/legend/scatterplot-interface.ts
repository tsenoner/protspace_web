import type { ScatterplotData } from './types';

/**
 * Interface defining the scatterplot element's API that the legend interacts with.
 * This provides type safety and documents the expected contract.
 */
export interface IScatterplotElement extends Element {
  // Data access
  getCurrentData(): ScatterplotData | null;
  selectedFeature: string;

  // Feature values
  hiddenFeatureValues: string[];
  otherFeatureValues: string[];
  useShapes: boolean;

  // Configuration
  config: Record<string, unknown>;

  // Isolation mode (optional - may not exist on all implementations)
  isIsolationMode?(): boolean;
  getIsolationHistory?(): string[][];
}

/**
 * Type guard to check if an element is a scatterplot element
 */
export function isScatterplotElement(element: Element | null): element is IScatterplotElement {
  return element !== null && 'getCurrentData' in element && 'selectedFeature' in element;
}

/**
 * Type guard to check if scatterplot supports hidden values
 */
export function supportsHiddenValues(element: IScatterplotElement): boolean {
  return 'hiddenFeatureValues' in element;
}

/**
 * Type guard to check if scatterplot supports other feature values
 */
export function supportsOtherValues(element: IScatterplotElement): boolean {
  return 'otherFeatureValues' in element;
}

/**
 * Type guard to check if scatterplot supports shapes
 */
export function supportsShapes(element: IScatterplotElement): boolean {
  return 'useShapes' in element;
}

/**
 * Type guard to check if scatterplot supports config
 */
export function supportsConfig(element: IScatterplotElement): boolean {
  return 'config' in element;
}

/**
 * Type guard to check if scatterplot supports isolation mode
 */
export function supportsIsolationMode(
  element: IScatterplotElement,
): element is IScatterplotElement & { isIsolationMode(): boolean } {
  return 'isIsolationMode' in element && typeof element.isIsolationMode === 'function';
}

/**
 * Type guard to check if scatterplot supports isolation history
 */
export function supportsIsolationHistory(
  element: IScatterplotElement,
): element is IScatterplotElement & { getIsolationHistory(): string[][] } {
  return 'getIsolationHistory' in element && typeof element.getIsolationHistory === 'function';
}
