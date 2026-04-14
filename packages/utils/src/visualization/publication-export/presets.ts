export type FigureLayoutId =
  | 'one_column_below'
  | 'two_column_right'
  | 'two_column_below'
  | 'full_page_top'
  | 'one_column_scatter_only'
  | 'two_column_scatter_only'
  | 'full_page_scatter_only';

export type LegendPlacement = 'top' | 'right' | 'below' | 'none';

export interface LegendGrid {
  placement: LegendPlacement;
  columns: number;
}

export interface FigureLayout {
  id: FigureLayoutId;
  widthMm: number;
  heightMm: number;
  paddingMm: number;
  legendBandMm: number;
  scatterAspect: number;
  legend: LegendGrid;
}

export const FIGURE_LAYOUTS: Record<FigureLayoutId, FigureLayout> = {
  one_column_below: {
    id: 'one_column_below',
    widthMm: 88,
    heightMm: 70,
    paddingMm: 2,
    legendBandMm: 20,
    scatterAspect: 4 / 3,
    legend: { placement: 'below', columns: 2 },
  },
  two_column_right: {
    id: 'two_column_right',
    widthMm: 178,
    heightMm: 95,
    paddingMm: 2.5,
    legendBandMm: 44,
    scatterAspect: 4 / 3,
    legend: { placement: 'right', columns: 1 },
  },
  two_column_below: {
    id: 'two_column_below',
    widthMm: 178,
    heightMm: 95,
    paddingMm: 2.5,
    legendBandMm: 26,
    scatterAspect: 4 / 3,
    legend: { placement: 'below', columns: 3 },
  },
  full_page_top: {
    id: 'full_page_top',
    widthMm: 180,
    heightMm: 250,
    paddingMm: 3,
    legendBandMm: 38,
    scatterAspect: 4 / 3,
    legend: { placement: 'top', columns: 3 },
  },
  one_column_scatter_only: {
    id: 'one_column_scatter_only',
    widthMm: 88,
    heightMm: 66,
    paddingMm: 2,
    legendBandMm: 0,
    scatterAspect: 4 / 3,
    legend: { placement: 'none', columns: 0 },
  },
  two_column_scatter_only: {
    id: 'two_column_scatter_only',
    widthMm: 178,
    heightMm: 133,
    paddingMm: 2.5,
    legendBandMm: 0,
    scatterAspect: 4 / 3,
    legend: { placement: 'none', columns: 0 },
  },
  full_page_scatter_only: {
    id: 'full_page_scatter_only',
    widthMm: 180,
    heightMm: 135,
    paddingMm: 3,
    legendBandMm: 0,
    scatterAspect: 4 / 3,
    legend: { placement: 'none', columns: 0 },
  },
};
