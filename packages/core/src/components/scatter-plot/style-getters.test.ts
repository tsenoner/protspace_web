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
    const createMockData = (featureValues: (string | null)[]): VisualizationData => ({
      protein_ids: featureValues.map((_, i) => `protein_${i}`),
      projections: [{ name: 'test', coordinates: featureValues.map(() => [0, 0, 0]) }],
      features: {
        test_feature: {
          values: featureValues,
          colors: featureValues.map(() => '#ff0000'),
        },
      },
      feature_data: {
        test_feature: featureValues.map((v) => [featureValues.indexOf(v)]),
      },
    });

    const createMockPoint = (featureValue: string | null): PlotDataPoint => ({
      id: 'test_protein',
      x: 0,
      y: 0,
      z: 0,
      featureValues: {
        test_feature: featureValue === null ? [null as unknown as string] : [featureValue],
      },
    });

    const createDefaultStyleConfig = (overrides: Partial<StyleConfig> = {}): StyleConfig => ({
      selectedProteinIds: [],
      highlightedProteinIds: [],
      selectedFeature: 'test_feature',
      hiddenFeatureValues: [],
      otherFeatureValues: [],
      useShapes: false,
      zOrderMapping: null,
      colorMapping: null,
      shapeMapping: null,
      sizes: { base: 10 },
      opacities: { base: 1, selected: 1, faded: 0.3 },
      ...overrides,
    });

    describe('getOpacity with hidden N/A values', () => {
      it('should hide points with null feature values when __NA__ is hidden', () => {
        const data = createMockData([null, 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenFeatureValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const nullPoint = createMockPoint(null);

        expect(getters.getOpacity(nullPoint)).toBe(0);
      });

      it('should hide points with empty string feature values when __NA__ is hidden', () => {
        const data = createMockData(['', 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenFeatureValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const emptyStringPoint = createMockPoint('');

        expect(getters.getOpacity(emptyStringPoint)).toBe(0);
      });

      it('should hide points with whitespace-only feature values when __NA__ is hidden', () => {
        const data = createMockData(['   ', 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenFeatureValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const whitespacePoint = createMockPoint('   ');

        expect(getters.getOpacity(whitespacePoint)).toBe(0);
      });

      it('should NOT hide non-N/A points when __NA__ is hidden', () => {
        const data = createMockData([null, 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenFeatureValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const regularPoint = createMockPoint('value1');

        expect(getters.getOpacity(regularPoint)).toBe(1);
      });

      it('should show N/A points when __NA__ is NOT hidden', () => {
        const data = createMockData([null, 'value1', 'value2']);
        const config = createDefaultStyleConfig({
          hiddenFeatureValues: [],
        });

        const getters = createStyleGetters(data, config);
        const nullPoint = createMockPoint(null);

        expect(getters.getOpacity(nullPoint)).toBe(1);
      });
    });

    describe('getColors with N/A color mapping', () => {
      it('should use color from colorMapping for null feature values', () => {
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

      it('should use color from colorMapping for empty string feature values', () => {
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
      it('should use z-order from zOrderMapping for null feature values', () => {
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

      it('should use z-order from zOrderMapping for empty string feature values', () => {
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
          hiddenFeatureValues: ['__NA__'],
        });

        const getters = createStyleGetters(data, config);
        const naStringPoint = createMockPoint('__NA__');

        // __NA__ string should be hidden when __NA__ is in hiddenFeatureValues
        expect(getters.getOpacity(naStringPoint)).toBe(0);
      });
    });
  });
});
