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
  position: { x: number; y: number };
  size: { width: number; height: number };
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
  confirmInset(): void;
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
      notify();
    },

    snapInset(input) {
      if (insetStep !== 'framing') return;
      // Create the inset immediately so it appears on the canvas as a draggable box
      const id = genId('inset');
      pendingInset = {
        id,
        sourceTransform: input.sourceTransform,
        capturedCanvas: input.capturedCanvas,
        zoomFactor: input.zoomFactor,
        position: input.position,
        size: input.size,
        shape: 'rectangle' as const,
        label: `${input.zoomFactor}× zoom`,
      };
      // Add to visible insets so the user can drag it into position
      insets = [...insets, pendingInset as Inset];
      insetStep = 'snapped';
      notify();
    },

    confirmInset() {
      if (insetStep !== 'snapped' || !pendingInset) return;
      // Inset is already in the array from snap — just finalize
      pendingInset = null;
      insetStep = 'idle';
      notify();
    },

    cancelInset() {
      if (pendingInset?.id) {
        insets = insets.filter((i) => i.id !== pendingInset!.id);
      }
      pendingInset = null;
      insetStep = 'idle';
      notify();
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
