// ============================================================================
// Color Parsing Utilities
// ============================================================================

const COLOR_CACHE = new Map<string, [number, number, number]>();

const COLOR_PARSER_CTX = (() => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.getContext('2d');
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

  const ctx = COLOR_PARSER_CTX;
  if (!ctx) {
    return cloneRgb(DEFAULT_RGB);
  }

  try {
    ctx.fillStyle = color;
  } catch {
    return cloneRgb(DEFAULT_RGB);
  }

  const normalized = ctx.fillStyle;
  const parsed = typeof normalized === 'string' ? parseNormalizedColor(ctx, normalized) : null;

  const rgb = parsed ?? DEFAULT_RGB;
  const result = cloneRgb(rgb);
  COLOR_CACHE.set(color, result);
  return result;
}

/**
 * Clears the color cache. Useful for testing or when memory needs to be freed.
 */
export function clearColorCache(): void {
  COLOR_CACHE.clear();
}

const DEFAULT_RGB: [number, number, number] = [1, 1, 1];

function parseNormalizedColor(
  ctx: CanvasRenderingContext2D,
  normalized: string
): [number, number, number] | null {
  const hex = parseHexColor(normalized);
  if (hex) return hex;

  const rgb = parseRgbString(normalized);
  if (rgb) return rgb;

  return sampleContextColor(ctx);
}

function parseHexColor(normalized: string): [number, number, number] | null {
  if (!normalized.startsWith('#')) return null;
  const hex = normalized.slice(1);

  let r: number;
  let g: number;
  let b: number;

  if (hex.length === 3 || hex.length === 4) {
    const full = hex
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else if (hex.length === 6 || hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return null;
  }

  return [toUnit(r), toUnit(g), toUnit(b)];
}

function parseRgbString(normalized: string): [number, number, number] | null {
  const match = normalized.match(/^rgba?\s*\((.+)\)$/i);
  if (!match) return null;

  const body = match[1].replace(/\//g, ',').trim();
  const parts = body.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const components: number[] = [];
  for (let i = 0; i < 3; i++) {
    const parsed = parseRgbComponent(parts[i]);
    if (parsed === null) {
      return null;
    }
    components.push(parsed);
  }

  return components as [number, number, number];
}

function parseRgbComponent(component: string): number | null {
  const trimmed = component.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith('%')) {
    const percent = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(percent)) return null;
    return clampUnit(percent / 100);
  }

  const value = parseFloat(trimmed);
  if (!Number.isFinite(value)) return null;
  return clampUnit(value / 255);
}

function sampleContextColor(ctx: CanvasRenderingContext2D): [number, number, number] | null {
  const canvas = ctx.canvas;
  if (!canvas) return null;

  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);

    const data = ctx.getImageData(0, 0, 1, 1).data;
    if (data.length < 4) return null;

    const alpha = clampUnit(data[3] / 255);
    if (alpha === 0) {
      return [0, 0, 0];
    }

    const r = clampUnit(data[0] / 255);
    const g = clampUnit(data[1] / 255);
    const b = clampUnit(data[2] / 255);

    if (alpha > 0 && alpha < 1) {
      return [clampUnit(r / alpha), clampUnit(g / alpha), clampUnit(b / alpha)];
    }

    return [r, g, b];
  } catch {
    return null;
  } finally {
    ctx.globalAlpha = prevAlpha;
    ctx.globalCompositeOperation = prevComposite;
  }
}

function toUnit(value: number): number {
  return clampUnit(value / 255);
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function cloneRgb(rgb: [number, number, number]): [number, number, number] {
  return [rgb[0], rgb[1], rgb[2]];
}
