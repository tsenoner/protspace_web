import { describe, expect, it } from 'vitest';
import type {
  DataErrorEventDetail,
  LegendErrorEventDetail,
  SelectionDisabledNotificationDetail,
  StructureErrorEventDetail,
} from '@protspace/core';
import {
  getCorruptedPersistedDatasetNotification,
  getDataLoadFailureNotification,
  getDatasetPersistenceFailureNotification,
  getExportFailureNotification,
  getLegendErrorNotification,
  getSelectionDisabledNotification,
  getStructureErrorNotification,
} from './demo-notifications';

describe('demo notifications', () => {
  it('classifies OPFS SecurityError failures with private browsing guidance', () => {
    const notification = getDatasetPersistenceFailureNotification(
      new DOMException('Security error when calling GetDirectory', 'SecurityError'),
    );

    expect(notification.title).toBe('Dataset loaded, but automatic reload is unavailable.');
    expect(notification.description).toMatch(/private\/incognito mode/i);
    expect(notification.description).toMatch(/browser storage is restricted/i);
  });

  it('classifies unsupported OPFS failures separately', () => {
    const notification = getDatasetPersistenceFailureNotification(
      new Error('Origin Private File System is not supported in this browser.'),
    );

    expect(notification.description).toMatch(/does not support the Origin Private File System/i);
  });

  it('maps normalized selection-disabled events to a warning notification', () => {
    const detail: SelectionDisabledNotificationDetail = {
      message: 'Selection mode disabled: Only 1 point remaining',
      severity: 'warning',
      source: 'control-bar',
      context: {
        reason: 'insufficient-data',
        dataSize: 1,
      },
    };

    expect(getSelectionDisabledNotification(detail)).toMatchObject({
      title: 'Selection mode disabled.',
      description: 'Selection mode disabled: Only 1 point remaining',
    });
  });

  it('maps normalized data errors to a dataset import failure notification', () => {
    const detail: DataErrorEventDetail = {
      message: 'Invalid parquet bundle',
      severity: 'error',
      source: 'data-loader',
      context: {
        operation: 'load',
      },
      originalError: new Error('Invalid parquet bundle'),
    };

    expect(getDataLoadFailureNotification(detail)).toMatchObject({
      title: 'Dataset import failed.',
      description: 'Invalid parquet bundle',
    });
  });

  it('maps legend and structure errors to host notifications', () => {
    const legendDetail: LegendErrorEventDetail = {
      message: 'Failed to process legend data',
      severity: 'error',
      source: 'data-processing',
      context: {
        annotation: 'phylum',
      },
    };
    const structureDetail: StructureErrorEventDetail = {
      message: 'No 3D structure was found for P12345.',
      severity: 'error',
      source: 'structure-viewer',
      context: {
        proteinId: 'P12345',
      },
    };

    expect(getLegendErrorNotification(legendDetail).title).toBe('Legend update failed.');
    expect(getStructureErrorNotification(structureDetail).title).toBe(
      'Structure could not be loaded.',
    );
  });

  it('builds clear recovery copy for corrupted persisted datasets and export failures', () => {
    expect(getCorruptedPersistedDatasetNotification('could not be loaded').description).toMatch(
      /loaded the default demo dataset/i,
    );
    expect(getExportFailureNotification(new Error('Disk full'))).toMatchObject({
      title: 'Export failed.',
      description: 'Disk full',
    });
  });
});
