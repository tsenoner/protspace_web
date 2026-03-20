import type { FigurePresetId, LegendPlacement } from './presets';

export const MAX_LEGEND_ITEMS: Record<FigurePresetId, Record<LegendPlacement, number>> = {
  one_column: { right: 10, below: 6 },
  two_column: { right: 18, below: 10 },
  full_page: { right: 28, below: 16 },
};

export function maxLegendItemsForLayout(
  presetId: FigurePresetId,
  placement: LegendPlacement,
): number {
  return MAX_LEGEND_ITEMS[presetId][placement];
}
