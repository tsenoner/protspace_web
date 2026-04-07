import { describe, it, expect } from 'vitest';
import {
  EXPORT_DEFAULTS,
  createDefaultExportOptions,
  calculateHeightFromWidth,
  calculateWidthFromHeight,
  isProjection3D,
  getProjectionPlane,
  shouldDisableSelection,
  getSelectionDisabledMessage,
  toggleProteinSelection,
  mergeProteinSelections,
} from './control-bar-helpers';

describe('control-bar-helpers', () => {
  describe('EXPORT_DEFAULTS', () => {
    it('has correct default values', () => {
      expect(EXPORT_DEFAULTS.FORMAT).toBe('png');
      expect(EXPORT_DEFAULTS.LAYOUT_ID).toBe('two_column_below');
      expect(EXPORT_DEFAULTS.LEGACY_IMAGE_WIDTH).toBe(2048);
      expect(EXPORT_DEFAULTS.LEGACY_IMAGE_HEIGHT).toBe(1024);
    });

    it('creates default export options including parquet toggles and publication fields', () => {
      expect(createDefaultExportOptions()).toEqual({
        imageWidth: EXPORT_DEFAULTS.LEGACY_IMAGE_WIDTH,
        imageHeight: EXPORT_DEFAULTS.LEGACY_IMAGE_HEIGHT,
        lockAspectRatio: true,
        legendWidthPercent: EXPORT_DEFAULTS.LEGACY_LEGEND_WIDTH_PERCENT,
        legendFontSizePx: EXPORT_DEFAULTS.LEGACY_LEGEND_FONT_SIZE_PX,
        includeLegendSettings: true,
        includeExportOptions: true,
        layoutId: EXPORT_DEFAULTS.LAYOUT_ID,
      });
    });

    describe('aspect ratio helpers', () => {
      it('maintains aspect ratio when doubling width', () => {
        const newHeight = calculateHeightFromWidth(4096, 2048, 1024);
        expect(newHeight).toBe(2048);
      });

      it('maintains aspect ratio when doubling height', () => {
        const newWidth = calculateWidthFromHeight(2048, 1024, 2048);
        expect(newWidth).toBe(4096);
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
});
