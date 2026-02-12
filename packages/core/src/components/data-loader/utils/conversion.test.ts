import { describe, it, expect } from 'vitest';
import { parseAnnotationValue } from './conversion';

describe('parseAnnotationValue', () => {
  it('parses label without pipe as full string with empty scores', () => {
    const result = parseAnnotationValue('taxonomy_value');
    expect(result.label).toBe('taxonomy_value');
    expect(result.scores).toEqual([]);
  });

  it('parses label|score with single numeric score', () => {
    const result = parseAnnotationValue('PF00001 (7tm_1)|1.5e-10');
    expect(result.label).toBe('PF00001 (7tm_1)');
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]).toBeCloseTo(1.5e-10);
  });

  it('parses label|score1,score2 with multiple comma-separated scores', () => {
    const result = parseAnnotationValue('PF00001|1.5e-10,2.3e-5');
    expect(result.label).toBe('PF00001');
    expect(result.scores).toHaveLength(2);
    expect(result.scores[0]).toBeCloseTo(1.5e-10);
    expect(result.scores[1]).toBeCloseTo(2.3e-5);
  });

  it('keeps GO:0005524|ATP binding intact (non-numeric after pipe)', () => {
    const result = parseAnnotationValue('GO:0005524|ATP binding');
    expect(result.label).toBe('GO:0005524|ATP binding');
    expect(result.scores).toEqual([]);
  });

  it('handles empty string gracefully', () => {
    const result = parseAnnotationValue('');
    expect(result.label).toBe('');
    expect(result.scores).toEqual([]);
  });

  it('handles whitespace-only string gracefully', () => {
    const result = parseAnnotationValue('   ');
    expect(result.label).toBe('');
    expect(result.scores).toEqual([]);
  });

  it('handles pipe at end of string', () => {
    const result = parseAnnotationValue('label|');
    expect(result.label).toBe('label|');
    expect(result.scores).toEqual([]);
  });

  it('handles negative numeric scores', () => {
    const result = parseAnnotationValue('domain|-3.5');
    expect(result.label).toBe('domain');
    expect(result.scores).toEqual([-3.5]);
  });

  it('handles zero score', () => {
    const result = parseAnnotationValue('domain|0');
    expect(result.label).toBe('domain');
    expect(result.scores).toEqual([0]);
  });

  it('handles mixed valid and invalid comma-separated values after pipe', () => {
    // If any part is non-numeric, the whole thing is kept as label
    const result = parseAnnotationValue('label|1.5,abc');
    expect(result.label).toBe('label|1.5,abc');
    expect(result.scores).toEqual([]);
  });

  it('handles multiple pipes — uses last pipe for score detection', () => {
    const result = parseAnnotationValue('GO:123|description|1.5e-3');
    expect(result.label).toBe('GO:123|description');
    expect(result.scores).toEqual([1.5e-3]);
  });
});
