import { describe, it, expect } from 'vitest';
import { djb2Hash, generateDatasetHash } from './data-hash';

describe('djb2Hash', () => {
  it('should return consistent hash for the same input', () => {
    const input = 'hello world';
    const hash1 = djb2Hash(input);
    const hash2 = djb2Hash(input);
    expect(hash1).toBe(hash2);
  });

  it('should return different hashes for different inputs', () => {
    const hash1 = djb2Hash('hello');
    const hash2 = djb2Hash('world');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const result = djb2Hash('');
    expect(result).toBe(5381); // Initial hash value when no characters are processed
  });

  it('should return an unsigned 32-bit integer', () => {
    const result = djb2Hash('test string with many characters');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xffffffff);
  });

  it('should produce different hashes for similar strings', () => {
    const hash1 = djb2Hash('abcdefghijklmnopqrstuvwxyz');
    const hash2 = djb2Hash('abcdefghijklmnopqrstuvwxyzz');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle special characters', () => {
    const hash1 = djb2Hash('hello\x00world');
    const hash2 = djb2Hash('helloworld');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle unicode characters', () => {
    const result = djb2Hash('こんにちは');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('generateDatasetHash', () => {
  it('should return 8-character hex string for valid input', () => {
    const result = generateDatasetHash(['protein1', 'protein2']);
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should return "00000000" for empty array', () => {
    const result = generateDatasetHash([]);
    expect(result).toBe('00000000');
  });

  it('should return consistent hash for the same protein IDs', () => {
    const proteins = ['P12345', 'Q67890', 'O11111'];
    const hash1 = generateDatasetHash(proteins);
    const hash2 = generateDatasetHash(proteins);
    expect(hash1).toBe(hash2);
  });

  it('should return the same hash regardless of input order', () => {
    const hash1 = generateDatasetHash(['P12345', 'Q67890', 'O11111']);
    const hash2 = generateDatasetHash(['O11111', 'P12345', 'Q67890']);
    const hash3 = generateDatasetHash(['Q67890', 'O11111', 'P12345']);
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should return different hashes for different protein sets', () => {
    const hash1 = generateDatasetHash(['P12345', 'Q67890']);
    const hash2 = generateDatasetHash(['P12345', 'Q67891']);
    expect(hash1).not.toBe(hash2);
  });

  it('should handle single protein ID', () => {
    const result = generateDatasetHash(['P12345']);
    expect(result).toMatch(/^[0-9a-f]{8}$/);
    expect(result).not.toBe('00000000');
  });

  it('should handle large arrays of protein IDs', () => {
    const proteins = Array.from({ length: 10000 }, (_, i) => `P${i.toString().padStart(5, '0')}`);
    const result = generateDatasetHash(proteins);
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should handle protein IDs with special characters', () => {
    const result = generateDatasetHash(['P12345-1', 'Q67890.2', 'O11111_HUMAN']);
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should differentiate between similar protein ID combinations', () => {
    const hash1 = generateDatasetHash(['AB', 'CD']);
    const hash2 = generateDatasetHash(['ABC', 'D']);
    const hash3 = generateDatasetHash(['A', 'BCD']);
    expect(hash1).not.toBe(hash2);
    expect(hash2).not.toBe(hash3);
    expect(hash1).not.toBe(hash3);
  });

  it('should not mutate the input array', () => {
    const proteins = ['Z99999', 'A00001', 'M50000'];
    const originalOrder = [...proteins];
    generateDatasetHash(proteins);
    expect(proteins).toEqual(originalOrder);
  });

  it('should handle duplicate protein IDs', () => {
    const hash1 = generateDatasetHash(['P12345', 'P12345', 'Q67890']);
    const hash2 = generateDatasetHash(['P12345', 'Q67890']);
    expect(hash1).not.toBe(hash2);
  });
});
