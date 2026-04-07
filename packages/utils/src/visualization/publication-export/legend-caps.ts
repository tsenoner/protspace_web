import type { FigureLayoutId } from './presets';

export const MAX_LEGEND_ITEMS: Record<FigureLayoutId, number> = {
  one_column_below: 3,
  two_column_right: 13,
  two_column_below: 8,
  full_page_top: 14,
};

export function maxLegendItemsForLayout(layoutId: FigureLayoutId): number {
  return MAX_LEGEND_ITEMS[layoutId];
}
