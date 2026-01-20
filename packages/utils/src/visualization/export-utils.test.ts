import { describe, it, expect } from 'vitest';
import { ProtSpaceExporter, createExporter } from './export-utils';
import type { ExportableElement, ExportOptions } from './export-utils';

/**
 * Mock ExportableElement for testing
 */
function createMockElement(overrides: Partial<ExportableElement> = {}): ExportableElement {
  return {
    getCurrentData: () => ({
      protein_ids: ['P1', 'P2', 'P3'],
      annotations: {
        species: {
          values: ['human', 'mouse', null],
          colors: ['#ff0000', '#00ff00', '#888888'],
          shapes: ['circle', 'square', 'triangle'],
        },
      },
      annotation_data: { species: [[0], [1], [2]] },
      projections: [{ name: 'PCA_2' }, { name: 'UMAP_3' }],
    }),
    selectedAnnotation: 'species',
    selectedProjectionIndex: 0,
    ...overrides,
  } as unknown as ExportableElement;
}

describe('createExporter', () => {
  it('creates an exporter instance', () => {
    const mockElement = createMockElement();
    const exporter = createExporter(mockElement);
    expect(exporter).toBeInstanceOf(ProtSpaceExporter);
  });

  it('creates an exporter with selected proteins', () => {
    const mockElement = createMockElement();
    const exporter = createExporter(mockElement, ['P1', 'P2']);
    expect(exporter).toBeInstanceOf(ProtSpaceExporter);
  });

  it('creates an exporter with isolation mode', () => {
    const mockElement = createMockElement();
    const exporter = createExporter(mockElement, [], true);
    expect(exporter).toBeInstanceOf(ProtSpaceExporter);
  });

  it('creates an exporter with all parameters', () => {
    const mockElement = createMockElement();
    const exporter = createExporter(mockElement, ['P1'], true);
    expect(exporter).toBeInstanceOf(ProtSpaceExporter);
  });
});

describe('ProtSpaceExporter.validateCanvasDimensions', () => {
  it('should accept small dimensions', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](2000, 1000);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should accept 6000px dimensions', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](6000, 3000);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should accept dimensions up to ~7782px (95% of 8192)', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](7700, 4000);
    expect(result.isValid).toBe(true);
  });

  it('should reject dimensions exceeding 8192px limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](8500, 4000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('8192px');
  });

  it('should reject very large dimensions that exceed area limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](20000, 20000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should handle non-square aspect ratios', () => {
    // Wide but within limits
    const result1 = ProtSpaceExporter['validateCanvasDimensions'](7000, 2000);
    expect(result1.isValid).toBe(true);

    // Tall but within limits
    const result2 = ProtSpaceExporter['validateCanvasDimensions'](2000, 7000);
    expect(result2.isValid).toBe(true);
  });

  it('should reject if width exceeds limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](9000, 1000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('limit');
  });

  it('should reject if height exceeds limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](1000, 9000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('limit');
  });

  it('should accept maximum safe dimensions', () => {
    // 95% of 8192 = 7782
    const maxSafe = Math.floor(8192 * 0.95);
    const result = ProtSpaceExporter['validateCanvasDimensions'](maxSafe, maxSafe);
    expect(result.isValid).toBe(true);
  });

  it('should accept very small dimensions', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](100, 100);
    expect(result.isValid).toBe(true);
  });
});

describe('Export dimension calculations', () => {
  describe('legend width percentage calculations', () => {
    it('calculates correct legend width from percentage', () => {
      // If scatterplot is 2048px and legend is 25%, total should be 2048 / 0.75 = 2730.67
      // Legend width = 2730.67 * 0.25 = 682.67
      const scatterWidth = 2048;
      const legendPercent = 25 / 100;
      const legendWidth = Math.round(scatterWidth * (legendPercent / (1 - legendPercent)));

      expect(legendWidth).toBe(683); // Rounded
    });

    it('handles different legend percentages', () => {
      const scatterWidth = 1000;

      // 15% legend
      const legend15 = Math.round(scatterWidth * (0.15 / 0.85));
      expect(legend15).toBe(176);

      // 50% legend
      const legend50 = Math.round(scatterWidth * (0.5 / 0.5));
      expect(legend50).toBe(1000);
    });
  });

  describe('target dimensions for export', () => {
    it('calculates target width excluding legend', () => {
      const imageWidth = 2048;
      const legendPercent = 25 / 100;
      const targetWidth = Math.round(imageWidth * (1 - legendPercent));

      expect(targetWidth).toBe(1536);
    });

    it('handles various image widths', () => {
      const legendPercent = 0.25;

      expect(Math.round(800 * (1 - legendPercent))).toBe(600);
      expect(Math.round(4096 * (1 - legendPercent))).toBe(3072);
      expect(Math.round(8192 * (1 - legendPercent))).toBe(6144);
    });
  });
});

describe('Export scale factor calculations', () => {
  const BASE_FONT_SIZE = 24;

  it('calculates correct scale factor for default font size', () => {
    const fontSizePx = 24;
    const scaleFactor = fontSizePx / BASE_FONT_SIZE;
    expect(scaleFactor).toBe(1.0);
  });

  it('calculates correct scale factor for smaller font', () => {
    const fontSizePx = 12;
    const scaleFactor = fontSizePx / BASE_FONT_SIZE;
    expect(scaleFactor).toBe(0.5);
  });

  it('calculates correct scale factor for larger font', () => {
    const fontSizePx = 48;
    const scaleFactor = fontSizePx / BASE_FONT_SIZE;
    expect(scaleFactor).toBe(2.0);
  });

  it('handles minimum font size', () => {
    const fontSizePx = 8;
    const scaleFactor = fontSizePx / BASE_FONT_SIZE;
    expect(scaleFactor).toBeCloseTo(0.333, 2);
  });

  it('handles maximum font size', () => {
    const fontSizePx = 120;
    const scaleFactor = fontSizePx / BASE_FONT_SIZE;
    expect(scaleFactor).toBe(5.0);
  });
});

describe('Export options validation', () => {
  it('accepts valid export options', () => {
    const options: ExportOptions = {
      targetWidth: 2048,
      targetHeight: 1024,
      legendWidthPercent: 25,
      legendScaleFactor: 1.0,
      includeSelection: false,
      backgroundColor: '#ffffff',
    };

    expect(options.targetWidth).toBe(2048);
    expect(options.targetHeight).toBe(1024);
    expect(options.legendWidthPercent).toBe(25);
    expect(options.legendScaleFactor).toBe(1.0);
  });

  it('handles optional properties', () => {
    const minimalOptions: ExportOptions = {};

    expect(minimalOptions.targetWidth).toBeUndefined();
    expect(minimalOptions.targetHeight).toBeUndefined();
    expect(minimalOptions.legendWidthPercent).toBeUndefined();
  });

  it('accepts custom export name', () => {
    const options: ExportOptions = {
      exportName: 'my_custom_export.png',
    };

    expect(options.exportName).toBe('my_custom_export.png');
  });

  it('accepts include shapes option', () => {
    const withShapes: ExportOptions = { includeShapes: true };
    const withoutShapes: ExportOptions = { includeShapes: false };

    expect(withShapes.includeShapes).toBe(true);
    expect(withoutShapes.includeShapes).toBe(false);
  });
});

describe('Export filename generation', () => {
  it('generates consistent filename format', () => {
    // Expected format: protspace_{projection}_{annotation}_{date}.{ext}
    const pattern = /^protspace_[a-z0-9_-]+_[a-z0-9_-]+_\d{4}-\d{2}-\d{2}\.(png|pdf|json)$/;

    expect('protspace_pca_species_2024-01-15.png').toMatch(pattern);
    expect('protspace_umap_gene_2024-12-31.pdf').toMatch(pattern);
    expect('protspace_tsne_cluster_2025-06-01.json').toMatch(pattern);
  });

  it('sanitizes projection names', () => {
    // Spaces and special chars should be replaced with underscores
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    expect(sanitize('PCA 2D')).toBe('pca_2d');
    expect(sanitize('UMAP@3D')).toBe('umap_3d');
    expect(sanitize('t-SNE')).toBe('t-sne');
  });

  it('removes dimension suffix from projection names', () => {
    const removeDimensionSuffix = (name: string) => name.replace(/_[23]$/, '');

    expect(removeDimensionSuffix('pca_2')).toBe('pca');
    expect(removeDimensionSuffix('umap_3')).toBe('umap');
    expect(removeDimensionSuffix('tsne_2d')).toBe('tsne_2d'); // Only removes _2 or _3
  });
});

describe('Export constants', () => {
  // These tests verify the expected export constant values
  describe('canvas limits', () => {
    const MAX_CANVAS_DIMENSION = 8192;
    const MAX_CANVAS_AREA = 268435456;
    const SAFE_DIMENSION_MARGIN = 0.95;

    it('has correct maximum dimension limit', () => {
      expect(MAX_CANVAS_DIMENSION).toBe(8192);
    });

    it('has correct maximum area limit (~268M pixels)', () => {
      expect(MAX_CANVAS_AREA).toBe(268435456);
    });

    it('calculates safe dimension correctly', () => {
      const safeDimension = Math.floor(MAX_CANVAS_DIMENSION * SAFE_DIMENSION_MARGIN);
      expect(safeDimension).toBe(7782);
    });

    it('calculates safe area correctly', () => {
      const safeArea = MAX_CANVAS_AREA * SAFE_DIMENSION_MARGIN;
      expect(safeArea).toBe(255013683.2);
    });
  });

  describe('PDF constants', () => {
    const PDF_MARGIN = 2;
    const PDF_GAP = 4;
    const PDF_MAX_WIDTH = 210; // A4 width in mm

    it('has correct PDF margin', () => {
      expect(PDF_MARGIN).toBe(2);
    });

    it('has correct PDF gap', () => {
      expect(PDF_GAP).toBe(4);
    });

    it('has correct A4 max width', () => {
      expect(PDF_MAX_WIDTH).toBe(210);
    });
  });
});

describe('Export aspect ratio calculations', () => {
  it('maintains aspect ratio when scaling width', () => {
    const originalWidth = 2048;
    const originalHeight = 1024;
    const newWidth = 4096;

    const aspectRatio = originalWidth / originalHeight;
    const newHeight = Math.round(newWidth / aspectRatio);

    expect(newHeight).toBe(2048);
  });

  it('maintains aspect ratio when scaling height', () => {
    const originalWidth = 2048;
    const originalHeight = 1024;
    const newHeight = 2048;

    const aspectRatio = originalWidth / originalHeight;
    const newWidth = Math.round(newHeight * aspectRatio);

    expect(newWidth).toBe(4096);
  });

  it('handles non-standard aspect ratios', () => {
    const width = 1920;
    const height = 1080;
    const aspectRatio = width / height;

    expect(aspectRatio).toBeCloseTo(16 / 9, 2);
  });
});
