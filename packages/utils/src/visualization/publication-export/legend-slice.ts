import type { FigurePresetId, LegendPlacement } from './presets';
import { maxLegendItemsForLayout } from './legend-caps';

export interface SlicedLegend<T> {
  visible: T[];
  omittedCount: number;
}

export function sliceLegendItemsForLayout<T>(
  items: readonly T[],
  presetId: FigurePresetId,
  placement: LegendPlacement,
): SlicedLegend<T> {
  const cap = maxLegendItemsForLayout(presetId, placement);
  if (items.length <= cap) {
    return { visible: [...items], omittedCount: 0 };
  }
  return {
    visible: items.slice(0, cap),
    omittedCount: items.length - cap,
  };
}
