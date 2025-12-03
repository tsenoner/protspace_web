// ============================================================================
// Color Parsing Utilities
// ============================================================================

const COLOR_CACHE = new Map<string, [number, number, number]>();

const COLOR_PARSER_CTX = (() => {
  try {
    return document.createElement('canvas').getContext('2d');
  } catch {
    return null;
  }
})();

/**
 * Resolves a CSS color string to normalized RGB values [0-1, 0-1, 0-1].
 * Uses canvas context for accurate color parsing and caches results.
 */
export function resolveColor(color: string): [number, number, number] {
  const cached = COLOR_CACHE.get(color);
  if (cached) return cached;

  if (!COLOR_PARSER_CTX) {
    return [1, 1, 1];
  }

  COLOR_PARSER_CTX.fillStyle = '#ffffff';
  COLOR_PARSER_CTX.fillStyle = color;
  const normalized = COLOR_PARSER_CTX.fillStyle;

  if (typeof normalized === 'string' && normalized.startsWith('#')) {
    const hex = normalized.slice(1);
    const fullHex =
      hex.length === 3
        ? hex.split('').map((c) => c + c).join('')
        : hex;
    const r = parseInt(fullHex.slice(0, 2), 16) / 255;
    const g = parseInt(fullHex.slice(2, 4), 16) / 255;
    const b = parseInt(fullHex.slice(4, 6), 16) / 255;
    const rgb: [number, number, number] = [r, g, b];
    COLOR_CACHE.set(color, rgb);
    return rgb;
  }

  return [1, 1, 1];
}

/**
 * Clears the color cache. Useful for testing or when memory needs to be freed.
 */
export function clearColorCache(): void {
  COLOR_CACHE.clear();
}

