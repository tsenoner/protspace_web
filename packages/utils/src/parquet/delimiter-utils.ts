/**
 * Utilities for finding and counting delimiters in parquetbundle files.
 * These are shared between the bundle reader (core) and bundle writer (utils).
 */

import { BUNDLE_DELIMITER_BYTES } from './constants';

/**
 * Find all positions of the bundle delimiter in a Uint8Array.
 *
 * @param uint8Array - The binary data to search
 * @returns Array of byte positions where delimiters start
 */
export function findBundleDelimiterPositions(uint8Array: Uint8Array): number[] {
  const positions: number[] = [];
  const len = BUNDLE_DELIMITER_BYTES.length;

  for (let i = 0; i <= uint8Array.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (uint8Array[i + j] !== BUNDLE_DELIMITER_BYTES[j]) {
        match = false;
        break;
      }
    }
    if (match) positions.push(i);
  }

  return positions;
}

/**
 * Check if an ArrayBuffer contains the bundle delimiter.
 *
 * @param arrayBuffer - The binary data to check
 * @returns true if at least one delimiter is found
 */
export function isParquetBundle(arrayBuffer: ArrayBuffer): boolean {
  const uint8Array = new Uint8Array(arrayBuffer);
  return findBundleDelimiterPositions(uint8Array).length > 0;
}

/**
 * Count the number of delimiters in a Uint8Array.
 * Useful for validating bundle structure in tests.
 *
 * @param uint8Array - The binary data to search
 * @returns Number of delimiters found
 */
export function countBundleDelimiters(uint8Array: Uint8Array): number {
  return findBundleDelimiterPositions(uint8Array).length;
}
