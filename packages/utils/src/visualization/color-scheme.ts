/**
 * Kelly's 21 Colors of Maximum Contrast
 *
 * A scientifically-designed palette optimized for maximum visual distinction
 * between categories. These colors are chosen to maximize perceptual distance
 * and ensure clear differentiation even with many categories.
 *
 * Medium gray (#848482) is excluded as it's reserved for special categories
 * (Others, N/A). Very light gray and very dark gray are included at the end
 * for use with less frequent categories.
 *
 * Reference: Kelly, Kenneth L. "Twenty-two colors of maximum contrast."
 * Color Engineering 3.26-27 (1965).
 */
export const KELLYS_COLORS = [
  '#F3C300', // Vivid Yellow
  '#875692', // Strong Purple
  '#F38400', // Vivid Orange
  '#A1CAF1', // Very Light Blue
  '#BE0032', // Vivid Red
  '#C2B280', // Grayish Yellow
  '#008856', // Vivid Green
  '#E68FAC', // Strong Purplish Pink
  '#0067A5', // Strong Blue
  '#F99379', // Strong Yellowish Pink
  '#604E97', // Strong Violet
  '#F6A600', // Vivid Orange Yellow
  '#B3446C', // Strong Purplish Red
  '#DCD300', // Vivid Greenish Yellow
  '#882D17', // Strong Reddish Brown
  '#8DB600', // Vivid Yellowish Green
  '#654522', // Deep Yellowish Brown
  '#E25822', // Vivid Reddish Orange
  '#2B3D26', // Dark Olive Green
  '#F2F3F4', // Very Light Gray
  '#222222', // Very Dark Gray
] as const;

// Color-blind safe
export const OKABE_ITO_COLORS = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#000000',
] as const;

export const TOL_BRIGHT_COLORS = [
  '#4477AA',
  '#66CCEE',
  '#228833',
  '#CCBB44',
  '#EE6677',
  '#AA3377',
  '#BBBBBB',
] as const;

// Categorical (general purpose)
export const SET2_COLORS = [
  '#66C2A5',
  '#FC8D62',
  '#8DA0CB',
  '#E78AC3',
  '#A6D854',
  '#FFD92F',
  '#E5C494',
  '#B3B3B3',
] as const;

export const DARK2_COLORS = [
  '#1B9E77',
  '#D95F02',
  '#7570B3',
  '#E7298A',
  '#66A61E',
  '#E6AB02',
  '#A6761D',
  '#666666',
] as const;

export const TABLEAU10_COLORS = [
  '#4E79A7',
  '#F28E2B',
  '#E15759',
  '#76B7B2',
  '#59A14F',
  '#EDC948',
  '#B07AA1',
  '#FF9DA7',
  '#9C755F',
  '#BAB0AB',
] as const;

export const COLOR_SCHEMES = {
  kellys: KELLYS_COLORS,
  okabeIto: OKABE_ITO_COLORS,
  tolBright: TOL_BRIGHT_COLORS,
  set2: SET2_COLORS,
  dark2: DARK2_COLORS,
  tableau10: TABLEAU10_COLORS,
} as const;
