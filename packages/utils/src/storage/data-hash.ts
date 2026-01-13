/**
 * Fast hash function (djb2 variant) for generating deterministic dataset identifiers.
 * Used to scope persisted settings to specific datasets.
 */

export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

export function generateDatasetHash(proteinIds: string[]): string {
  if (!proteinIds || proteinIds.length === 0) {
    return '00000000';
  }

  // Create a deterministic string from protein IDs
  // Sort to ensure order-independent hashing (same proteins = same hash)
  const sortedIds = [...proteinIds].sort();
  const combined = sortedIds.join('\x00'); // Use null separator to avoid collisions

  const hash = djb2Hash(combined);
  return hash.toString(16).padStart(8, '0');
}
