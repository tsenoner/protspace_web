export interface RequestedExploreView {
  annotation?: string;
  projection?: string;
}

export interface ExploreViewNormalization {
  annotation: boolean;
  projection: boolean;
}

export interface ExploreViewRequestState {
  requested: RequestedExploreView;
  present: {
    annotation: boolean;
    projection: boolean;
  };
  normalize: ExploreViewNormalization;
}

export interface EffectiveExploreView {
  annotation: string;
  projection: string;
}

export interface ResolvedExploreView {
  effective: EffectiveExploreView;
  matchesRequested: {
    annotation: boolean;
    projection: boolean;
  };
}

export type ExploreViewChangeSource = 'user' | 'url' | 'dataset-load';
