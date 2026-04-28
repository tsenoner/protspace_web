import { describe, it, expect } from 'vitest';
import { validatePublishState } from './publish-state-validate';

describe('validatePublishState', () => {
  it('returns empty for non-objects', () => {
    expect(validatePublishState(null)).toEqual({});
    expect(validatePublishState(undefined)).toEqual({});
    expect(validatePublishState('not-an-object')).toEqual({});
    expect(validatePublishState(42)).toEqual({});
    expect(validatePublishState([1, 2, 3])).toEqual({});
  });

  it('drops invalid overlay types', () => {
    const out = validatePublishState({
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
        { type: 'unknown' },
        { type: 'arrow' /* missing required fields */ },
        'not-an-object',
        null,
      ],
    });
    expect(out.overlays).toHaveLength(1);
    expect(out.overlays?.[0].type).toBe('circle');
  });

  it('drops overlays with out-of-range coords', () => {
    const out = validatePublishState({
      overlays: [
        {
          type: 'circle',
          cx: -0.5,
          cy: 0.5,
          rx: 0.1,
          ry: 0.1,
          rotation: 0,
          color: '#000',
          strokeWidth: 2,
        },
        {
          type: 'circle',
          cx: 1.5,
          cy: 0.5,
          rx: 0.1,
          ry: 0.1,
          rotation: 0,
          color: '#000',
          strokeWidth: 2,
        },
        { type: 'arrow', x1: 0, y1: 0, x2: 1, y2: 1, color: '#000', width: 2 },
      ],
    });
    expect(out.overlays).toHaveLength(1);
    expect(out.overlays?.[0].type).toBe('arrow');
  });

  it('rejects NaN/Infinity in coords', () => {
    const out = validatePublishState({
      overlays: [
        { type: 'arrow', x1: NaN, y1: 0, x2: 1, y2: 1, color: '#000', width: 2 },
        { type: 'arrow', x1: 0, y1: Infinity, x2: 1, y2: 1, color: '#000', width: 2 },
      ],
    });
    expect(out.overlays).toEqual([]);
  });

  it('drops insets with invalid rects', () => {
    const out = validatePublishState({
      insets: [
        {
          sourceRect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
          targetRect: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
          border: 2,
          connector: 'lines',
        },
        // Bad: w is negative
        {
          sourceRect: { x: 0.1, y: 0.1, w: -0.2, h: 0.2 },
          targetRect: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
          border: 2,
          connector: 'lines',
        },
        // Bad: connector value
        {
          sourceRect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
          targetRect: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
          border: 2,
          connector: 'arrows',
        },
      ],
    });
    expect(out.insets).toHaveLength(1);
  });

  it('keeps valid scalar fields', () => {
    const out = validatePublishState({
      preset: 'custom',
      sizeMode: 'flexible',
      widthPx: 2048,
      heightPx: 1024,
      dpi: 300,
      format: 'png',
      background: 'white',
      referenceWidth: 2048,
    });
    expect(out.preset).toBe('custom');
    expect(out.sizeMode).toBe('flexible');
    expect(out.widthPx).toBe(2048);
    expect(out.heightPx).toBe(1024);
    expect(out.dpi).toBe(300);
    expect(out.format).toBe('png');
    expect(out.background).toBe('white');
    expect(out.referenceWidth).toBe(2048);
  });

  it('drops out-of-range scalars', () => {
    const out = validatePublishState({
      widthPx: -1,
      heightPx: 0,
      dpi: NaN,
      format: 'jpeg',
      background: 'red',
      sizeMode: 'unknown',
    });
    expect(out.widthPx).toBeUndefined();
    expect(out.heightPx).toBeUndefined();
    expect(out.dpi).toBeUndefined();
    expect(out.format).toBeUndefined();
    expect(out.background).toBeUndefined();
    expect(out.sizeMode).toBeUndefined();
  });

  it('partial legend fields are kept independently', () => {
    const out = validatePublishState({
      legend: {
        visible: true,
        position: 'unknown-pos',
        widthPercent: 25,
        fontSizePx: 14,
        columns: 2,
        overflow: 'multi-column',
      },
    });
    expect(out.legend?.visible).toBe(true);
    expect(out.legend?.position).toBeUndefined();
    expect(out.legend?.widthPercent).toBe(25);
    expect(out.legend?.fontSizePx).toBe(14);
    expect(out.legend?.columns).toBe(2);
    expect(out.legend?.overflow).toBe('multi-column');
  });

  it('keeps a complete viewFingerprint', () => {
    const out = validatePublishState({
      viewFingerprint: { projection: 'umap', dimensionality: 2 },
    });
    expect(out.viewFingerprint).toEqual({ projection: 'umap', dimensionality: 2 });
  });

  it('drops viewFingerprint with missing fields', () => {
    expect(
      validatePublishState({ viewFingerprint: { projection: 'umap' } }).viewFingerprint,
    ).toBeUndefined();
    expect(
      validatePublishState({ viewFingerprint: { dimensionality: 2 } }).viewFingerprint,
    ).toBeUndefined();
  });
});
