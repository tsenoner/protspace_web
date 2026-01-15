/**
 * Generic typed localStorage wrapper for persisting component settings.
 * Provides a consistent API for saving and loading settings scoped by
 * component, dataset, and context (e.g., feature name).
 */

const STORAGE_PREFIX = 'protspace';

export function buildStorageKey(component: string, datasetHash: string, context?: string): string {
  const parts = [STORAGE_PREFIX, component, datasetHash];
  if (context) {
    parts.push(context);
  }
  return parts.join(':');
}

export function getStorageItem<Value>(key: string, defaultValue: Value): Value {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as Value;
  } catch {
    // JSON parse error or localStorage not available
    return defaultValue;
  }
}

export function setStorageItem<Value>(key: string, value: Value): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // localStorage not available or quota exceeded
    return false;
  }
}

export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
