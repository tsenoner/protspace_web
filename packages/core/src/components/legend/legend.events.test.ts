import { describe, expect, it } from 'vitest';
import { createLegendErrorEventDetail } from './legend.events';

describe('legend events', () => {
  it('builds normalized legend-error details', () => {
    const originalError = new Error('Boom');

    expect(
      createLegendErrorEventDetail('Failed to process legend data', 'data-processing', {
        annotation: 'phylum',
        originalError,
      }),
    ).toEqual({
      message: 'Failed to process legend data',
      severity: 'error',
      source: 'data-processing',
      context: {
        annotation: 'phylum',
      },
      originalError,
    });
  });
});
