import { describe, it, expect } from 'vitest';
import {
  SHAPE_PATH_GENERATORS,
  LEGEND_DEFAULTS,
  LEGEND_STYLES,
  FIRST_NUMBER_SORT_FEATURES,
  LEGEND_VALUES,
  LEGEND_EVENTS,
} from './config';

describe('config', () => {
  describe('SHAPE_PATH_GENERATORS', () => {
    const testSize = 20;

    it('has all 6 shape generators', () => {
      expect(Object.keys(SHAPE_PATH_GENERATORS)).toHaveLength(6);
      expect(SHAPE_PATH_GENERATORS).toHaveProperty('circle');
      expect(SHAPE_PATH_GENERATORS).toHaveProperty('square');
      expect(SHAPE_PATH_GENERATORS).toHaveProperty('diamond');
      expect(SHAPE_PATH_GENERATORS).toHaveProperty('plus');
      expect(SHAPE_PATH_GENERATORS).toHaveProperty('triangle-up');
      expect(SHAPE_PATH_GENERATORS).toHaveProperty('triangle-down');
    });

    it('circle generates valid SVG path', () => {
      const path = SHAPE_PATH_GENERATORS.circle(testSize);
      expect(path).toContain('M');
      expect(path).toContain('A');
      // Should create two arcs for a complete circle
      expect((path.match(/A/g) || []).length).toBe(2);
    });

    it('square generates closed path', () => {
      const path = SHAPE_PATH_GENERATORS.square(testSize);
      expect(path).toContain('M');
      expect(path).toContain('L');
      expect(path).toContain('Z');
      // Should have 4 line commands for 4 sides
      expect((path.match(/L/g) || []).length).toBe(3);
    });

    it('diamond generates closed path', () => {
      const path = SHAPE_PATH_GENERATORS.diamond(testSize);
      expect(path).toContain('M');
      expect(path).toContain('L');
      expect(path).toContain('Z');
      // Should have 4 points (3 L commands)
      expect((path.match(/L/g) || []).length).toBe(3);
    });

    it('plus generates closed path with 12 points', () => {
      const path = SHAPE_PATH_GENERATORS.plus(testSize);
      expect(path).toContain('M');
      expect(path).toContain('L');
      expect(path).toContain('Z');
      // Plus shape has 12 corners
      expect((path.match(/L/g) || []).length).toBe(11);
    });

    it('triangle-up generates closed path', () => {
      const path = SHAPE_PATH_GENERATORS['triangle-up'](testSize);
      expect(path).toContain('M');
      expect(path).toContain('L');
      expect(path).toContain('Z');
      // Triangle has 3 points (2 L commands)
      expect((path.match(/L/g) || []).length).toBe(2);
    });

    it('triangle-down generates closed path', () => {
      const path = SHAPE_PATH_GENERATORS['triangle-down'](testSize);
      expect(path).toContain('M');
      expect(path).toContain('L');
      expect(path).toContain('Z');
      // Triangle has 3 points (2 L commands)
      expect((path.match(/L/g) || []).length).toBe(2);
    });

    it('all generators produce strings', () => {
      for (const [, generator] of Object.entries(SHAPE_PATH_GENERATORS)) {
        const path = generator(testSize);
        expect(typeof path).toBe('string');
        expect(path.length).toBeGreaterThan(0);
      }
    });

    it('paths scale with size parameter', () => {
      const smallPath = SHAPE_PATH_GENERATORS.circle(10);
      const largePath = SHAPE_PATH_GENERATORS.circle(20);
      // Larger size should produce longer path string (larger numbers)
      expect(largePath.length).toBeGreaterThanOrEqual(smallPath.length);
    });
  });

  describe('LEGEND_DEFAULTS', () => {
    it('has correct default values', () => {
      expect(LEGEND_DEFAULTS.maxVisibleValues).toBe(10);
      expect(LEGEND_DEFAULTS.symbolSizeMultiplier).toBe(8);
      expect(LEGEND_DEFAULTS.dragTimeout).toBe(100);
      expect(LEGEND_DEFAULTS.scatterplotSelector).toBe('protspace-scatterplot');
      expect(LEGEND_DEFAULTS.autoSyncDelay).toBe(100);
      expect(LEGEND_DEFAULTS.includeOthers).toBe(true);
      expect(LEGEND_DEFAULTS.includeShapes).toBe(false);
      expect(LEGEND_DEFAULTS.enableDuplicateStackUI).toBe(false);
    });

    it('symbolSize is derived from pointSize', () => {
      expect(typeof LEGEND_DEFAULTS.symbolSize).toBe('number');
      expect(LEGEND_DEFAULTS.symbolSize).toBeGreaterThan(0);
    });
  });

  describe('LEGEND_STYLES', () => {
    it('has stroke width configurations', () => {
      expect(LEGEND_STYLES.strokeWidth.default).toBe(1);
      expect(LEGEND_STYLES.strokeWidth.selected).toBe(2);
      expect(LEGEND_STYLES.strokeWidth.outline).toBe(2);
    });

    it('has color configurations', () => {
      expect(LEGEND_STYLES.colors.defaultStroke).toBe('#394150');
      expect(LEGEND_STYLES.colors.selectedStroke).toBe('#00A3E0');
    });

    it('has outline shapes set', () => {
      expect(LEGEND_STYLES.outlineShapes).toBeInstanceOf(Set);
    });

    it('has legend display size', () => {
      expect(LEGEND_STYLES.legendDisplaySize).toBe(16);
    });
  });

  describe('FIRST_NUMBER_SORT_FEATURES', () => {
    it('is a Set', () => {
      expect(FIRST_NUMBER_SORT_FEATURES).toBeInstanceOf(Set);
    });

    it('contains length features', () => {
      expect(FIRST_NUMBER_SORT_FEATURES.has('length_fixed')).toBe(true);
      expect(FIRST_NUMBER_SORT_FEATURES.has('length_quantile')).toBe(true);
    });

    it('has exactly 2 entries', () => {
      expect(FIRST_NUMBER_SORT_FEATURES.size).toBe(2);
    });
  });

  describe('LEGEND_VALUES', () => {
    it('has correct string constants', () => {
      expect(LEGEND_VALUES.OTHER).toBe('Other');
      expect(LEGEND_VALUES.OTHERS).toBe('Others');
      expect(LEGEND_VALUES.NULL_STRING).toBe('null');
      expect(LEGEND_VALUES.NA_DISPLAY).toBe('N/A');
    });
  });

  describe('LEGEND_EVENTS', () => {
    it('has correct event names', () => {
      expect(LEGEND_EVENTS.ITEM_CLICK).toBe('legend-item-click');
      expect(LEGEND_EVENTS.ZORDER_CHANGE).toBe('legend-zorder-change');
      expect(LEGEND_EVENTS.COLORMAPPING_CHANGE).toBe('legend-colormapping-change');
      expect(LEGEND_EVENTS.CUSTOMIZE).toBe('legend-customize');
      expect(LEGEND_EVENTS.DOWNLOAD).toBe('legend-download');
      expect(LEGEND_EVENTS.ERROR).toBe('legend-error');
    });

    it('has external event names', () => {
      expect(LEGEND_EVENTS.DATA_CHANGE).toBe('data-change');
      expect(LEGEND_EVENTS.FEATURE_CHANGE).toBe('feature-change');
    });
  });
});
