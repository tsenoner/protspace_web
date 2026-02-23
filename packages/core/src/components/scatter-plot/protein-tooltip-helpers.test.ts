import { describe, it, expect } from 'vitest';
import { LEGEND_VALUES } from '@protspace/utils';
import {
  filterAnnotationValues,
  getGeneName,
  getProteinName,
  getUniprotKbId,
} from './protein-tooltip-helpers';

describe('filterAnnotationValues', () => {
  it('returns null for undefined input', () => {
    expect(filterAnnotationValues(undefined)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(filterAnnotationValues([])).toBeNull();
  });

  it('returns null when all values are __NA__', () => {
    expect(filterAnnotationValues([LEGEND_VALUES.NA_VALUE, LEGEND_VALUES.NA_VALUE])).toBeNull();
  });

  it('returns null when all values are whitespace', () => {
    expect(filterAnnotationValues(['  ', '\t', ''])).toBeNull();
  });

  it('filters out __NA__ and returns remaining values', () => {
    expect(filterAnnotationValues([LEGEND_VALUES.NA_VALUE, 'BRCA1'])).toBe('BRCA1');
  });

  it('trims whitespace from values', () => {
    expect(filterAnnotationValues(['  TP53  '])).toBe('TP53');
  });

  it('joins multiple non-NA values with comma', () => {
    expect(filterAnnotationValues(['BRCA1', 'TP53'])).toBe('BRCA1, TP53');
  });

  it('filters NA and whitespace, then joins remaining', () => {
    expect(filterAnnotationValues([LEGEND_VALUES.NA_VALUE, 'BRCA1', '  ', 'TP53'])).toBe(
      'BRCA1, TP53',
    );
  });

  it('returns single value without comma', () => {
    expect(filterAnnotationValues(['Kinase'])).toBe('Kinase');
  });
});

describe('getGeneName', () => {
  it('resolves gene_name key', () => {
    expect(getGeneName({ gene_name: ['BRCA1'] })).toBe('BRCA1');
  });

  it('resolves "Gene name" key', () => {
    expect(getGeneName({ 'Gene name': ['TP53'] })).toBe('TP53');
  });

  it('prefers gene_name over "Gene name"', () => {
    expect(getGeneName({ gene_name: ['BRCA1'], 'Gene name': ['TP53'] })).toBe('BRCA1');
  });

  it('returns null when gene annotation is all __NA__', () => {
    expect(getGeneName({ gene_name: [LEGEND_VALUES.NA_VALUE] })).toBeNull();
  });

  it('returns null when no gene keys exist', () => {
    expect(getGeneName({ species: ['human'] })).toBeNull();
  });
});

describe('getProteinName', () => {
  it('resolves protein_name key', () => {
    expect(getProteinName({ protein_name: ['Tumor protein p53'] })).toBe('Tumor protein p53');
  });

  it('resolves "Protein name" key', () => {
    expect(getProteinName({ 'Protein name': ['Kinase'] })).toBe('Kinase');
  });

  it('returns null when all values are __NA__', () => {
    expect(getProteinName({ protein_name: [LEGEND_VALUES.NA_VALUE] })).toBeNull();
  });

  it('returns null when no protein name keys exist', () => {
    expect(getProteinName({ gene_name: ['TP53'] })).toBeNull();
  });
});

describe('getUniprotKbId', () => {
  it('resolves uniprot_kb_id key', () => {
    expect(getUniprotKbId({ uniprot_kb_id: ['P04637'] })).toBe('P04637');
  });

  it('returns null when all values are __NA__', () => {
    expect(getUniprotKbId({ uniprot_kb_id: [LEGEND_VALUES.NA_VALUE] })).toBeNull();
  });

  it('returns null when key does not exist', () => {
    expect(getUniprotKbId({ gene_name: ['TP53'] })).toBeNull();
  });

  it('joins multiple IDs', () => {
    expect(getUniprotKbId({ uniprot_kb_id: ['P04637', 'Q9NZC2'] })).toBe('P04637, Q9NZC2');
  });
});
