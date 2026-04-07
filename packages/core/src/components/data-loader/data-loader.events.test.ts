import { describe, expect, it } from 'vitest';
import { createDataErrorEventDetail } from './data-loader.events';

describe('data-loader events', () => {
  it('builds normalized data-error details', () => {
    const originalError = new Error('Invalid parquet bundle');

    expect(createDataErrorEventDetail('Invalid parquet bundle', originalError)).toEqual({
      message: 'Invalid parquet bundle',
      severity: 'error',
      source: 'data-loader',
      context: {
        operation: 'load',
      },
      originalError,
    });
  });
});
