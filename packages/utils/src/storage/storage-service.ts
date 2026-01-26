/**
 * Generic typed localStorage wrapper for persisting component settings.
 * Provides a consistent API for saving and loading settings scoped by
 * component, dataset, and context (e.g., annotation name).
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

/**
 * Remove all localStorage entries for a specific dataset hash.
 * This is used when importing a parquetbundle with settings to ensure
 * the imported settings are the only source of truth.
 *
 * Keys follow pattern: protspace:{component}:{hash}:{context?}
 *
 * @param datasetHash - The dataset hash to match
 * @returns The number of keys removed
 */
export function removeAllStorageItemsByHash(datasetHash: string): number {
  try {
    const keysToRemove: string[] = [];
    const prefix = `${STORAGE_PREFIX}:`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        // Parse key to check if it contains this hash
        const parts = key.split(':');
        // parts[0] = 'protspace', parts[1] = component, parts[2] = hash
        if (parts.length >= 3 && parts[2] === datasetHash) {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    return keysToRemove.length;
  } catch {
    return 0;
  }
}
