/** @vitest-environment jsdom */

import { describe, it, expect, vi } from 'vitest';
import { createExporter, ProtSpaceExporter, generateProtspaceExportBasename } from './export-utils';
import type { ExportableElement, ExportableData } from './export-utils';
import { LEGEND_VALUES } from './shapes';
import { validateCanvasDimensions } from './canvas-limits';

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
  } as ExportableElement;
}

describe('createExporter', () => {
  it('creates an exporter instance', () => {
    const mockElement = createMockElement();
    const exporter = createExporter(mockElement);
    expect(exporter).toBeInstanceOf(ProtSpaceExporter);
  });
});

describe('validateCanvasDimensions', () => {
  it('accepts moderate dimensions', () => {
    expect(validateCanvasDimensions(2000, 1000).isValid).toBe(true);
  });

  it('rejects dimensions exceeding safe limit', () => {
    const result = validateCanvasDimensions(8500, 4000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('8192');
  });

  it('accepts maximum safe square dimension', () => {
    const maxSafe = Math.floor(8192 * 0.95);
    expect(validateCanvasDimensions(maxSafe, maxSafe).isValid).toBe(true);
  });
});

describe('generateProtspaceExportBasename', () => {
  it('returns protspace prefix and date', () => {
    const el = createMockElement();
    const base = generateProtspaceExportBasename(el);
    expect(base).toMatch(/^protspace_pca_species_\d{4}-\d{2}-\d{2}$/);
  });
});

describe('exportProteinIds', () => {
  const baseData: ExportableData = {
    protein_ids: ['P1', 'P2', 'P3', 'P4'],
    annotations: {
      species: {
        values: ['human', 'mouse', null],
        colors: ['#ff0000', '#00ff00', '#888888'],
        shapes: ['circle', 'square', 'triangle'],
      },
    },
    annotation_data: { species: [[0], [1], [2], [0]] },
  };

  it('exports all IDs when nothing is hidden', () => {
    const el = createMockElement({ getCurrentData: () => baseData, selectedAnnotation: 'species' });
    let capturedHref = '';
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const node = realCreate(tag);
      if (tag === 'a') {
        vi.spyOn(node, 'click').mockImplementation(function (this: HTMLAnchorElement) {
          capturedHref = this.href;
        });
      }
      return node;
    });
    createExporter(el).exportProteinIds();
    vi.mocked(document.createElement).mockRestore();
    const encoded = capturedHref.replace('data:text/plain;charset=utf-8,', '');
    expect(decodeURIComponent(encoded).split('\n')).toEqual(['P1', 'P2', 'P3', 'P4']);
  });

  it('excludes N/A when __NA__ is hidden', () => {
    const el = createMockElement({
      getCurrentData: () => baseData,
      selectedAnnotation: 'species',
      hiddenAnnotationValues: [LEGEND_VALUES.NA_VALUE],
    });
    let capturedHref = '';
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const node = realCreate(tag);
      if (tag === 'a') {
        vi.spyOn(node, 'click').mockImplementation(function (this: HTMLAnchorElement) {
          capturedHref = this.href;
        });
      }
      return node;
    });
    createExporter(el).exportProteinIds();
    vi.mocked(document.createElement).mockRestore();
    const encoded = capturedHref.replace('data:text/plain;charset=utf-8,', '');
    expect(decodeURIComponent(encoded).split('\n')).toEqual(['P1', 'P2', 'P4']);
  });
});
