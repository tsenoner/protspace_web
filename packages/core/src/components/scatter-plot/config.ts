import type { ScatterplotConfig } from '@protspace/utils';
import { OTHER_GRAY } from '@protspace/utils';

/**
 * Duplicate stack UI threshold:
 * - Below this zoom level, we hide duplicate count badges to reduce visual clutter.
 * - Must be within `zoomExtent`.
 */
export const DUPLICATE_STACK_BADGES_MIN_ZOOM = 20;

// Centralized default configuration for the scatterplot component
export const DEFAULT_CONFIG: Required<ScatterplotConfig> = {
  width: 800,
  height: 600,
  margin: { top: 40, right: 40, bottom: 40, left: 40 },
  pointSize: 240,
  zoomExtent: [0.1, 1000],
  baseOpacity: 0.9,
  selectedOpacity: 1.0,
  fadedOpacity: 0.15,
  enableDuplicateStackUI: false,
};

/**
 * @deprecated Use OTHER_GRAY from @protspace/utils instead.
 * Kept for backward compatibility but will be removed in a future version.
 */
export const NEUTRAL_VALUE_COLOR = OTHER_GRAY;
