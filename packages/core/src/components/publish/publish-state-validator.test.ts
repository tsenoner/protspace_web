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

  it('drops overlays with coords outside [0,1]', () => {
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
      ],
    });
    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0]).toMatchObject({ cx: 0.5, cy: 0.5 });
  });

  it('drops overlays with non-positive size fields', () => {
    const result = sanitizePublishState({
      overlays: [
        {
          type: 'circle',
          cx: 0.5,
          cy: 0.5,
          rx: 0,
          ry: 0.1,
          rotation: 0,
          color: '#000',
          strokeWidth: 2,
        },
        {
          type: 'circle',
          cx: 0.5,
          cy: 0.5,
          rx: 0.1,
          ry: 0.1,
          rotation: 0,
          color: '#000',
          strokeWidth: 0,
        },
        { type: 'arrow', x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5, color: '#000', width: -1 },
        { type: 'label', x: 0.5, y: 0.5, text: 'x', fontSize: 0, rotation: 0, color: '#000' },
      ],
    });
    expect(result.overlays).toHaveLength(0);
  });

  it('drops insets whose rects extend past plot bounds', () => {
    const result = sanitizePublishState({
      insets: [
        {
          sourceRect: { x: 0.9, y: 0, w: 0.5, h: 0.5 },
          targetRect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
          border: 1,
          connector: 'lines',
        },
        {
          sourceRect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
          targetRect: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
          border: 1,
          connector: 'lines',
        },
      ],
    });
    expect(result.insets).toHaveLength(1);
  });

  it('drops insets with unknown connector', () => {
    const result = sanitizePublishState({
      insets: [
        {
          sourceRect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
          targetRect: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
          border: 1,
          connector: 'rainbow',
        },
      ],
    });
    expect(result.insets).toHaveLength(0);
  });

  it('rejects non-positive widthPx/heightPx/dpi and falls back to defaults', () => {
    const defaults = createDefaultPublishState();
    const result = sanitizePublishState({ widthPx: 0, heightPx: -10, dpi: 0 });
    expect(result.widthPx).toBe(defaults.widthPx);
    expect(result.heightPx).toBe(defaults.heightPx);
    expect(result.dpi).toBe(defaults.dpi);
  });

  it('rejects widthPx/heightPx/referenceWidth above the canvas dim cap', () => {
    const defaults = createDefaultPublishState();
    const result = sanitizePublishState({
      widthPx: 50_000,
      heightPx: 16_385,
      referenceWidth: 100_000,
    });
    expect(result.widthPx).toBe(defaults.widthPx);
    expect(result.heightPx).toBe(defaults.heightPx);
    expect(result.referenceWidth).toBe(defaults.referenceWidth);
  });

  it('preserves widthPx/heightPx exactly at the cap', () => {
    const result = sanitizePublishState({ widthPx: 8192, heightPx: 8192 });
    expect(result.widthPx).toBe(8192);
    expect(result.heightPx).toBe(8192);
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

  it('defaults resample/aspectLocked/unit when missing', () => {
    const result = sanitizePublishState({});
    expect(result.resample).toBe(true);
    expect(result.aspectLocked).toBe(true);
    expect(result.unit).toBe('mm');
  });

  it('preserves valid resample/aspectLocked/unit', () => {
    const result = sanitizePublishState({
      resample: false,
      aspectLocked: false,
      unit: 'in',
    });
    expect(result.resample).toBe(false);
    expect(result.aspectLocked).toBe(false);
    expect(result.unit).toBe('in');
  });

  it('rejects unknown unit and falls back to default', () => {
    const result = sanitizePublishState({ unit: 'parsec' });
    expect(result.unit).toBe('mm');
  });

  it('rejects non-boolean resample/aspectLocked and falls back to defaults', () => {
    const result = sanitizePublishState({ resample: 'yes', aspectLocked: 1 });
    expect(result.resample).toBe(true);
    expect(result.aspectLocked).toBe(true);
  });
});
