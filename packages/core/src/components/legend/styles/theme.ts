import { css } from 'lit';

/**
 * Legend Theme Styles
 *
 * CSS custom properties for Legend component theming.
 * These properties can be overridden by consumers for customization.
 */
export const themeStyles = css`
  :host {
    /* Layout */
    --legend-border-radius: 6px;
    --legend-padding: var(--spacing-md);
    --legend-item-padding: 0.625rem;
    --legend-item-gap: var(--spacing-sm);

    /* Colors - Background */
    --legend-bg: var(--surface);
    --legend-bg-dark: var(--surface-dark);
    --legend-hover-bg: var(--disabled-bg);
    --legend-hover-bg-dark: var(--border-dark);
    --legend-hidden-bg: var(--disabled-bg);
    --legend-hidden-bg-dark: var(--border-dark);
    --legend-active-bg: var(--active-bg);
    --legend-active-bg-dark: #1e3a8a;
    --legend-drag-bg: var(--primary-light);
    --legend-drag-bg-dark: #1e3a8a;

    /* Colors - Borders */
    --legend-border: var(--border);
    --legend-border-dark: var(--border-dark);
    --legend-selected-ring: var(--primary);

    /* Colors - Text */
    --legend-text-color: var(--text-primary);
    --legend-text-color-dark: #f9fafb;
    --legend-text-secondary: var(--text-secondary);
    --legend-text-secondary-dark: #9ca3af;

    /* Opacity */
    --legend-hidden-opacity: 0.5;
  }
`;
