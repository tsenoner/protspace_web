import type { ProtspaceControlBar, ProtspaceScatterplot } from '@protspace/core';
import type { VisualizationData } from '@protspace/utils';
import type {
  EffectiveExploreView,
  ExploreViewChangeSource,
  ExploreViewRequestState,
} from './view-state';
import {
  cloneExploreViewRequest,
  createEmptyExploreViewRequest,
  getResolvedExploreViewNormalization,
  resolveExploreView,
} from './url-state';
import type { ExploreViewChange } from './types';

interface ViewControllerOptions {
  plotElement: ProtspaceScatterplot;
  controlBar: ProtspaceControlBar;
}

export interface ViewController {
  getCurrentEffectiveView(dataOverride?: VisualizationData): EffectiveExploreView | null;
  getLatestViewRequest(): ExploreViewRequestState;
  resolveLatestView(dataOverride?: VisualizationData): EffectiveExploreView | null;
  applyViewSelection(
    viewRequest: ExploreViewRequestState,
    source: ExploreViewChangeSource,
    dataOverride?: VisualizationData,
  ): EffectiveExploreView | null;
  applyLatestViewForDatasetLoad(dataOverride?: VisualizationData): EffectiveExploreView | null;
  setRequestedView(viewRequest: ExploreViewRequestState): void;
  handleUserAnnotationChange(): void;
  handleUserProjectionChange(): void;
  subscribeToViewChanges(callback: (change: ExploreViewChange) => void): () => void;
  dispose(): void;
}

export function createViewController({
  plotElement,
  controlBar,
}: ViewControllerOptions): ViewController {
  let latestViewRequest = createEmptyExploreViewRequest();
  let activeViewChangeSource: ExploreViewChangeSource | null = null;
  let activeViewChangeResetFrame = 0;
  const subscribers = new Set<(change: ExploreViewChange) => void>();

  const emitViewChange = (change: ExploreViewChange) => {
    subscribers.forEach((callback) => callback(change));
  };

  const scheduleActiveViewChangeSourceReset = (source: ExploreViewChangeSource) => {
    if (activeViewChangeResetFrame) {
      cancelAnimationFrame(activeViewChangeResetFrame);
    }

    activeViewChangeResetFrame = requestAnimationFrame(() => {
      if (activeViewChangeSource === source) {
        activeViewChangeSource = null;
      }
      activeViewChangeResetFrame = 0;
    });
  };

  const getViewOptions = (data: VisualizationData | undefined) => ({
    availableAnnotations: Object.keys(data?.annotations ?? {}),
    availableProjections: data?.projections?.map((projection) => projection.name) ?? [],
  });

  const getCurrentEffectiveView = (
    dataOverride?: VisualizationData,
  ): EffectiveExploreView | null => {
    const currentData = dataOverride ?? plotElement.getCurrentData?.();
    const { availableAnnotations, availableProjections } = getViewOptions(currentData);

    if (availableAnnotations.length === 0 || availableProjections.length === 0) {
      return null;
    }

    const projectionIndex =
      typeof plotElement.selectedProjectionIndex === 'number'
        ? plotElement.selectedProjectionIndex
        : availableProjections.indexOf(controlBar.selectedProjection);
    const projection =
      availableProjections[projectionIndex] ??
      controlBar.selectedProjection ??
      availableProjections[0];
    const annotation =
      plotElement.selectedAnnotation &&
      availableAnnotations.includes(plotElement.selectedAnnotation)
        ? plotElement.selectedAnnotation
        : controlBar.selectedAnnotation &&
            availableAnnotations.includes(controlBar.selectedAnnotation)
          ? controlBar.selectedAnnotation
          : availableAnnotations[0];

    return {
      annotation,
      projection,
    };
  };

  const selectProjection = (projection: string) => {
    const controlBarInternals = controlBar as unknown as {
      selectProjection?: (projectionName: string) => void;
    };

    if (typeof controlBarInternals.selectProjection === 'function') {
      controlBarInternals.selectProjection(projection);
      return;
    }

    controlBar.selectedProjection = projection;
    const projectionIndex = controlBar.projections.indexOf(projection);
    if (projectionIndex >= 0) {
      plotElement.selectedProjectionIndex = projectionIndex;
    }
    controlBar.dispatchEvent(
      new CustomEvent('projection-change', {
        detail: { projection },
        bubbles: true,
        composed: true,
      }),
    );
  };

  const selectAnnotation = (annotation: string) => {
    const controlBarInternals = controlBar as unknown as {
      handleAnnotationSelected?: (event: CustomEvent<{ annotation: string }>) => void;
    };

    if (typeof controlBarInternals.handleAnnotationSelected === 'function') {
      controlBarInternals.handleAnnotationSelected(
        new CustomEvent('annotation-select', {
          detail: { annotation },
        }),
      );
      return;
    }

    controlBar.selectedAnnotation = annotation;
    plotElement.selectedAnnotation = annotation;
    controlBar.dispatchEvent(
      new CustomEvent('annotation-change', {
        detail: { annotation },
        bubbles: true,
        composed: true,
      }),
    );
  };

  const resolveLatestView = (dataOverride?: VisualizationData) => {
    const currentData = dataOverride ?? plotElement.getCurrentData?.();
    const { availableAnnotations, availableProjections } = getViewOptions(currentData);
    const resolved = resolveExploreView(
      latestViewRequest.requested,
      availableAnnotations,
      availableProjections,
    );
    return resolved?.effective ?? null;
  };

  const applyViewSelection = (
    viewRequest: ExploreViewRequestState,
    source: ExploreViewChangeSource,
    dataOverride?: VisualizationData,
  ): EffectiveExploreView | null => {
    latestViewRequest = cloneExploreViewRequest(viewRequest);

    const currentData = dataOverride ?? plotElement.getCurrentData?.();
    const { availableAnnotations, availableProjections } = getViewOptions(currentData);
    const resolved = resolveExploreView(
      latestViewRequest.requested,
      availableAnnotations,
      availableProjections,
    );

    if (!resolved) {
      return null;
    }

    const currentView = getCurrentEffectiveView(currentData);
    const effective = resolved.effective;
    const projectionChanged = currentView?.projection !== effective.projection;
    const annotationChanged = currentView?.annotation !== effective.annotation;

    activeViewChangeSource = source;
    if (projectionChanged) {
      selectProjection(effective.projection);
    }
    if (annotationChanged) {
      selectAnnotation(effective.annotation);
    }
    scheduleActiveViewChangeSourceReset(source);

    emitViewChange({
      effective,
      source,
      normalize: getResolvedExploreViewNormalization(latestViewRequest, resolved),
    });

    return effective;
  };

  const emitCurrentUserViewChange = () => {
    if (activeViewChangeSource) {
      return;
    }

    const effective = getCurrentEffectiveView();
    if (!effective) {
      return;
    }

    emitViewChange({
      effective,
      source: 'user',
      normalize: {
        annotation: false,
        projection: false,
      },
    });
  };

  return {
    getCurrentEffectiveView,
    getLatestViewRequest: () => cloneExploreViewRequest(latestViewRequest),
    resolveLatestView,
    applyLatestViewForDatasetLoad(dataOverride?: VisualizationData) {
      return applyViewSelection(latestViewRequest, 'dataset-load', dataOverride);
    },
    applyViewSelection,
    setRequestedView(viewRequest: ExploreViewRequestState) {
      latestViewRequest = cloneExploreViewRequest(viewRequest);
      applyViewSelection(latestViewRequest, 'url');
    },
    handleUserAnnotationChange() {
      emitCurrentUserViewChange();
    },
    handleUserProjectionChange() {
      emitCurrentUserViewChange();
    },
    subscribeToViewChanges(callback: (change: ExploreViewChange) => void) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    dispose() {
      if (activeViewChangeResetFrame) {
        cancelAnimationFrame(activeViewChangeResetFrame);
        activeViewChangeResetFrame = 0;
      }
      subscribers.clear();
    },
  };
}
