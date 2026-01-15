import { describe, it, expect } from 'vitest';
import type { StyleConfig } from './style-getters';
import { createStyleGetters } from './style-getters';
import type { VisualizationData, PlotDataPoint } from '@protspace/utils';

/**
 * Tests for style-getters.ts focusing on N/A value handling.
 *
 * The legend uses '__NA__' internally to represent N/A values (null, empty string, whitespace).
 * These tests ensure the scatterplot's style getters correctly handle this convention.
 */

describe('style-getters', () => {
  describe('N/A value handling', () => {
    const createMockData = (annotationValues: (string | null)[]): VisualizationData => ({
      protein_ids: annotationValues.map((_, i) => `protein_${i}`),
      projections: [{ name: 'test', data: annotationValues.map(() => [0, 0, 0]) }],
      annotations: {
        test_annotation: {
          values: annotationValues,
          colors: annotationValues.map(() => '#ff0000'),
          shapes: annotationValues.map(() => 'circle'),
        },
      },
      annotation_data: {
        test_annotation: annotationValues.map((v) => [annotationValues.indexOf(v)]),
      },
    });

    const createMockPoint = (annotationValue: string | null): PlotDataPoint => ({
      id: 'test_protein',
      x: 0,
      y: 0,
      z: 0,
      originalIndex: 0,
      annotationValues: {
        test_annotation: annotationValue === null ? [null as unknown as string] : [annotationValue],
      },
    });

    const createDefaultStyleConfig = (overrides: Partial<StyleConfig> = {}): StyleConfig => ({
      selectedProteinIds: [],
      highlightedProteinIds: [],
      selectedAnnotation: 'test_annotation',
      hiddenAnnotationValues: [],
      otherAnnotationValues: [],
      useShapes: false,
      zOrderMapping: null,
      colorMapping: null,
      shapeMapping: null,
      sizes: { base: 10 },
      opacities: { base: 1, selected: 1, faded: 0.3 },
      ...overrides,
    });

    describe('getOpacity with hidden N/A values', () => {
      it('should hide points with null annotation values when __NA__ is hidden', () => {
        const data = createMockData([null, 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenAnnotationValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const nullPoint = createMockPoint(null);

        expect(getters.getOpacity(nullPoint)).toBe(0);
      });

      it('should hide points with empty string annotation values when __NA__ is hidden', () => {
        const data = createMockData(['', 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenAnnotationValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const emptyStringPoint = createMockPoint('');

        expect(getters.getOpacity(emptyStringPoint)).toBe(0);
      });

      it('should hide points with whitespace-only annotation values when __NA__ is hidden', () => {
        const data = createMockData(['   ', 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenAnnotationValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const whitespacePoint = createMockPoint('   ');

        expect(getters.getOpacity(whitespacePoint)).toBe(0);
      });

      it('should NOT hide non-N/A points when __NA__ is hidden', () => {
        const data = createMockData([null, 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenAnnotationValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const regularPoint = createMockPoint('value1');

        expect(getters.getOpacity(regularPoint)).toBe(1);
      });

      it('should show N/A points when __NA__ is NOT hidden', () => {
        const data = createMockData([null, 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenAnnotationValues: [],
        });

        const getters = createStyleGetters(data, config);
        const nullPoint = createMockPoint(null);

        expect(getters.getOpacity(nullPoint)).toBe(1);
      });
    });

    describe('getColors with N/A color mapping', () => {
      it('should use color from colorMapping for null annotation values', () => {
        const data = createMockData([null, 'value1']);
        const config = createDefaultStyleConfig({
          colorMapping: {
            __NA__: '#dddddd',
            value1: '#ff0000',
          },
        });

        const getters = createStyleGetters(data, config);
        const nullPoint = createMockPoint(null);

        expect(getters.getColors(nullPoint)).toEqual(['#dddddd']);
      });

      it('should use color from colorMapping for empty string annotation values', () => {
        const data = createMockData(['', 'value1']);
        const config = createDefaultStyleConfig({
          colorMapping: {
            __NA__: '#dddddd',
            value1: '#ff0000',
          },
        });

        const getters = createStyleGetters(data, config);
        const emptyStringPoint = createMockPoint('');

        expect(getters.getColors(emptyStringPoint)).toEqual(['#dddddd']);
      });
    });

    describe('getDepth with N/A z-order mapping', () => {
      it('should use z-order from zOrderMapping for null annotation values', () => {
        const data = createMockData([null, 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          zOrderMapping: {
            __NA__: 0,
            value1: 1,
            value2: 2,
          },
        });

        const getters = createStyleGetters(data, config);
        const nullPoint = createMockPoint(null);
        const value1Point = createMockPoint('value1');

        // Lower z-order (0) should result in smaller depth value (rendered on top)
        const nullDepth = getters.getDepth(nullPoint);
        const value1Depth = getters.getDepth(value1Point);

        expect(nullDepth).toBeLessThan(value1Depth);
      });

      it('should use z-order from zOrderMapping for empty string annotation values', () => {
        const data = createMockData(['', 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          zOrderMapping: {
            __NA__: 0,
            value1: 1,
            value2: 2,
          },
        });

        const getters = createStyleGetters(data, config);
        const emptyStringPoint = createMockPoint('');
        const value2Point = createMockPoint('value2');

        const emptyDepth = getters.getDepth(emptyStringPoint);
        const value2Depth = getters.getDepth(value2Point);

        expect(emptyDepth).toBeLessThan(value2Depth);
      });
    });

    describe('normalizeToKey behavior', () => {
      it('should treat __NA__ string as-is (not double-convert)', () => {
        // If someone explicitly uses '__NA__' as a value, it should work correctly
        const data = createMockData(['__NA__', 'value1']);
        const config = createDefaultStyleConfig({
          hiddenAnnotationValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const naStringPoint = createMockPoint('__NA__');

        // __NA__ string should be hidden when __NA__ is in hiddenAnnotationValues
        expect(getters.getOpacity(naStringPoint)).toBe(0);
      });
    });
  });

  describe('z-order change consistency', () => {
    const createMockData = (annotationValues: string[]): VisualizationData => ({
      protein_ids: annotationValues.map((_, i) => `protein_${i}`),
      projections: [{ name: 'test', data: annotationValues.map(() => [0, 0, 0]) }],
      annotations: {
        test_annotation: {
          values: annotationValues,
          colors: annotationValues.map(() => '#ff0000'),
          shapes: annotationValues.map(() => 'circle'),
        },
      },
      annotation_data: {
        test_annotation: annotationValues.map((v) => [annotationValues.indexOf(v)]),
      },
    });

    const createMockPoint = (annotationValue: string): PlotDataPoint => ({
      id: 'test_protein',
      x: 0,
      y: 0,
      z: 0,
      originalIndex: 0,
      annotationValues: {
        test_annotation: [annotationValue],
      },
    });

    const createDefaultStyleConfig = (overrides: Partial<StyleConfig> = {}): StyleConfig => ({
      selectedProteinIds: [],
      highlightedProteinIds: [],
      selectedAnnotation: 'test_annotation',
      hiddenAnnotationValues: [],
      otherAnnotationValues: [],
      useShapes: false,
      zOrderMapping: null,
      colorMapping: null,
      shapeMapping: null,
      sizes: { base: 10 },
      opacities: { base: 1, selected: 1, faded: 0.3 },
      ...overrides,
    });

    it('should produce different depth values when zOrderMapping changes', () => {
      const data = createMockData(['categoryA', 'categoryB', 'categoryC']);
      const pointA = createMockPoint('categoryA');
      const pointB = createMockPoint('categoryB');
      const pointC = createMockPoint('categoryC');

      // First z-order: A=0, B=1, C=2
      const config1 = createDefaultStyleConfig({
        zOrderMapping: {
          categoryA: 0,
          categoryB: 1,
          categoryC: 2,
        },
      });
      const getters1 = createStyleGetters(data, config1);
      const depthA1 = getters1.getDepth(pointA);
      const depthB1 = getters1.getDepth(pointB);
      const depthC1 = getters1.getDepth(pointC);

      // Second z-order: reversed - A=2, B=1, C=0
      const config2 = createDefaultStyleConfig({
        zOrderMapping: {
          categoryA: 2,
          categoryB: 1,
          categoryC: 0,
        },
      });
      const getters2 = createStyleGetters(data, config2);
      const depthA2 = getters2.getDepth(pointA);
      const depthB2 = getters2.getDepth(pointB);
      const depthC2 = getters2.getDepth(pointC);

      // Depths should change when z-order changes
      expect(depthA1).not.toEqual(depthA2);
      expect(depthC1).not.toEqual(depthC2);

      // In config1: A should have smallest depth (top), C largest (bottom)
      expect(depthA1).toBeLessThan(depthB1);
      expect(depthB1).toBeLessThan(depthC1);

      // In config2: C should have smallest depth (top), A largest (bottom)
      expect(depthC2).toBeLessThan(depthB2);
      expect(depthB2).toBeLessThan(depthA2);
    });

    it('should produce consistent depth values for the same configuration', () => {
      const data = createMockData(['categoryA', 'categoryB', 'categoryC']);
      const point = createMockPoint('categoryA');

      const config = createDefaultStyleConfig({
        zOrderMapping: {
          categoryA: 0,
          categoryB: 1,
          categoryC: 2,
        },
      });

      // Create style getters multiple times with same config
      const getters1 = createStyleGetters(data, config);
      const getters2 = createStyleGetters(data, config);
      const getters3 = createStyleGetters(data, config);

      // All should produce identical depth values
      expect(getters1.getDepth(point)).toBe(getters2.getDepth(point));
      expect(getters2.getDepth(point)).toBe(getters3.getDepth(point));
    });

    it('should maintain z-order ordering across all points', () => {
      const data = createMockData(['categoryA', 'categoryB', 'categoryC']);
      const pointA = createMockPoint('categoryA');
      const pointB = createMockPoint('categoryB');
      const pointC = createMockPoint('categoryC');

      const config = createDefaultStyleConfig({
        zOrderMapping: {
          categoryA: 0, // front (smallest depth)
          categoryB: 1, // middle
          categoryC: 2, // back (largest depth)
        },
      });

      const getters = createStyleGetters(data, config);

      // Lower z-order = smaller depth = rendered on top (WebGL LESS depth test)
      const depthA = getters.getDepth(pointA);
      const depthB = getters.getDepth(pointB);
      const depthC = getters.getDepth(pointC);

      // Strict ordering should be maintained
      expect(depthA).toBeLessThan(depthB);
      expect(depthB).toBeLessThan(depthC);
    });

    it('should handle null zOrderMapping gracefully', () => {
      const data = createMockData(['categoryA', 'categoryB']);
      const pointA = createMockPoint('categoryA');
      const pointB = createMockPoint('categoryB');

      const config = createDefaultStyleConfig({
        zOrderMapping: null,
      });

      const getters = createStyleGetters(data, config);

      // Without z-order mapping, depth should still be computable (based on opacity)
      const depthA = getters.getDepth(pointA);
      const depthB = getters.getDepth(pointB);

      // Both should have the same depth (only opacity matters, which is the same)
      expect(depthA).toBe(depthB);
      expect(depthA).toBeGreaterThanOrEqual(0);
      expect(depthA).toBeLessThanOrEqual(1);
    });
  });
});
