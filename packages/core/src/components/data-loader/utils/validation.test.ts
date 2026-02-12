import { describe, it, expect } from 'vitest';
import { validateRowsBasic } from './validation';

function makeRows(overrides: Record<string, unknown> = {}): Record<string, unknown>[] {
  return [{ id: '1', name: 'test', ...overrides }];
}

describe('validateRowsBasic', () => {
  it('passes for short cell values', () => {
    expect(() => validateRowsBasic(makeRows({ annotation: 'short value' }))).not.toThrow();
  });

  it('passes for semicolon-separated values where total exceeds limit but individual parts do not', () => {
    // Each part is ~30 chars, total > 256 chars but each part < 256
    const parts = Array.from(
      { length: 15 },
      (_, i) => `PF${String(i).padStart(5, '0')} (domain_${i})`,
    );
    const value = parts.join(';');
    expect(value.length).toBeGreaterThan(256);
    expect(() => validateRowsBasic(makeRows({ pfam: value }))).not.toThrow();
  });

  it('rejects a single value exceeding the limit', () => {
    const longValue = 'x'.repeat(300);
    expect(() => validateRowsBasic(makeRows({ col: longValue }))).toThrow(
      /Cell value too long in column 'col'/,
    );
  });

  it('error message includes column name and character count', () => {
    const longValue = 'y'.repeat(300);
    expect(() => validateRowsBasic(makeRows({ my_column: longValue }))).toThrow(
      /my_column.*300 characters.*limit: 256/,
    );
  });

  it('respects custom maxCellStringLength override', () => {
    const value = 'a'.repeat(100);
    // Should pass with default limit (256)
    expect(() => validateRowsBasic(makeRows({ col: value }))).not.toThrow();
    // Should fail with custom limit (50)
    expect(() => validateRowsBasic(makeRows({ col: value }), { maxCellStringLength: 50 })).toThrow(
      /Cell value too long/,
    );
  });

  it('passes when semicolon-separated parts are each under the limit', () => {
    const value = 'abc;def;ghi';
    expect(() => validateRowsBasic(makeRows({ col: value }))).not.toThrow();
  });

  it('rejects when one semicolon-separated part exceeds the limit', () => {
    const longPart = 'z'.repeat(300);
    const value = `short;${longPart};other`;
    expect(() => validateRowsBasic(makeRows({ col: value }))).toThrow(/Cell value too long/);
  });
});
