import type { Rows } from './types';
import { sanitizeForMessage } from '@protspace/utils';

// Parquet magic bytes 'PAR1'
const PARQUET_MAGIC = new Uint8Array([0x50, 0x41, 0x52, 0x31]);

// Safety limits to avoid abusive inputs
const MAX_FILE_SIZE_BYTES_DEFAULT = 500 * 1024 * 1024; // 500MB
const MAX_ROWS_DEFAULT = 2_000_000;
const MAX_COLUMNS_DEFAULT = 200;
const MAX_TOTAL_CELLS_DEFAULT = 1_000_000_000;
const MAX_CELL_STRING_LENGTH_DEFAULT = 1024;

export function assertValidParquetMagic(buffer: ArrayBuffer): void {
  const u8 = new Uint8Array(buffer);
  if (u8.length < 12) {
    throw new Error('Invalid Parquet file: too small');
  }
  const head = u8.subarray(0, 4);
  const tail = u8.subarray(u8.length - 4);
  for (let i = 0; i < 4; i++) {
    if (head[i] !== PARQUET_MAGIC[i] || tail[i] !== PARQUET_MAGIC[i]) {
      throw new Error('Invalid Parquet file: magic bytes not found');
    }
  }
}

export function assertWithinFileSizeLimit(
  sizeBytes: number,
  maxSizeBytes = MAX_FILE_SIZE_BYTES_DEFAULT,
): void {
  if (sizeBytes > maxSizeBytes) {
    throw new Error(`File too large: ${(sizeBytes / (1024 * 1024)).toFixed(2)}MB exceeds limit`);
  }
}

export function validateRowsBasic(
  rows: unknown,
  {
    maxRows = MAX_ROWS_DEFAULT,
    maxColumns = MAX_COLUMNS_DEFAULT,
    maxTotalCells = MAX_TOTAL_CELLS_DEFAULT,
    maxCellStringLength = MAX_CELL_STRING_LENGTH_DEFAULT,
  }: {
    maxRows?: number;
    maxColumns?: number;
    maxTotalCells?: number;
    maxCellStringLength?: number;
  } = {},
): asserts rows is Rows {
  if (!Array.isArray(rows)) {
    throw new Error('Parsed data is not an array of rows');
  }
  if (rows.length === 0) {
    throw new Error('No data rows found in file');
  }
  if (rows.length > maxRows) {
    throw new Error(`Too many rows: ${rows.length} exceeds limit`);
  }
  const first = rows[0];
  if (typeof first !== 'object' || first == null) {
    throw new Error('Rows must be objects');
  }
  const columnNames = Object.keys(first as Record<string, unknown>);
  if (columnNames.length === 0) {
    throw new Error('No columns found in data');
  }
  if (columnNames.length > maxColumns) {
    throw new Error(`Too many columns: ${columnNames.length} exceeds limit`);
  }
  const totalCells = rows.length * columnNames.length;
  if (totalCells > maxTotalCells) {
    throw new Error(`Dataset too large: ${totalCells} cells exceeds limit`);
  }
  // Scan a small sample for dangerous content and overlong strings
  const sampleSize = Math.min(1000, rows.length);
  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i] as Record<string, unknown>;
    for (const key of columnNames) {
      const val = row[key];
      const safeKey = sanitizeForMessage(key);
      if (typeof val === 'string') {
        if (val.length > maxCellStringLength) {
          throw new Error(`Cell string too long in column '${safeKey}'`);
        }
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(val)) {
          throw new Error(`Control characters detected in column '${safeKey}'`);
        }
      }
    }
  }
}

export function validateMergedBundleRows(rows: Rows): void {
  validateRowsBasic(rows);
  const columnNames = Object.keys(rows[0]);
  const numericLikeColumns = columnNames.filter((name) => /^[+-]?\d+(?:\.\d+)?$/.test(name));
  if (numericLikeColumns.length > 0) {
    const sampleList = sanitizeForMessage(numericLikeColumns.slice(0, 5).join(', '));
    throw new Error(
      `Invalid bundle: numeric-looking column names detected (${sampleList}). Expected named columns like 'projection_name', 'x', 'y'`,
    );
  }
  // Guard: empty column names are not allowed
  for (const name of columnNames) {
    if (name.trim().length === 0) {
      throw new Error('Invalid bundle: empty column name found');
    }
  }
  const hasX = columnNames.includes('x');
  const hasY = columnNames.includes('y');
  const hasProjectionName = columnNames.includes('projection_name');
  if (!hasX || !hasY || !hasProjectionName) {
    throw new Error("Invalid bundle: expected columns 'projection_name', 'x', 'y'");
  }
  // Check numeric sanity for coordinates on a sample
  const sampleSize = Math.min(1000, rows.length);
  for (let i = 0; i < sampleSize; i++) {
    const r = rows[i] as Record<string, unknown>;
    const x = Number(r['x']);
    const y = Number(r['y']);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Invalid coordinates detected in bundle data');
    }
  }
}
