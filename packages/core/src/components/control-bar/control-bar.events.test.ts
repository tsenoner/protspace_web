import { describe, expect, it } from 'vitest';
import { createSelectionDisabledNotificationDetail } from './control-bar.events';

describe('control-bar events', () => {
  it('builds normalized selection-disabled notifications', () => {
    expect(createSelectionDisabledNotificationDetail('insufficient-data', 1)).toEqual({
      message: 'Selection mode disabled: Only 1 point remaining',
      severity: 'warning',
      source: 'control-bar',
      context: {
        reason: 'insufficient-data',
        dataSize: 1,
      },
    });
  });
});
