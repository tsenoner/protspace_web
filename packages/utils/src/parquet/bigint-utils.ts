/**
 * Utilities for handling BigInt values from parquet parsing.
 *
 * hyparquet returns BigInt for INT64 columns in parquet files.
 * These utilities convert BigInt to Number for JSON serialization
 * and general JavaScript compatibility.
 */

/**
 * Recursively sanitize values from parquet parsing.
 * Converts BigInt to Number since JSON.stringify cannot handle BigInt.
 *
 * @param value - The value to sanitize (can be any type including nested objects/arrays)
 * @returns The sanitized value with all BigInts converted to Numbers
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return value;
}

/**
 * JSON replacer function that converts BigInt to Number.
 * Use as the second argument to JSON.stringify().
 *
 * This is a safety net in case any BigInt values slip through to serialization.
 *
 * @example
 * JSON.stringify(data, bigIntReplacer)
 */
export function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
}
