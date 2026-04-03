import { describe, expect, it } from 'vitest';
import {
  buildSearchParamsWithExploreView,
  getResolvedExploreViewNormalization,
  parseExploreViewRequest,
  resolveExploreView,
} from './url-state';

describe('explore url state', () => {
  it('parses a bare URL without requested values', () => {
    const parsed = parseExploreViewRequest(new URLSearchParams(''));

    expect(parsed).toEqual({
      requested: {},
      present: {
        annotation: false,
        projection: false,
      },
      normalize: {
        annotation: false,
        projection: false,
      },
    });
  });

  it('uses the first duplicate value for requested params and marks them for normalization', () => {
    const parsed = parseExploreViewRequest(
      new URLSearchParams('annotation=ec&annotation=pfam&projection=UMAP&projection=PCA'),
    );

    expect(parsed).toEqual({
      requested: {
        annotation: 'ec',
        projection: 'UMAP',
      },
      present: {
        annotation: true,
        projection: true,
      },
      normalize: {
        annotation: true,
        projection: true,
      },
    });
  });

  it('treats empty values as invalid and normalizes them', () => {
    const parsed = parseExploreViewRequest(new URLSearchParams('annotation=&projection=%20'));
    const resolved = resolveExploreView(parsed.requested, ['ec', 'pfam'], ['UMAP', 'PCA']);

    expect(parsed).toEqual({
      requested: {},
      present: {
        annotation: true,
        projection: true,
      },
      normalize: {
        annotation: true,
        projection: true,
      },
    });
    expect(resolved).toEqual({
      effective: {
        annotation: 'ec',
        projection: 'UMAP',
      },
      matchesRequested: {
        annotation: false,
        projection: false,
      },
    });
    expect(getResolvedExploreViewNormalization(parsed, resolved!)).toEqual({
      annotation: true,
      projection: true,
    });
  });

  it('keeps both requested values when they are valid', () => {
    const parsed = parseExploreViewRequest(new URLSearchParams('annotation=pfam&projection=PCA'));
    const resolved = resolveExploreView(parsed.requested, ['ec', 'pfam'], ['UMAP', 'PCA']);

    expect(resolved).toEqual({
      effective: {
        annotation: 'pfam',
        projection: 'PCA',
      },
      matchesRequested: {
        annotation: true,
        projection: true,
      },
    });
    expect(getResolvedExploreViewNormalization(parsed, resolved!)).toEqual({
      annotation: false,
      projection: false,
    });
  });

  it('normalizes duplicate params even when the first values are valid', () => {
    const parsed = parseExploreViewRequest(
      new URLSearchParams('annotation=pfam&annotation=ec&projection=PCA&projection=UMAP'),
    );
    const resolved = resolveExploreView(parsed.requested, ['ec', 'pfam'], ['UMAP', 'PCA']);

    expect(resolved).toEqual({
      effective: {
        annotation: 'pfam',
        projection: 'PCA',
      },
      matchesRequested: {
        annotation: true,
        projection: true,
      },
    });
    expect(getResolvedExploreViewNormalization(parsed, resolved!)).toEqual({
      annotation: true,
      projection: true,
    });
  });

  it('resolves partial validity independently', () => {
    const parsed = parseExploreViewRequest(
      new URLSearchParams('annotation=pfam&projection=UNKNOWN'),
    );
    const resolved = resolveExploreView(parsed.requested, ['ec', 'pfam'], ['UMAP', 'PCA']);

    expect(resolved).toEqual({
      effective: {
        annotation: 'pfam',
        projection: 'UMAP',
      },
      matchesRequested: {
        annotation: true,
        projection: false,
      },
    });
    expect(getResolvedExploreViewNormalization(parsed, resolved!)).toEqual({
      annotation: false,
      projection: true,
    });
  });

  it('normalizes both keys when both requested values are invalid', () => {
    const parsed = parseExploreViewRequest(
      new URLSearchParams('annotation=unknown&projection=UNKNOWN'),
    );
    const resolved = resolveExploreView(parsed.requested, ['ec', 'pfam'], ['UMAP', 'PCA']);

    expect(resolved).toEqual({
      effective: {
        annotation: 'ec',
        projection: 'UMAP',
      },
      matchesRequested: {
        annotation: false,
        projection: false,
      },
    });
    expect(getResolvedExploreViewNormalization(parsed, resolved!)).toEqual({
      annotation: true,
      projection: true,
    });
  });

  it('returns null when the dataset has no available view options yet', () => {
    const parsed = parseExploreViewRequest(new URLSearchParams('annotation=ec&projection=UMAP'));

    expect(resolveExploreView(parsed.requested, [], ['UMAP'])).toBeNull();
    expect(resolveExploreView(parsed.requested, ['ec'], [])).toBeNull();
  });

  it('preserves unrelated params for user-driven writes', () => {
    const next = buildSearchParamsWithExploreView(
      new URLSearchParams('webglPerf=1&dataset=demo'),
      {
        annotation: 'pfam',
        projection: 'PCA',
      },
      { mode: 'user' },
    );

    expect(next.toString()).toBe('webglPerf=1&dataset=demo&annotation=pfam&projection=PCA');
  });

  it('normalizes only invalid keys during replace writes', () => {
    const next = buildSearchParamsWithExploreView(
      new URLSearchParams('annotation=pfam&projection=UNKNOWN&webglPerf=1'),
      {
        annotation: 'pfam',
        projection: 'UMAP',
      },
      {
        mode: 'normalize',
        normalize: {
          annotation: false,
          projection: true,
        },
      },
    );

    expect(next.toString()).toBe('annotation=pfam&projection=UMAP&webglPerf=1');
  });
});
