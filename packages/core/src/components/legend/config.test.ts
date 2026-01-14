import { describe, it, expect } from 'vitest';
import {
  SHAPE_PATH_GENERATORS,
  LEGEND_VALUES,
  isNADataValue,
  isNAValue,
  toInternalValue,
  toDataValue,
  toDisplayValue,
} from './config';

describe('config', () => {
  describe('SHAPE_PATH_GENERATORS', () => {
    const testSize = 20;

    it('circle generates valid SVG arc path', () => {
      const path = SHAPE_PATH_GENERATORS.circle(testSize);
      expect(path).toContain('M');
      expect(path).toContain('A');
      // Two arcs form a complete circle
      expect((path.match(/A/g) || []).length).toBe(2);
    });

    it('square generates closed 4-sided path', () => {
      const path = SHAPE_PATH_GENERATORS.square(testSize);
      expect(path).toMatch(/^M.*L.*L.*L.*Z$/);
    });

    it('diamond generates closed 4-point path', () => {
      const path = SHAPE_PATH_GENERATORS.diamond(testSize);
      expect(path).toMatch(/^M.*L.*L.*L.*Z$/);
    });

    it('plus generates closed 12-point path', () => {
      const path = SHAPE_PATH_GENERATORS.plus(testSize);
      expect((path.match(/L/g) || []).length).toBe(11);
      expect(path).toContain('Z');
    });

    it('triangle-up generates closed 3-point path', () => {
      const path = SHAPE_PATH_GENERATORS['triangle-up'](testSize);
      expect((path.match(/L/g) || []).length).toBe(2);
      expect(path).toContain('Z');
    });

    it('triangle-down generates closed 3-point path', () => {
      const path = SHAPE_PATH_GENERATORS['triangle-down'](testSize);
      expect((path.match(/L/g) || []).length).toBe(2);
      expect(path).toContain('Z');
    });

    it('paths scale with size parameter', () => {
      const smallPath = SHAPE_PATH_GENERATORS.circle(10);
      const largePath = SHAPE_PATH_GENERATORS.circle(20);
      expect(largePath.length).toBeGreaterThanOrEqual(smallPath.length);
    });
  });

  describe('isNADataValue', () => {
    it('returns true for null', () => {
      expect(isNADataValue(null)).toBe(true);
    });

    it('returns true for undefined', () => {
      expect(isNADataValue(undefined)).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(isNADataValue('')).toBe(true);
    });

    it('returns true for whitespace-only string', () => {
      expect(isNADataValue('   ')).toBe(true);
      expect(isNADataValue('\t')).toBe(true);
      expect(isNADataValue('\n')).toBe(true);
    });

    it('returns false for non-empty strings', () => {
      expect(isNADataValue('value')).toBe(false);
      expect(isNADataValue('0')).toBe(false);
      expect(isNADataValue('false')).toBe(false);
    });

    it('returns false for __NA__ (internal value)', () => {
      expect(isNADataValue(LEGEND_VALUES.NA_VALUE)).toBe(false);
    });
  });

  describe('isNAValue', () => {
    it('returns true for __NA__', () => {
      expect(isNAValue(LEGEND_VALUES.NA_VALUE)).toBe(true);
    });

    it('returns false for other values', () => {
      expect(isNAValue('')).toBe(false);
      expect(isNAValue('null')).toBe(false);
      expect(isNAValue('N/A')).toBe(false);
      expect(isNAValue('value')).toBe(false);
    });
  });

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

    it('converts whitespace-only string to __NA__', () => {
      expect(toInternalValue('   ')).toBe(LEGEND_VALUES.NA_VALUE);
    });

    it('preserves non-empty strings', () => {
      expect(toInternalValue('value')).toBe('value');
      expect(toInternalValue('Other')).toBe('Other');
    });

    it('preserves __NA__ without double-conversion', () => {
      expect(toInternalValue(LEGEND_VALUES.NA_VALUE)).toBe(LEGEND_VALUES.NA_VALUE);
    });
  });

  describe('toDataValue', () => {
    it('converts __NA__ to null', () => {
      expect(toDataValue(LEGEND_VALUES.NA_VALUE)).toBe(null);
    });

    it('preserves other values', () => {
      expect(toDataValue('value')).toBe('value');
      expect(toDataValue('Other')).toBe('Other');
      expect(toDataValue('')).toBe('');
    });
  });

  describe('toDisplayValue', () => {
    it('converts __NA__ to N/A display text', () => {
      expect(toDisplayValue(LEGEND_VALUES.NA_VALUE)).toBe(LEGEND_VALUES.NA_DISPLAY);
      expect(toDisplayValue(LEGEND_VALUES.NA_VALUE)).toBe('N/A');
    });

    it('preserves other values', () => {
      expect(toDisplayValue('value')).toBe('value');
      expect(toDisplayValue('Other')).toBe('Other');
      expect(toDisplayValue('')).toBe('');
    });
  });
});
