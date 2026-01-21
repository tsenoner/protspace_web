import { css } from 'lit';

/**
 * Legend Responsive Styles
 *
 * All media queries for Legend component.
 * This file should always be imported last in the styles array.
 */
export const responsiveStyles = css`
  @media (max-width: 950px) {
    /* --breakpoint-lg */
    :host {
      max-width: unset;
    }
  }
`;
