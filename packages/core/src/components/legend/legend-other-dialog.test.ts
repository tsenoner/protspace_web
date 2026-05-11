/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'lit';
import { renderOtherDialog } from './legend-other-dialog';
import type { OtherItem } from './types';
import { NA_VALUE } from './config';

function renderToContainer(otherItems: OtherItem[], overrides = {}) {
  const callbacks = {
    onExtract: vi.fn(),
    onExtractAll: vi.fn(),
    onClose: vi.fn(),
    onOverlayMouseDown: vi.fn(),
    onOverlayMouseUp: vi.fn(),
    ...overrides,
  };
  const container = document.createElement('div');
  render(renderOtherDialog({ otherItems }, callbacks), container);
  return { container, callbacks };
}

describe('renderOtherDialog', () => {
  const sampleItems: OtherItem[] = [
    { value: 'cat1', count: 5 },
    { value: 'cat2', count: 3 },
    { value: NA_VALUE, count: 2 },
  ];

  describe('extract-all button', () => {
    it('uses btn-danger class, not btn-primary', () => {
      const { container } = renderToContainer(sampleItems);
      const btn = container.querySelector('.extract-all-button')!;
      expect(btn.classList.contains('btn-danger')).toBe(true);
      expect(btn.classList.contains('btn-primary')).toBe(false);
    });

    it('is disabled when otherItems is empty', () => {
      const { container } = renderToContainer([]);
      const btn = container.querySelector('.extract-all-button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('is enabled when otherItems is non-empty', () => {
      const { container } = renderToContainer(sampleItems);
      const btn = container.querySelector('.extract-all-button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('calls onExtractAll when clicked', () => {
      const { container, callbacks } = renderToContainer(sampleItems);
      const btn = container.querySelector('.extract-all-button') as HTMLButtonElement;
      btn.click();
      expect(callbacks.onExtractAll).toHaveBeenCalledOnce();
    });
  });

  describe('individual extract buttons', () => {
    it('renders one extract button per item', () => {
      const { container } = renderToContainer(sampleItems);
      const buttons = container.querySelectorAll('.extract-button');
      expect(buttons.length).toBe(3);
    });

    it('calls onExtract with the correct value', () => {
      const { container, callbacks } = renderToContainer(sampleItems);
      const buttons = container.querySelectorAll(
        '.extract-button',
      ) as NodeListOf<HTMLButtonElement>;
      buttons[1].click();
      expect(callbacks.onExtract).toHaveBeenCalledWith('cat2');
    });
  });

  describe('close button', () => {
    it('calls onClose when clicked', () => {
      const { container, callbacks } = renderToContainer(sampleItems);
      const btn = container.querySelector('.close-button') as HTMLButtonElement;
      btn.click();
      expect(callbacks.onClose).toHaveBeenCalledOnce();
    });
  });

  describe('overlay interactions', () => {
    it('calls onOverlayMouseDown on overlay mousedown', () => {
      const { container, callbacks } = renderToContainer(sampleItems);
      const overlay = container.querySelector('.modal-overlay')!;
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(callbacks.onOverlayMouseDown).toHaveBeenCalledOnce();
    });

    it('calls onOverlayMouseUp on overlay mouseup', () => {
      const { container, callbacks } = renderToContainer(sampleItems);
      const overlay = container.querySelector('.modal-overlay')!;
      overlay.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(callbacks.onOverlayMouseUp).toHaveBeenCalledOnce();
    });
  });

  describe('item display', () => {
    it('displays item names and counts', () => {
      const { container } = renderToContainer(sampleItems);
      const items = container.querySelectorAll('.other-item');
      expect(items.length).toBe(3);

      const firstName = items[0].querySelector('.other-item-name')!.textContent;
      const firstCount = items[0].querySelector('.other-item-count')!.textContent;
      expect(firstName).toBe('cat1');
      expect(firstCount).toBe('(5)');
    });

    it('displays N/A for __NA__ values', () => {
      const { container } = renderToContainer(sampleItems);
      const items = container.querySelectorAll('.other-item');
      const naName = items[2].querySelector('.other-item-name')!.textContent;
      expect(naName).toBe('N/A');
    });
  });
});
