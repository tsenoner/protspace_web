import { NEUTRAL_VALUE_COLOR } from './config';
import type { PlotDataPoint, VisualizationData, AnnotationStore } from '@protspace/utils';
import { normalizeShapeName, toInternalValue, getAnnotationValues } from '@protspace/utils';
import type { ColumnarStyleGetters } from './webgl/types';

export interface StyleConfig {
  selectedProteinIds: string[];
  highlightedProteinIds: string[];
  selectedAnnotation: string;
  hiddenAnnotationValues: string[];
  otherAnnotationValues: string[];
  useShapes?: boolean;
  /**
   * Optional legend-driven z-order mapping: annotation value key -> rank (0 = top).
   * Used to break overlap ties deterministically without CPU-sorting.
   */
  zOrderMapping?: Record<string, number> | null;
  /**
   * Optional legend-driven color mapping: annotation value key -> hex color.
   * When provided, colors are determined by the legend (frequency-sorted).
   * When null, falls back to annotation.colors from the data.
   */
  colorMapping?: Record<string, string> | null;
  /**
   * Optional legend-driven shape mapping: annotation value key -> shape name.
   * When provided, shapes are determined by the legend (frequency-sorted).
   * When null, falls back to annotation.shapes from the data.
   */
  shapeMapping?: Record<string, string> | null;
  sizes: {
    base: number;
  };
  opacities: {
    base: number;
    selected: number;
    faded: number;
  };
}

export function createStyleGetters(data: VisualizationData | null, styleConfig: StyleConfig) {
  // Precompute fast lookup structures
  const selectedIdsSet = new Set(styleConfig.selectedProteinIds);
  const highlightedIdsSet = new Set(styleConfig.highlightedProteinIds);
  const hiddenKeysSet = new Set(
    (styleConfig.hiddenAnnotationValues || []).map((v) => toInternalValue(v)),
  );
  const otherValuesSet = new Set(styleConfig.otherAnnotationValues || []);

  // Precompute value -> color and value -> shape for the selected annotation
  const annotation =
    data && styleConfig.selectedAnnotation
      ? data.annotations[styleConfig.selectedAnnotation]
      : undefined;
  const valueToColor = new Map<string, string>();
  const valueToShape = new Map<string, string>();

  // Priority: legend colorMapping > annotation.colors from data
  const colorMap = styleConfig.colorMapping;
  const shapeMap = styleConfig.shapeMapping;

  if (colorMap) {
    // Use legend-provided color mapping (frequency-sorted)
    for (const [key, color] of Object.entries(colorMap)) {
      valueToColor.set(key, color);
    }
  } else if (annotation && Array.isArray(annotation.values)) {
    // Fallback to annotation.colors from data
    for (let i = 0; i < annotation.values.length; i++) {
      const v = annotation.values[i];
      const k = toInternalValue(v);
      const color = annotation.colors?.[i];
      if (color) valueToColor.set(k, color);
    }
  }

  if (shapeMap) {
    // Use legend-provided shape mapping - always apply custom shapes from legend
    // regardless of useShapes setting (custom shapes override global setting)
    for (const [key, shape] of Object.entries(shapeMap)) {
      valueToShape.set(key, normalizeShapeName(shape));
    }
  } else if (annotation && Array.isArray(annotation.values) && styleConfig.useShapes) {
    // Fallback to annotation.shapes from data (only when useShapes is enabled)
    for (let i = 0; i < annotation.values.length; i++) {
      const v = annotation.values[i];
      const k = toInternalValue(v);
      if (annotation.shapes && annotation.shapes[i]) {
        valueToShape.set(k, normalizeShapeName(annotation.shapes[i]));
      }
    }
  }
  // Detect if the user has effectively hidden all values for the selected annotation
  // In that case, we ignore the hidden filter to avoid rendering an empty plot.
  const computeAllHidden = (): boolean => {
    if (!data || !styleConfig.selectedAnnotation) return false;
    const annotation = data.annotations[styleConfig.selectedAnnotation];
    if (!annotation || !Array.isArray(annotation.values)) return false;
    const hidden = new Set(styleConfig.hiddenAnnotationValues);
    if (hidden.size === 0) return false;
    const normalizedKeys = annotation.values.map((v) => toInternalValue(v));
    return normalizedKeys.length > 0 && normalizedKeys.every((k) => hidden.has(k));
  };

  const allHidden = computeAllHidden();

  const getPointSize = (_point: PlotDataPoint): number => {
    return styleConfig.sizes.base;
  };

  const getPointShape = (point: PlotDataPoint): string => {
    if (!data || !styleConfig.selectedAnnotation) return 'circle';

    const annotationValueArray = point.annotationValues[styleConfig.selectedAnnotation];

    // multilabel points only support circle for now
    if (annotationValueArray.length > 1) return 'circle';

    // Defensive guard — shouldn't happen since DataProcessor normalizes nulls to __NA__
    if (annotationValueArray.length === 0) return 'circle';

    const annotationValue = annotationValueArray[0];
    if (annotationValue && otherValuesSet.has(annotationValue)) return 'circle';

    const k = toInternalValue(annotationValue);
    // Check if we have a custom shape from the legend mapping
    const customShape = valueToShape.get(k);
    if (customShape) return customShape;

    return 'circle';
  };

  const getColors = (point: PlotDataPoint): string[] => {
    if (!data || !styleConfig.selectedAnnotation) return [NEUTRAL_VALUE_COLOR];

    const annotationValueArray = point.annotationValues[styleConfig.selectedAnnotation];

    // Defensive guard
    if (annotationValueArray.length === 0) return [NEUTRAL_VALUE_COLOR];

    if (annotationValueArray.every((v) => otherValuesSet.has(v))) {
      return [NEUTRAL_VALUE_COLOR];
    }

    const colors = annotationValueArray
      .map((v) => {
        if (hiddenKeysSet.has(toInternalValue(v))) return undefined;
        if (otherValuesSet.has(v)) return NEUTRAL_VALUE_COLOR;
        return valueToColor.get(toInternalValue(v)) ?? NEUTRAL_VALUE_COLOR;
      })
      .filter((v) => v !== undefined);

    // Remove multiple neutral colors from multiple other annotations
    return [...new Set(colors)];
  };

  const getOpacity = (point: PlotDataPoint): number => {
    const annotationValue = point.annotationValues[styleConfig.selectedAnnotation];

    if (!allHidden && annotationValue) {
      if (annotationValue.every((f) => hiddenKeysSet.has(toInternalValue(f)))) return 0;
    }

    const isSelected = selectedIdsSet.has(point.id);
    const isHighlighted = highlightedIdsSet.has(point.id);
    const hasSelection = styleConfig.selectedProteinIds.length > 0;

    if (isSelected || isHighlighted) {
      return styleConfig.opacities.selected;
    }
    if (hasSelection && !isSelected) {
      return styleConfig.opacities.faded;
    }
    return styleConfig.opacities.base;
  };

  // Precompute normalization for z-order mapping so getDepth is cheap.
  const zMap = styleConfig.zOrderMapping ?? null;
  const zMax =
    zMap && Object.keys(zMap).length > 0
      ? Math.max(...Object.values(zMap).filter((v) => typeof v === 'number' && Number.isFinite(v)))
      : 0;
  const Z_EPS = 1e-3; // must be small enough to not override opacity-based depth differences

  /**
   * Depth used by WebGL depth test:
   * - Primary: opacity (more opaque wins)
   * - Secondary: legend z-order (lower rank wins when opacity ties)
   */
  const getDepth = (point: PlotDataPoint): number => {
    const opacity = getOpacity(point);
    // Base depth in [0,1]: higher opacity -> smaller depth -> wins with LESS
    let depth = 1 - Math.min(1, Math.max(0, opacity));

    if (zMap && styleConfig.selectedAnnotation) {
      const annotationValueArray = point.annotationValues[styleConfig.selectedAnnotation];
      let key: string;

      if (annotationValueArray && annotationValueArray.length > 0) {
        // Check if this point belongs to the "Other" category
        const isOther = annotationValueArray.some((v) => otherValuesSet.has(v));
        if (isOther) {
          key = 'Other';
        } else {
          const raw = annotationValueArray[0];
          key = toInternalValue(raw);
        }
      } else {
        // Defensive fallback — shouldn't happen since DataProcessor normalizes nulls
        key = '__NA__';
      }

      const order = zMap[key];
      if (typeof order === 'number' && Number.isFinite(order) && zMax > 0) {
        const orderNorm = Math.min(1, Math.max(0, order / zMax));
        depth = depth + orderNorm * Z_EPS;
      } else if (zMap && zMax > 0) {
        // Unknown values go to the back within an opacity tier.
        depth = depth + Z_EPS;
      }
    }

    // Clamp to a safe range (shader expects roughly [0,1])
    return Math.min(1, Math.max(0, depth));
  };

  const getStrokeColor = (_point: PlotDataPoint): string => {
    return 'var(--protspace-default-stroke, #333333)';
  };

  const getStrokeWidth = (_point: PlotDataPoint): number => {
    return 1;
  };

  return {
    getPointSize,
    getPointShape,
    getColors,
    getOpacity,
    getDepth,
    getStrokeColor,
    getStrokeWidth,
  };
}

/**
 * Creates style getters that use index-based annotation lookup from a shared AnnotationStore.
 * This avoids the need for per-point PlotDataPoint objects.
 */
export function createColumnarStyleGetters(
  annotationStore: AnnotationStore,
  ids: string[],
  styleConfig: StyleConfig,
): ColumnarStyleGetters {
  const selectedIdsSet = new Set(styleConfig.selectedProteinIds);
  const highlightedIdsSet = new Set(styleConfig.highlightedProteinIds);
  const hiddenKeysSet = new Set(
    (styleConfig.hiddenAnnotationValues || []).map((v) => toInternalValue(v)),
  );
  const otherValuesSet = new Set(styleConfig.otherAnnotationValues || []);

  const annotation = styleConfig.selectedAnnotation
    ? annotationStore.annotations[styleConfig.selectedAnnotation]
    : undefined;
  const valueToColor = new Map<string, string>();
  const valueToShape = new Map<string, string>();

  const colorMap = styleConfig.colorMapping;
  const shapeMap = styleConfig.shapeMapping;

  if (colorMap) {
    for (const [key, color] of Object.entries(colorMap)) {
      valueToColor.set(key, color);
    }
  } else if (annotation && Array.isArray(annotation.values)) {
    for (let i = 0; i < annotation.values.length; i++) {
      const v = annotation.values[i];
      const k = toInternalValue(v);
      const color = annotation.colors?.[i];
      if (color) valueToColor.set(k, color);
    }
  }

  if (shapeMap) {
    for (const [key, shape] of Object.entries(shapeMap)) {
      valueToShape.set(key, normalizeShapeName(shape));
    }
  } else if (annotation && Array.isArray(annotation.values) && styleConfig.useShapes) {
    for (let i = 0; i < annotation.values.length; i++) {
      const v = annotation.values[i];
      const k = toInternalValue(v);
      if (annotation.shapes && annotation.shapes[i]) {
        valueToShape.set(k, normalizeShapeName(annotation.shapes[i]));
      }
    }
  }

  const computeAllHidden = (): boolean => {
    if (!styleConfig.selectedAnnotation) return false;
    if (!annotation || !Array.isArray(annotation.values)) return false;
    const hidden = new Set(styleConfig.hiddenAnnotationValues);
    if (hidden.size === 0) return false;
    const normalizedKeys = annotation.values.map((v) => toInternalValue(v));
    return normalizedKeys.length > 0 && normalizedKeys.every((k) => hidden.has(k));
  };

  const allHidden = computeAllHidden();

  const getAnnotationValuesForPoint = (pointIndex: number): string[] => {
    if (!styleConfig.selectedAnnotation) return [];
    return getAnnotationValues(annotationStore, styleConfig.selectedAnnotation, pointIndex);
  };

  const getPointSize = (_pointIndex: number): number => {
    return styleConfig.sizes.base;
  };

  const getShape = (pointIndex: number): string => {
    if (!styleConfig.selectedAnnotation) return 'circle';

    const annotationValueArray = getAnnotationValuesForPoint(pointIndex);
    if (annotationValueArray.length > 1) return 'circle';
    if (annotationValueArray.length === 0) return 'circle';

    const annotationValue = annotationValueArray[0];
    if (annotationValue && otherValuesSet.has(annotationValue)) return 'circle';

    const k = toInternalValue(annotationValue);
    const customShape = valueToShape.get(k);
    if (customShape) return customShape;

    return 'circle';
  };

  const getColors = (pointIndex: number): string[] => {
    if (!styleConfig.selectedAnnotation) return [NEUTRAL_VALUE_COLOR];

    const annotationValueArray = getAnnotationValuesForPoint(pointIndex);
    if (annotationValueArray.length === 0) return [NEUTRAL_VALUE_COLOR];

    if (annotationValueArray.every((v) => otherValuesSet.has(v))) {
      return [NEUTRAL_VALUE_COLOR];
    }

    const colors = annotationValueArray
      .map((v) => {
        if (hiddenKeysSet.has(toInternalValue(v))) return undefined;
        if (otherValuesSet.has(v)) return NEUTRAL_VALUE_COLOR;
        return valueToColor.get(toInternalValue(v)) ?? NEUTRAL_VALUE_COLOR;
      })
      .filter((v) => v !== undefined);

    return [...new Set(colors)];
  };

  const getOpacity = (pointIndex: number): number => {
    const annotationValue = getAnnotationValuesForPoint(pointIndex);

    if (!allHidden && annotationValue.length > 0) {
      if (annotationValue.every((f) => hiddenKeysSet.has(toInternalValue(f)))) return 0;
    }

    const pointId = ids[pointIndex];
    const isSelected = selectedIdsSet.has(pointId);
    const isHighlighted = highlightedIdsSet.has(pointId);
    const hasSelection = styleConfig.selectedProteinIds.length > 0;

    if (isSelected || isHighlighted) {
      return styleConfig.opacities.selected;
    }
    if (hasSelection && !isSelected) {
      return styleConfig.opacities.faded;
    }
    return styleConfig.opacities.base;
  };

  const zMap = styleConfig.zOrderMapping ?? null;
  const zMax =
    zMap && Object.keys(zMap).length > 0
      ? Math.max(...Object.values(zMap).filter((v) => typeof v === 'number' && Number.isFinite(v)))
      : 0;
  const Z_EPS = 1e-3;

  const getDepth = (pointIndex: number): number => {
    const opacity = getOpacity(pointIndex);
    let depth = 1 - Math.min(1, Math.max(0, opacity));

    if (zMap && styleConfig.selectedAnnotation) {
      const annotationValueArray = getAnnotationValuesForPoint(pointIndex);
      let key: string;

      if (annotationValueArray && annotationValueArray.length > 0) {
        const isOther = annotationValueArray.some((v) => otherValuesSet.has(v));
        if (isOther) {
          key = 'Other';
        } else {
          const raw = annotationValueArray[0];
          key = toInternalValue(raw);
        }
      } else {
        key = '__NA__';
      }

      const order = zMap[key];
      if (typeof order === 'number' && Number.isFinite(order) && zMax > 0) {
        const orderNorm = Math.min(1, Math.max(0, order / zMax));
        depth = depth + orderNorm * Z_EPS;
      } else if (zMap && zMax > 0) {
        depth = depth + Z_EPS;
      }
    }

    return Math.min(1, Math.max(0, depth));
  };

  const getStrokeColor = (_pointIndex: number): string => {
    return 'var(--protspace-default-stroke, #333333)';
  };

  const getStrokeWidth = (_pointIndex: number): number => {
    return 1;
  };

  return {
    getPointSize,
    getShape,
    getColors,
    getOpacity,
    getDepth,
    getStrokeColor,
    getStrokeWidth,
  };
}
