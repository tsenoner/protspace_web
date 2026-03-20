export type FigurePresetId = 'one_column' | 'two_column' | 'full_page';
export type LegendPlacement = 'right' | 'below';

export interface FigurePreset {
  id: FigurePresetId;
  widthMm: number;
  heightMm: number;
  paddingMm: number;
  legendBandMm: { right: number; below: number };
  scatterAspect: number;
}

export const FIGURE_PRESETS: Record<FigurePresetId, FigurePreset> = {
  one_column: {
    id: 'one_column',
    widthMm: 88,
    heightMm: 70,
    paddingMm: 2,
    legendBandMm: { right: 38, below: 20 },
    scatterAspect: 4 / 3,
  },
  two_column: {
    id: 'two_column',
    widthMm: 178,
    heightMm: 95,
    paddingMm: 2.5,
    legendBandMm: { right: 44, below: 26 },
    scatterAspect: 4 / 3,
  },
  full_page: {
    id: 'full_page',
    widthMm: 180,
    heightMm: 140,
    paddingMm: 3,
    legendBandMm: { right: 50, below: 32 },
    scatterAspect: 16 / 10,
  },
};
