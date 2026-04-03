import type {
  EffectiveExploreView,
  ExploreViewChangeSource,
  ExploreViewNormalization,
  ExploreViewRequestState,
  RequestedExploreView,
  ResolvedExploreView,
} from './view-state';

function getRequestedValue(searchParams: URLSearchParams, key: 'annotation' | 'projection') {
  if (!searchParams.has(key)) {
    return undefined;
  }

  const value = searchParams.get(key);
  if (value === null || value.trim() === '') {
    return undefined;
  }

  return value;
}

export function parseExploreViewRequest(searchParams: URLSearchParams): ExploreViewRequestState {
  const requested = {
    annotation: getRequestedValue(searchParams, 'annotation'),
    projection: getRequestedValue(searchParams, 'projection'),
  };

  return {
    requested,
    present: {
      annotation: searchParams.has('annotation'),
      projection: searchParams.has('projection'),
    },
    normalize: {
      annotation:
        (searchParams.has('annotation') && requested.annotation === undefined) ||
        searchParams.getAll('annotation').length > 1,
      projection:
        (searchParams.has('projection') && requested.projection === undefined) ||
        searchParams.getAll('projection').length > 1,
    },
  };
}

export function createEmptyExploreViewRequest(): ExploreViewRequestState {
  return {
    requested: {},
    present: {
      annotation: false,
      projection: false,
    },
    normalize: {
      annotation: false,
      projection: false,
    },
  };
}

export function cloneExploreViewRequest(
  requestState: ExploreViewRequestState,
): ExploreViewRequestState {
  return {
    requested: {
      annotation: requestState.requested.annotation,
      projection: requestState.requested.projection,
    },
    present: {
      annotation: requestState.present.annotation,
      projection: requestState.present.projection,
    },
    normalize: {
      annotation: requestState.normalize.annotation,
      projection: requestState.normalize.projection,
    },
  };
}

export function resolveExploreView(
  requested: RequestedExploreView,
  availableAnnotations: string[],
  availableProjections: string[],
): ResolvedExploreView | null {
  if (availableAnnotations.length === 0 || availableProjections.length === 0) {
    return null;
  }

  const requestedAnnotation = requested.annotation;
  const requestedProjection = requested.projection;
  const annotationIsValid =
    requestedAnnotation !== undefined && availableAnnotations.includes(requestedAnnotation);
  const projectionIsValid =
    requestedProjection !== undefined && availableProjections.includes(requestedProjection);

  return {
    effective: {
      annotation: annotationIsValid ? requestedAnnotation : availableAnnotations[0],
      projection: projectionIsValid ? requestedProjection : availableProjections[0],
    },
    matchesRequested: {
      annotation: annotationIsValid,
      projection: projectionIsValid,
    },
  };
}

export function getResolvedExploreViewNormalization(
  requestState: ExploreViewRequestState,
  resolved: ResolvedExploreView,
): ExploreViewNormalization {
  return {
    annotation:
      requestState.normalize.annotation ||
      (requestState.present.annotation && !resolved.matchesRequested.annotation),
    projection:
      requestState.normalize.projection ||
      (requestState.present.projection && !resolved.matchesRequested.projection),
  };
}

export function buildSearchParamsWithExploreView(
  searchParams: URLSearchParams,
  effective: EffectiveExploreView,
  options:
    | {
        mode: 'user';
      }
    | {
        mode: 'normalize';
        normalize: ExploreViewNormalization;
      },
) {
  const next = new URLSearchParams(searchParams);

  if (options.mode === 'user') {
    next.set('annotation', effective.annotation);
    next.set('projection', effective.projection);
    return next;
  }

  if (options.normalize.annotation) {
    next.set('annotation', effective.annotation);
  }

  if (options.normalize.projection) {
    next.set('projection', effective.projection);
  }

  return next;
}

export function getExploreViewSearchParamsUpdate(
  searchParams: URLSearchParams,
  change: {
    effective: EffectiveExploreView;
    source: ExploreViewChangeSource;
    normalize: ExploreViewNormalization;
  },
  options: {
    pendingUrlRequest: boolean;
  },
): { next: URLSearchParams; replace: boolean } | null {
  if (change.source === 'user' && !options.pendingUrlRequest) {
    const next = buildSearchParamsWithExploreView(searchParams, change.effective, {
      mode: 'user',
    });
    return next.toString() === searchParams.toString() ? null : { next, replace: false };
  }

  if (!change.normalize.annotation && !change.normalize.projection) {
    return null;
  }

  const next = buildSearchParamsWithExploreView(searchParams, change.effective, {
    mode: 'normalize',
    normalize: change.normalize,
  });

  return next.toString() === searchParams.toString() ? null : { next, replace: true };
}
