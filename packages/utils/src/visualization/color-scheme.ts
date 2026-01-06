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

export const COLOR_SCHEMES = {
  kellys: KELLYS_COLORS,
} as const;

/**
 * Reserved medium gray (#848482) for N/A (missing/nullish) categories.
 * This color is excluded from Kelly's palette to ensure it's only used for special categories.
 */
export const NA_GRAY = '#848482';

/**
 * Gray color for the "Other" bucket category.
 * Distinct from NA_GRAY to differentiate between missing values and grouped low-frequency categories.
 */
export const OTHER_GRAY = '#999999';
