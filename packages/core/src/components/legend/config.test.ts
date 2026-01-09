import { describe, it, expect } from 'vitest';
import { SHAPE_PATH_GENERATORS } from './config';

describe('config', () => {
  describe('SHAPE_PATH_GENERATORS', () => {
    const testSize = 20;

    it('circle generates valid SVG arc path', () => {
      const path = SHAPE_PATH_GENERATORS.circle(testSize);
      expect(path).toContain('M');
      expect(path).toContain('A');
      // Two arcs form a complete circle
      expect((path.match(/A/g) || []).length).toBe(2);
    });

    it('square generates closed 4-sided path', () => {
      const path = SHAPE_PATH_GENERATORS.square(testSize);
      expect(path).toMatch(/^M.*L.*L.*L.*Z$/);
    });

    it('diamond generates closed 4-point path', () => {
      const path = SHAPE_PATH_GENERATORS.diamond(testSize);
      expect(path).toMatch(/^M.*L.*L.*L.*Z$/);
    });

    it('plus generates closed 12-point path', () => {
      const path = SHAPE_PATH_GENERATORS.plus(testSize);
      expect((path.match(/L/g) || []).length).toBe(11);
      expect(path).toContain('Z');
    });

    it('triangle-up generates closed 3-point path', () => {
      const path = SHAPE_PATH_GENERATORS['triangle-up'](testSize);
      expect((path.match(/L/g) || []).length).toBe(2);
      expect(path).toContain('Z');
    });

    it('triangle-down generates closed 3-point path', () => {
      const path = SHAPE_PATH_GENERATORS['triangle-down'](testSize);
      expect((path.match(/L/g) || []).length).toBe(2);
      expect(path).toContain('Z');
    });

    it('paths scale with size parameter', () => {
      const smallPath = SHAPE_PATH_GENERATORS.circle(10);
      const largePath = SHAPE_PATH_GENERATORS.circle(20);
      expect(largePath.length).toBeGreaterThanOrEqual(smallPath.length);
    });
  });
});
