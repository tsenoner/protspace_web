/**
 * Storage utilities for persisting component settings in localStorage.
 * Provides dataset-scoped persistence with type safety.
 */

export { generateDatasetHash, djb2Hash } from './data-hash';
export {
  buildStorageKey,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from './storage-service';
