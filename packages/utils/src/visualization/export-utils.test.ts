import { describe, it, expect } from 'vitest';
import { ProtSpaceExporter } from './export-utils';

describe('ProtSpaceExporter.validateCanvasDimensions', () => {
  it('should accept small dimensions', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](2000, 1000);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should accept 6000px dimensions', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](6000, 3000);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should accept dimensions up to ~7782px (95% of 8192)', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](7700, 4000);
    expect(result.isValid).toBe(true);
  });

  it('should reject dimensions exceeding 8192px limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](8500, 4000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('8192px');
  });

  it('should reject very large dimensions that exceed area limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](20000, 20000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should handle non-square aspect ratios', () => {
    // Wide but within limits
    const result1 = ProtSpaceExporter['validateCanvasDimensions'](7000, 2000);
    expect(result1.isValid).toBe(true);

    // Tall but within limits
    const result2 = ProtSpaceExporter['validateCanvasDimensions'](2000, 7000);
    expect(result2.isValid).toBe(true);
  });

  it('should reject if width exceeds limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](9000, 1000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('limit');
  });

  it('should reject if height exceeds limit', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](1000, 9000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('limit');
  });

  it('should accept maximum safe dimensions', () => {
    // 95% of 8192 = 7782
    const maxSafe = Math.floor(8192 * 0.95);
    const result = ProtSpaceExporter['validateCanvasDimensions'](maxSafe, maxSafe);
    expect(result.isValid).toBe(true);
  });

  it('should accept very small dimensions', () => {
    const result = ProtSpaceExporter['validateCanvasDimensions'](100, 100);
    expect(result.isValid).toBe(true);
  });
});
