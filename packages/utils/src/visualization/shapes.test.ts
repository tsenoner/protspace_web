import { describe, it, expect } from 'vitest';
import { toInternalValue, LEGEND_VALUES } from './shapes';

describe('toInternalValue', () => {
  it('converts null to __NA__', () => {
    expect(toInternalValue(null)).toBe(LEGEND_VALUES.NA_VALUE);
  });

  it('converts undefined to __NA__', () => {
    expect(toInternalValue(undefined)).toBe(LEGEND_VALUES.NA_VALUE);
  });

  it('converts empty string to __NA__', () => {
    expect(toInternalValue('')).toBe(LEGEND_VALUES.NA_VALUE);
  });

  it('converts whitespace-only strings to __NA__', () => {
    expect(toInternalValue('   ')).toBe(LEGEND_VALUES.NA_VALUE);
    expect(toInternalValue('\t')).toBe(LEGEND_VALUES.NA_VALUE);
    expect(toInternalValue('\n')).toBe(LEGEND_VALUES.NA_VALUE);
  });

  it('preserves regular string values', () => {
    expect(toInternalValue('human')).toBe('human');
    expect(toInternalValue('Other')).toBe('Other');
    expect(toInternalValue('0')).toBe('0');
  });

  it('preserves __NA__ without double-conversion', () => {
    expect(toInternalValue(LEGEND_VALUES.NA_VALUE)).toBe(LEGEND_VALUES.NA_VALUE);
  });

  it('stringifies non-string values', () => {
    expect(toInternalValue(42)).toBe('42');
    expect(toInternalValue(true)).toBe('true');
  });
});
