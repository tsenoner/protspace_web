import { describe, it, expect } from 'vitest';
import { toDisplayValue, LEGEND_VALUES } from './shapes';
import { NA_VALUE, NA_DISPLAY } from './missing-values';

describe('toDisplayValue', () => {
  it('returns NA_DISPLAY for the internal NA token', () => {
    expect(toDisplayValue(NA_VALUE)).toBe(NA_DISPLAY);
    expect(toDisplayValue('__NA__')).toBe('N/A');
  });

  it('returns the value unchanged for regular categories', () => {
    expect(toDisplayValue('Hemoglobin')).toBe('Hemoglobin');
    expect(toDisplayValue('TP53')).toBe('TP53');
  });

  it('returns "Other" unchanged when otherItemsCount is undefined or zero', () => {
    expect(toDisplayValue(LEGEND_VALUES.OTHER)).toBe('Other');
    expect(toDisplayValue(LEGEND_VALUES.OTHER, 0)).toBe('Other');
  });

  it('appends category count to "Other" when otherItemsCount is positive', () => {
    expect(toDisplayValue(LEGEND_VALUES.OTHER, 3)).toBe('Other (3 categories)');
    expect(toDisplayValue(LEGEND_VALUES.OTHER, 17)).toBe('Other (17 categories)');
  });
});
