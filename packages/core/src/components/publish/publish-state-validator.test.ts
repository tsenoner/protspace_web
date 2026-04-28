/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { sanitizePublishState } from './publish-state-validator';
import { createDefaultPublishState } from './publish-state';

describe('sanitizePublishState', () => {
  it('returns defaults for null/undefined/non-object', () => {
    expect(sanitizePublishState(null)).toEqual(createDefaultPublishState());
    expect(sanitizePublishState(undefined)).toEqual(createDefaultPublishState());
    expect(sanitizePublishState('garbage')).toEqual(createDefaultPublishState());
    expect(sanitizePublishState([])).toEqual(createDefaultPublishState());
  });

  it('drops overlays with unknown type', () => {
    const result = sanitizePublishState({
      overlays: [
        {
          type: 'circle',
          cx: 0.5,
          cy: 0.5,
          rx: 0.1,
          ry: 0.1,
          rotation: 0,
          color: '#000',
          strokeWidth: 2,
        },
        { type: 'unicorn', x: 0.5, y: 0.5 },
      ],
    });
    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0].type).toBe('circle');
  });

  it('clamps overlay coords to [0,1]', () => {
    const result = sanitizePublishState({
      overlays: [
        {
          type: 'circle',
          cx: 1.5,
          cy: -0.2,
          rx: 0.1,
          ry: 0.1,
          rotation: 0,
          color: '#000',
          strokeWidth: 2,
        },
      ],
    });
    expect(result.overlays[0]).toMatchObject({ cx: 1, cy: 0 });
  });

  it('drops overlays whose required fields are not finite numbers', () => {
    const result = sanitizePublishState({
      overlays: [{ type: 'arrow', x1: NaN, y1: 0.2, x2: 0.5, y2: 0.5, color: '#000', width: 2 }],
    });
    expect(result.overlays).toHaveLength(0);
  });

  it('drops insets with malformed rects', () => {
    const result = sanitizePublishState({
      insets: [
        {
          sourceRect: { x: 0, y: 0, w: 0.2, h: 0.2 },
          targetRect: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
          border: 1,
          connector: 'lines',
        },
        { sourceRect: { x: 'oops' }, targetRect: {}, border: 1, connector: 'lines' },
      ],
    });
    expect(result.insets).toHaveLength(1);
  });

  it('preserves valid scalar fields', () => {
    const result = sanitizePublishState({ widthPx: 4096, heightPx: 2048, dpi: 600, format: 'pdf' });
    expect(result.widthPx).toBe(4096);
    expect(result.heightPx).toBe(2048);
    expect(result.dpi).toBe(600);
    expect(result.format).toBe('pdf');
  });

  it('rejects non-finite scalars and falls back to defaults', () => {
    const defaults = createDefaultPublishState();
    const result = sanitizePublishState({ widthPx: NaN, heightPx: Infinity });
    expect(result.widthPx).toBe(defaults.widthPx);
    expect(result.heightPx).toBe(defaults.heightPx);
  });

  it('drops unknown preset strings and falls back to default', () => {
    const result = sanitizePublishState({ preset: 'hacker-mode' });
    expect(result.preset).toBe('flexible'); // createDefaultPublishState's default
  });

  it('preserves valid preset ids', () => {
    expect(sanitizePublishState({ preset: 'nature-1col' }).preset).toBe('nature-1col');
    expect(sanitizePublishState({ preset: 'cell-1p5col' }).preset).toBe('cell-1p5col');
    expect(sanitizePublishState({ preset: 'custom' }).preset).toBe('custom');
  });
});
