import { describe, it, expect, vi } from 'vitest';
import { createAnnotationController } from './annotation-controller';

function makeController() {
  return createAnnotationController();
}

describe('annotation-controller', () => {
  describe('indicators', () => {
    it('starts with no indicators', () => {
      const ctrl = makeController();
      expect(ctrl.getIndicators()).toEqual([]);
    });

    it('adds an indicator and assigns an id', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P0DM09', label: 'P0DM09', dataCoords: [10, 20] });
      const indicators = ctrl.getIndicators();
      expect(indicators).toHaveLength(1);
      expect(indicators[0].proteinId).toBe('P0DM09');
      expect(indicators[0].label).toBe('P0DM09');
      expect(indicators[0].dataCoords).toEqual([10, 20]);
      expect(indicators[0].offsetPx).toEqual([0, 0]);
      expect(indicators[0].id).toBeTruthy();
    });

    it('removes an indicator by id', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      const id = ctrl.getIndicators()[0].id;
      ctrl.removeIndicator(id);
      expect(ctrl.getIndicators()).toEqual([]);
    });

    it('updates indicator label', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      const id = ctrl.getIndicators()[0].id;
      ctrl.updateIndicator(id, { label: 'Custom Label' });
      expect(ctrl.getIndicators()[0].label).toBe('Custom Label');
    });

    it('updates indicator offset', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      const id = ctrl.getIndicators()[0].id;
      ctrl.updateIndicator(id, { offsetPx: [15, -10] as [number, number] });
      expect(ctrl.getIndicators()[0].offsetPx).toEqual([15, -10]);
    });
  });

  describe('insets', () => {
    it('starts with no insets', () => {
      const ctrl = makeController();
      expect(ctrl.getInsets()).toEqual([]);
    });

    it('adds an inset in framing state', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      expect(ctrl.getInsetStep()).toBe('framing');
    });

    it('snaps an inset with transform data', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 100, y: 50, scale: 2.4 },
        capturedCanvas: null,
        zoomFactor: 2.4,
      });
      expect(ctrl.getInsetStep()).toBe('snapped');
    });

    it('confirms inset with position and adds to list', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 100, y: 50, scale: 2.4 },
        capturedCanvas: null,
        zoomFactor: 2.4,
      });
      ctrl.confirmInset({
        position: { x: 0.8, y: 0.1 },
        size: { width: 0.25, height: 0.2 },
        shape: 'rectangle',
        label: 'Kunitz cluster',
      });
      expect(ctrl.getInsetStep()).toBe('idle');
      expect(ctrl.getInsets()).toHaveLength(1);
      expect(ctrl.getInsets()[0].label).toBe('Kunitz cluster');
      expect(ctrl.getInsets()[0].shape).toBe('rectangle');
    });

    it('cancels inset framing and resets step', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.cancelInset();
      expect(ctrl.getInsetStep()).toBe('idle');
      expect(ctrl.getInsets()).toEqual([]);
    });

    it('removes an inset by id', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 0, y: 0, scale: 1 },
        capturedCanvas: null,
        zoomFactor: 1,
      });
      ctrl.confirmInset({
        position: { x: 0, y: 0 },
        size: { width: 0.2, height: 0.2 },
        shape: 'rectangle',
        label: '',
      });
      const id = ctrl.getInsets()[0].id;
      ctrl.removeInset(id);
      expect(ctrl.getInsets()).toEqual([]);
    });
  });

  describe('snapshot', () => {
    it('produces a serializable snapshot without canvas references', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [5, 10] });
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 0, y: 0, scale: 2 },
        capturedCanvas: null,
        zoomFactor: 2,
      });
      ctrl.confirmInset({
        position: { x: 0.5, y: 0.5 },
        size: { width: 0.3, height: 0.3 },
        shape: 'circle',
        label: 'Test',
      });

      const snap = ctrl.getSnapshot();
      expect(snap.indicators).toHaveLength(1);
      expect(snap.insets).toHaveLength(1);
      expect(snap.insets[0]).not.toHaveProperty('capturedCanvas');
    });
  });

  describe('change callback', () => {
    it('fires onChange when indicators change', () => {
      const onChange = vi.fn();
      const ctrl = createAnnotationController({ onChange });
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('fires onChange when inset is confirmed', () => {
      const onChange = vi.fn();
      const ctrl = createAnnotationController({ onChange });
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 0, y: 0, scale: 1 },
        capturedCanvas: null,
        zoomFactor: 1,
      });
      ctrl.confirmInset({
        position: { x: 0, y: 0 },
        size: { width: 0.2, height: 0.2 },
        shape: 'rectangle',
        label: '',
      });
      expect(onChange).toHaveBeenCalled();
    });
  });
});
