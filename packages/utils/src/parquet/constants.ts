/**
 * Shared constants for parquetbundle file format.
 * Used by both the bundle reader (core) and bundle writer (utils).
 */

/**
 * Delimiter string used to separate parts in a parquetbundle file.
 */
export const BUNDLE_DELIMITER = '---PARQUET_DELIMITER---';

/**
 * Pre-encoded delimiter bytes for efficient binary operations.
 */
export const BUNDLE_DELIMITER_BYTES = new TextEncoder().encode(BUNDLE_DELIMITER);
