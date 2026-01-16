import { css } from 'lit';

/**
 * Design System Tokens
 *
 * Single source of truth for all design values.
 * These CSS custom properties enable runtime theming and can be overridden
 * by consumers of the components.
 *
 * @example
 * ```typescript
 * // In a component
 * import { tokens } from './styles/tokens';
 *
 * static styles = [tokens, css`
 *   button {
 *     background: var(--primary);
 *     padding: var(--spacing-md);
 *   }
 * `];
 * ```
 *
 * @example
 * ```css
 * // Override in consumer CSS
 * my-component {
 *   --primary: #ff0000;
 *   --spacing-md: 1rem;
 * }
 * ```
 */
export const tokens = css`
  :host {
    display: block;
    font-family: var(--font-family);

    /* Color Palette */
    --primary: #00a3e0;
    --primary-hover: #008ec4;
    --primary-light: #eef6fb;
    --surface: #ffffff;
    --border: #d9e2ec;
    --muted: #4a5568;
    --text-dark: #0b0f19;
    --text-light: #ffffff;
    --focus-ring: rgba(0, 163, 224, 0.15);

    /* Destructive Actions */
    --danger: #e42121;
    --danger-hover: #c20909;
    --danger-border: #d06868;

    /* Additional UI Colors */
    --border-light: #cfe8f5;
    --hint: #d6d7da;
    --scrollbar: #cbd5e0;
    --hover-bg: #f7fafc;

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.05);
    --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.08);

    /* Spacing Scale (8px base unit) */
    --spacing-xs: 0.25rem; /*  4px */
    --spacing-sm: 0.5rem; /*  8px */
    --spacing-md: 0.75rem; /* 12px */
    --spacing-lg: 1rem; /* 16px */

    /* Border & Radius */
    --border-width: 1px;
    --radius: 0.25rem; /* 4px */

    /* Typography Scale */
    --font-family: system-ui, -apple-system, sans-serif;
    --text-xs: 0.625rem; /* 10px */
    --text-sm: 0.75rem; /* 12px */
    --text-base: 0.875rem; /* 14px */
    --text-md: 1rem; /* 16px */

    /* Font Weights */
    --font-normal: 400;
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;

    /* Animations */
    --transition-fast: all 0.1s ease;
    --transition: all 0.15s ease;

    /* Layout */
    --dropdown-offset: 0.3125rem; /* 5px */
    --dropdown-z: 100;

    /* Component sizing */
    --input-padding-y: 0.375rem; /* 6px */
    --input-padding-x: 0.5625rem; /* 9px */
    --button-padding-y: 0.3rem;
    --button-padding-x: 0.75rem;
  }
`;
