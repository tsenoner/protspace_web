import { describe, it, expect } from 'vitest';
import { wrapLabelToTwoLines } from './legend-text-layout';

function mockCtx(charWidth: number): CanvasRenderingContext2D {
  return {
    measureText: (s: string) => ({ width: s.length * charWidth }),
  } as CanvasRenderingContext2D;
}

describe('wrapLabelToTwoLines', () => {
  it('returns single line when short', () => {
    const ctx = mockCtx(5);
    const r = wrapLabelToTwoLines(ctx, 'hi', 500);
    expect(r.lines).toEqual(['hi']);
    expect(r.truncated).toBe(false);
  });

  it('truncates long unbroken token', () => {
    const ctx = mockCtx(8);
    const r = wrapLabelToTwoLines(ctx, 'W'.repeat(80), 40);
    expect(r.lines.length).toBe(1);
    expect(r.truncated).toBe(true);
    expect(r.lines[0].endsWith('…')).toBe(true);
  });

  it('wraps two lines and adds ellipsis when remainder', () => {
    const ctx = mockCtx(6);
    const r = wrapLabelToTwoLines(ctx, 'one two three four five six', 40);
    expect(r.lines.length).toBe(2);
    expect(r.truncated).toBe(true);
  });
});
