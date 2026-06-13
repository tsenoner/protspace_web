import { afterEach, describe, expect, it, vi } from 'vitest';

const mockedToast = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../components/ui/sonner', () => ({
  toast: mockedToast,
}));

import { notify, resetNotifyStateForTests } from './notify';

describe('notify', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetNotifyStateForTests();
  });

  it('forwards success notifications with the default duration', () => {
    notify.success({ title: 'Export ready.' });

    expect(mockedToast.success).toHaveBeenCalledWith('Export ready.', {
      description: undefined,
      duration: 4_000,
    });
  });

  it('dedupes repeated warning notifications when the same dedupe key is reused', () => {
    notify.warning({
      title: 'Selection mode disabled.',
      dedupeKey: 'selection-disabled',
    });
    notify.warning({
      title: 'Selection mode disabled.',
      dedupeKey: 'selection-disabled',
    });

    expect(mockedToast.warning).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe notifications when no dedupe key is provided', () => {
    notify.error({ title: 'Export failed.' });
    notify.error({ title: 'Export failed.' });

    expect(mockedToast.error).toHaveBeenCalledTimes(2);
  });

  it('forwards an action to the toast as a label and onClick handler', () => {
    notify.error({
      title: 'Service down.',
      action: { label: 'Open in Colab ↗', href: 'https://colab.example.com/nb' },
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      'Service down.',
      expect.objectContaining({
        action: { label: 'Open in Colab ↗', onClick: expect.any(Function) },
      }),
    );
  });

  it('omits the action when none is provided', () => {
    notify.info({ title: 'Heads up.' });

    expect(mockedToast.info).toHaveBeenCalledWith(
      'Heads up.',
      expect.objectContaining({ action: undefined }),
    );
  });
});
