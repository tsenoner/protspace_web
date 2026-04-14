import type { FigureLayoutId } from './presets';

export const MAX_LEGEND_ITEMS: Record<FigureLayoutId, number> = {
  one_column_below: 3,
  two_column_right: 13,
  two_column_below: 8,
  full_page_top: 14,
  one_column_scatter_only: 10000,
  two_column_scatter_only: 10000,
  full_page_scatter_only: 10000,
};

export function maxLegendItemsForLayout(layoutId: FigureLayoutId): number {
  return MAX_LEGEND_ITEMS[layoutId];
}
