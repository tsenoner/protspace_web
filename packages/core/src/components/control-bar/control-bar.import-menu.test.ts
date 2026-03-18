/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import './control-bar';
import '../data-loader/data-loader';

describe('control-bar import menu', () => {
  let controlBar: HTMLElement & {
    autoSync?: boolean;
    currentDatasetName?: string;
    currentDatasetIsDemo?: boolean;
    updateComplete?: Promise<unknown>;
  };

  beforeEach(async () => {
    document.body.innerHTML = '';
    controlBar = document.createElement('protspace-control-bar') as HTMLElement & {
      autoSync?: boolean;
      currentDatasetName?: string;
      currentDatasetIsDemo?: boolean;
      updateComplete?: Promise<unknown>;
    };
    controlBar.autoSync = false;
    document.body.appendChild(controlBar);
    await controlBar.updateComplete;
  });

  it('opens the import flyout from the import trigger', async () => {
    const trigger = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import"] .dropdown-trigger',
    ) as HTMLButtonElement | null;

    trigger?.click();
    await controlBar.updateComplete;

    const importMenu = controlBar.shadowRoot?.querySelector('.import-menu');
    expect(importMenu).not.toBeNull();
  });

  it('dispatches load-demo-dataset when the demo action is clicked', async () => {
    const eventHandler = vi.fn();
    controlBar.addEventListener('load-demo-dataset', eventHandler);

    const trigger = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import"] .dropdown-trigger',
    ) as HTMLButtonElement | null;
    trigger?.click();
    await controlBar.updateComplete;

    const demoButton = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import-demo-dataset"]',
    ) as HTMLButtonElement | null;
    demoButton?.click();
    await controlBar.updateComplete;

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(controlBar.shadowRoot?.querySelector('.import-menu')).toBeNull();
  });

  it('shows the current dataset name in the import flyout', async () => {
    controlBar.currentDatasetName = '5K.parquetbundle';
    await controlBar.updateComplete;

    const trigger = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import"] .dropdown-trigger',
    ) as HTMLButtonElement | null;
    trigger?.click();
    await controlBar.updateComplete;

    const datasetName = controlBar.shadowRoot?.querySelector('.import-current-dataset-name');
    expect(datasetName?.textContent?.trim()).toBe('5K.parquetbundle');
  });

  it('disables the demo action when the demo dataset is already loaded', async () => {
    const eventHandler = vi.fn();
    controlBar.addEventListener('load-demo-dataset', eventHandler);
    controlBar.currentDatasetIsDemo = true;
    await controlBar.updateComplete;

    const trigger = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import"] .dropdown-trigger',
    ) as HTMLButtonElement | null;
    trigger?.click();
    await controlBar.updateComplete;

    const demoButton = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import-demo-dataset"]',
    ) as HTMLButtonElement | null;
    expect(demoButton?.disabled).toBe(true);

    demoButton?.click();
    await controlBar.updateComplete;

    expect(eventHandler).not.toHaveBeenCalled();
  });

  it('uses the data-loader file input for the custom dataset action', async () => {
    const dataLoader = document.createElement('protspace-data-loader');
    document.body.appendChild(dataLoader);
    await (dataLoader as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;

    const fileInput = dataLoader.shadowRoot?.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    const clickSpy = vi.spyOn(fileInput!, 'click');

    const trigger = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import"] .dropdown-trigger',
    ) as HTMLButtonElement | null;
    trigger?.click();
    await controlBar.updateComplete;

    const ownDatasetButton = controlBar.shadowRoot?.querySelector(
      '[data-driver-id="import-own-dataset"]',
    ) as HTMLButtonElement | null;
    ownDatasetButton?.click();
    await controlBar.updateComplete;

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(controlBar.shadowRoot?.querySelector('.import-menu')).toBeNull();
  });
});
