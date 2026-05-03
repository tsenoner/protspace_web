/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import './publish-modal';
import type { ProtspacePublishModal } from './publish-modal';

interface PublishInternals {
  _state: {
    widthPx: number;
    heightPx: number;
    dpi: number;
    resample: boolean;
    aspectLocked: boolean;
    unit: 'px' | 'mm' | 'in' | 'cm';
    preset: string;
  };
  _legendItems: Array<{ value: string }>;
  _legendTitle: string;
}

function makeModal(): ProtspacePublishModal {
  const modal = document.createElement('protspace-publish-modal') as ProtspacePublishModal;
  document.body.appendChild(modal);
  return modal;
}

describe('<protspace-publish-modal> legend reader', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads legend state from legendElement property when provided', async () => {
    const legend = document.createElement('div') as unknown as HTMLElement & {
      getLegendExportData: () => unknown;
    };
    legend.getLegendExportData = () => ({
      annotation: 'family',
      includeShapes: true,
      otherItemsCount: 0,
      items: [{ value: 'A', color: '#fff', shape: 'circle', count: 1, isVisible: true }],
    });

    const modal = makeModal();
    (modal as unknown as { legendElement: HTMLElement }).legendElement = legend;
    await modal.updateComplete;

    const internals = modal as unknown as PublishInternals;
    expect(internals._legendTitle).toBe('family');
    expect(internals._legendItems).toHaveLength(1);
  });
});

describe('<protspace-publish-modal> dimensions section', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders width input in mm by default', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const widthInput = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="width"]',
    );
    expect(widthInput).not.toBeNull();
    // Default state is flexible, 2048 px @ 300 dpi → 173.4 mm
    expect(parseFloat(widthInput!.value)).toBeCloseTo(173.4, 0);
  });

  it('typing width-mm with Resample=ON updates widthPx', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;
    const widthInput = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="width"]',
    )!;
    widthInput.value = '89';
    widthInput.dispatchEvent(new Event('change'));
    await modal.updateComplete;
    // 89 mm @ 300 dpi = 1051 px
    expect(internals._state.widthPx).toBe(1051);
    expect(internals._state.resample).toBe(true);
  });

  it('toggling Resample=OFF then changing DPI does not change widthPx', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;
    const initialPx = internals._state.widthPx;

    const resampleCb = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="resample"]',
    )!;
    resampleCb.checked = false;
    resampleCb.dispatchEvent(new Event('change'));
    await modal.updateComplete;

    const dpiInput = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="dpi"]',
    )!;
    dpiInput.value = '600';
    dpiInput.dispatchEvent(new Event('change'));
    await modal.updateComplete;

    expect(internals._state.widthPx).toBe(initialPx);
    expect(internals._state.dpi).toBe(600);
  });

  it('clicking the chain-link icon toggles aspectLocked', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;
    expect(internals._state.aspectLocked).toBe(true);
    const chainBtn = modal.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-publish-input="aspect-lock"]',
    )!;
    chainBtn.click();
    await modal.updateComplete;
    expect(internals._state.aspectLocked).toBe(false);
  });

  it('clicking a preset while Resample=OFF flips Resample=ON', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;

    // Turn Resample off first.
    const resampleCb = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="resample"]',
    )!;
    resampleCb.checked = false;
    resampleCb.dispatchEvent(new Event('change'));
    await modal.updateComplete;
    expect(internals._state.resample).toBe(false);

    // Click Nature 1 col preset.
    const presetBtns = modal.shadowRoot!.querySelectorAll<HTMLButtonElement>('.publish-preset-btn');
    const nature1 = Array.from(presetBtns).find((b) => /Nature.*1 col/i.test(b.textContent ?? ''));
    expect(nature1).not.toBeUndefined();
    nature1!.click();
    await modal.updateComplete;

    expect(internals._state.resample).toBe(true);
    expect(internals._state.preset).toBe('nature-1col');
  });
});
