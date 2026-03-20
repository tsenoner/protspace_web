import { describe, it, expect } from 'vitest';
import { legendBodyPt, mmToPx, ptToPx, PRINT_DPI_DEFAULT } from './typography';

describe('ptToPx / mmToPx', () => {
  it('converts 72 pt to dpi pixels', () => {
    expect(ptToPx(72, 300)).toBe(300);
  });

  it('converts 25.4 mm to 300 px at 300 dpi', () => {
    expect(mmToPx(25.4, 300)).toBe(300);
  });

  it('uses print dpi default', () => {
    expect(ptToPx(10)).toBe((10 * PRINT_DPI_DEFAULT) / 72);
  });
});

describe('legendBodyPt', () => {
  it('clamps to [7, 10]', () => {
    expect(legendBodyPt(40, 1, 5)).toBeGreaterThanOrEqual(7);
    expect(legendBodyPt(40, 1, 5)).toBeLessThanOrEqual(10);
  });

  it('uses displayed count for density', () => {
    const low = legendBodyPt(30, 2, 5);
    const high = legendBodyPt(30, 80, 5);
    expect(high).toBeLessThanOrEqual(low);
  });
});
