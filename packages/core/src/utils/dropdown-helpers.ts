/**
 * Dropdown utility functions
 * Shared helpers for consistent dropdown behavior across components
 */

/**
 * Handles escape key press for dropdown menus
 * - Stops event propagation to prevent conflicts with other handlers
 * - Provides consistent behavior across all dropdowns
 *
 * @param event - The keyboard event
 * @param onClose - Callback to close the dropdown
 */
export function handleDropdownEscape(event: KeyboardEvent, onClose: () => void): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  onClose();
}

/**
 * Checks if any dropdown is currently open
 * Used by document-level handlers to avoid interfering with dropdown Escape handling
 *
 * @param dropdownStates - Object containing boolean states of all dropdowns
 * @returns true if any dropdown is open
 */
export function isAnyDropdownOpen(dropdownStates: Record<string, boolean>): boolean {
  return Object.values(dropdownStates).some((isOpen) => isOpen);
}
