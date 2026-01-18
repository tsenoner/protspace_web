import { tokens } from '../../styles/tokens';
import { buttonMixin } from '../../styles/mixins';
import { overlayMixins } from '../../styles/overlay-mixins';
import { themeStyles } from './styles/theme';
import { layoutStyles } from './styles/layout';
import { itemStyles } from './styles/item';
import { modalStyles } from './styles/modal';
import { responsiveStyles } from './styles/responsive';

/**
 * Legend Styles
 *
 * Modular style composition following the unified ProtSpace style architecture.
 * Styles are imported in order: tokens → mixins → theme → features → responsive
 *
 * @see /docs/developers/style-architecture.md for organization standards
 */
export const legendStyles = [
  // 1. Foundation
  tokens,

  // 2. Shared mixins
  buttonMixin,
  overlayMixins,

  // 3. Component-specific (modular)
  themeStyles,
  layoutStyles,
  itemStyles,
  modalStyles,

  // 4. Responsive (ALWAYS LAST)
  responsiveStyles,
];
