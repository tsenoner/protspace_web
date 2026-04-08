// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { wrapLabelToTwoLines } from './legend-text-layout';

beforeAll(() => {
  const mockCtx = {
    font: '',
    measureText(s: string) {
      const sizeMatch = this.font.match(/(\d+(?:\.\d+)?)px/);
      const px = sizeMatch ? parseFloat(sizeMatch[1]) : 14;
      return { width: [...s].length * px * 0.6 };
    },
  };
  HTMLCanvasElement.prototype.getContext = () => mockCtx as unknown as CanvasRenderingContext2D;
});

const FONT = '500 14px Arial, sans-serif';
const WIDE = 600; // px — fits anything short on one line
const NARROW = 80; // px — forces wraps and ellipsis

describe('wrapLabelToTwoLines', () => {
  it('returns one line when text fits', async () => {
    const result = await wrapLabelToTwoLines('hello', FONT, WIDE);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0]).toBe('hello');
    expect(result.truncated).toBe(false);
  });

  it('wraps to two lines when needed', async () => {
    const result = await wrapLabelToTwoLines('the quick brown fox jumps over', FONT, NARROW);
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].length).toBeGreaterThan(0);
    expect(result.lines[1].length).toBeGreaterThan(0);
  });

  it('truncates the second line with ellipsis when text overflows two lines', async () => {
    const result = await wrapLabelToTwoLines(
      'the quick brown fox jumps over the lazy dog and then keeps going on and on',
      FONT,
      NARROW,
    );
    expect(result.lines.length).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.lines[1].endsWith('…')).toBe(true);
  });

  it('handles a single very long word by truncating with ellipsis', async () => {
    const result = await wrapLabelToTwoLines('supercalifragilisticexpialidocious', FONT, 60);
    expect(result.truncated).toBe(true);
    expect(result.lines[result.lines.length - 1].endsWith('…')).toBe(true);
  });

  it('handles CJK text without spaces (no crash, returns lines)', async () => {
    const result = await wrapLabelToTwoLines('蛋白质组学的研究方法和应用', FONT, NARROW);
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
    expect(result.lines.length).toBeLessThanOrEqual(2);
  });
});
