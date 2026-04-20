import { describe, it, expect } from 'vitest';
import { computeConnectorLines } from './inset-tool';

describe('inset-tool', () => {
  describe('computeConnectorLines', () => {
    it('returns two lines from source corners to inset corners', () => {
      const source = { x: 100, y: 100, width: 200, height: 150 };
      const inset = { x: 500, y: 50, width: 180, height: 135 };
      const lines = computeConnectorLines(source, inset);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual({ x1: 100, y1: 100, x2: 500, y2: 50 });
      expect(lines[1]).toEqual({ x1: 300, y1: 250, x2: 680, y2: 185 });
    });

    it('handles source to the right of inset', () => {
      const source = { x: 500, y: 100, width: 100, height: 100 };
      const inset = { x: 50, y: 50, width: 120, height: 90 };
      const lines = computeConnectorLines(source, inset);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual({ x1: 600, y1: 100, x2: 170, y2: 50 });
      expect(lines[1]).toEqual({ x1: 500, y1: 200, x2: 50, y2: 140 });
    });
  });
});
