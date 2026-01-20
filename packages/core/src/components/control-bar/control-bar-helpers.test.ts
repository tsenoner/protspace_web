import { describe, it, expect } from 'vitest';
import {
  EXPORT_DEFAULTS,
  calculateHeightFromWidth,
  calculateWidthFromHeight,
  isProjection3D,
  getProjectionPlane,
  getActiveFilters,
  doesProteinMatchFilters,
  applyFiltersToData,
  createCustomAnnotation,
  shouldDisableSelection,
  getSelectionDisabledMessage,
  areFilterConfigsEqual,
  initializeFilterConfig,
  toggleProteinSelection,
  mergeProteinSelections,
  validateAnnotationValues,
  type FilterConfig,
  type ActiveFilter,
} from './control-bar-helpers';
import type { ProtspaceData } from './types';

describe('control-bar-helpers', () => {
  describe('EXPORT_DEFAULTS', () => {
    it('has correct default values', () => {
      expect(EXPORT_DEFAULTS.FORMAT).toBe('png');
      expect(EXPORT_DEFAULTS.IMAGE_WIDTH).toBe(2048);
      expect(EXPORT_DEFAULTS.IMAGE_HEIGHT).toBe(1024);
      expect(EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT).toBe(25);
      expect(EXPORT_DEFAULTS.LEGEND_FONT_SIZE_PX).toBe(24);
      expect(EXPORT_DEFAULTS.BASE_FONT_SIZE).toBe(24);
      expect(EXPORT_DEFAULTS.MIN_LEGEND_FONT_SIZE_PX).toBe(8);
      expect(EXPORT_DEFAULTS.MAX_LEGEND_FONT_SIZE_PX).toBe(120);
      expect(EXPORT_DEFAULTS.LOCK_ASPECT_RATIO).toBe(true);
    });

    it('is defined and not undefined', () => {
      expect(EXPORT_DEFAULTS).toBeDefined();
      expect(typeof EXPORT_DEFAULTS).toBe('object');
    });

    it('has all required keys', () => {
      const requiredKeys = [
        'FORMAT',
        'IMAGE_WIDTH',
        'IMAGE_HEIGHT',
        'LEGEND_WIDTH_PERCENT',
        'LEGEND_FONT_SIZE_PX',
        'BASE_FONT_SIZE',
        'MIN_LEGEND_FONT_SIZE_PX',
        'MAX_LEGEND_FONT_SIZE_PX',
        'LOCK_ASPECT_RATIO',
      ];

      requiredKeys.forEach((key) => {
        expect(EXPORT_DEFAULTS).toHaveProperty(key);
      });
    });

    it('has valid numeric ranges', () => {
      expect(EXPORT_DEFAULTS.IMAGE_WIDTH).toBeGreaterThan(0);
      expect(EXPORT_DEFAULTS.IMAGE_HEIGHT).toBeGreaterThan(0);
      expect(EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT).toBeGreaterThan(0);
      expect(EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT).toBeLessThanOrEqual(100);
      expect(EXPORT_DEFAULTS.MIN_LEGEND_FONT_SIZE_PX).toBeLessThan(
        EXPORT_DEFAULTS.MAX_LEGEND_FONT_SIZE_PX,
      );
    });

    describe('export dimension calculations', () => {
      it('calculates correct legend percentage', () => {
        const legendPercent = EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT / 100;
        expect(legendPercent).toBe(0.25);
      });

      it('calculates correct target width for scatterplot', () => {
        const legendPercent = EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT / 100;
        const targetWidth = Math.round(EXPORT_DEFAULTS.IMAGE_WIDTH * (1 - legendPercent));
        expect(targetWidth).toBe(1536); // 2048 * 0.75 = 1536
      });

      it('calculates correct legend scale factor', () => {
        const scaleFactor = EXPORT_DEFAULTS.LEGEND_FONT_SIZE_PX / EXPORT_DEFAULTS.BASE_FONT_SIZE;
        expect(scaleFactor).toBe(1.0); // 24 / 24 = 1.0
      });

      it('calculates scale factor for minimum font size', () => {
        const scaleFactor =
          EXPORT_DEFAULTS.MIN_LEGEND_FONT_SIZE_PX / EXPORT_DEFAULTS.BASE_FONT_SIZE;
        expect(scaleFactor).toBeCloseTo(0.333, 2); // 8 / 24 ≈ 0.333
      });

      it('calculates scale factor for maximum font size', () => {
        const scaleFactor =
          EXPORT_DEFAULTS.MAX_LEGEND_FONT_SIZE_PX / EXPORT_DEFAULTS.BASE_FONT_SIZE;
        expect(scaleFactor).toBe(5.0); // 120 / 24 = 5.0
      });
    });

    describe('aspect ratio calculations with defaults', () => {
      it('calculates default aspect ratio', () => {
        const aspectRatio = EXPORT_DEFAULTS.IMAGE_WIDTH / EXPORT_DEFAULTS.IMAGE_HEIGHT;
        expect(aspectRatio).toBe(2); // 2048 / 1024 = 2
      });

      it('maintains aspect ratio when doubling width', () => {
        const newWidth = EXPORT_DEFAULTS.IMAGE_WIDTH * 2;
        const newHeight = calculateHeightFromWidth(
          newWidth,
          EXPORT_DEFAULTS.IMAGE_WIDTH,
          EXPORT_DEFAULTS.IMAGE_HEIGHT,
        );
        expect(newHeight).toBe(2048); // 1024 * 2
      });

      it('maintains aspect ratio when doubling height', () => {
        const newHeight = EXPORT_DEFAULTS.IMAGE_HEIGHT * 2;
        const newWidth = calculateWidthFromHeight(
          newHeight,
          EXPORT_DEFAULTS.IMAGE_HEIGHT,
          EXPORT_DEFAULTS.IMAGE_WIDTH,
        );
        expect(newWidth).toBe(4096); // 2048 * 2
      });
    });
  });

  describe('calculateHeightFromWidth', () => {
    it('calculates height proportionally when width changes', () => {
      const result = calculateHeightFromWidth(4096, 2048, 1024);
      expect(result).toBe(2048); // doubled width, doubled height
    });

    it('rounds to nearest integer', () => {
      const result = calculateHeightFromWidth(2049, 2048, 1024);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('returns current height when old width is 0', () => {
      const result = calculateHeightFromWidth(2048, 0, 1024);
      expect(result).toBe(1024);
    });

    it('returns current height when old width is negative', () => {
      const result = calculateHeightFromWidth(2048, -100, 1024);
      expect(result).toBe(1024);
    });

    it('handles width reduction', () => {
      const result = calculateHeightFromWidth(1024, 2048, 1024);
      expect(result).toBe(512); // halved width, halved height
    });

    it('handles fractional scaling', () => {
      const result = calculateHeightFromWidth(3000, 2000, 1000);
      expect(result).toBe(1500); // 1.5x width, 1.5x height
    });
  });

  describe('calculateWidthFromHeight', () => {
    it('calculates width proportionally when height changes', () => {
      const result = calculateWidthFromHeight(2048, 1024, 2048);
      expect(result).toBe(4096); // doubled height, doubled width
    });

    it('rounds to nearest integer', () => {
      const result = calculateWidthFromHeight(1025, 1024, 2048);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('returns current width when old height is 0', () => {
      const result = calculateWidthFromHeight(1024, 0, 2048);
      expect(result).toBe(2048);
    });

    it('returns current width when old height is negative', () => {
      const result = calculateWidthFromHeight(1024, -100, 2048);
      expect(result).toBe(2048);
    });

    it('handles height reduction', () => {
      const result = calculateWidthFromHeight(512, 1024, 2048);
      expect(result).toBe(1024); // halved height, halved width
    });
  });

  describe('isProjection3D', () => {
    const projectionsMeta = [
      { name: 'projection2D', metadata: { dimension: 2 as const } },
      { name: 'projection3D', metadata: { dimension: 3 as const } },
      { name: 'projectionNoMeta' },
    ];

    it('returns true for 3D projection', () => {
      expect(isProjection3D('projection3D', projectionsMeta)).toBe(true);
    });

    it('returns false for 2D projection', () => {
      expect(isProjection3D('projection2D', projectionsMeta)).toBe(false);
    });

    it('returns false for projection without metadata', () => {
      expect(isProjection3D('projectionNoMeta', projectionsMeta)).toBe(false);
    });

    it('returns false for non-existent projection', () => {
      expect(isProjection3D('nonExistent', projectionsMeta)).toBe(false);
    });

    it('returns false for empty projections array', () => {
      expect(isProjection3D('projection3D', [])).toBe(false);
    });
  });

  describe('getProjectionPlane', () => {
    it('returns current plane for 3D projection', () => {
      expect(getProjectionPlane(true, 'xz')).toBe('xz');
      expect(getProjectionPlane(true, 'yz')).toBe('yz');
      expect(getProjectionPlane(true, 'xy')).toBe('xy');
    });

    it('returns xy for 2D projection regardless of current plane', () => {
      expect(getProjectionPlane(false, 'xz')).toBe('xy');
      expect(getProjectionPlane(false, 'yz')).toBe('xy');
      expect(getProjectionPlane(false, 'xy')).toBe('xy');
    });
  });

  describe('getActiveFilters', () => {
    it('returns only enabled filters with values', () => {
      const config: Record<string, FilterConfig> = {
        annotation1: { enabled: true, values: ['a', 'b'] },
        annotation2: { enabled: false, values: ['c'] },
        annotation3: { enabled: true, values: [] },
        annotation4: { enabled: true, values: ['d'] },
      };

      const result = getActiveFilters(config);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ annotation: 'annotation1', values: ['a', 'b'] });
      expect(result).toContainEqual({ annotation: 'annotation4', values: ['d'] });
    });

    it('returns empty array when no filters are enabled', () => {
      const config: Record<string, FilterConfig> = {
        annotation1: { enabled: false, values: ['a'] },
        annotation2: { enabled: false, values: ['b'] },
      };

      expect(getActiveFilters(config)).toEqual([]);
    });

    it('returns empty array for empty config', () => {
      expect(getActiveFilters({})).toEqual([]);
    });

    it('handles null values in filter values', () => {
      const config: Record<string, FilterConfig> = {
        annotation1: { enabled: true, values: ['a', null, 'b'] },
      };

      const result = getActiveFilters(config);
      expect(result).toHaveLength(1);
      expect(result[0].values).toEqual(['a', null, 'b']);
    });
  });

  describe('doesProteinMatchFilters', () => {
    const data: ProtspaceData = {
      protein_ids: ['P1', 'P2', 'P3'],
      annotations: {
        species: { values: ['human', 'mouse', 'rat'] },
        gene: { values: ['geneA', 'geneB', 'geneC'] },
      },
      annotation_data: {
        species: [0, 1, 2], // P1=human, P2=mouse, P3=rat
        gene: [0, 1, 2], // P1=geneA, P2=geneB, P3=geneC
      },
    };

    it('returns true when protein matches single filter', () => {
      const filters: ActiveFilter[] = [{ annotation: 'species', values: ['human'] }];
      expect(doesProteinMatchFilters(0, filters, data)).toBe(true);
    });

    it('returns false when protein does not match filter', () => {
      const filters: ActiveFilter[] = [{ annotation: 'species', values: ['mouse'] }];
      expect(doesProteinMatchFilters(0, filters, data)).toBe(false);
    });

    it('returns true when protein matches all filters (AND logic)', () => {
      const filters: ActiveFilter[] = [
        { annotation: 'species', values: ['human'] },
        { annotation: 'gene', values: ['geneA'] },
      ];
      expect(doesProteinMatchFilters(0, filters, data)).toBe(true);
    });

    it('returns false when protein matches some but not all filters', () => {
      const filters: ActiveFilter[] = [
        { annotation: 'species', values: ['human'] },
        { annotation: 'gene', values: ['geneB'] },
      ];
      expect(doesProteinMatchFilters(0, filters, data)).toBe(false);
    });

    it('returns true when protein value is in allowed values list', () => {
      const filters: ActiveFilter[] = [{ annotation: 'species', values: ['human', 'mouse'] }];
      expect(doesProteinMatchFilters(0, filters, data)).toBe(true);
      expect(doesProteinMatchFilters(1, filters, data)).toBe(true);
      expect(doesProteinMatchFilters(2, filters, data)).toBe(false);
    });

    it('returns false when annotation data is missing', () => {
      const filters: ActiveFilter[] = [{ annotation: 'missing', values: ['value'] }];
      expect(doesProteinMatchFilters(0, filters, data)).toBe(false);
    });

    it('handles null annotation values', () => {
      const dataWithNull: ProtspaceData = {
        ...data,
        annotations: {
          ...data.annotations,
          status: { values: ['active', null, 'inactive'] },
        },
        annotation_data: {
          ...data.annotation_data,
          status: [1, 1, 2], // P1=null, P2=null, P3=inactive
        },
      };

      const filters: ActiveFilter[] = [{ annotation: 'status', values: [null] }];
      expect(doesProteinMatchFilters(0, filters, dataWithNull)).toBe(true);
    });

    it('handles 2D annotation data array', () => {
      const dataWith2D: ProtspaceData = {
        ...data,
        annotation_data: {
          species: [[0], [1], [2]], // 2D array format
          gene: [0, 1, 2],
        },
      };

      const filters: ActiveFilter[] = [{ annotation: 'species', values: ['human'] }];
      expect(doesProteinMatchFilters(0, filters, dataWith2D)).toBe(true);
    });
  });

  describe('applyFiltersToData', () => {
    const data: ProtspaceData = {
      protein_ids: ['P1', 'P2', 'P3', 'P4'],
      annotations: {
        species: { values: ['human', 'mouse', 'rat', 'dog'] },
      },
      annotation_data: {
        species: [0, 1, 0, 2], // P1=human, P2=mouse, P3=human, P4=rat
      },
    };

    it('applies single filter correctly', () => {
      const filters: ActiveFilter[] = [{ annotation: 'species', values: ['human'] }];
      const result = applyFiltersToData(data, filters);

      expect(result).toEqual([0, 1, 0, 1]); // P1 and P3 match (0), P2 and P4 don't (1)
    });

    it('applies multiple filters with AND logic', () => {
      const dataMulti: ProtspaceData = {
        ...data,
        annotations: {
          ...data.annotations,
          gene: { values: ['geneA', 'geneB', 'geneC', 'geneD'] },
        },
        annotation_data: {
          ...data.annotation_data,
          gene: [0, 0, 1, 1],
        },
      };

      const filters: ActiveFilter[] = [
        { annotation: 'species', values: ['human'] },
        { annotation: 'gene', values: ['geneA'] },
      ];

      const result = applyFiltersToData(dataMulti, filters);
      expect(result).toEqual([0, 1, 1, 1]); // Only P1 matches both
    });

    it('returns all filtered (1) when no proteins match', () => {
      const filters: ActiveFilter[] = [{ annotation: 'species', values: ['cat'] }];
      const result = applyFiltersToData(data, filters);

      expect(result).toEqual([1, 1, 1, 1]);
    });

    it('returns all matched (0) when all proteins match', () => {
      const filters: ActiveFilter[] = [
        { annotation: 'species', values: ['human', 'mouse', 'rat', 'dog'] },
      ];
      const result = applyFiltersToData(data, filters);

      expect(result).toEqual([0, 0, 0, 0]);
    });

    it('handles empty data', () => {
      const emptyData: ProtspaceData = { protein_ids: [] };
      const filters: ActiveFilter[] = [{ annotation: 'species', values: ['human'] }];
      const result = applyFiltersToData(emptyData, filters);

      expect(result).toEqual([]);
    });

    it('handles empty filters', () => {
      const result = applyFiltersToData(data, []);
      // With no filters, all proteins match (no criteria to fail)
      expect(result).toEqual([0, 0, 0, 0]);
    });
  });

  describe('createCustomAnnotation', () => {
    it('creates annotation with correct structure', () => {
      const result = createCustomAnnotation();

      expect(result.values).toEqual(['Filtered Proteins', 'Other Proteins']);
      expect(result.colors).toEqual(['#00A35A', '#9AA0A6']);
      expect(result.shapes).toEqual(['circle', 'circle']);
    });

    it('returns same structure on repeated calls', () => {
      const result1 = createCustomAnnotation();
      const result2 = createCustomAnnotation();

      expect(result1).toEqual(result2);
    });
  });

  describe('shouldDisableSelection', () => {
    it('returns true when data size is 0', () => {
      expect(shouldDisableSelection(0)).toBe(true);
    });

    it('returns true when data size is 1', () => {
      expect(shouldDisableSelection(1)).toBe(true);
    });

    it('returns false when data size is 2', () => {
      expect(shouldDisableSelection(2)).toBe(false);
    });

    it('returns false for larger data sizes', () => {
      expect(shouldDisableSelection(100)).toBe(false);
      expect(shouldDisableSelection(1000)).toBe(false);
    });
  });

  describe('getSelectionDisabledMessage', () => {
    it('returns correct message for insufficient data with 0 points', () => {
      const msg = getSelectionDisabledMessage('insufficient-data', 0);
      expect(msg).toBe('Selection mode disabled: Only 0 points remaining');
    });

    it('returns correct message for insufficient data with 1 point', () => {
      const msg = getSelectionDisabledMessage('insufficient-data', 1);
      expect(msg).toBe('Selection mode disabled: Only 1 point remaining');
    });

    it('uses correct singular/plural for points', () => {
      const msg2 = getSelectionDisabledMessage('insufficient-data', 2);
      expect(msg2).toContain('2 points');
    });

    it('returns generic message for other reasons', () => {
      const msg = getSelectionDisabledMessage('other-reason', 10);
      expect(msg).toBe('Selection mode disabled');
    });
  });

  describe('areFilterConfigsEqual', () => {
    it('returns true for identical configs', () => {
      const config1: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a', 'b'] },
        ann2: { enabled: false, values: [] },
      };
      const config2: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a', 'b'] },
        ann2: { enabled: false, values: [] },
      };

      expect(areFilterConfigsEqual(config1, config2)).toBe(true);
    });

    it('returns true regardless of key order', () => {
      const config1: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a'] },
        ann2: { enabled: true, values: ['b'] },
      };
      const config2: Record<string, FilterConfig> = {
        ann2: { enabled: true, values: ['b'] },
        ann1: { enabled: true, values: ['a'] },
      };

      expect(areFilterConfigsEqual(config1, config2)).toBe(true);
    });

    it('returns true regardless of value order', () => {
      const config1: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a', 'b', 'c'] },
      };
      const config2: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['c', 'a', 'b'] },
      };

      expect(areFilterConfigsEqual(config1, config2)).toBe(true);
    });

    it('returns false when enabled differs', () => {
      const config1: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a'] },
      };
      const config2: Record<string, FilterConfig> = {
        ann1: { enabled: false, values: ['a'] },
      };

      expect(areFilterConfigsEqual(config1, config2)).toBe(false);
    });

    it('returns false when values differ', () => {
      const config1: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a', 'b'] },
      };
      const config2: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a', 'c'] },
      };

      expect(areFilterConfigsEqual(config1, config2)).toBe(false);
    });

    it('returns false when number of keys differ', () => {
      const config1: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a'] },
      };
      const config2: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a'] },
        ann2: { enabled: false, values: [] },
      };

      expect(areFilterConfigsEqual(config1, config2)).toBe(false);
    });

    it('returns true for empty configs', () => {
      expect(areFilterConfigsEqual({}, {})).toBe(true);
    });
  });

  describe('initializeFilterConfig', () => {
    it('initializes config for new annotations', () => {
      const annotations = ['ann1', 'ann2'];
      const result = initializeFilterConfig(annotations, {});

      expect(result.ann1).toEqual({ enabled: false, values: [] });
      expect(result.ann2).toEqual({ enabled: false, values: [] });
    });

    it('preserves existing config', () => {
      const annotations = ['ann1', 'ann2'];
      const existing: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a'] },
      };

      const result = initializeFilterConfig(annotations, existing);

      expect(result.ann1).toEqual({ enabled: true, values: ['a'] });
      expect(result.ann2).toEqual({ enabled: false, values: [] });
    });

    it('does not overwrite existing annotations', () => {
      const annotations = ['ann1'];
      const existing: Record<string, FilterConfig> = {
        ann1: { enabled: true, values: ['a', 'b'] },
      };

      const result = initializeFilterConfig(annotations, existing);

      expect(result.ann1).toEqual({ enabled: true, values: ['a', 'b'] });
    });

    it('handles empty annotations array', () => {
      const result = initializeFilterConfig([], {});
      expect(result).toEqual({});
    });
  });

  describe('toggleProteinSelection', () => {
    it('adds protein when not selected', () => {
      const result = toggleProteinSelection('P1', ['P2', 'P3']);
      expect(result).toContain('P1');
      expect(result).toContain('P2');
      expect(result).toContain('P3');
      expect(result.length).toBe(3);
    });

    it('removes protein when already selected', () => {
      const result = toggleProteinSelection('P2', ['P1', 'P2', 'P3']);
      expect(result).toContain('P1');
      expect(result).toContain('P3');
      expect(result).not.toContain('P2');
      expect(result.length).toBe(2);
    });

    it('handles empty selection', () => {
      const result = toggleProteinSelection('P1', []);
      expect(result).toEqual(['P1']);
    });

    it('handles removing last selection', () => {
      const result = toggleProteinSelection('P1', ['P1']);
      expect(result).toEqual([]);
    });
  });

  describe('mergeProteinSelections', () => {
    it('merges two selections', () => {
      const result = mergeProteinSelections(['P1', 'P2'], ['P3', 'P4']);
      expect(result).toEqual(expect.arrayContaining(['P1', 'P2', 'P3', 'P4']));
      expect(result.length).toBe(4);
    });

    it('deduplicates overlapping selections', () => {
      const result = mergeProteinSelections(['P1', 'P2'], ['P2', 'P3']);
      expect(result).toEqual(expect.arrayContaining(['P1', 'P2', 'P3']));
      expect(result.length).toBe(3);
    });

    it('handles empty current selection', () => {
      const result = mergeProteinSelections([], ['P1', 'P2']);
      expect(result).toEqual(expect.arrayContaining(['P1', 'P2']));
    });

    it('handles empty new selections', () => {
      const result = mergeProteinSelections(['P1', 'P2'], []);
      expect(result).toEqual(expect.arrayContaining(['P1', 'P2']));
    });

    it('handles both empty', () => {
      const result = mergeProteinSelections([], []);
      expect(result).toEqual([]);
    });
  });

  describe('validateAnnotationValues', () => {
    const availableValues = ['human', 'mouse', 'rat', null];

    it('returns only valid values', () => {
      const values = ['human', 'mouse', 'cat'];
      const result = validateAnnotationValues(values, availableValues);
      expect(result).toEqual(['human', 'mouse']);
    });

    it('handles null values', () => {
      const values = ['human', null, 'cat'];
      const result = validateAnnotationValues(values, availableValues);
      expect(result).toEqual(['human', null]);
    });

    it('returns empty array when no values are valid', () => {
      const values = ['cat', 'dog'];
      const result = validateAnnotationValues(values, availableValues);
      expect(result).toEqual([]);
    });

    it('returns all values when all are valid', () => {
      const values = ['human', 'mouse'];
      const result = validateAnnotationValues(values, availableValues);
      expect(result).toEqual(['human', 'mouse']);
    });

    it('handles empty values array', () => {
      const result = validateAnnotationValues([], availableValues);
      expect(result).toEqual([]);
    });

    it('handles empty available values', () => {
      const result = validateAnnotationValues(['human'], []);
      expect(result).toEqual([]);
    });
  });
});
