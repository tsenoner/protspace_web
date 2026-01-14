/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ReactiveControllerHost } from 'lit';
import { DragController, type DragCallbacks } from './drag-controller';
import type { LegendItem } from '../types';
import { LEGEND_DEFAULTS } from '../config';

describe('DragController', () => {
  let controller: DragController;
  let mockHost: ReactiveControllerHost;
  let mockCallbacks: DragCallbacks;
  let mockLegendItems: LegendItem[];

  beforeEach(() => {
    vi.useFakeTimers();

    mockLegendItems = [
      { value: 'cat1', zOrder: 0, color: '#ff0000', shape: 'circle', count: 10, isVisible: true },
      { value: 'cat2', zOrder: 1, color: '#00ff00', shape: 'circle', count: 8, isVisible: true },
      { value: 'cat3', zOrder: 2, color: '#0000ff', shape: 'circle', count: 6, isVisible: true },
      { value: 'Other', zOrder: 3, color: '#999999', shape: 'circle', count: 4, isVisible: true },
    ] as LegendItem[];

    mockHost = {
      addController: vi.fn(),
      removeController: vi.fn(),
      requestUpdate: vi.fn(),
      updateComplete: Promise.resolve(true),
    };

    mockCallbacks = {
      getLegendItems: vi.fn().mockReturnValue(mockLegendItems),
      setLegendItems: vi.fn(),
      onReorder: vi.fn(),
    };

    controller = new DragController(mockHost, mockCallbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hostDisconnected', () => {
    it('clears pending timeouts', () => {
      controller.handleDragStart(mockLegendItems[0]);

      const event = new Event('dragover') as DragEvent;
      Object.defineProperty(event, 'dataTransfer', { value: { dropEffect: 'none' } });
      controller.handleDragOver(event as DragEvent, mockLegendItems[1]);

      controller.hostDisconnected();
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout + 100);
      expect(mockCallbacks.setLegendItems).not.toHaveBeenCalled();
    });
  });

  describe('isDragging', () => {
    it('tracks dragging state correctly', () => {
      expect(controller.isDragging(0)).toBe(false);

      controller.handleDragStart(mockLegendItems[1]);
      expect(controller.isDragging(1)).toBe(true);
      expect(controller.isDragging(0)).toBe(false);

      controller.handleDragEnd();
      expect(controller.isDragging(1)).toBe(false);
    });
  });

  describe('handleDragStart', () => {
    it('sets dragged item index correctly', () => {
      controller.handleDragStart(mockLegendItems[2]);
      expect(controller.draggedItemIndex).toBe(2);
    });

    it('sets index to -1 for item not in list', () => {
      const unknownItem = { value: 'unknown', zOrder: 0 } as LegendItem;
      controller.handleDragStart(unknownItem);
      expect(controller.draggedItemIndex).toBe(-1);
    });

    it('clears any existing timeout', () => {
      controller.handleDragStart(mockLegendItems[0]);

      const event = new Event('dragover') as DragEvent;
      Object.defineProperty(event, 'dataTransfer', { value: { dropEffect: 'none' } });
      controller.handleDragOver(event as DragEvent, mockLegendItems[1]);

      controller.handleDragStart(mockLegendItems[2]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout + 100);
      expect(mockCallbacks.setLegendItems).not.toHaveBeenCalled();
    });
  });

  describe('handleDragOver', () => {
    let mockEvent: DragEvent;

    beforeEach(() => {
      mockEvent = new Event('dragover') as DragEvent;
      Object.defineProperty(mockEvent, 'dataTransfer', {
        value: { dropEffect: 'none' },
        writable: true,
      });
      Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() });
    });

    it('prevents default and sets dropEffect', () => {
      controller.handleDragStart(mockLegendItems[0]);
      controller.handleDragOver(mockEvent, mockLegendItems[1]);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.dataTransfer!.dropEffect).toBe('move');
    });

    it('does nothing when not dragging or dragging over same item', () => {
      controller.handleDragOver(mockEvent, mockLegendItems[1]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout + 100);
      expect(mockCallbacks.setLegendItems).not.toHaveBeenCalled();

      controller.handleDragStart(mockLegendItems[1]);
      controller.handleDragOver(mockEvent, mockLegendItems[1]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout + 100);
      expect(mockCallbacks.setLegendItems).not.toHaveBeenCalled();
    });

    it('triggers reorder after timeout', () => {
      controller.handleDragStart(mockLegendItems[0]);
      controller.handleDragOver(mockEvent, mockLegendItems[2]);

      expect(mockCallbacks.setLegendItems).not.toHaveBeenCalled();
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout);

      expect(mockCallbacks.setLegendItems).toHaveBeenCalled();
      expect(mockCallbacks.onReorder).toHaveBeenCalled();
    });

    it('reorders items correctly (move down)', () => {
      controller.handleDragStart(mockLegendItems[0]);
      controller.handleDragOver(mockEvent, mockLegendItems[2]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout);

      const newItems = (mockCallbacks.setLegendItems as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as LegendItem[];
      expect(newItems[0].value).toBe('cat2');
      expect(newItems[1].value).toBe('cat1');
      expect(newItems[2].value).toBe('cat3');
    });

    it('reorders items correctly (move up)', () => {
      controller.handleDragStart(mockLegendItems[2]);
      controller.handleDragOver(mockEvent, mockLegendItems[0]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout);

      const newItems = (mockCallbacks.setLegendItems as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as LegendItem[];
      expect(newItems[0].value).toBe('cat3');
      expect(newItems[1].value).toBe('cat1');
      expect(newItems[2].value).toBe('cat2');
    });

    it('updates zOrder on all items after reorder', () => {
      controller.handleDragStart(mockLegendItems[0]);
      controller.handleDragOver(mockEvent, mockLegendItems[2]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout);

      const newItems = (mockCallbacks.setLegendItems as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as LegendItem[];
      newItems.forEach((item, idx) => {
        expect(item.zOrder).toBe(idx);
      });
    });

    it('clears previous timeout on new dragover', () => {
      controller.handleDragStart(mockLegendItems[0]);
      controller.handleDragOver(mockEvent, mockLegendItems[1]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout / 2);

      controller.handleDragOver(mockEvent, mockLegendItems[2]);
      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout / 2);
      expect(mockCallbacks.setLegendItems).not.toHaveBeenCalled();

      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout / 2);
      expect(mockCallbacks.setLegendItems).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleDrop', () => {
    it('prevents default and ends drag', () => {
      const mockEvent = new Event('drop') as DragEvent;
      Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() });

      controller.handleDragStart(mockLegendItems[0]);
      controller.handleDrop(mockEvent, mockLegendItems[1]);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(controller.draggedItemIndex).toBe(-1);
    });
  });

  describe('handleDragEnd', () => {
    it('resets state and clears pending timeout', () => {
      controller.handleDragStart(mockLegendItems[0]);

      const mockEvent = new Event('dragover') as DragEvent;
      Object.defineProperty(mockEvent, 'dataTransfer', { value: { dropEffect: 'none' } });
      Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() });
      controller.handleDragOver(mockEvent, mockLegendItems[1]);

      controller.handleDragEnd();
      expect(controller.draggedItemIndex).toBe(-1);

      vi.advanceTimersByTime(LEGEND_DEFAULTS.dragTimeout + 100);
      expect(mockCallbacks.setLegendItems).not.toHaveBeenCalled();
    });
  });
});
