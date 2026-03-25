import { describe, it, expect } from 'vitest';
import type { ProtspaceData } from './types';
import type { FilterQuery } from './query-types';
import { evaluateQuery, resolveAnnotationValue } from './query-evaluate';

/** Minimal test data: 5 proteins with organism and reviewed annotations */
function createTestData(): ProtspaceData {
  return {
    protein_ids: ['P1', 'P2', 'P3', 'P4', 'P5'],
    annotations: {
      organism: { values: ['Human', 'Mouse', 'Zebrafish'] },
      reviewed: { values: ['true', 'false'] },
      pfam: { values: ['PF00069', 'PF00076', null] },
    },
    annotation_data: {
      // P1=Human, P2=Mouse, P3=Human, P4=Zebrafish, P5=Mouse
      organism: [[0], [1], [0], [2], [1]],
      // P1=true, P2=false, P3=true, P4=true, P5=false
      reviewed: [[0], [1], [0], [0], [1]],
      // P1=PF00069, P2=PF00076, P3=null, P4=PF00069, P5=PF00076
      pfam: [[0], [1], [2], [0], [1]],
    },
  };
}

describe('resolveAnnotationValue', () => {
  it('resolves value from number[][] format', () => {
    const data = createTestData();
    expect(resolveAnnotationValue(0, 'organism', data)).toBe('Human');
    expect(resolveAnnotationValue(1, 'organism', data)).toBe('Mouse');
  });

  it('returns null for missing annotation', () => {
    const data = createTestData();
    expect(resolveAnnotationValue(0, 'nonexistent', data)).toBeNull();
  });

  it('returns null for out-of-range index', () => {
    const data = createTestData();
    expect(resolveAnnotationValue(99, 'organism', data)).toBeNull();
  });

  it('handles number[] format (flat array)', () => {
    const data: ProtspaceData = {
      protein_ids: ['P1', 'P2'],
      annotations: { organism: { values: ['Human', 'Mouse'] } },
      annotation_data: { organism: [0, 1] as unknown as number[][] },
    };
    expect(resolveAnnotationValue(0, 'organism', data)).toBe('Human');
    expect(resolveAnnotationValue(1, 'organism', data)).toBe('Mouse');
  });
});

describe('evaluateQuery', () => {
  describe('empty/trivial queries', () => {
    it('returns all indices for empty query', () => {
      const data = createTestData();
      const result = evaluateQuery([], data);
      expect(result).toEqual(new Set([0, 1, 2, 3, 4]));
    });

    it('returns empty set for missing protein_ids', () => {
      const result = evaluateQuery([], {});
      expect(result).toEqual(new Set());
    });
  });

  describe('single condition - is operator', () => {
    it('matches proteins with selected value', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });

    it('matches multiple values (implicit OR)', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human', 'Mouse'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 1, 2, 4]));
    });

    it('skips condition with empty values', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: [] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 1, 2, 3, 4]));
    });
  });

  describe('single condition - is_not operator', () => {
    it('excludes proteins with selected value', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is_not', values: ['Human'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([1, 3, 4]));
    });
  });

  describe('single condition - contains operator', () => {
    it('matches substring case-insensitive', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'contains', values: ['uman'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });

    it('does not match null values', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'pfam', operator: 'contains', values: ['PF'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 1, 3, 4]));
    });
  });

  describe('single condition - starts_with operator', () => {
    it('matches prefix case-insensitive', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'starts_with', values: ['hu'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });
  });

  describe('AND logic', () => {
    it('intersects two conditions', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
        { id: '2', logicalOp: 'AND', annotation: 'reviewed', operator: 'is', values: ['true'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });
  });

  describe('OR logic', () => {
    it('unions two conditions', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
        { id: '2', logicalOp: 'OR', annotation: 'reviewed', operator: 'is', values: ['false'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 1, 2, 4]));
    });
  });

  describe('NOT logic', () => {
    it('negates a single condition', () => {
      const query: FilterQuery = [
        { id: '1', logicalOp: 'NOT', annotation: 'organism', operator: 'is', values: ['Human'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([1, 3, 4]));
    });

    it('NOT combined with AND', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'organism', operator: 'is', values: ['Human', 'Mouse'] },
        { id: '2', logicalOp: 'NOT', annotation: 'reviewed', operator: 'is', values: ['false'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });
  });

  describe('groups', () => {
    it('evaluates a group as a unit', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'reviewed', operator: 'is', values: ['true'] },
        {
          id: 'g1',
          logicalOp: 'AND',
          conditions: [
            { id: '2', annotation: 'organism', operator: 'is', values: ['Human'] },
            { id: '3', logicalOp: 'OR', annotation: 'organism', operator: 'is', values: ['Mouse'] },
          ],
        },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([0, 2]));
    });

    it('negates an entire group with NOT', () => {
      const query: FilterQuery = [
        {
          id: 'g1',
          logicalOp: 'NOT',
          conditions: [
            { id: '1', annotation: 'organism', operator: 'is', values: ['Human'] },
            { id: '2', logicalOp: 'AND', annotation: 'reviewed', operator: 'is', values: ['true'] },
          ],
        },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set([1, 3, 4]));
    });
  });

  describe('null value handling', () => {
    it('is operator matches null via __NA__ normalized value', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'pfam', operator: 'is', values: ['__NA__'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // P3 has pfam=null → normalized to __NA__
      expect(result).toEqual(new Set([2]));
    });

    it('is_not operator excludes null via __NA__ normalized value', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'pfam', operator: 'is_not', values: ['__NA__'] },
      ];
      const result = evaluateQuery(query, createTestData());
      // All except P3 (which has null pfam)
      expect(result).toEqual(new Set([0, 1, 3, 4]));
    });
  });

  describe('missing annotation', () => {
    it('treats missing annotation as non-matching', () => {
      const query: FilterQuery = [
        { id: '1', annotation: 'nonexistent', operator: 'is', values: ['foo'] },
      ];
      const result = evaluateQuery(query, createTestData());
      expect(result).toEqual(new Set());
    });
  });
});
