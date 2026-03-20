import { describe, it, expect } from 'vitest';
import { buildPublicationLegendModel } from './build-legend-model';
import { LEGEND_VALUES } from '../shapes';
import type { ExportableData } from '../export-utils';

const data: ExportableData = {
  protein_ids: ['P1', 'P2', 'P3'],
  annotations: {
    species: {
      values: ['human', null],
      colors: ['#f00', '#888'],
      shapes: ['circle', 'square'],
    },
  },
  annotation_data: { species: [[0], [1], [1]] },
};

describe('buildPublicationLegendModel', () => {
  it('keeps legend counts when no selection', () => {
    const model = buildPublicationLegendModel({
      legendExport: {
        annotation: 'species',
        includeShapes: true,
        otherItemsCount: 0,
        items: [
          {
            value: 'human',
            color: '#f00',
            shape: 'circle',
            count: 1,
            isVisible: true,
            zOrder: 0,
          },
          {
            value: LEGEND_VALUES.NA_VALUE,
            color: '#888',
            shape: 'square',
            count: 2,
            isVisible: true,
            zOrder: 1,
          },
        ],
      },
      data,
      annotationKey: 'species',
      selectedProteinIds: [],
      hiddenAnnotationValues: [],
    });
    const na = model.items.find((i) => i.value === LEGEND_VALUES.NA_VALUE);
    expect(na?.count).toBe(2);
  });

  it('recomputes counts for selection', () => {
    const model = buildPublicationLegendModel({
      legendExport: {
        annotation: 'species',
        includeShapes: true,
        otherItemsCount: 0,
        items: [
          {
            value: 'human',
            color: '#f00',
            shape: 'circle',
            count: 99,
            isVisible: true,
            zOrder: 0,
          },
          {
            value: LEGEND_VALUES.NA_VALUE,
            color: '#888',
            shape: 'square',
            count: 99,
            isVisible: true,
            zOrder: 1,
          },
        ],
      },
      data,
      annotationKey: 'species',
      selectedProteinIds: ['P2'],
      hiddenAnnotationValues: [],
    });
    const na = model.items.find((i) => i.value === LEGEND_VALUES.NA_VALUE);
    expect(na?.count).toBe(1);
    const human = model.items.find((i) => i.value === 'human');
    expect(human?.count).toBe(0);
  });

  it('drops hidden annotation values', () => {
    const model = buildPublicationLegendModel({
      legendExport: {
        annotation: 'species',
        includeShapes: true,
        otherItemsCount: 0,
        items: [
          {
            value: 'human',
            color: '#f00',
            shape: 'circle',
            count: 1,
            isVisible: true,
            zOrder: 0,
          },
        ],
      },
      data,
      annotationKey: 'species',
      selectedProteinIds: [],
      hiddenAnnotationValues: ['human'],
    });
    expect(model.items.some((i) => i.value === 'human')).toBe(false);
  });
});
