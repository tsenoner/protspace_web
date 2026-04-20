import type { Indicator, Inset, InsetStep, AnnotationSnapshot } from '@protspace/core';

interface AddIndicatorInput {
  proteinId: string;
  label: string;
  dataCoords: [number, number];
}

interface SnapInsetInput {
  sourceTransform: { x: number; y: number; scale: number };
  capturedCanvas: HTMLCanvasElement | null;
  zoomFactor: number;
}

interface ConfirmInsetInput {
  position: { x: number; y: number };
  size: { width: number; height: number };
  shape: 'rectangle' | 'circle';
  label: string;
}

interface AnnotationControllerOptions {
  onChange?: () => void;
}

export interface AnnotationController {
  getIndicators(): Indicator[];
  addIndicator(input: AddIndicatorInput): void;
  removeIndicator(id: string): void;
  updateIndicator(id: string, patch: Partial<Pick<Indicator, 'label' | 'offsetPx'>>): void;

  getInsets(): Inset[];
  getInsetStep(): InsetStep;
  startInsetFraming(): void;
  snapInset(input: SnapInsetInput): void;
  confirmInset(input: ConfirmInsetInput): void;
  cancelInset(): void;
  removeInset(id: string): void;

  getSnapshot(): AnnotationSnapshot;
}

let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

export function createAnnotationController(
  options?: AnnotationControllerOptions,
): AnnotationController {
  const onChange = options?.onChange;
  let indicators: Indicator[] = [];
  let insets: Inset[] = [];
  let insetStep: InsetStep = 'idle';
  let pendingInset: Partial<Inset> | null = null;

  function notify() {
    onChange?.();
  }

  return {
    getIndicators() {
      return [...indicators];
    },

    addIndicator(input) {
      indicators = [
        ...indicators,
        {
          id: genId('ind'),
          proteinId: input.proteinId,
          label: input.label,
          dataCoords: input.dataCoords,
          offsetPx: [0, 0],
        },
      ];
      notify();
    },

    removeIndicator(id) {
      indicators = indicators.filter((i) => i.id !== id);
      notify();
    },

    updateIndicator(id, patch) {
      indicators = indicators.map((i) => (i.id === id ? { ...i, ...patch } : i));
      notify();
    },

    getInsets() {
      return [...insets];
    },

    getInsetStep() {
      return insetStep;
    },

    startInsetFraming() {
      insetStep = 'framing';
      pendingInset = {};
    },

    snapInset(input) {
      if (insetStep !== 'framing') return;
      pendingInset = {
        ...pendingInset,
        sourceTransform: input.sourceTransform,
        capturedCanvas: input.capturedCanvas,
        zoomFactor: input.zoomFactor,
      };
      insetStep = 'snapped';
    },

    confirmInset(input) {
      if (insetStep !== 'snapped' || !pendingInset) return;
      insets = [
        ...insets,
        {
          id: genId('inset'),
          sourceTransform: pendingInset.sourceTransform!,
          capturedCanvas: pendingInset.capturedCanvas ?? null,
          position: input.position,
          size: input.size,
          shape: input.shape,
          label: input.label,
          zoomFactor: pendingInset.zoomFactor ?? 1,
        },
      ];
      pendingInset = null;
      insetStep = 'idle';
      notify();
    },

    cancelInset() {
      pendingInset = null;
      insetStep = 'idle';
    },

    removeInset(id) {
      insets = insets.filter((i) => i.id !== id);
      notify();
    },

    getSnapshot(): AnnotationSnapshot {
      return {
        indicators: [...indicators],
        insets: insets.map(({ capturedCanvas: _, ...rest }) => rest),
      };
    },
  };
}
