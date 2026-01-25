import type { LegendPersistedSettings, PersistedCategoryData, LegendSortMode } from '../types';

/**
 * Valid sort mode values for legend persistence.
 */
const VALID_SORT_MODES: LegendSortMode[] = [
  'size-asc',
  'size-desc',
  'alpha-asc',
  'alpha-desc',
  'manual',
  'manual-reverse',
];

/**
 * Validates that a value is a valid PersistedCategoryData object.
 */
export function isValidPersistedCategoryData(obj: unknown): obj is PersistedCategoryData {
  if (typeof obj !== 'object' || obj === null) return false;
  const cat = obj as Record<string, unknown>;
  return (
    typeof cat.zOrder === 'number' && typeof cat.color === 'string' && typeof cat.shape === 'string'
  );
}

/**
 * Validates that a value is a valid LegendSortMode.
 */
export function isValidSortMode(value: unknown): value is LegendSortMode {
  return typeof value === 'string' && VALID_SORT_MODES.includes(value as LegendSortMode);
}

/**
 * Validates that a value is a valid LegendPersistedSettings object.
 * Checks the structure and types of all required fields.
 *
 * Note: This function is permissive of extra fields for forward compatibility.
 * Unknown fields are silently ignored, allowing newer settings versions
 * to be read by older code.
 */
export function isValidLegendSettings(obj: unknown): obj is LegendPersistedSettings {
  if (typeof obj !== 'object' || obj === null) return false;

  const s = obj as Record<string, unknown>;

  // Check required primitive fields
  if (typeof s.maxVisibleValues !== 'number') return false;
  if (typeof s.includeShapes !== 'boolean') return false;
  if (typeof s.shapeSize !== 'number') return false;
  if (!isValidSortMode(s.sortMode)) return false;
  if (typeof s.enableDuplicateStackUI !== 'boolean') return false;

  // Check hiddenValues is an array of strings
  if (!Array.isArray(s.hiddenValues)) return false;
  if (!s.hiddenValues.every((v) => typeof v === 'string')) return false;

  // Check categories is an object with valid PersistedCategoryData values
  if (typeof s.categories !== 'object' || s.categories === null || Array.isArray(s.categories)) {
    return false;
  }

  const categories = s.categories as Record<string, unknown>;
  for (const key of Object.keys(categories)) {
    if (!isValidPersistedCategoryData(categories[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a BundleSettings object (annotation name -> legend settings map).
 * Returns true if all values are valid LegendPersistedSettings.
 */
export function isValidBundleSettings(
  obj: unknown,
): obj is Record<string, LegendPersistedSettings> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  const settings = obj as Record<string, unknown>;
  for (const key of Object.keys(settings)) {
    if (!isValidLegendSettings(settings[key])) {
      return false;
    }
  }

  return true;
}
