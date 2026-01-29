/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactiveControllerHost } from 'lit';
import { DragController, type DragCallbacks } from './drag-controller';
import type { LegendItem } from '../types';

describe('DragController', () => {
  let controller: DragController;
  let mockHost: ReactiveControllerHost;
  let mockCallbacks: DragCallbacks;
  let mockLegendItems: LegendItem[];
  let mockContainer: HTMLElement;

  beforeEach(() => {
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
      onMergeToOther: vi.fn(),
      onSortModeChange: vi.fn(),
    };

    mockContainer = document.createElement('div');
    mockContainer.className = 'legend-items';

    // Add mock legend item elements with data-value attributes
    mockLegendItems.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'legend-item';
      el.setAttribute('data-value', item.value);
      mockContainer.appendChild(el);
    });

    controller = new DragController(mockHost, mockCallbacks);
  });

  describe('initialization', () => {
    it('should register with host', () => {
      expect(mockHost.addController).toHaveBeenCalledWith(controller);
    });

    it('should initialize Sortable instance on container', () => {
      controller.initialize(mockContainer);
      expect(controller.getInstance()).not.toBeNull();
      expect(controller.isInitialized()).toBe(true);
    });

    it('should not reinitialize on same container', () => {
      controller.initialize(mockContainer);
      const firstInstance = controller.getInstance();

      controller.initialize(mockContainer);
      const secondInstance = controller.getInstance();

      // Should be the same instance (not reinitialized)
      expect(firstInstance).toBe(secondInstance);
    });

    it('should reinitialize on different container', () => {
      controller.initialize(mockContainer);
      const firstInstance = controller.getInstance();

      const newContainer = document.createElement('div');
      controller.initialize(newContainer);
      const secondInstance = controller.getInstance();

      expect(firstInstance).not.toBe(secondInstance);
    });
  });

  describe('cleanup', () => {
    it('should destroy Sortable instance on disconnect', () => {
      controller.initialize(mockContainer);
      expect(controller.getInstance()).not.toBeNull();

      controller.hostDisconnected();
      expect(controller.getInstance()).toBeNull();
      expect(controller.isInitialized()).toBe(false);
    });

    it('should handle destroy when no instance exists', () => {
      expect(() => controller.destroy()).not.toThrow();
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(controller.isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      controller.initialize(mockContainer);
      expect(controller.isInitialized()).toBe(true);
    });

    it('should return false after destroy', () => {
      controller.initialize(mockContainer);
      controller.destroy();
      expect(controller.isInitialized()).toBe(false);
    });
  });
});
