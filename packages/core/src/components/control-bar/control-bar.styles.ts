/**
 * Control Bar Styles
 *
 * Composed from multiple style layers:
 * - Design tokens (colors, spacing, typography)
 * - Reusable mixins (buttons, inputs, dropdowns)
 * - Component-specific layouts and features
 * - Responsive adaptations
 *
 * This modular approach eliminates duplication and provides a single
 * source of truth for design patterns.
 */

import { tokens } from '../../styles/tokens';
import { buttonMixin, inputMixin, dropdownMixin, iconMixin } from '../../styles/mixins';
import { layoutStyles } from './styles/layout';
import { filterStyles } from './styles/filter';
import { exportStyles } from './styles/export';
import { responsiveStyles } from './styles/responsive';

/**
 * Export as an array of CSS style sheets.
 * Lit will automatically compose and deduplicate these styles.
 */
export const controlBarStyles = [
  tokens,
  buttonMixin,
  inputMixin,
  dropdownMixin,
  iconMixin,
  layoutStyles,
  filterStyles,
  exportStyles,
  responsiveStyles,
];
