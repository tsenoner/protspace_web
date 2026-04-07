import type { FigureLayoutId } from './presets';

export const MAX_LEGEND_ITEMS: Record<FigureLayoutId, number> = {
  one_column_below: 8,
  two_column_right: 18,
  two_column_below: 18,
  full_page_top: 36,
};

export function maxLegendItemsForLayout(layoutId: FigureLayoutId): number {
  return MAX_LEGEND_ITEMS[layoutId];
}
