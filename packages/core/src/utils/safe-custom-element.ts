import { customElement as litCustomElement } from 'lit/decorators.js';

/**
 * HMR-safe wrapper around Lit's `@customElement` decorator.
 *
 * Vite HMR re-evaluates modules on file save, which causes Lit's decorator
 * to call `customElements.define(tagName, …)` a second time and throw a
 * `NotSupportedError` because the registry forbids redefining a tag. The
 * effect is a noisy console error and a half-mounted page until the user
 * does a full reload.
 *
 * This wrapper checks the registry first: if the tag is already defined,
 * it returns a no-op decorator (the existing class stays registered, and
 * the developer needs a full reload to see class-shape changes — which was
 * already true for HMR'd Lit components).
 */
export const customElement: typeof litCustomElement = (tagName) => {
  if (typeof customElements !== 'undefined' && customElements.get(tagName)) {
    return ((target: unknown) => target) as ReturnType<typeof litCustomElement>;
  }
  return litCustomElement(tagName);
};
