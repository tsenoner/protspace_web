import type { FigureLayoutId } from './presets';
import { maxLegendItemsForLayout } from './legend-caps';

export interface SlicedLegend<T> {
  visible: T[];
  omittedCount: number;
}

export function sliceLegendItemsForLayout<T>(
  items: readonly T[],
  layoutId: FigureLayoutId,
): SlicedLegend<T> {
  const cap = maxLegendItemsForLayout(layoutId);
  if (items.length <= cap) {
    return { visible: [...items], omittedCount: 0 };
  }
  return {
    visible: items.slice(0, cap),
    omittedCount: items.length - cap,
  };
}
