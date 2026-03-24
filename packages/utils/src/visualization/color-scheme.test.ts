import { describe, expect, it } from 'vitest';
import {
  CIVIDIS_COLORS,
  createColorSchemeLinearGradient,
  getColorSchemeStops,
  sampleColorSchemeColor,
} from './color-scheme';

describe('color-scheme helpers', () => {
  it('returns configured stops for known palettes', () => {
    expect(getColorSchemeStops('cividis')).toEqual(CIVIDIS_COLORS);
  });

  it('falls back to the default categorical palette for unknown palette ids', () => {
    expect(getColorSchemeStops('unknown-palette')).toHaveLength(21);
  });

  it('creates a linear-gradient CSS string from palette stops', () => {
    expect(createColorSchemeLinearGradient('cividis')).toBe(
      `linear-gradient(90deg, ${CIVIDIS_COLORS.join(', ')})`,
    );
  });

  it('samples interpolated colors from the shared palette model', () => {
    expect(sampleColorSchemeColor('cividis', 0)).toBe('#00224E');
    expect(sampleColorSchemeColor('cividis', 1)).toBe('#FEE838');
    expect(sampleColorSchemeColor('cividis', 0.5)).not.toBe('#00224E');
  });
});
