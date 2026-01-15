/**
 * Utility functions for focus trapping in dialogs.
 * Ensures keyboard navigation stays within the dialog when open.
 */

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'a[href]',
].join(', ');

/**
 * Gets all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
  return Array.from(elements).filter(
    (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden',
  );
}

/**
 * Gets the active element, traversing shadow DOM boundaries.
 * document.activeElement only returns the host element when focus is inside Shadow DOM.
 */
function getDeepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/**
 * Creates a keydown handler that traps focus within the container.
 * Returns a cleanup function to remove the event listener.
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const activeElement = getDeepActiveElement();

    if (e.shiftKey) {
      // Shift + Tab: going backwards
      if (activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: going forwards
      if (activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus the first focusable element when trap is set up
  requestAnimationFrame(() => {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  });

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}
